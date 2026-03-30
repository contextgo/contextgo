from __future__ import annotations

from hashlib import sha256
from typing import Any, Optional

import httpx

from .config import Settings
from .db import User

DEFAULT_PROVIDER_ID = "infermesh-cloud-managed"
DEFAULT_TOKEN_NAME = "ContextGo Auto Connect"
NEW_API_USER_HEADER = "New-Api-User"
SERVICE_TOKEN_ID_HEADER = "CF-Access-Client-Id"
SERVICE_TOKEN_SECRET_HEADER = "CF-Access-Client-Secret"
USER_AGENT = "ContextGo Cloud"


class InfermeshProvisionError(RuntimeError):
    """Raised when InferMesh provisioning cannot complete safely."""


def is_infermesh_configured(settings: Settings) -> bool:
    required_values = (
        settings.infermesh_api_base_url,
        settings.infermesh_console_base_url,
        settings.infermesh_admin_base_url,
        settings.infermesh_admin_username,
        settings.infermesh_admin_password,
        settings.infermesh_password_secret,
    )
    return all(required_values)


def _normalize_base_url(raw_url: Optional[str]) -> str:
    if not raw_url:
        raise InfermeshProvisionError("InferMesh base URL is not configured")
    return raw_url.rstrip("/")


def build_infermesh_username(settings: Settings, user: User) -> str:
    prefix = (settings.infermesh_username_prefix or "cg").strip().lower()
    safe_prefix = "".join(char for char in prefix if char.isalnum())[:4] or "cg"
    digest = sha256(user.id.encode("utf-8")).hexdigest()
    return f"{safe_prefix}{digest[:16]}"[:20]


def build_infermesh_password(settings: Settings, user: User) -> str:
    secret = settings.infermesh_password_secret
    if not secret:
        raise InfermeshProvisionError("InferMesh password secret is not configured")
    digest = sha256(f"{secret}:{user.id}".encode("utf-8")).hexdigest()
    return f"Cg{digest[:18]}"


def build_infermesh_display_name(user: User) -> str:
    candidate = (user.display_name or user.username or user.email.split("@")[0] or "ContextGo").strip()
    return candidate[:20] or "ContextGo"


def detect_model_protocol(model_name: str) -> str:
    normalized = model_name.strip().lower()
    if normalized.startswith("claude") or normalized.startswith("anthropic"):
        return "anthropic"
    if normalized.startswith("gemini") or normalized.startswith("models/gemini"):
        return "gemini"
    return "openai"


def _build_admin_headers(settings: Settings) -> dict[str, str]:
    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    client_id = settings.infermesh_admin_access_client_id
    client_secret = settings.infermesh_admin_access_client_secret
    if client_id and client_secret:
        headers[SERVICE_TOKEN_ID_HEADER] = client_id
        headers[SERVICE_TOKEN_SECRET_HEADER] = client_secret
    return headers


def _build_user_headers(user_id: int) -> dict[str, str]:
    return {
        "Accept": "application/json",
        NEW_API_USER_HEADER: str(user_id),
        "User-Agent": USER_AGENT,
    }


async def _parse_newapi_response(response: httpx.Response) -> Any:
    try:
        payload = response.json()
    except ValueError as error:
        raise InfermeshProvisionError(f"InferMesh returned non-JSON response ({response.status_code})") from error

    if not isinstance(payload, dict):
        raise InfermeshProvisionError(f"InferMesh returned unexpected response shape ({response.status_code})")

    if not response.is_success or payload.get("success") is not True:
        message = str(payload.get("message") or response.text or f"HTTP {response.status_code}")
        raise InfermeshProvisionError(message)

    return payload.get("data")


