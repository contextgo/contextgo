from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any, Optional

from fastapi import WebSocket


@dataclass
class RemoteRelayPresence:
    connected: bool
    connected_at: Optional[str]
    client_connected: bool
    client_connected_at: Optional[str]
    transport: str = "cloud-relay"
    browser_entry_url: Optional[str] = None
    browser_entry_ready: bool = False
    browser_entry_reason: Optional[str] = None


@dataclass
class RemoteHttpRelayResponse:
    status_code: int
    headers: dict[str, str]
    body: bytes
    set_cookies: list[str]


@dataclass
class DeviceRelayConnection:
    user_id: str
    device_id: str
    websocket: WebSocket
    connected_at: str
    browser_entry_url: Optional[str] = None
    browser_entry_ready: bool = False
    browser_entry_reason: Optional[str] = None


@dataclass
class ClientRelayConnection:
    user_id: str
    device_id: str
    websocket: WebSocket
    connected_at: str


@dataclass
class ViteRelayClientConnection:
    user_id: str
    device_id: str
    socket_id: str
    websocket: WebSocket
    connected_at: str


class RemoteRelayHub:
    """
    Process-local relay registry for the hosted Official Remote MVP.

    This intentionally keeps relay state in-memory so the desktop app can
    maintain one authenticated long-lived outbound connection to ContextGo
    Cloud, and browser clients can attach to that live desktop session
    through the managed cloud relay. Horizontal fan-out can be added later with a
    shared broker once the protocol is stable.
    """

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._devices: dict[str, DeviceRelayConnection] = {}
        self._clients: dict[str, ClientRelayConnection] = {}
        self._vite_clients: dict[str, ViteRelayClientConnection] = {}
        self._pending_http: dict[str, tuple[str, asyncio.Future[RemoteHttpRelayResponse]]] = {}

    async def register_device(
        self,
        *,
        user_id: str,
        device_id: str,
        websocket: WebSocket,
        connected_at: str,
        browser_entry_url: Optional[str] = None,
        browser_entry_ready: bool = False,
        browser_entry_reason: Optional[str] = None,
    ) -> None:
        existing_device: DeviceRelayConnection | None = None
        existing_client: ClientRelayConnection | None = None
        async with self._lock:
            existing_device = self._devices.get(device_id)
            self._devices[device_id] = DeviceRelayConnection(
                user_id=user_id,
                device_id=device_id,
                websocket=websocket,
                connected_at=connected_at,
                browser_entry_url=browser_entry_url,
                browser_entry_ready=browser_entry_ready,
                browser_entry_reason=browser_entry_reason,
            )
            existing_client = self._clients.get(device_id)

        if existing_device and existing_device.websocket is not websocket:
            await self._close_socket(existing_device.websocket, code=1012, reason="Device connection replaced")

        if existing_client:
            await self._send_json(
                websocket,
                {
                    "type": "client_status",
                    "connected": True,
                    "connectedAt": existing_client.connected_at,
                },
            )

    async def update_device_browser_entry(
        self,
        device_id: str,
        websocket: WebSocket,
        *,
        browser_entry_url: Optional[str],
        browser_entry_ready: bool,
        browser_entry_reason: Optional[str],
    ) -> None:
        async with self._lock:
            current = self._devices.get(device_id)
            if current is None or current.websocket is not websocket:
                return

            current.browser_entry_url = browser_entry_url
            current.browser_entry_ready = browser_entry_ready
            current.browser_entry_reason = browser_entry_reason

    async def unregister_device(self, device_id: str, websocket: WebSocket) -> None:
        client_to_close: ClientRelayConnection | None = None
        vite_clients_to_close: list[ViteRelayClientConnection] = []
        pending_http: list[asyncio.Future[RemoteHttpRelayResponse]] = []
        async with self._lock:
            current = self._devices.get(device_id)
            if current and current.websocket is websocket:
                del self._devices[device_id]
                client_to_close = self._clients.pop(device_id, None)
                vite_keys = [socket_id for socket_id, client in self._vite_clients.items() if client.device_id == device_id]
                vite_clients_to_close = [self._vite_clients.pop(socket_id) for socket_id in vite_keys]
                pending_ids = [request_id for request_id, (pending_device_id, _future) in self._pending_http.items() if pending_device_id == device_id]
                pending_http = [self._pending_http.pop(request_id)[1] for request_id in pending_ids]

        if client_to_close:
            await self._close_socket(client_to_close.websocket, code=1012, reason="Remote device disconnected")

        for vite_client in vite_clients_to_close:
            await self._close_socket(vite_client.websocket, code=1012, reason="Remote device disconnected")

        for future in pending_http:
            if not future.done():
                future.set_exception(RuntimeError("Remote device disconnected"))

    async def register_client(
        self,
        *,
        user_id: str,
        device_id: str,
        websocket: WebSocket,
        connected_at: str,
    ) -> bool:
        existing_client: ClientRelayConnection | None = None
        device_socket: WebSocket | None = None
        async with self._lock:
            device = self._devices.get(device_id)
            if device is None or device.user_id != user_id:
                return False

            existing_client = self._clients.get(device_id)
            self._clients[device_id] = ClientRelayConnection(
                user_id=user_id,
                device_id=device_id,
                websocket=websocket,
                connected_at=connected_at,
            )
            device_socket = device.websocket

        if existing_client and existing_client.websocket is not websocket:
            await self._close_socket(existing_client.websocket, code=1012, reason="Remote session replaced")

        if device_socket:
            await self._send_json(
                device_socket,
                {
                    "type": "client_status",
                    "connected": True,
                    "connectedAt": connected_at,
                },
            )

        return True

    async def unregister_client(self, device_id: str, websocket: WebSocket) -> None:
        device_socket: WebSocket | None = None
        async with self._lock:
            current = self._clients.get(device_id)
            if current and current.websocket is websocket:
                del self._clients[device_id]
                device = self._devices.get(device_id)
                device_socket = device.websocket if device else None

        if device_socket:
            await self._send_json(
                device_socket,
                {
                    "type": "client_status",
                    "connected": False,
                },
            )

    async def register_vite_client(
        self,
        *,
        user_id: str,
        device_id: str,
        socket_id: str,
        websocket: WebSocket,
        connected_at: str,
    ) -> bool:
        existing_client: ViteRelayClientConnection | None = None
        async with self._lock:
            device = self._devices.get(device_id)
            if device is None or device.user_id != user_id:
                return False

            existing_client = self._vite_clients.get(socket_id)
            self._vite_clients[socket_id] = ViteRelayClientConnection(
                user_id=user_id,
                device_id=device_id,
                socket_id=socket_id,
                websocket=websocket,
                connected_at=connected_at,
            )

        if existing_client and existing_client.websocket is not websocket:
            await self._close_socket(existing_client.websocket, code=1012, reason="Remote Vite session replaced")

        return True

    async def unregister_vite_client(self, socket_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            current = self._vite_clients.get(socket_id)
            if current and current.websocket is websocket:
                del self._vite_clients[socket_id]

    async def forward_bridge_to_client(self, device_id: str, payload: dict[str, Any]) -> bool:
        async with self._lock:
            client = self._clients.get(device_id)

        if client is None:
            return False

        return await self._send_json(client.websocket, payload)

    async def forward_bridge_to_device(self, device_id: str, payload: dict[str, Any]) -> bool:
        async with self._lock:
            device = self._devices.get(device_id)

        if device is None:
            return False

        return await self._send_json(
            device.websocket,
            {
                "type": "bridge",
                "payload": payload,
            },
        )

    async def begin_http_request(
        self,
        *,
        user_id: str,
        device_id: str,
        request_id: str,
        payload: dict[str, Any],
        timeout: float = 30.0,
    ) -> Optional[RemoteHttpRelayResponse]:
        loop = asyncio.get_running_loop()
        future: asyncio.Future[RemoteHttpRelayResponse] = loop.create_future()
        device_socket: WebSocket | None = None
        async with self._lock:
            device = self._devices.get(device_id)
            if device is None or device.user_id != user_id:
                return None

            self._pending_http[request_id] = (device_id, future)
            device_socket = device.websocket

        sent = await self._send_json(device_socket, payload)
        if not sent:
            async with self._lock:
                self._pending_http.pop(request_id, None)
            return None

        try:
            return await asyncio.wait_for(future, timeout=timeout)
        finally:
            async with self._lock:
                current = self._pending_http.get(request_id)
                if current and current[1] is future:
                    self._pending_http.pop(request_id, None)

    async def resolve_http_response(
        self,
        *,
        device_id: str,
        request_id: str,
        response: RemoteHttpRelayResponse,
    ) -> bool:
        future: asyncio.Future[RemoteHttpRelayResponse] | None = None
        async with self._lock:
            current = self._pending_http.get(request_id)
            if current is None:
                return False

            pending_device_id, pending_future = current
            if pending_device_id != device_id:
                return False

            future = pending_future
            self._pending_http.pop(request_id, None)

        if not future.done():
            future.set_result(response)
        return True

    async def reject_http_response(self, *, device_id: str, request_id: str, message: str) -> bool:
        future: asyncio.Future[RemoteHttpRelayResponse] | None = None
        async with self._lock:
            current = self._pending_http.get(request_id)
            if current is None:
                return False

            pending_device_id, pending_future = current
            if pending_device_id != device_id:
                return False

            future = pending_future
            self._pending_http.pop(request_id, None)

        if not future.done():
            future.set_exception(RuntimeError(message))
        return True

    async def forward_vite_to_device(self, device_id: str, payload: dict[str, Any]) -> bool:
        async with self._lock:
            device = self._devices.get(device_id)

        if device is None:
            return False

        return await self._send_json(device.websocket, payload)

    async def send_vite_client_text(self, socket_id: str, data: str) -> bool:
        async with self._lock:
            client = self._vite_clients.get(socket_id)

        if client is None:
            return False

        return await self._send_text(client.websocket, data)

    async def disconnect_vite_client(self, socket_id: str, *, code: int, reason: str) -> bool:
        async with self._lock:
            client = self._vite_clients.get(socket_id)

        if client is None:
            return False

        await self._close_socket(client.websocket, code=code, reason=reason)
        return True

    def get_presence(self, device_id: str) -> RemoteRelayPresence:
        device = self._devices.get(device_id)
        client = self._clients.get(device_id)
        return RemoteRelayPresence(
            connected=device is not None,
            connected_at=device.connected_at if device else None,
            client_connected=client is not None,
            client_connected_at=client.connected_at if client else None,
            browser_entry_url=device.browser_entry_url if device else None,
            browser_entry_ready=device.browser_entry_ready if device else False,
            browser_entry_reason=device.browser_entry_reason if device else None,
        )

    async def _send_json(self, websocket: WebSocket, payload: dict[str, Any]) -> bool:
        try:
            await websocket.send_json(payload)
            return True
        except Exception:
            return False

    async def _send_text(self, websocket: WebSocket, data: str) -> bool:
        try:
            await websocket.send_text(data)
            return True
        except Exception:
            return False

    async def _close_socket(self, websocket: WebSocket, *, code: int, reason: str) -> None:
        try:
            await websocket.close(code=code, reason=reason)
        except Exception:
            pass
