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


@dataclass
class DeviceRelayConnection:
    user_id: str
    device_id: str
    websocket: WebSocket
    connected_at: str


@dataclass
class ClientRelayConnection:
    user_id: str
    device_id: str
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

    async def register_device(
        self,
        *,
        user_id: str,
        device_id: str,
        websocket: WebSocket,
        connected_at: str,
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

    async def unregister_device(self, device_id: str, websocket: WebSocket) -> None:
        client_to_close: ClientRelayConnection | None = None
        async with self._lock:
            current = self._devices.get(device_id)
            if current and current.websocket is websocket:
                del self._devices[device_id]
                client_to_close = self._clients.pop(device_id, None)

        if client_to_close:
            await self._close_socket(client_to_close.websocket, code=1012, reason="Remote device disconnected")

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
            if device is None:
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

    async def forward_bridge_to_client(self, device_id: str, payload: dict[str, Any]) -> bool:
        async with self._lock:
            client = self._clients.get(device_id)

        if client is None:
            return False

        await self._send_json(client.websocket, payload)
        return True

    async def forward_bridge_to_device(self, device_id: str, payload: dict[str, Any]) -> bool:
        async with self._lock:
            device = self._devices.get(device_id)

        if device is None:
            return False

        await self._send_json(
            device.websocket,
            {
                "type": "bridge",
                "payload": payload,
            },
        )
        return True

    def get_presence(self, device_id: str) -> RemoteRelayPresence:
        device = self._devices.get(device_id)
        client = self._clients.get(device_id)
        return RemoteRelayPresence(
            connected=device is not None,
            connected_at=device.connected_at if device else None,
            client_connected=client is not None,
            client_connected_at=client.connected_at if client else None,
        )

    async def _send_json(self, websocket: WebSocket, payload: dict[str, Any]) -> None:
        try:
            await websocket.send_json(payload)
        except Exception:
            pass

    async def _close_socket(self, websocket: WebSocket, *, code: int, reason: str) -> None:
        try:
            await websocket.close(code=code, reason=reason)
        except Exception:
            pass
