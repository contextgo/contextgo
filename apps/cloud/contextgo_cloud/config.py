from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional


def _read_env(name: str, default: Optional[str] = None) -> Optional[str]:
    value = os.getenv(name, default)
    if value is None:
        return None

    trimmed = value.strip()
    return trimmed or None


def _read_int(name: str, default: int) -> int:
    value = _read_env(name)
    if value is None:
        return default

    try:
        return int(value)
    except ValueError as error:
        raise RuntimeError(f"{name} must be an integer") from error


def _read_csv(name: str, default: str = "") -> tuple[str, ...]:
    raw_value = _read_env(name, default) or ""
    return tuple(item.strip() for item in raw_value.split(",") if item.strip())


def _build_default_oidc_redirect_uris(
    infermesh_console_base_url: Optional[str],
    infermesh_admin_base_url: Optional[str],
) -> tuple[str, ...]:
    candidates = []
    for base_url in (infermesh_console_base_url, infermesh_admin_base_url):
        if not base_url:
            continue

        redirect_uri = f"{base_url.rstrip('/')}/oauth/oidc"
        if redirect_uri not in candidates:
            candidates.append(redirect_uri)

    return tuple(candidates)


@dataclass(frozen=True)
class Settings:
    database_path: str
    auth_base_url: str
    api_base_url: str
    remote_base_url: str
    session_cookie_domain: Optional[str]
    allowed_emails: tuple[str, ...]
    github_client_id: Optional[str]
    github_client_secret: Optional[str]
    google_client_id: Optional[str]
    google_client_secret: Optional[str]
    infermesh_api_base_url: Optional[str]
    infermesh_console_base_url: Optional[str]
    infermesh_portal_url: str
    infermesh_admin_base_url: Optional[str]
    infermesh_admin_username: Optional[str]
    infermesh_admin_password: Optional[str]
    infermesh_admin_access_client_id: Optional[str]
    infermesh_admin_access_client_secret: Optional[str]
    infermesh_password_secret: Optional[str]
    infermesh_username_prefix: str
    infermesh_provider_name: str
    oidc_client_id: Optional[str]
    oidc_client_secret: Optional[str]
    oidc_client_name: str
    oidc_redirect_uris: tuple[str, ...]
    oidc_signing_key_pem: Optional[str]
    oidc_signing_key_id: str
    session_cookie_name: str = "contextgo_session"
    oauth_state_cookie_name: str = "contextgo_oauth_state"
    session_ttl_seconds: int = 60 * 60 * 24 * 30
    oauth_state_ttl_seconds: int = 60 * 10
    oidc_authorization_code_ttl_seconds: int = 60 * 5
    oidc_access_token_ttl_seconds: int = 60 * 60
    oidc_id_token_ttl_seconds: int = 60 * 10


