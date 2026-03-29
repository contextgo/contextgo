from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Optional

import httpx

from .config import Settings
from .db import normalize_email

ProviderId = Literal["github", "google"]


@dataclass(frozen=True)
class OAuthProfile:
    provider: ProviderId
    provider_user_id: str
    email: str
    email_verified: bool
    username_candidate: str
    display_name: str
    avatar_url: Optional[str]


def get_enabled_providers(settings: Settings) -> list[ProviderId]:
    providers: list[ProviderId] = []
    if settings.github_client_id and settings.github_client_secret:
        providers.append("github")
    if settings.google_client_id and settings.google_client_secret:
        providers.append("google")
    return providers


def is_provider_enabled(settings: Settings, provider: str) -> bool:
    return provider in get_enabled_providers(settings)


def get_callback_url(settings: Settings, provider: ProviderId) -> str:
    return f"{settings.auth_base_url}/api/auth/oauth/{provider}/callback"


def build_authorization_url(settings: Settings, provider: ProviderId, state: str) -> str:
    if provider == "github":
        if not settings.github_client_id:
            raise RuntimeError("GitHub OAuth is not configured")

        query = httpx.QueryParams(
            {
                "client_id": settings.github_client_id,
                "redirect_uri": get_callback_url(settings, provider),
                "scope": "read:user user:email",
                "state": state,
            }
        )
        return f"https://github.com/login/oauth/authorize?{query}"

    if not settings.google_client_id:
        raise RuntimeError("Google OAuth is not configured")

    query = httpx.QueryParams(
        {
            "client_id": settings.google_client_id,
            "redirect_uri": get_callback_url(settings, provider),
            "response_type": "code",
            "scope": "openid email profile",
            "prompt": "select_account",
            "state": state,
        }
    )
    return f"https://accounts.google.com/o/oauth2/v2/auth?{query}"


async def exchange_code_for_profile(settings: Settings, provider: ProviderId, code: str) -> OAuthProfile:
    if provider == "github":
        return await _fetch_github_profile(settings, code)

    return await _fetch_google_profile(settings, code)


async def _fetch_github_profile(settings: Settings, code: str) -> OAuthProfile:
    if not settings.github_client_id or not settings.github_client_secret:
        raise RuntimeError("GitHub OAuth is not configured")

    async with httpx.AsyncClient(timeout=10.0, headers={"User-Agent": "ContextGo"}) as client:
        token_response = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            json={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": code,
                "redirect_uri": get_callback_url(settings, "github"),
            },
        )
        token_payload = token_response.json()
        access_token = token_payload.get("access_token")
        if not token_response.is_success or not access_token:
            raise RuntimeError(token_payload.get("error_description") or token_payload.get("error") or "GitHub token exchange failed")

        common_headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {access_token}",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        user_response, email_response = await client.get("https://api.github.com/user", headers=common_headers), await client.get(
            "https://api.github.com/user/emails", headers=common_headers
        )

    user_payload = user_response.json()
    email_payload = email_response.json()
    if not user_response.is_success or not user_payload.get("login") or not user_payload.get("id"):
        raise RuntimeError("Failed to fetch GitHub profile")

    verified_email = None
    if isinstance(email_payload, list):
        primary_verified = next(
            (entry.get("email") for entry in email_payload if entry.get("primary") and entry.get("verified")),
            None,
        )
        verified_email = primary_verified or next(
            (entry.get("email") for entry in email_payload if entry.get("verified")),
            None,
        )

    fallback_email = user_payload.get("email")
    email = normalize_email(verified_email or fallback_email or "")
    display_name = user_payload.get("name") or user_payload["login"]

    return OAuthProfile(
        provider="github",
        provider_user_id=str(user_payload["id"]),
        email=email,
        email_verified=bool(verified_email),
        username_candidate=user_payload["login"],
        display_name=display_name,
        avatar_url=user_payload.get("avatar_url"),
    )


async def _fetch_google_profile(settings: Settings, code: str) -> OAuthProfile:
    if not settings.google_client_id or not settings.google_client_secret:
        raise RuntimeError("Google OAuth is not configured")

    async with httpx.AsyncClient(timeout=10.0) as client:
        token_response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": get_callback_url(settings, "google"),
                "grant_type": "authorization_code",
            },
        )
        token_payload = token_response.json()
        access_token = token_payload.get("access_token")
        if not token_response.is_success or not access_token:
            raise RuntimeError(token_payload.get("error_description") or token_payload.get("error") or "Google token exchange failed")

        user_response = await client.get(
            "https://openidconnect.googleapis.com/v1/userinfo",
            headers={
                "Accept": "application/json",
                "Authorization": f"Bearer {access_token}",
            },
        )

    user_payload = user_response.json()
    if not user_response.is_success or not user_payload.get("email") or not user_payload.get("sub"):
        raise RuntimeError("Failed to fetch Google profile")

    email = normalize_email(user_payload["email"])
    username_candidate = user_payload.get("name") or email.split("@")[0] or "google-user"
    display_name = user_payload.get("name") or username_candidate

    return OAuthProfile(
        provider="google",
        provider_user_id=str(user_payload["sub"]),
        email=email,
        email_verified=user_payload.get("email_verified") is True,
        username_candidate=username_candidate,
        display_name=display_name,
        avatar_url=user_payload.get("picture"),
    )