async def _bootstrap_admin_access(client: httpx.AsyncClient, settings: Settings) -> None:
    admin_base_url = _normalize_base_url(settings.infermesh_admin_base_url)
    client_id = settings.infermesh_admin_access_client_id
    client_secret = settings.infermesh_admin_access_client_secret
    if not client_id or not client_secret:
        return

    response = await client.get(
        f"{admin_base_url}/",
        headers={
            SERVICE_TOKEN_ID_HEADER: client_id,
            SERVICE_TOKEN_SECRET_HEADER: client_secret,
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
    )
    response.raise_for_status()


async def _login_user(
    client: httpx.AsyncClient,
    *,
    base_url: str,
    username: str,
    password: str,
    extra_headers: Optional[dict[str, str]] = None,
    allow_invalid_credentials: bool = False,
) -> Optional[dict[str, Any]]:
    response = await client.post(
        f"{base_url}/api/user/login",
        json={"username": username, "password": password},
        headers={"Accept": "application/json", "User-Agent": USER_AGENT, **(extra_headers or {})},
    )

    try:
        payload = response.json()
    except ValueError as error:
        raise InfermeshProvisionError(f"InferMesh login returned non-JSON response ({response.status_code})") from error

    if response.is_success and payload.get("success") is True and isinstance(payload.get("data"), dict):
        data = payload["data"]
        user_id = data.get("id")
        if isinstance(user_id, int):
            return data
        raise InfermeshProvisionError("InferMesh login response missing user ID")

    message = str(payload.get("message") or response.text or f"HTTP {response.status_code}")
    if allow_invalid_credentials and "用户名或密码错误" in message:
        return None
    raise InfermeshProvisionError(message)


async def _ensure_user_exists(
    client: httpx.AsyncClient,
    settings: Settings,
    *,
    username: str,
    password: str,
    display_name: str,
) -> None:
    admin_base_url = _normalize_base_url(settings.infermesh_admin_base_url)
    admin_headers = _build_admin_headers(settings)
    admin_login = await _login_user(
        client,
        base_url=admin_base_url,
        username=settings.infermesh_admin_username or "",
        password=settings.infermesh_admin_password or "",
        extra_headers=admin_headers,
    )
    admin_user_id = admin_login["id"]

    response = await client.post(
        f"{admin_base_url}/api/user/",
        json={
            "username": username,
            "password": password,
            "display_name": display_name,
            "role": 1,
        },
        headers={**admin_headers, **_build_user_headers(admin_user_id)},
    )

    try:
        payload = response.json()
    except ValueError as error:
        raise InfermeshProvisionError("InferMesh create-user response was not JSON") from error

    if response.is_success and payload.get("success") is True:
        return

    message = str(payload.get("message") or response.text or f"HTTP {response.status_code}")
    if "用户已存在" in message:
        return
    raise InfermeshProvisionError(message)


async def _list_tokens(client: httpx.AsyncClient, base_url: str, user_id: int) -> list[dict[str, Any]]:
    response = await client.get(
        f"{base_url}/api/token/search",
        params={"keyword": DEFAULT_TOKEN_NAME, "size": 100, "page_size": 100, "p": 1},
        headers=_build_user_headers(user_id),
    )
    data = await _parse_newapi_response(response)
    if not isinstance(data, dict):
        return []
    items = data.get("items")
    if not isinstance(items, list):
        return []
    return [item for item in items if isinstance(item, dict)]


async def _create_token(client: httpx.AsyncClient, base_url: str, user_id: int) -> None:
    response = await client.post(
        f"{base_url}/api/token/",
        json={
            "name": DEFAULT_TOKEN_NAME,
            "expired_time": -1,
            "unlimited_quota": True,
            "remain_quota": 0,
            "model_limits_enabled": False,
            "group": "",
            "cross_group_retry": False,
        },
        headers=_build_user_headers(user_id),
    )
    await _parse_newapi_response(response)


async def _get_token_key(client: httpx.AsyncClient, base_url: str, user_id: int, token_id: int) -> str:
    response = await client.post(
        f"{base_url}/api/token/{token_id}/key",
        headers=_build_user_headers(user_id),
    )
    data = await _parse_newapi_response(response)
    if not isinstance(data, dict):
        raise InfermeshProvisionError("InferMesh token-key response was invalid")
    key = data.get("key")
    if not isinstance(key, str) or not key.strip():
        raise InfermeshProvisionError("InferMesh token key is missing")
    return key.strip()


async def _ensure_token_key(client: httpx.AsyncClient, base_url: str, user_id: int) -> str:
    tokens = await _list_tokens(client, base_url, user_id)
    exact_match = next((item for item in tokens if item.get("name") == DEFAULT_TOKEN_NAME), None)
    if exact_match is None:
        await _create_token(client, base_url, user_id)
        tokens = await _list_tokens(client, base_url, user_id)
        exact_match = next((item for item in tokens if item.get("name") == DEFAULT_TOKEN_NAME), None)

    if exact_match is None:
        raise InfermeshProvisionError("InferMesh managed token was not found after creation")

    token_id = exact_match.get("id")
    if not isinstance(token_id, int):
        raise InfermeshProvisionError("InferMesh token ID is invalid")

    return await _get_token_key(client, base_url, user_id, token_id)


async def _fetch_models(api_base_url: str, api_key: str) -> list[str]:
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
            f"{api_base_url}/v1/models",
            headers={
                "Accept": "application/json",
                "Authorization": f"Bearer {api_key}",
                "User-Agent": USER_AGENT,
            },
        )
    try:
        payload = response.json()
    except ValueError as error:
        raise InfermeshProvisionError("InferMesh model list response was not JSON") from error

    if not response.is_success:
        message = str(payload.get("message") or response.text or f"HTTP {response.status_code}")
        raise InfermeshProvisionError(f"InferMesh model discovery failed: {message}")

    items = payload.get("data")
    if not isinstance(items, list):
        return []

    models: list[str] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        model_id = item.get("id")
        if isinstance(model_id, str) and model_id.strip():
            models.append(model_id.strip())

    deduped: list[str] = []
    seen: set[str] = set()
    for model_name in models:
        if model_name in seen:
            continue
        seen.add(model_name)
        deduped.append(model_name)
    return deduped


async def provision_infermesh_provider(settings: Settings, user: User) -> dict[str, Any]:
    if not is_infermesh_configured(settings):
        raise InfermeshProvisionError("InferMesh integration is not configured")

    api_base_url = _normalize_base_url(settings.infermesh_api_base_url)
    console_base_url = _normalize_base_url(settings.infermesh_console_base_url)

    username = build_infermesh_username(settings, user)
    password = build_infermesh_password(settings, user)
    display_name = build_infermesh_display_name(user)

    async with httpx.AsyncClient(timeout=15.0, follow_redirects=False) as client:
        await _bootstrap_admin_access(client, settings)

        user_login = await _login_user(
            client,
            base_url=console_base_url,
            username=username,
            password=password,
            allow_invalid_credentials=True,
        )
        if user_login is None:
            await _ensure_user_exists(
                client,
                settings,
                username=username,
                password=password,
                display_name=display_name,
            )
            user_login = await _login_user(
                client,
                base_url=console_base_url,
                username=username,
                password=password,
            )

        user_id = user_login["id"]
        token_key = await _ensure_token_key(client, console_base_url, user_id)

    models = await _fetch_models(api_base_url, token_key)
    model_protocols = {model_name: detect_model_protocol(model_name) for model_name in models}

    return {
        "id": DEFAULT_PROVIDER_ID,
        "name": settings.infermesh_provider_name,
        "platform": "new-api",
        "baseUrl": api_base_url,
        "apiKey": token_key,
        "model": models,
        "modelProtocols": model_protocols,
    }