def load_settings() -> Settings:
    allowed_emails_env = _read_env("CONTEXTGO_ALLOWED_EMAILS", "") or ""
    allowed_emails = tuple(
        email.strip().lower()
        for email in allowed_emails_env.split(",")
        if email.strip()
    )

    auth_base_url = _read_env("CONTEXTGO_AUTH_BASE_URL", "https://auth.contextgo.io")
    api_base_url = _read_env("CONTEXTGO_API_BASE_URL", "https://api.contextgo.io")
    remote_base_url = _read_env("CONTEXTGO_REMOTE_BASE_URL", "https://remote.contextgo.io")
    if auth_base_url is None or api_base_url is None or remote_base_url is None:
        raise RuntimeError(
            "CONTEXTGO_AUTH_BASE_URL, CONTEXTGO_API_BASE_URL, and CONTEXTGO_REMOTE_BASE_URL must be configured"
        )

    session_cookie_domain = _read_env("CONTEXTGO_SESSION_COOKIE_DOMAIN", ".contextgo.io")
    infermesh_api_base_url = _read_env("CONTEXTGO_INFERMESH_API_BASE_URL", "https://api.infermesh.org")
    infermesh_console_base_url = _read_env("CONTEXTGO_INFERMESH_CONSOLE_BASE_URL", "https://newapi.infermesh.org")
    infermesh_portal_url = _read_env("CONTEXTGO_INFERMESH_PORTAL_URL", "https://infermesh.org") or "https://infermesh.org"
    infermesh_admin_base_url = _read_env("CONTEXTGO_INFERMESH_ADMIN_BASE_URL", "https://newapi-admin.infermesh.org")
    default_oidc_redirect_uris = _build_default_oidc_redirect_uris(
        infermesh_console_base_url,
        infermesh_admin_base_url,
    )
    oidc_redirect_uris = _read_csv(
        "CONTEXTGO_OIDC_REDIRECT_URIS",
        ",".join(default_oidc_redirect_uris),
    )

    return Settings(
        database_path=_read_env("CONTEXTGO_DATABASE_PATH", "./data/contextgo-cloud.db") or "./data/contextgo-cloud.db",
        auth_base_url=auth_base_url.rstrip("/"),
        api_base_url=api_base_url.rstrip("/"),
        remote_base_url=remote_base_url.rstrip("/"),
        session_cookie_domain=session_cookie_domain,
        allowed_emails=allowed_emails,
        github_client_id=_read_env("CONTEXTGO_GITHUB_CLIENT_ID"),
        github_client_secret=_read_env("CONTEXTGO_GITHUB_CLIENT_SECRET"),
        google_client_id=_read_env("CONTEXTGO_GOOGLE_CLIENT_ID"),
        google_client_secret=_read_env("CONTEXTGO_GOOGLE_CLIENT_SECRET"),
        infermesh_api_base_url=infermesh_api_base_url,
        infermesh_console_base_url=infermesh_console_base_url,
        infermesh_portal_url=infermesh_portal_url.rstrip('/'),
        infermesh_admin_base_url=infermesh_admin_base_url,
        infermesh_admin_username=_read_env("CONTEXTGO_INFERMESH_ADMIN_USERNAME"),
        infermesh_admin_password=_read_env("CONTEXTGO_INFERMESH_ADMIN_PASSWORD"),
        infermesh_admin_access_client_id=_read_env("CONTEXTGO_INFERMESH_ADMIN_ACCESS_CLIENT_ID"),
        infermesh_admin_access_client_secret=_read_env("CONTEXTGO_INFERMESH_ADMIN_ACCESS_CLIENT_SECRET"),
        infermesh_password_secret=_read_env("CONTEXTGO_INFERMESH_PASSWORD_SECRET"),
        infermesh_username_prefix=_read_env("CONTEXTGO_INFERMESH_USERNAME_PREFIX", "cg") or "cg",
        infermesh_provider_name=_read_env("CONTEXTGO_INFERMESH_PROVIDER_NAME", "InferMesh Cloud") or "InferMesh Cloud",
        oidc_client_id=_read_env("CONTEXTGO_OIDC_CLIENT_ID"),
        oidc_client_secret=_read_env("CONTEXTGO_OIDC_CLIENT_SECRET"),
        oidc_client_name=_read_env("CONTEXTGO_OIDC_CLIENT_NAME", "InferMesh") or "InferMesh",
        oidc_redirect_uris=oidc_redirect_uris,
        oidc_signing_key_pem=_read_env("CONTEXTGO_OIDC_SIGNING_KEY_PEM"),
        oidc_signing_key_id=_read_env("CONTEXTGO_OIDC_SIGNING_KEY_ID", "contextgo-auth-1") or "contextgo-auth-1",
        oidc_authorization_code_ttl_seconds=_read_int("CONTEXTGO_OIDC_AUTHORIZATION_CODE_TTL_SECONDS", 60 * 5),
        oidc_access_token_ttl_seconds=_read_int("CONTEXTGO_OIDC_ACCESS_TOKEN_TTL_SECONDS", 60 * 60),
        oidc_id_token_ttl_seconds=_read_int("CONTEXTGO_OIDC_ID_TOKEN_TTL_SECONDS", 60 * 10),
    )
