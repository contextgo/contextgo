from __future__ import annotations

from contextlib import asynccontextmanager
from html import escape
from typing import Any, Dict, Literal, Optional, Union
from urllib.parse import urlencode, urlparse

from fastapi import FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from pydantic import BaseModel, Field

from .config import Settings, load_settings
from .db import (
    Device,
    User,
    apply_sync_changes,
    allocate_username,
    cleanup_expired_rows,
    create_device,
    consume_oauth_state,
    create_oauth_state,
    create_session,
    create_user,
    delete_session,
    find_user_by_email,
    find_user_by_oauth_account,
    get_user_by_device_token,
    get_user_by_session_token,
    initialize_database,
    list_devices_for_user,
    pull_sync_events,
    revoke_device,
    touch_device,
    update_user_profile,
    upsert_oauth_account,
)
from .oauth import OAuthProfile, build_authorization_url, exchange_code_for_profile, get_enabled_providers, is_provider_enabled

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

settings: Settings = load_settings()
api_host = urlparse(settings.api_base_url).hostname or ""


@asynccontextmanager
async def lifespan(_app: FastAPI):
    initialize_database(settings)
    cleanup_expired_rows(settings)
    yield


app = FastAPI(title="ContextGo Cloud Auth Service", lifespan=lifespan)

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
    raw_token = request.cookies.get(settings.session_cookie_name)
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


def render_login_page(request: Request, user: Optional[User]) -> str:
    oauth_error = request.query_params.get("oauthError")
    success = request.query_params.get("success")

    provider_buttons = []
    for provider in get_enabled_providers(settings):
        label = "Continue with GitHub" if provider == "github" else "Continue with Google"
        provider_buttons.append(
            f'<a class="provider" href="/api/auth/oauth/{provider}/start">{escape(label)}</a>'
        )

    provider_markup = "\n".join(provider_buttons) or "<p>No OAuth providers are configured.</p>"
    message = ""
    if oauth_error:
        message = f'<p class="message error">Login failed: {escape(oauth_error)}</p>'
    elif success:
        message = '<p class="message success">Login succeeded.</p>'

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
      <div class="stack">
        {provider_markup}
      </div>
      {account_markup}
      <p class="caption">Session cookie domain: <code>{escape(settings.session_cookie_domain or "host-only")}</code></p>
    </main>
  </div>
</body>
</html>"""


def redirect_to_login(error_code: Optional[str] = None, success: bool = False) -> RedirectResponse:
    query: Dict[str, str] = {}
    if error_code:
        query["oauthError"] = error_code
    if success:
        query["success"] = "1"

    target = f"/login?{urlencode(query)}" if query else "/login"
    return RedirectResponse(url=target, status_code=303)


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


def require_current_device(request: Request) -> tuple[User, Device]:
    raw_token = read_bearer_token(request)
    if raw_token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Device token is required",
        )

    user, device = get_user_by_device_token(settings, raw_token)
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
    host = (request.headers.get("host") or "").split(":")[0]
    if host == api_host:
        return JSONResponse(
            {
                "service": "contextgo-cloud-auth",
                "authBaseUrl": settings.auth_base_url,
                "apiBaseUrl": settings.api_base_url,
                "providers": get_enabled_providers(settings),
            }
        )

    return HTMLResponse(render_login_page(request, read_current_user(request)))


@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request) -> HTMLResponse:
    return HTMLResponse(render_login_page(request, read_current_user(request)))


@app.get("/api/auth/providers")
async def auth_providers() -> JSONResponse:
    return JSONResponse({"success": True, "providers": get_enabled_providers(settings)})


@app.get("/api/auth/session")
async def auth_session(request: Request) -> JSONResponse:
    return JSONResponse(build_session_payload(read_current_user(request)))


@app.get("/api/auth/logout")
async def auth_logout_get(request: Request, next: Optional[str] = Query(default=None)) -> RedirectResponse:
    return build_logout_response(request, next)


@app.post("/api/auth/logout")
async def auth_logout(request: Request, next: Optional[str] = Query(default=None)) -> RedirectResponse:
    return build_logout_response(request, next)


@app.get("/api/auth/oauth/{provider}/start")
async def auth_oauth_start(provider: str, request: Request) -> RedirectResponse:
    if not is_provider_enabled(settings, provider):
        return redirect_to_login("provider_not_enabled")

    next_path = pick_next_path(request.query_params.get("next"))
    state = create_oauth_state(settings, provider, next_path)
    authorization_url = build_authorization_url(settings, provider, state)  # type: ignore[arg-type]

    response = RedirectResponse(url=authorization_url, status_code=302)
    set_oauth_state_cookie(response, state)
    return response


@app.get("/api/auth/oauth/{provider}/callback")
async def auth_oauth_callback(provider: str, request: Request) -> RedirectResponse:
    if not is_provider_enabled(settings, provider):
        return redirect_to_login("provider_not_enabled")

    callback_error = request.query_params.get("error")
    if callback_error:
        response = redirect_to_login("access_denied" if callback_error == "access_denied" else "callback_failed")
        clear_oauth_state_cookie(response)
        return response

    expected_state = request.cookies.get(settings.oauth_state_cookie_name)
    returned_state = request.query_params.get("state")
    code = request.query_params.get("code")
    if not expected_state or not returned_state or expected_state != returned_state:
        response = redirect_to_login("invalid_state")
        clear_oauth_state_cookie(response)
        return response

    if not code:
        response = redirect_to_login("missing_code")
        clear_oauth_state_cookie(response)
        return response

    next_path = consume_oauth_state(settings, returned_state, provider)
    if next_path is None:
        response = redirect_to_login("invalid_state")
        clear_oauth_state_cookie(response)
        return response

    try:
        profile = await exchange_code_for_profile(settings, provider, code)  # type: ignore[arg-type]
    except Exception:
        response = redirect_to_login("callback_failed")
        clear_oauth_state_cookie(response)
        return response

    if not profile.email or not profile.email_verified:
        response = redirect_to_login("email_required")
        clear_oauth_state_cookie(response)
        return response

    if not is_allowed_email(profile.email):
        response = redirect_to_login("email_not_allowed")
        clear_oauth_state_cookie(response)
        return response

    user = find_or_create_user(profile)
    session = create_session(
        settings=settings,
        user=user,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    response = RedirectResponse(url=next_path if next_path != "/" else "/login?success=1", status_code=303)
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
