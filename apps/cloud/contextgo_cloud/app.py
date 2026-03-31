from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from html import escape
import json
import os
from pathlib import Path
from typing import Any, Dict, Literal, Optional, Union
from urllib.parse import parse_qs, quote, urlencode, urlparse

from fastapi import FastAPI, HTTPException, Query, Request, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .config import Settings, load_settings
from .db import (
    Device,
    User,
    apply_sync_changes,
    allocate_username,
    cleanup_expired_rows,
    consume_desktop_login_code,
    create_device,
    create_desktop_login_code,
    consume_oauth_state,
    create_oauth_state,
    create_session,
    create_user,
    delete_session,
    find_user_by_email,
    find_user_by_oauth_account,
    get_device_for_user,
    get_user_by_device_token,
    get_user_by_session_token,
    initialize_database,
    list_devices_for_user,
    peek_oauth_state,
    pull_sync_events,
    revoke_device,
    touch_device,
    update_user_profile,
    upsert_oauth_account,
)
from .infermesh import InfermeshProvisionError, is_infermesh_configured, provision_infermesh_provider
from .oauth import OAuthProfile, build_authorization_url, exchange_code_for_profile, get_enabled_providers, is_provider_enabled
from .remote import RemoteRelayHub

ProviderId = Literal["github", "google"]


class DeviceRegisterRequest(BaseModel):
    deviceName: str = Field(min_length=1, max_length=120)
    platform: str = Field(default="unknown", min_length=1, max_length=64)


class SyncChangePayload(BaseModel):
    namespace: str = Field(min_length=1, max_length=128)
    key: str = Field(min_length=1, max_length=256)
    value: Any = None
    deleted: bool = False
    clientUpdatedAt: str = Field(min_length=1, max_length=64)


class SyncPushRequest(BaseModel):
    changes: list[SyncChangePayload]


class DesktopLoginConsumeRequest(BaseModel):
    code: str = Field(min_length=1, max_length=256)


settings: Settings = load_settings()
api_host = urlparse(settings.api_base_url).hostname or ""
remote_host = urlparse(settings.remote_base_url).hostname or ""
DESKTOP_LOGIN_COMPLETE_PATH = "/desktop-login-complete"
MOBILE_SHELL_LOGIN_COMPLETE_PATH = "/mobile-shell-login-complete"
REMOTE_DEVICES_PATH = "/remote/devices"
REMOTE_APP_PATH = "/remote/app"
REMOTE_APP_ASSETS_PATH = f"{REMOTE_APP_PATH}/assets"
REMOTE_DEVICE_PATH_PREFIX = "/device"
REMOTE_SHELL_SCHEME = "contextgo-remote"
RENDERER_BUILD_ROOT_ENV = "CONTEXTGO_RENDERER_BUILD_ROOT"


def resolve_renderer_build_root() -> Path:
    app_path = Path(__file__).resolve()
    candidates: list[Path] = []
    explicit_root = os.getenv(RENDERER_BUILD_ROOT_ENV, "").strip()
    if explicit_root:
        candidates.append(Path(explicit_root).expanduser())

    if len(app_path.parents) > 3:
        candidates.append(app_path.parents[3] / "out" / "renderer")

    candidates.append(Path.cwd() / "out" / "renderer")
    candidates.append(app_path.parents[1] / "out" / "renderer")

    resolved_candidates: list[Path] = []
    for candidate in candidates:
        resolved = candidate.resolve()
        if resolved not in resolved_candidates:
            resolved_candidates.append(resolved)

    for candidate in resolved_candidates:
        if (candidate / "index.html").is_file():
            return candidate

    return resolved_candidates[0]


RENDERER_BUILD_ROOT = resolve_renderer_build_root()
RENDERER_INDEX_PATH = RENDERER_BUILD_ROOT / "index.html"
RENDERER_ASSETS_PATH = RENDERER_BUILD_ROOT / "assets"
IOS_ASSOCIATED_APP_IDS_ENV = "CONTEXTGO_IOS_ASSOCIATED_APP_IDS"
ANDROID_APP_LINK_TARGETS_ENV = "CONTEXTGO_ANDROID_APP_LINK_TARGETS"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    initialize_database(settings)
    cleanup_expired_rows(settings)
    yield


app = FastAPI(title="ContextGo Cloud Auth Service", lifespan=lifespan)
remote_relay_hub = RemoteRelayHub()

if RENDERER_ASSETS_PATH.is_dir():
    app.mount(REMOTE_APP_ASSETS_PATH, StaticFiles(directory=str(RENDERER_ASSETS_PATH)), name="remote-app-assets")

allowed_origins = [
    "https://contextgo.io",
    "https://www.contextgo.io",
    "https://auth.contextgo.io",
    "https://api.contextgo.io",
    "https://remote.contextgo.io",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

def is_allowed_email(email: str) -> bool:
    if not settings.allowed_emails:
        return True

    return email in settings.allowed_emails


def build_cookie_domain() -> Optional[str]:
    return settings.session_cookie_domain or None


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_csv_env(name: str) -> list[str]:
    return [item.strip() for item in os.getenv(name, "").split(",") if item.strip()]


def build_current_path_with_query(request: Request) -> str:
    query = request.url.query
    return f"{request.url.path}?{query}" if query else request.url.path


def get_request_hostname(request: Request) -> str:
    return (request.headers.get("host") or "").split(":")[0].strip().lower()


def is_remote_request(request: Request) -> bool:
    return get_request_hostname(request) == remote_host


def build_remote_url(path: str) -> str:
    return f"{settings.remote_base_url}{path}"


def is_mobile_shell_request(request: Request) -> bool:
    return "contextgomobileshell/" in request.headers.get("user-agent", "").lower()


def resolve_mobile_shell_target_url(request: Request, next_path: str) -> str:
    safe_next_path = pick_next_path(next_path)
    if safe_next_path == "/":
        return build_remote_url(REMOTE_DEVICES_PATH)

    if safe_next_path.startswith("http://") or safe_next_path.startswith("https://"):
        return safe_next_path

    if safe_next_path.startswith(REMOTE_DEVICE_PATH_PREFIX) or safe_next_path.startswith("/remote/"):
        return build_remote_url(safe_next_path)

    if is_remote_request(request):
        return build_remote_url(safe_next_path)

    return f"{str(request.base_url).rstrip('/')}{safe_next_path}"


def build_mobile_shell_login_complete_url(target_url: str) -> str:
    return f"{settings.auth_base_url}{MOBILE_SHELL_LOGIN_COMPLETE_PATH}?{urlencode({'target': target_url})}"


def render_remote_app_shell() -> str:
    if not RENDERER_INDEX_PATH.is_file():
        raise FileNotFoundError(RENDERER_INDEX_PATH)

    html = RENDERER_INDEX_PATH.read_text(encoding="utf-8")
    asset_prefix = f"{REMOTE_APP_ASSETS_PATH}/"
    return (
        html.replace('href="./assets/', f'href="{asset_prefix}')
        .replace('src="./assets/', f'src="{asset_prefix}')
        .replace("href='./assets/", f"href='{asset_prefix}")
        .replace("src='./assets/", f"src='{asset_prefix}")
    )


def set_session_cookie(response: Union[RedirectResponse, JSONResponse, HTMLResponse], token: str) -> None:
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        httponly=True,
        secure=settings.auth_base_url.startswith("https://"),
        samesite="lax",
        domain=build_cookie_domain(),
        path="/",
        max_age=settings.session_ttl_seconds,
    )


