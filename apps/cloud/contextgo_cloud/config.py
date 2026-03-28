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


@dataclass(frozen=True)
class Settings:
    database_path: str
    auth_base_url: str
    api_base_url: str
    session_cookie_domain: Optional[str]
    allowed_emails: tuple[str, ...]
    github_client_id: Optional[str]
    github_client_secret: Optional[str]
    google_client_id: Optional[str]
    google_client_secret: Optional[str]
    session_cookie_name: str = "contextgo_session"
    oauth_state_cookie_name: str = "contextgo_oauth_state"
    session_ttl_seconds: int = 60 * 60 * 24 * 30
    oauth_state_ttl_seconds: int = 60 * 10


def load_settings() -> Settings:
    allowed_emails_env = _read_env("CONTEXTGO_ALLOWED_EMAILS", "") or ""
    allowed_emails = tuple(
        email.strip().lower()
        for email in allowed_emails_env.split(",")
        if email.strip()
    )

    auth_base_url = _read_env("CONTEXTGO_AUTH_BASE_URL", "https://auth.contextgo.io")
    api_base_url = _read_env("CONTEXTGO_API_BASE_URL", "https://api.contextgo.io")
    if auth_base_url is None or api_base_url is None:
        raise RuntimeError("CONTEXTGO_AUTH_BASE_URL and CONTEXTGO_API_BASE_URL must be configured")

    session_cookie_domain = _read_env("CONTEXTGO_SESSION_COOKIE_DOMAIN", ".contextgo.io")

    return Settings(
        database_path=_read_env("CONTEXTGO_DATABASE_PATH", "./data/contextgo-cloud.db") or "./data/contextgo-cloud.db",
        auth_base_url=auth_base_url.rstrip("/"),
        api_base_url=api_base_url.rstrip("/"),
        session_cookie_domain=session_cookie_domain,
        allowed_emails=allowed_emails,
        github_client_id=_read_env("CONTEXTGO_GITHUB_CLIENT_ID"),
        github_client_secret=_read_env("CONTEXTGO_GITHUB_CLIENT_SECRET"),
        google_client_id=_read_env("CONTEXTGO_GOOGLE_CLIENT_ID"),
        google_client_secret=_read_env("CONTEXTGO_GOOGLE_CLIENT_SECRET"),
    )