def clear_session_cookie(response: Union[RedirectResponse, JSONResponse, HTMLResponse]) -> None:
    response.delete_cookie(
        key=settings.session_cookie_name,
        domain=build_cookie_domain(),
        path="/",
    )


def set_oauth_state_cookie(response: RedirectResponse, state: str) -> None:
    response.set_cookie(
        key=settings.oauth_state_cookie_name,
        value=state,
        httponly=True,
        secure=settings.auth_base_url.startswith("https://"),
        samesite="lax",
        path="/api/auth/oauth",
        max_age=settings.oauth_state_ttl_seconds,
    )


def clear_oauth_state_cookie(response: RedirectResponse) -> None:
    response.delete_cookie(
        key=settings.oauth_state_cookie_name,
        path="/api/auth/oauth",
    )


def read_current_user(request: Request) -> Optional[User]:
    return read_current_user_from_session_token(request.cookies.get(settings.session_cookie_name))


def read_current_user_from_session_token(raw_token: Optional[str]) -> Optional[User]:
    if not raw_token:
        return None

    return get_user_by_session_token(settings, raw_token)


def pick_next_path(value: Optional[str]) -> str:
    if not value:
        return "/"

    trimmed = value.strip()
    if trimmed.startswith("/") and not trimmed.startswith("//"):
        return trimmed

    parsed = urlparse(trimmed)
    hostname = (parsed.hostname or "").strip().lower()
    if parsed.scheme not in ("http", "https") or not hostname:
        return "/"

    cookie_domain = (settings.session_cookie_domain or "").lstrip(".").lower()
    allowed_hosts = {
        (urlparse(settings.auth_base_url).hostname or "").lower(),
        (urlparse(settings.api_base_url).hostname or "").lower(),
        "127.0.0.1",
        "::1",
        "localhost",
    }
    is_contextgo_host = hostname == "contextgo.io" or hostname.endswith(".contextgo.io")

    if is_contextgo_host:
        pass
    elif cookie_domain:
        if hostname != cookie_domain and not hostname.endswith(f".{cookie_domain}"):
            return "/"
    elif hostname not in allowed_hosts:
        return "/"

    if parsed.scheme != "https" and hostname not in {"127.0.0.1", "::1", "localhost"}:
        return "/"

    return trimmed


def build_logout_response(request: Request, next_value: Optional[str]) -> RedirectResponse:
    raw_token = request.cookies.get(settings.session_cookie_name)
    if raw_token:
        delete_session(settings, raw_token)

    redirect_target = pick_next_path(next_value)
    if redirect_target == "/":
        redirect_target = "/login"

    response = RedirectResponse(url=redirect_target, status_code=303)
    clear_session_cookie(response)
    return response


def build_login_url(
    *,
    error_code: Optional[str] = None,
    success: bool = False,
    cancel: bool = False,
    provider: Optional[str] = None,
    desktop: bool = False,
    next_path: Optional[str] = None,
) -> str:
    query: Dict[str, str] = {}
    if error_code:
        query["oauthError"] = error_code
    if success:
        query["success"] = "1"
    if cancel:
        query["cancel"] = "1"
    if provider:
        query["provider"] = provider
    if desktop:
        query["desktop"] = "1"
    if next_path:
        safe_next_path = pick_next_path(next_path)
        if safe_next_path != "/":
            query["next"] = safe_next_path

    return f"/login?{urlencode(query)}" if query else "/login"


def normalize_provider(value: Optional[str]) -> Optional[ProviderId]:
    if value in ("github", "google"):
        return value

    return None


def build_desktop_login_complete_url(provider: Optional[str] = None, error_code: Optional[str] = None) -> str:
    query: Dict[str, str] = {}
    if provider:
        query["provider"] = provider
    if error_code:
        query["error"] = error_code

    return f"{DESKTOP_LOGIN_COMPLETE_PATH}?{urlencode(query)}" if query else DESKTOP_LOGIN_COMPLETE_PATH


def build_desktop_login_deep_link(
    *,
    code: Optional[str] = None,
    provider: Optional[str] = None,
    error_code: Optional[str] = None,
) -> str:
    query: Dict[str, str] = {}
    if code:
        query["code"] = code
    if provider:
        query["provider"] = provider
    if error_code:
        query["error"] = error_code

    return f"contextgo://cloud-login?{urlencode(query)}" if query else "contextgo://cloud-login"


def extract_login_context(next_path: Optional[str]) -> tuple[Optional[str], bool]:
    if not next_path:
        return None, False

    parsed = urlparse(next_path)
    if parsed.path == DESKTOP_LOGIN_COMPLETE_PATH:
        query = parse_qs(parsed.query)
        return normalize_provider(query.get("provider", [None])[0]), True

    if parsed.path != "/login":
        return None, False

    query = parse_qs(parsed.query)
    return normalize_provider(query.get("provider", [None])[0]), query.get("desktop", [None])[0] == "1"


def peek_login_context(provider: str, state_value: Optional[str]) -> tuple[Optional[str], bool]:
    next_path = peek_oauth_state(settings, state_value, provider) if state_value else None
    next_provider, desktop_mode = extract_login_context(next_path)
    if next_provider:
        return next_provider, desktop_mode

    fallback_provider = provider if provider in ("github", "google") else None
    return fallback_provider, desktop_mode


def render_login_page(request: Request, user: Optional[User]) -> str:
    oauth_error = request.query_params.get("oauthError")
    success = request.query_params.get("success")
    cancel = request.query_params.get("cancel")
    selected_provider = normalize_provider(request.query_params.get("provider"))
    desktop_mode = request.query_params.get("desktop") == "1"
    next_path = pick_next_path(request.query_params.get("next"))

    provider_ids = get_enabled_providers(settings)
    if selected_provider in provider_ids:
        provider_ids = [selected_provider]

    provider_buttons = []
    for provider in provider_ids:
        label = "Continue with GitHub" if provider == "github" else "Continue with Google"
        href = f"/api/auth/oauth/{provider}/start"
        if desktop_mode:
            href = f'{href}?{urlencode({"next": build_desktop_login_complete_url(provider), "desktop": "1"})}'
        else:
            next_target = next_path
            if is_mobile_shell_request(request):
                next_target = build_mobile_shell_login_complete_url(resolve_mobile_shell_target_url(request, next_path))
            elif next_path == "/" and is_remote_request(request):
                next_target = REMOTE_DEVICES_PATH

            if next_target != "/":
                href = f'{href}?{urlencode({"next": next_target})}'
        provider_buttons.append(
            f'<a class="provider" href="{escape(href)}">{escape(label)}</a>'
        )

    if desktop_mode:
        provider_buttons.append(
            f'<a class="secondary" href="{escape(build_desktop_login_complete_url(selected_provider, "cancelled"))}">Cancel and Close</a>'
        )

    provider_markup = "\n".join(provider_buttons) or "<p>No OAuth providers are configured.</p>"
    message = ""
    if oauth_error:
        message = f'<p class="message error">Login failed: {escape(oauth_error)}</p>'
    elif success:
        message = '<p class="message success">Login succeeded.</p>'
    elif cancel:
        message = '<p class="message info">Login cancelled. You can close this window safely.</p>'

    desktop_hint = ""
    if desktop_mode:
        desktop_hint = (
            '<p class="caption intro">'
            'Continue in your browser. ContextGo will reopen automatically after sign-in.'
            '</p>'
        )

    account_markup = ""
    if user:
        avatar = ""
        if user.avatar_url:
            avatar = f'<img class="avatar" src="{escape(user.avatar_url)}" alt="{escape(user.display_name)}" />'
        account_markup = f"""
        <section class="card session">
          <div class="session-header">
            {avatar}
            <div>
              <h2>{escape(user.display_name)}</h2>
              <p>{escape(user.email)}</p>
              <p class="muted">@{escape(user.username)}</p>
            </div>
          </div>
          <form method="post" action="/api/auth/logout">
            <button class="secondary" type="submit">Sign out</button>
          </form>
        </section>
        """

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ContextGo Auth</title>
  <style>
    body {{
      margin: 0;
      font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: linear-gradient(180deg, #f4f7fb 0%, #eef3ff 100%);
      color: #0f172a;
    }}
    .wrap {{
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 32px 16px;
    }}
    .card {{
      width: min(560px, 100%);
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(15, 23, 42, 0.08);
      border-radius: 24px;
      box-shadow: 0 24px 80px rgba(15, 23, 42, 0.12);
      padding: 32px;
    }}
    h1 {{
      margin: 0 0 8px;
      font-size: 34px;
    }}
    p {{
      margin: 0;
      line-height: 1.6;
      color: #475569;
    }}
    .stack {{
      display: grid;
      gap: 14px;
      margin-top: 24px;
    }}
    .provider, button {{
      appearance: none;
      border: 0;
      border-radius: 999px;
      padding: 14px 18px;
      font-size: 15px;
      font-weight: 600;
      text-decoration: none;
      text-align: center;
      cursor: pointer;
    }}
    .provider {{
      background: #111827;
      color: white;
    }}
    .provider:hover {{
      background: #1f2937;
    }}
    .secondary {{
      background: white;
      color: #111827;
      border: 1px solid rgba(15, 23, 42, 0.12);
    }}
    .message {{
      margin-top: 18px;
      padding: 12px 14px;
      border-radius: 14px;
    }}
    .message.success {{
      background: #ecfdf5;
      color: #166534;
    }}
    .message.error {{
      background: #fef2f2;
      color: #991b1b;
    }}
    .message.info {{
      background: #eff6ff;
      color: #1d4ed8;
    }}
    .session {{
      margin-top: 20px;
    }}
    .session-header {{
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 18px;
    }}
    .avatar {{
      width: 56px;
      height: 56px;
      border-radius: 50%;
      object-fit: cover;
    }}
    .muted {{
      color: #64748b;
      font-size: 14px;
    }}
    .caption {{
      margin-top: 24px;
      font-size: 14px;
      color: #64748b;
    }}
    .intro {{
      margin-top: 16px;
    }}
    code {{
      background: rgba(15, 23, 42, 0.06);
      padding: 2px 6px;
      border-radius: 8px;
    }}
  </style>
</head>
<body>
  <div class="wrap">
    <main class="card">
      <h1>ContextGo account</h1>
      <p>Cloud-side OAuth and session service for ContextGo users.</p>
      {message}
      {desktop_hint}
      <div class="stack">
        {provider_markup}
      </div>
      {account_markup}
      <p class="caption">Session cookie domain: <code>{escape(settings.session_cookie_domain or "host-only")}</code></p>
    </main>
  </div>
</body>
</html>"""


def build_remote_session_url(device_id: str) -> str:
    return f"{REMOTE_DEVICE_PATH_PREFIX}/{quote(device_id, safe='')}"


def build_mobile_shell_open_url(target_url: str) -> str:
    return f"{REMOTE_SHELL_SCHEME}://open?{urlencode({'target': target_url})}"


def describe_remote_notice(notice: Optional[str]) -> Optional[dict[str, str]]:
    if notice == "device_not_found":
        return {
            "className": "error",
            "title": "This remote device could not be found.",
            "detail": "It may have been revoked or linked to another cloud account.",
        }

    if notice == "device_offline":
        return {
            "className": "info",
            "title": "The desktop relay is offline.",
            "detail": "Reconnect ContextGo on the desktop, then refresh this device list.",
        }

    if notice == "session_replaced":
        return {
            "className": "info",
            "title": "This hosted session was replaced.",
            "detail": "Another browser took over the live session. Choose a device again to continue here.",
        }

    if notice == "service_restarted":
        return {
            "className": "info",
            "title": "The hosted remote session was restarted.",
            "detail": "Refresh the list and reopen the desktop session.",
        }

    return None


def describe_remote_device_availability(device_payload: dict[str, object]) -> dict[str, object]:
    remote_status = device_payload.get("remoteStatus")
    remote_data = remote_status if isinstance(remote_status, dict) else {}
    connected = remote_data.get("connected") is True
    client_connected = remote_data.get("clientConnected") is True
    transport = remote_data.get("transport") if isinstance(remote_data.get("transport"), str) else "cloud-relay"
    transport_label = "ContextGo Cloud relay" if transport == "cloud-relay" else transport

    if connected and client_connected:
        return {
            "connected": True,
            "clientConnected": True,
            "badge": "Live session",
            "badgeClass": "busy",
            "summary": f"Desktop is online and already attached to a browser session through {transport_label}.",
            "detail": "A second browser can still take over, but the current session is already active.",
            "actionLabel": "Open live session",
            "actionHref": build_remote_session_url(str(device_payload.get("id", ""))),
        }

    if connected:
        return {
            "connected": True,
            "clientConnected": False,
            "badge": "Available",
            "badgeClass": "ready",
            "summary": f"Desktop is online and ready through {transport_label}.",
            "detail": "This device has an authenticated outbound relay connection and can open a live WebUI session now.",
            "actionLabel": "Open live session",
            "actionHref": build_remote_session_url(str(device_payload.get("id", ""))),
        }

    return {
        "connected": False,
        "clientConnected": False,
        "badge": "Unavailable",
        "badgeClass": "offline",
        "summary": f"Desktop is not connected to {transport_label} right now.",
        "detail": "The machine may still be registered and active, but hosted remote access stays unavailable until the desktop relay reconnects.",
        "actionLabel": "Unavailable",
        "actionHref": None,
    }


def render_remote_devices_page(
    user: User,
    devices: list[dict[str, object]],
    remote_origin: str,
    notice: Optional[dict[str, str]] = None,
) -> str:
    cards = []
    for device in devices:
        availability = describe_remote_device_availability(device)
        action_markup = ""
        if availability["actionHref"]:
            relative_target_url = str(availability["actionHref"])
            absolute_target_url = f"{remote_origin}{relative_target_url}"
            mobile_shell_url = build_mobile_shell_open_url(absolute_target_url)
            action_markup = (
                f'<a class="primary" href="{escape(relative_target_url)}">{escape(str(availability["actionLabel"]))}</a>'
                f'<a class="secondary" href="{escape(mobile_shell_url)}">Open in app</a>'
            )
        else:
            action_markup = '<span class="secondary disabled" aria-disabled="true">Unavailable</span>'
        connected_at = ""
        remote_status = device.get("remoteStatus")
        remote_data = remote_status if isinstance(remote_status, dict) else {}
        if isinstance(remote_data.get("connectedAt"), str) and remote_data["connectedAt"]:
            connected_at = f'<p class="meta">Relay connected at {escape(str(remote_data["connectedAt"]))}</p>'
        elif isinstance(device.get("lastSeenAt"), str) and device["lastSeenAt"]:
            connected_at = f'<p class="meta">Last seen at {escape(str(device["lastSeenAt"]))}</p>'

        cards.append(
            f"""
            <article class="device-card">
              <div class="device-header">
                <div>
                  <h2>{escape(str(device.get("deviceName", "Unnamed device")))}</h2>
                  <p class="device-subtitle">{escape(str(device.get("platform", "unknown")))} · device {escape(str(device.get("status", "unknown")))}</p>
                </div>
                <span class="badge badge-{escape(str(availability["badgeClass"]))}">{escape(str(availability["badge"]))}</span>
              </div>
              <p class="summary">{escape(str(availability["summary"]))}</p>
              <p class="detail">{escape(str(availability["detail"]))}</p>
              {connected_at}
              <div class="actions">
                {action_markup}
              </div>
            </article>
            """
        )

    devices_markup = "\n".join(cards)
    if not devices_markup:
        devices_markup = """
        <section class="empty-state">
          <h2>No desktop devices are registered yet.</h2>
          <p>Sign in on a desktop build of ContextGo first. Once that device links to your cloud account, it will appear here automatically.</p>
        </section>
        """

    account_name = escape(user.display_name)
    account_email = escape(user.email)
    notice_markup = ""
    if notice is not None:
        notice_markup = f"""
        <section class="notice notice-{escape(notice["className"])}">
          <strong>{escape(notice["title"])}</strong>
          <p>{escape(notice["detail"])}</p>
        </section>
        """

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ContextGo Remote</title>
  <style>
    body {{
      margin: 0;
      font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background:
        radial-gradient(circle at top left, rgba(56, 189, 248, 0.18), transparent 28%),
        linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%);
      color: #0f172a;
    }}
    .wrap {{
      width: min(1100px, calc(100% - 32px));
      margin: 0 auto;
      padding: 32px 0 56px;
    }}
    .topbar {{
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 28px;
    }}
    .topbar h1 {{
      margin: 0;
      font-size: 34px;
    }}
    .topbar p {{
      margin: 8px 0 0;
      color: #475569;
      line-height: 1.6;
    }}
    .account-card {{
      min-width: 260px;
      background: rgba(255, 255, 255, 0.86);
      border: 1px solid rgba(15, 23, 42, 0.08);
      border-radius: 20px;
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
      padding: 18px 20px;
    }}
    .account-card p {{
      margin: 0;
      line-height: 1.5;
    }}
    .account-meta {{
      color: #475569;
      font-size: 14px;
      margin-top: 4px;
    }}
    .toolbar {{
      display: flex;
      gap: 12px;
      align-items: center;
      margin-top: 14px;
    }}
    .grid {{
      display: grid;
      gap: 16px;
    }}
    .notice {{
      margin-bottom: 16px;
      padding: 16px 18px;
      border-radius: 18px;
      border: 1px solid rgba(15, 23, 42, 0.08);
      box-shadow: 0 16px 36px rgba(15, 23, 42, 0.06);
      background: rgba(255, 255, 255, 0.92);
    }}
    .notice strong {{
      display: block;
      font-size: 15px;
    }}
    .notice p {{
      margin: 8px 0 0;
      color: #475569;
      line-height: 1.6;
    }}
    .notice-error {{
      background: #fff7f7;
      border-color: rgba(220, 38, 38, 0.15);
    }}
    .notice-info {{
      background: #f8fbff;
      border-color: rgba(37, 99, 235, 0.12);
    }}
    .device-card, .empty-state {{
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid rgba(15, 23, 42, 0.08);
      border-radius: 24px;
      box-shadow: 0 20px 56px rgba(15, 23, 42, 0.08);
      padding: 24px;
    }}
    .device-header {{
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
    }}
    .device-header h2, .empty-state h2 {{
      margin: 0;
      font-size: 24px;
    }}
    .device-subtitle {{
      margin: 8px 0 0;
      color: #64748b;
      text-transform: lowercase;
    }}
    .summary {{
      margin: 18px 0 0;
      color: #0f172a;
      line-height: 1.7;
      font-weight: 600;
    }}
    .detail, .meta, .empty-state p {{
      margin: 10px 0 0;
      color: #475569;
      line-height: 1.7;
    }}
    .badge {{
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 8px 12px;
      font-size: 13px;
      font-weight: 700;
      white-space: nowrap;
    }}
    .badge-ready {{
      background: #ecfdf5;
      color: #166534;
    }}
    .badge-busy {{
      background: #eff6ff;
      color: #1d4ed8;
    }}
    .badge-offline {{
      background: #f8fafc;
      color: #64748b;
    }}
    .actions {{
      display: flex;
      gap: 12px;
      margin-top: 18px;
    }}
    a.primary, a.secondary, button.secondary, .secondary.disabled {{
      appearance: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      padding: 0 18px;
      border-radius: 999px;
      text-decoration: none;
      font-size: 14px;
      font-weight: 700;
      border: 1px solid rgba(15, 23, 42, 0.1);
      box-sizing: border-box;
    }}
    a.primary {{
      background: #111827;
      border-color: #111827;
      color: white;
    }}
    a.secondary, button.secondary, .secondary.disabled {{
      background: white;
      color: #0f172a;
    }}
    .secondary.disabled {{
      color: #94a3b8;
      cursor: not-allowed;
    }}
    form {{
      margin: 0;
    }}
    @media (max-width: 768px) {{
      .topbar, .device-header {{
        flex-direction: column;
      }}
      .account-card {{
        width: 100%;
      }}
    }}
  </style>
</head>
<body>
  <main class="wrap">
    <section class="topbar">
      <div>
        <h1>ContextGo Remote</h1>
        <p>Signed in as {account_name} · {account_email}</p>
        <p>Choose a desktop device that currently has a live cloud relay connection. Registered devices stay listed, but only relay-connected machines can open a hosted remote session.</p>
      </div>
      <div class="account-card">
        <p><strong>{account_name}</strong></p>
        <p class="account-meta">@{escape(user.username)}</p>
        <div class="toolbar">
          <a class="secondary" href="{REMOTE_DEVICES_PATH}">Refresh devices</a>
          <form method="post" action="/api/auth/logout?next={escape(REMOTE_DEVICES_PATH)}">
            <button class="secondary" type="submit">Sign out</button>
          </form>
        </div>
      </div>
    </section>
    {notice_markup}
    <section class="grid">
      {devices_markup}
    </section>
  </main>
</body>
</html>"""


def render_desktop_login_complete_page(deep_link_url: str, is_error: bool, message: str) -> str:
    escaped_deep_link_url = escape(deep_link_url)
    escaped_message = escape(message)
    status_class = "error" if is_error else "success"
    action_label = "Return to ContextGo" if is_error else "Open ContextGo"
    script_deep_link_url = json.dumps(deep_link_url)

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ContextGo Desktop Login</title>
  <style>
    body {{
      margin: 0;
      font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
      color: #0f172a;
    }}
    .wrap {{
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
    }}
    .card {{
      width: min(520px, 100%);
      background: rgba(255, 255, 255, 0.94);
      border: 1px solid rgba(15, 23, 42, 0.08);
      border-radius: 24px;
      box-shadow: 0 24px 80px rgba(15, 23, 42, 0.12);
      padding: 32px;
    }}
    h1 {{
      margin: 0 0 8px;
      font-size: 32px;
    }}
    p {{
      margin: 0;
      line-height: 1.6;
      color: #475569;
    }}
    .message {{
      margin-top: 18px;
      padding: 14px 16px;
      border-radius: 16px;
    }}
    .message.success {{
      background: #ecfdf5;
      color: #166534;
    }}
    .message.error {{
      background: #fef2f2;
      color: #991b1b;
    }}
    .stack {{
      display: grid;
      gap: 12px;
      margin-top: 24px;
    }}
    .primary {{
      display: inline-flex;
      justify-content: center;
      align-items: center;
      min-height: 48px;
      border-radius: 999px;
      background: #111827;
      color: white;
      text-decoration: none;
      font-weight: 600;
      padding: 0 20px;
    }}
    .caption {{
      margin-top: 18px;
      font-size: 14px;
      color: #64748b;
    }}
    code {{
      background: rgba(15, 23, 42, 0.06);
      padding: 2px 6px;
      border-radius: 8px;
      word-break: break-all;
    }}
  </style>
</head>
<body>
  <div class="wrap">
    <main class="card">
      <h1>Return to ContextGo</h1>
      <p class="message {status_class}">{escaped_message}</p>
      <div class="stack">
        <a class="primary" href="{escaped_deep_link_url}">{action_label}</a>
      </div>
      <p class="caption">If ContextGo does not open automatically, use the button above.</p>
      <p class="caption">Deep link: <code>{escaped_deep_link_url}</code></p>
    </main>
  </div>
  <script>
    window.setTimeout(() => {{
      window.location.href = {script_deep_link_url};
    }}, 80);
  </script>
</body>
</html>"""


def redirect_to_login(
    error_code: Optional[str] = None,
    success: bool = False,
    provider: Optional[str] = None,
    desktop: bool = False,
) -> RedirectResponse:
    if desktop:
        return RedirectResponse(
            url=build_desktop_login_complete_url(provider=provider, error_code=error_code),
            status_code=303,
        )

    return RedirectResponse(
        url=build_login_url(error_code=error_code, success=success, provider=provider, desktop=desktop),
        status_code=303,
    )


def build_session_payload(user: Optional[User]) -> dict[str, object]:
    if user is None:
        return {
            "authenticated": False,
            "user": None,
        }

    return {
        "authenticated": True,
        "user": {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "displayName": user.display_name,
            "avatarUrl": user.avatar_url,
        },
    }


def serialize_device(device: Device) -> dict[str, object]:
    remote_status = remote_relay_hub.get_presence(device.id)
    return {
        "id": device.id,
        "userId": device.user_id,
        "deviceName": device.device_name,
        "platform": device.platform,
        "status": device.status,
        "createdAt": device.created_at,
        "updatedAt": device.updated_at,
        "lastSeenAt": device.last_seen_at,
        "lastIpAddress": device.last_ip_address,
        "lastUserAgent": device.last_user_agent,
        "remoteStatus": {
            "connected": remote_status.connected,
            "connectedAt": remote_status.connected_at,
            "clientConnected": remote_status.client_connected,
            "clientConnectedAt": remote_status.client_connected_at,
            "transport": remote_status.transport,
        },
    }


def require_current_user(request: Request) -> User:
    user = read_current_user(request)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    return user


def read_bearer_token(request: Request) -> Optional[str]:
    authorization = request.headers.get("authorization", "").strip()
    bearer_prefix = "bearer "
    if not authorization.lower().startswith(bearer_prefix):
        return None

    token = authorization[len(bearer_prefix) :].strip()
    return token or None


def read_bearer_token_from_header(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None

    bearer_prefix = "bearer "
    normalized = authorization.strip()
    if not normalized.lower().startswith(bearer_prefix):
        return None

    token = normalized[len(bearer_prefix) :].strip()
    return token or None


def read_user_and_device_from_device_token(raw_token: Optional[str]) -> tuple[Optional[User], Optional[Device]]:
    if not raw_token:
        return None, None

    return get_user_by_device_token(settings, raw_token)


def require_current_device(request: Request) -> tuple[User, Device]:
    raw_token = read_bearer_token(request)
    if raw_token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Device token is required",
        )

    user, device = read_user_and_device_from_device_token(raw_token)
    if user is None or device is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid device token",
        )

    touch_device(
        settings=settings,
        device_id=device.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return user, device


def require_current_user_or_device(request: Request) -> User:
    user = read_current_user(request)
    if user is not None:
        return user

    device_user, _device = require_current_device(request)
    return device_user


def find_or_create_user(profile: OAuthProfile) -> User:
    user = find_user_by_oauth_account(settings, profile.provider, profile.provider_user_id)
    if user is None:
        user = find_user_by_email(settings, profile.email)

    if user is None:
        username = allocate_username(settings, profile.username_candidate, profile.email)
        user = create_user(
            settings=settings,
            email=profile.email,
            username=username,
            display_name=profile.display_name,
            avatar_url=profile.avatar_url,
        )
    else:
        update_user_profile(
            settings=settings,
            user_id=user.id,
            display_name=profile.display_name,
            avatar_url=profile.avatar_url,
        )
        refreshed_user = find_user_by_email(settings, profile.email)
        if refreshed_user is not None:
            user = refreshed_user

    upsert_oauth_account(
        settings=settings,
        user_id=user.id,
        provider=profile.provider,
        provider_user_id=profile.provider_user_id,
        email=profile.email,
    )
    return user


@app.get("/healthz")
async def healthz() -> JSONResponse:
    return JSONResponse({"ok": True})


@app.get("/api/healthz")
async def api_healthz() -> JSONResponse:
    return JSONResponse({"ok": True})


@app.get("/", response_class=HTMLResponse, response_model=None)
async def root(request: Request):
    host = get_request_hostname(request)
    if host == api_host:
        return JSONResponse(
            {
                "service": "contextgo-cloud-auth",
                "authBaseUrl": settings.auth_base_url,
                "apiBaseUrl": settings.api_base_url,
                "remoteBaseUrl": settings.remote_base_url,
                "providers": get_enabled_providers(settings),
            }
        )

    if host == remote_host:
        return RedirectResponse(url=REMOTE_DEVICES_PATH, status_code=307)

    return HTMLResponse(render_login_page(request, read_current_user(request)))


@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request) -> HTMLResponse:
    return HTMLResponse(render_login_page(request, read_current_user(request)))


@app.get(REMOTE_DEVICES_PATH, response_class=HTMLResponse)
async def remote_devices_page(request: Request) -> HTMLResponse:
    if not is_remote_request(request):
        return RedirectResponse(url=build_remote_url(REMOTE_DEVICES_PATH), status_code=307)

    user = read_current_user(request)
    if user is None:
        return RedirectResponse(url=build_login_url(next_path=REMOTE_DEVICES_PATH), status_code=303)

    devices = [serialize_device(device) for device in list_devices_for_user(settings, user.id)]
    remote_origin = settings.remote_base_url
    remote_notice = describe_remote_notice(request.query_params.get("remoteNotice"))
    return HTMLResponse(render_remote_devices_page(user, devices, remote_origin, remote_notice))


def build_remote_app_login_redirect(request: Request) -> RedirectResponse:
    return RedirectResponse(url=build_login_url(next_path=build_current_path_with_query(request)), status_code=303)


@app.get(f"{REMOTE_DEVICE_PATH_PREFIX}/{{device_id}}", response_class=HTMLResponse)
async def remote_device_page(device_id: str, request: Request):
    if not is_remote_request(request):
        return RedirectResponse(url=build_remote_url(build_remote_session_url(device_id)), status_code=307)

    user = read_current_user(request)
    if user is None:
        return build_remote_app_login_redirect(request)

    if not RENDERER_INDEX_PATH.is_file():
        return HTMLResponse(
            "<h1>Hosted remote shell is unavailable</h1><p>The renderer build was not found on this deployment.</p>",
            status_code=503,
        )

    return HTMLResponse(render_remote_app_shell())


@app.get(MOBILE_SHELL_LOGIN_COMPLETE_PATH)
async def mobile_shell_login_complete(request: Request) -> RedirectResponse:
    target_url = resolve_mobile_shell_target_url(request, request.query_params.get("target") or REMOTE_DEVICES_PATH)
    user = read_current_user(request)
    if user is None:
        login_target = build_remote_url(build_login_url(error_code="missing_session", next_path=REMOTE_DEVICES_PATH))
        return RedirectResponse(url=build_mobile_shell_open_url(login_target), status_code=303)

    return RedirectResponse(url=build_mobile_shell_open_url(target_url), status_code=303)


@app.get(DESKTOP_LOGIN_COMPLETE_PATH, response_class=HTMLResponse)
async def desktop_login_complete(request: Request) -> HTMLResponse:
    provider = normalize_provider(request.query_params.get("provider"))
    error_code = request.query_params.get("error")

    if provider is None:
        deep_link_url = build_desktop_login_deep_link(error_code="invalid_provider")
        return HTMLResponse(
            render_desktop_login_complete_page(
                deep_link_url=deep_link_url,
                is_error=True,
                message="Desktop sign-in is missing a valid OAuth provider.",
            )
        )

    if error_code:
        deep_link_url = build_desktop_login_deep_link(provider=provider, error_code=error_code)
        return HTMLResponse(
            render_desktop_login_complete_page(
                deep_link_url=deep_link_url,
                is_error=True,
                message=f"ContextGo sign-in could not be completed: {error_code}.",
            )
        )

    user = read_current_user(request)
    if user is None:
        deep_link_url = build_desktop_login_deep_link(provider=provider, error_code="missing_session")
        return HTMLResponse(
            render_desktop_login_complete_page(
                deep_link_url=deep_link_url,
                is_error=True,
                message="Browser sign-in finished, but no cloud session was found for this page.",
            )
        )

    code = create_desktop_login_code(settings, user.id, provider)
    deep_link_url = build_desktop_login_deep_link(code=code, provider=provider)
    return HTMLResponse(
        render_desktop_login_complete_page(
            deep_link_url=deep_link_url,
            is_error=False,
            message="Browser sign-in succeeded. ContextGo should continue automatically.",
        )
    )


@app.get("/api/auth/providers")
async def auth_providers() -> JSONResponse:
    return JSONResponse({"success": True, "providers": get_enabled_providers(settings)})


@app.get("/api/auth/oauth/providers")
async def auth_oauth_providers() -> JSONResponse:
    return JSONResponse({"success": True, "providers": get_enabled_providers(settings)})


@app.get("/api/auth/user")
async def auth_current_user_alias(request: Request) -> JSONResponse:
    user = read_current_user(request)
    if user is None:
        return JSONResponse({"success": True, "user": None})

    return JSONResponse(
        {
            "success": True,
            "user": {
                "id": user.id,
                "username": user.username,
                "displayName": user.display_name,
                "email": user.email,
                "avatarUrl": user.avatar_url,
                "authSource": "cloud",
            },
        }
    )


@app.get("/api/auth/session")
async def auth_session(request: Request) -> JSONResponse:
    return JSONResponse(build_session_payload(read_current_user(request)))


@app.get("/api/integrations/infermesh/provider")
async def infermesh_provider(request: Request) -> JSONResponse:
    if not is_infermesh_configured(settings):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="InferMesh integration is not configured",
        )

    user = require_current_user_or_device(request)
    try:
        provider = await provision_infermesh_provider(settings, user)
    except InfermeshProvisionError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(error),
        ) from error

    return JSONResponse({"success": True, "provider": provider})


@app.get("/api/auth/logout")
async def auth_logout_get(request: Request, next: Optional[str] = Query(default=None)) -> RedirectResponse:
    return build_logout_response(request, next)


@app.post("/api/auth/logout")
async def auth_logout(request: Request, next: Optional[str] = Query(default=None)) -> RedirectResponse:
    return build_logout_response(request, next)


@app.post("/logout")
async def auth_logout_alias(request: Request, next: Optional[str] = Query(default=None)) -> RedirectResponse:
    return build_logout_response(request, next)


@app.get("/.well-known/apple-app-site-association")
async def apple_app_site_association() -> JSONResponse:
    app_ids = parse_csv_env(IOS_ASSOCIATED_APP_IDS_ENV)
    details = [{"appIDs": app_ids, "components": [{"/": "/remote/*"}, {"/": "/login"}]}] if app_ids else []
    return JSONResponse(
        {
            "applinks": {
                "apps": [],
                "details": details,
            }
        }
    )


@app.get("/.well-known/assetlinks.json")
async def android_asset_links() -> JSONResponse:
    statements = []
    for raw_item in parse_csv_env(ANDROID_APP_LINK_TARGETS_ENV):
        package_name, separator, fingerprint_list = raw_item.partition("@")
        if not separator or not package_name or not fingerprint_list:
            continue

        fingerprints = [fingerprint.strip() for fingerprint in fingerprint_list.split(";") if fingerprint.strip()]
        if not fingerprints:
            continue

        statements.append(
            {
                "relation": ["delegate_permission/common.handle_all_urls"],
                "target": {
                    "namespace": "android_app",
                    "package_name": package_name.strip(),
                    "sha256_cert_fingerprints": fingerprints,
                },
            }
        )

    return JSONResponse(statements)


@app.post("/api/auth/desktop/consume")
async def auth_desktop_consume(request: Request, payload: DesktopLoginConsumeRequest) -> JSONResponse:
    consumed = consume_desktop_login_code(settings, payload.code)
    if consumed is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired desktop login code",
        )

    user, provider = consumed
    session = create_session(
        settings=settings,
        user=user,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    response = JSONResponse({"success": True, "provider": provider, **build_session_payload(user)})
    set_session_cookie(response, session.token)
    return response


@app.get("/api/auth/oauth/{provider}/start")
async def auth_oauth_start(provider: str, request: Request) -> RedirectResponse:
    desktop_mode = request.query_params.get("desktop") == "1"
    if not is_provider_enabled(settings, provider):
        return redirect_to_login("provider_not_enabled", provider=provider, desktop=desktop_mode)

    next_path = pick_next_path(request.query_params.get("next"))
    state = create_oauth_state(settings, provider, next_path)
    authorization_url = build_authorization_url(settings, provider, state)  # type: ignore[arg-type]

    response = RedirectResponse(url=authorization_url, status_code=302)
    set_oauth_state_cookie(response, state)
    return response


@app.get("/api/auth/oauth/{provider}/callback")
async def auth_oauth_callback(provider: str, request: Request) -> RedirectResponse:
    returned_state = request.query_params.get("state")
    context_provider, desktop_mode = peek_login_context(provider, returned_state)
    if not is_provider_enabled(settings, provider):
        return redirect_to_login("provider_not_enabled", provider=context_provider or provider, desktop=desktop_mode)

    callback_error = request.query_params.get("error")
    if callback_error:
        response = redirect_to_login(
            "access_denied" if callback_error == "access_denied" else "callback_failed",
            provider=context_provider,
            desktop=desktop_mode,
        )
        clear_oauth_state_cookie(response)
        return response

    expected_state = request.cookies.get(settings.oauth_state_cookie_name)
    code = request.query_params.get("code")
    if not expected_state or not returned_state or expected_state != returned_state:
        state_hint = expected_state or returned_state
        context_provider, desktop_mode = peek_login_context(provider, state_hint)
        response = redirect_to_login("invalid_state", provider=context_provider, desktop=desktop_mode)
        clear_oauth_state_cookie(response)
        return response

    if not code:
        response = redirect_to_login("missing_code", provider=context_provider, desktop=desktop_mode)
        clear_oauth_state_cookie(response)
        return response

    next_path_hint = peek_oauth_state(settings, returned_state, provider)
    next_path = consume_oauth_state(settings, returned_state, provider)
    if next_path is None:
        next_provider, next_desktop_mode = extract_login_context(next_path_hint)
        response = redirect_to_login(
            "invalid_state",
            provider=next_provider or context_provider,
            desktop=next_desktop_mode or desktop_mode,
        )
        clear_oauth_state_cookie(response)
        return response

    try:
        profile = await exchange_code_for_profile(settings, provider, code)  # type: ignore[arg-type]
    except Exception:
        next_provider, next_desktop_mode = extract_login_context(next_path)
        response = redirect_to_login(
            "callback_failed",
            provider=next_provider or context_provider,
            desktop=next_desktop_mode or desktop_mode,
        )
        clear_oauth_state_cookie(response)
        return response

    if not profile.email or not profile.email_verified:
        next_provider, next_desktop_mode = extract_login_context(next_path)
        response = redirect_to_login(
            "email_required",
            provider=next_provider or context_provider,
            desktop=next_desktop_mode or desktop_mode,
        )
        clear_oauth_state_cookie(response)
        return response

    if not is_allowed_email(profile.email):
        next_provider, next_desktop_mode = extract_login_context(next_path)
        response = redirect_to_login(
            "email_not_allowed",
            provider=next_provider or context_provider,
            desktop=next_desktop_mode or desktop_mode,
        )
        clear_oauth_state_cookie(response)
        return response

    user = find_or_create_user(profile)
    session = create_session(
        settings=settings,
        user=user,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    response = RedirectResponse(
        url=next_path if next_path != "/" else build_remote_url(REMOTE_DEVICES_PATH),
        status_code=303,
    )
    set_session_cookie(response, session.token)
    clear_oauth_state_cookie(response)
    return response


@app.post("/api/devices/register")
async def api_device_register(request: Request, payload: DeviceRegisterRequest) -> JSONResponse:
    user = require_current_user(request)
    device_name = payload.deviceName.strip()
    platform = payload.platform.strip()
    if not device_name or not platform:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="deviceName and platform are required",
        )

    device, raw_token = create_device(
        settings=settings,
        user_id=user.id,
        device_name=device_name,
        platform=platform,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content={
            "success": True,
            "device": serialize_device(device),
            "token": raw_token,
        },
    )


@app.get("/api/devices")
async def api_devices(request: Request) -> JSONResponse:
    user = require_current_user(request)
    devices = [serialize_device(device) for device in list_devices_for_user(settings, user.id)]
    return JSONResponse(
        {
            "success": True,
            "devices": devices,
        }
    )


@app.get("/api/remote/devices")
async def api_remote_devices(request: Request) -> JSONResponse:
    user = require_current_user(request)
    devices = [serialize_device(device) for device in list_devices_for_user(settings, user.id)]
    return JSONResponse(
        {
            "success": True,
            "devices": devices,
        }
    )


@app.post("/api/devices/{device_id}/revoke")
async def api_device_revoke(device_id: str, request: Request) -> JSONResponse:
    user = require_current_user(request)
    revoked = revoke_device(settings, user.id, device_id)
    if not revoked:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")

    return JSONResponse({"success": True, "deviceId": device_id, "status": "revoked"})


@app.post("/api/sync/push")
async def api_sync_push(request: Request, payload: SyncPushRequest) -> JSONResponse:
    user, device = require_current_device(request)
    result = apply_sync_changes(
        settings=settings,
        user_id=user.id,
        device_id=device.id,
        changes=[change.model_dump() for change in payload.changes],
    )
    return JSONResponse({"success": True, **result})


@app.get("/api/sync/pull")
async def api_sync_pull(
    request: Request,
    cursor: int = Query(default=0, ge=0),
    limit: int = Query(default=200, ge=1, le=500),
) -> JSONResponse:
    user, _device = require_current_device(request)
    result = pull_sync_events(
        settings=settings,
        user_id=user.id,
        cursor=cursor,
        limit=limit,
    )
    return JSONResponse({"success": True, **result})


async def handle_remote_client_websocket(websocket: WebSocket, device_id: str) -> None:
    user = read_current_user_from_session_token(websocket.cookies.get(settings.session_cookie_name))
    if user is None:
        await websocket.close(code=4401, reason="Authentication required")
        return

    device = get_device_for_user(settings, user.id, device_id)
    if device is None:
        await websocket.close(code=4404, reason="Device not found")
        return

    await websocket.accept()
    registered = await remote_relay_hub.register_client(
        user_id=user.id,
        device_id=device.id,
        websocket=websocket,
        connected_at=utc_now_iso(),
    )
    if not registered:
        await websocket.close(code=4404, reason="Device offline")
        return

    try:
        while True:
            payload = await websocket.receive_json()
            if not isinstance(payload, dict):
                continue

            if payload.get("name") == "pong":
                continue

            await remote_relay_hub.forward_bridge_to_device(device.id, payload)
    except WebSocketDisconnect:
        pass
    finally:
        await remote_relay_hub.unregister_client(device.id, websocket)


@app.websocket("/")
async def root_websocket(websocket: WebSocket) -> None:
    device_id = websocket.query_params.get("device_id")
    if not device_id:
        await websocket.close(code=4400, reason="device_id is required")
        return

    await handle_remote_client_websocket(websocket, device_id)


@app.websocket("/api/remote/client-connect")
async def remote_client_connect(websocket: WebSocket) -> None:
    device_id = websocket.query_params.get("device_id")
    if not device_id:
        await websocket.close(code=4400, reason="device_id is required")
        return

    await handle_remote_client_websocket(websocket, device_id)


@app.websocket("/api/remote/device-connect")
async def remote_device_connect(websocket: WebSocket) -> None:
    raw_token = read_bearer_token_from_header(websocket.headers.get("authorization"))
    user, device = read_user_and_device_from_device_token(raw_token)
    if user is None or device is None:
        await websocket.close(code=4401, reason="Invalid device token")
        return

    touch_device(
        settings=settings,
        device_id=device.id,
        ip_address=websocket.client.host if websocket.client else None,
        user_agent=websocket.headers.get("user-agent"),
    )

    await websocket.accept()
    await remote_relay_hub.register_device(
        user_id=user.id,
        device_id=device.id,
        websocket=websocket,
        connected_at=utc_now_iso(),
    )
    await websocket.send_json(
        {
            "type": "hello",
            "deviceId": device.id,
            "connectedAt": utc_now_iso(),
            "transport": "cloud-relay",
        }
    )

    try:
        while True:
            payload = await websocket.receive_json()
            if not isinstance(payload, dict):
                continue

            payload_type = payload.get("type")
            if payload_type == "pong":
                continue

            if payload_type == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            if payload_type == "bridge" and isinstance(payload.get("payload"), dict):
                await remote_relay_hub.forward_bridge_to_client(device.id, payload["payload"])
    except WebSocketDisconnect:
        pass
    finally:
        await remote_relay_hub.unregister_device(device.id, websocket)
