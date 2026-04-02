from __future__ import annotations

import base64
import importlib
import os
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch
from urllib.parse import parse_qs, quote, urlparse

from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

CLOUD_ROOT = Path(__file__).resolve().parents[1]
if str(CLOUD_ROOT) not in sys.path:
    sys.path.insert(0, str(CLOUD_ROOT))

MODULE_NAMES = (
    "contextgo_cloud.config",
    "contextgo_cloud.db",
    "contextgo_cloud.infermesh",
    "contextgo_cloud.oidc",
    "contextgo_cloud.oauth",
    "contextgo_cloud.app",
)

ENV_KEYS = (
    "CONTEXTGO_DATABASE_PATH",
    "CONTEXTGO_AUTH_BASE_URL",
    "CONTEXTGO_API_BASE_URL",
    "CONTEXTGO_REMOTE_BASE_URL",
    "CONTEXTGO_RENDERER_BUILD_ROOT",
    "CONTEXTGO_SESSION_COOKIE_DOMAIN",
    "CONTEXTGO_ALLOWED_EMAILS",
    "CONTEXTGO_GITHUB_CLIENT_ID",
    "CONTEXTGO_GITHUB_CLIENT_SECRET",
    "CONTEXTGO_GOOGLE_CLIENT_ID",
    "CONTEXTGO_GOOGLE_CLIENT_SECRET",
    "CONTEXTGO_INFERMESH_API_BASE_URL",
    "CONTEXTGO_INFERMESH_CONSOLE_BASE_URL",
    "CONTEXTGO_INFERMESH_ADMIN_BASE_URL",
    "CONTEXTGO_INFERMESH_ADMIN_USERNAME",
    "CONTEXTGO_INFERMESH_ADMIN_PASSWORD",
    "CONTEXTGO_INFERMESH_ADMIN_ACCESS_CLIENT_ID",
    "CONTEXTGO_INFERMESH_ADMIN_ACCESS_CLIENT_SECRET",
    "CONTEXTGO_INFERMESH_PASSWORD_SECRET",
    "CONTEXTGO_INFERMESH_USERNAME_PREFIX",
    "CONTEXTGO_INFERMESH_PROVIDER_NAME",
    "CONTEXTGO_OIDC_CLIENT_ID",
    "CONTEXTGO_OIDC_CLIENT_SECRET",
    "CONTEXTGO_OIDC_CLIENT_NAME",
    "CONTEXTGO_OIDC_REDIRECT_URIS",
    "CONTEXTGO_OIDC_SIGNING_KEY_PEM",
    "CONTEXTGO_OIDC_SIGNING_KEY_ID",
)


def unload_modules() -> None:
    for name in MODULE_NAMES:
        sys.modules.pop(name, None)


class CloudApiTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.renderer_dir = Path(self.temp_dir.name) / "renderer-build"
        assets_dir = self.renderer_dir / "assets"
        assets_dir.mkdir(parents=True)
        (self.renderer_dir / "index.html").write_text(
            "<!doctype html><html><body><div id=\"root\"></div><script src=\"./assets/app.js\"></script></body></html>",
            encoding="utf-8",
        )
        (assets_dir / "app.js").write_text("console.log('remote shell');", encoding="utf-8")

        self.previous_env = {key: os.environ.get(key) for key in ENV_KEYS}
        self.addCleanup(self._restore_environment)

        os.environ["CONTEXTGO_DATABASE_PATH"] = str(Path(self.temp_dir.name) / "contextgo-cloud.db")
        os.environ["CONTEXTGO_AUTH_BASE_URL"] = "http://testserver"
        os.environ["CONTEXTGO_API_BASE_URL"] = "http://testserver"
        os.environ["CONTEXTGO_REMOTE_BASE_URL"] = "https://remote.contextgo.io"
        os.environ["CONTEXTGO_RENDERER_BUILD_ROOT"] = str(self.renderer_dir)
        os.environ["CONTEXTGO_SESSION_COOKIE_DOMAIN"] = ""
        os.environ["CONTEXTGO_ALLOWED_EMAILS"] = "yeyitech@gmail.com"
        os.environ["CONTEXTGO_GITHUB_CLIENT_ID"] = "github-client-id"
        os.environ["CONTEXTGO_GITHUB_CLIENT_SECRET"] = "github-client-secret"
        os.environ["CONTEXTGO_GOOGLE_CLIENT_ID"] = "google-client-id"
        os.environ["CONTEXTGO_GOOGLE_CLIENT_SECRET"] = "google-client-secret"
        os.environ["CONTEXTGO_INFERMESH_API_BASE_URL"] = "https://api.infermesh.test"
        os.environ["CONTEXTGO_INFERMESH_CONSOLE_BASE_URL"] = "https://newapi.infermesh.test"
        os.environ["CONTEXTGO_INFERMESH_ADMIN_BASE_URL"] = "https://newapi-admin.infermesh.test"
        os.environ["CONTEXTGO_INFERMESH_ADMIN_USERNAME"] = "root"
        os.environ["CONTEXTGO_INFERMESH_ADMIN_PASSWORD"] = "test-password"
        os.environ["CONTEXTGO_INFERMESH_PASSWORD_SECRET"] = "test-secret"
        os.environ["CONTEXTGO_INFERMESH_USERNAME_PREFIX"] = "cg"
        os.environ["CONTEXTGO_INFERMESH_PROVIDER_NAME"] = "InferMesh Cloud"
        os.environ["CONTEXTGO_OIDC_CLIENT_ID"] = "infermesh-oidc-client"
        os.environ["CONTEXTGO_OIDC_CLIENT_SECRET"] = "infermesh-oidc-secret"
        os.environ["CONTEXTGO_OIDC_CLIENT_NAME"] = "InferMesh"
        os.environ["CONTEXTGO_OIDC_REDIRECT_URIS"] = "https://newapi.infermesh.test/oauth/oidc"
        os.environ["CONTEXTGO_OIDC_SIGNING_KEY_ID"] = "test-key-1"

        unload_modules()
        self.app_module = importlib.import_module("contextgo_cloud.app")
        self.db_module = importlib.import_module("contextgo_cloud.db")
        self.oauth_module = importlib.import_module("contextgo_cloud.oauth")
        self.settings = self.app_module.settings

        self.client = TestClient(self.app_module.app)
        self.client.__enter__()
        self.addCleanup(self.client.__exit__, None, None, None)

    def _restore_environment(self) -> None:
        for key, value in self.previous_env.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        unload_modules()

    def _create_browser_session(self) -> tuple[object, object]:
        user = self.db_module.find_user_by_email(self.settings, "yeyitech@gmail.com")
        if user is None:
            user = self.db_module.create_user(
                settings=self.settings,
                email="yeyitech@gmail.com",
                username="yeyitech",
                display_name="Yeyi Tech",
                avatar_url=None,
            )
        session = self.db_module.create_session(
            settings=self.settings,
            user=user,
            ip_address="127.0.0.1",
            user_agent="test-client",
        )
        self.client.cookies.set(self.settings.session_cookie_name, session.token)
        return user, session

    def _register_device(self, device_name: str = "Mac mini", platform: str = "macos") -> dict[str, object]:
        self._create_browser_session()
        response = self.client.post(
            "/api/devices/register",
            json={
                "deviceName": device_name,
                "platform": platform,
                "deviceKind": "desktop",
            },
        )
        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertTrue(payload["success"])
        return payload

    def _authorize_oidc_code(
        self,
        *,
        scope: str = "openid profile email",
        state: str = "state-123",
        nonce: str = "nonce-123",
        code_challenge: str | None = None,
        code_challenge_method: str | None = None,
    ) -> tuple[str, str]:
        self._create_browser_session()
        redirect_uri = "https://newapi.infermesh.test/oauth/oidc"
        params = {
            "client_id": self.settings.oidc_client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": scope,
            "state": state,
            "nonce": nonce,
        }
        if code_challenge is not None:
            params["code_challenge"] = code_challenge
        if code_challenge_method is not None:
            params["code_challenge_method"] = code_challenge_method

        response = self.client.get("/oauth/authorize", params=params, follow_redirects=False)
        self.assertEqual(response.status_code, 303)
        location = response.headers["location"]
        parsed = urlparse(location)
        self.assertEqual(parsed.scheme, "https")
        self.assertEqual(parsed.netloc, "newapi.infermesh.test")
        query = parse_qs(parsed.query)
        self.assertEqual(query["state"][0], state)
        return query["code"][0], redirect_uri

    def test_oauth_callback_creates_session(self) -> None:
        start_response = self.client.get("/api/auth/oauth/google/start?next=/desktop", follow_redirects=False)
        self.assertEqual(start_response.status_code, 302)

        redirect_url = start_response.headers["location"]
        state = parse_qs(urlparse(redirect_url).query)["state"][0]
        profile = self.oauth_module.OAuthProfile(
            provider="google",
            provider_user_id="google-user-1",
            email="yeyitech@gmail.com",
            email_verified=True,
            username_candidate="yeyitech",
            display_name="Yeyi Tech",
            avatar_url="https://example.com/avatar.png",
        )

        with patch.object(
            self.app_module,
            "exchange_code_for_profile",
            AsyncMock(return_value=profile),
        ):
            callback_response = self.client.get(
                f"/api/auth/oauth/google/callback?state={state}&code=test-code",
                follow_redirects=False,
            )

        self.assertEqual(callback_response.status_code, 303)
        self.assertEqual(callback_response.headers["location"], "/desktop")

        session_response = self.client.get("/api/auth/session")
        self.assertEqual(session_response.status_code, 200)
        session_payload = session_response.json()
        self.assertTrue(session_payload["authenticated"])
        self.assertEqual(session_payload["user"]["email"], "yeyitech@gmail.com")
        self.assertEqual(session_payload["user"]["username"], "yeyitech")

    def test_oidc_discovery_document_is_exposed(self) -> None:
        response = self.client.get("/.well-known/openid-configuration")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["issuer"], "http://testserver")
        self.assertEqual(payload["authorization_endpoint"], "http://testserver/oauth/authorize")
        self.assertEqual(payload["token_endpoint"], "http://testserver/oauth/token")
        self.assertEqual(payload["userinfo_endpoint"], "http://testserver/oauth/userinfo")
        self.assertEqual(payload["jwks_uri"], "http://testserver/oauth/jwks")
        self.assertIn("openid", payload["scopes_supported"])

    def test_oidc_authorize_redirects_to_login_when_browser_session_missing(self) -> None:
        response = self.client.get(
            "/oauth/authorize",
            params={
                "client_id": self.settings.oidc_client_id,
                "redirect_uri": "https://newapi.infermesh.test/oauth/oidc",
                "response_type": "code",
                "scope": "openid profile email",
                "state": "oidc-state",
            },
            follow_redirects=False,
        )

        self.assertEqual(response.status_code, 303)
        self.assertIn("/login?next=", response.headers["location"])
        self.assertIn("oauth%2Fauthorize", response.headers["location"])

    def test_oidc_token_and_userinfo_complete_authorization_code_flow(self) -> None:
        code, redirect_uri = self._authorize_oidc_code()

        token_response = self.client.post(
            "/oauth/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
                "client_id": self.settings.oidc_client_id,
                "client_secret": self.settings.oidc_client_secret,
            },
        )

        self.assertEqual(token_response.status_code, 200)
        token_payload = token_response.json()
        self.assertEqual(token_payload["token_type"], "Bearer")
        self.assertEqual(token_payload["scope"], "openid profile email")
        self.assertTrue(token_payload["access_token"].startswith("ctxat_"))
        self.assertTrue(token_payload["id_token"])

        userinfo_response = self.client.get(
            "/oauth/userinfo",
            headers={"authorization": f"Bearer {token_payload['access_token']}"},
        )
        self.assertEqual(userinfo_response.status_code, 200)
        userinfo = userinfo_response.json()
        self.assertEqual(userinfo["email"], "yeyitech@gmail.com")
        self.assertEqual(userinfo["preferred_username"], "yeyitech")

    def test_oidc_token_validates_pkce(self) -> None:
        code_verifier = "pkce-verifier-1234567890"
        code_challenge = "U0RIF4P8X7U3t7c6JtS6b8I6J0u2nW0V2y4W4v6Pv0M"
        code, redirect_uri = self._authorize_oidc_code(
            code_challenge=code_challenge,
            code_challenge_method="S256",
        )

        token_response = self.client.post(
            "/oauth/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
                "client_id": self.settings.oidc_client_id,
                "client_secret": self.settings.oidc_client_secret,
                "code_verifier": code_verifier,
            },
        )

        self.assertEqual(token_response.status_code, 400)
        self.assertEqual(token_response.json()["error"], "invalid_grant")

    def test_oidc_token_requires_valid_client_secret(self) -> None:
        code, redirect_uri = self._authorize_oidc_code()

        token_response = self.client.post(
            "/oauth/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
                "client_id": self.settings.oidc_client_id,
                "client_secret": "wrong-secret",
            },
        )

        self.assertEqual(token_response.status_code, 401)
        self.assertEqual(token_response.json()["error"], "invalid_client")

    def test_oauth_callback_allows_remote_contextgo_return_url(self) -> None:
        next_url = "https://remote.contextgo.io/login"
        start_response = self.client.get(f"/api/auth/oauth/google/start?next={next_url}", follow_redirects=False)
        self.assertEqual(start_response.status_code, 302)

        redirect_url = start_response.headers["location"]
        state = parse_qs(urlparse(redirect_url).query)["state"][0]
        profile = self.oauth_module.OAuthProfile(
            provider="google",
            provider_user_id="google-user-2",
            email="yeyitech@gmail.com",
            email_verified=True,
            username_candidate="yeyitech",
            display_name="Yeyi Tech",
            avatar_url="https://example.com/avatar.png",
        )

        with patch.object(
            self.app_module,
            "exchange_code_for_profile",
            AsyncMock(return_value=profile),
        ):
            callback_response = self.client.get(
                f"/api/auth/oauth/google/callback?state={state}&code=test-code",
                follow_redirects=False,
            )

        self.assertEqual(callback_response.status_code, 303)
        self.assertEqual(callback_response.headers["location"], next_url)

    def test_oauth_callback_without_next_redirects_to_remote_devices(self) -> None:
        start_response = self.client.get("/api/auth/oauth/google/start", follow_redirects=False)
        self.assertEqual(start_response.status_code, 302)

        redirect_url = start_response.headers["location"]
        state = parse_qs(urlparse(redirect_url).query)["state"][0]
        profile = self.oauth_module.OAuthProfile(
            provider="google",
            provider_user_id="google-user-3",
            email="yeyitech@gmail.com",
            email_verified=True,
            username_candidate="yeyitech",
            display_name="Yeyi Tech",
            avatar_url="https://example.com/avatar.png",
        )

        with patch.object(
            self.app_module,
            "exchange_code_for_profile",
            AsyncMock(return_value=profile),
        ):
            callback_response = self.client.get(
                f"/api/auth/oauth/google/callback?state={state}&code=test-code",
                follow_redirects=False,
            )

        self.assertEqual(callback_response.status_code, 303)
        self.assertEqual(callback_response.headers["location"], "https://remote.contextgo.io/remote/devices")

    def test_oauth_callback_allows_mobile_browser_handoff_without_state_cookie(self) -> None:
        start_response = self.client.get("/api/auth/oauth/google/start?next=%2Fremote%2Fdevices", follow_redirects=False)
        self.assertEqual(start_response.status_code, 302)

        redirect_url = start_response.headers["location"]
        state = parse_qs(urlparse(redirect_url).query)["state"][0]
        profile = self.oauth_module.OAuthProfile(
            provider="google",
            provider_user_id="google-user-mobile",
            email="yeyitech@gmail.com",
            email_verified=True,
            username_candidate="yeyitech",
            display_name="Yeyi Tech",
            avatar_url="https://example.com/avatar.png",
        )

        self.client.cookies.pop(self.settings.oauth_state_cookie_name, None)

        with patch.object(
            self.app_module,
            "exchange_code_for_profile",
            AsyncMock(return_value=profile),
        ):
            callback_response = self.client.get(
                f"/api/auth/oauth/google/callback?state={state}&code=test-code",
                follow_redirects=False,
            )

        self.assertEqual(callback_response.status_code, 303)
        self.assertEqual(callback_response.headers["location"], "/remote/devices")

    def test_oauth_callback_rejects_mismatched_state_cookie_even_if_returned_state_exists(self) -> None:
        start_response = self.client.get("/api/auth/oauth/google/start?next=%2Fremote%2Fdevices", follow_redirects=False)
        self.assertEqual(start_response.status_code, 302)

        redirect_url = start_response.headers["location"]
        returned_state = parse_qs(urlparse(redirect_url).query)["state"][0]
        self.client.cookies.set(self.settings.oauth_state_cookie_name, "wrong-state")

        callback_response = self.client.get(
            f"/api/auth/oauth/google/callback?state={returned_state}&code=test-code",
            follow_redirects=False,
        )

        self.assertEqual(callback_response.status_code, 303)
        self.assertEqual(callback_response.headers["location"], "/login?oauthError=invalid_state&provider=google")

    def test_device_management_requires_browser_session(self) -> None:
        response = self.client.post(
            "/api/devices/register",
            json={
                "deviceName": "Mac mini",
                "platform": "macos",
                "deviceKind": "desktop",
            },
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["detail"], "Authentication required")

    def test_device_register_reuses_existing_device_for_same_identity(self) -> None:
        first = self._register_device(device_name="Studio", platform="macos")
        second = self._register_device(device_name="Studio", platform="macos")

        self.assertEqual(first["device"]["id"], second["device"]["id"])
        self.assertNotEqual(first["token"], second["token"])

        devices_payload = self.client.get("/api/devices").json()
        self.assertEqual(len(devices_payload["devices"]), 1)
        self.assertEqual(devices_payload["devices"][0]["deviceKind"], "desktop")

    def test_device_register_keeps_webui_and_desktop_bindings_separate(self) -> None:
        self._create_browser_session()

        desktop = self.client.post(
            "/api/devices/register",
            json={
                "deviceName": "Studio",
                "platform": "macos",
                "deviceKind": "desktop",
            },
        )
        self.assertEqual(desktop.status_code, 201)

        webui = self.client.post(
            "/api/devices/register",
            json={
                "deviceName": "Studio",
                "platform": "macos",
                "deviceKind": "webui",
            },
        )
        self.assertEqual(webui.status_code, 201)

        devices_payload = self.client.get("/api/devices").json()
        self.assertEqual(len(devices_payload["devices"]), 2)
        self.assertEqual(
            {device["deviceKind"] for device in devices_payload["devices"]},
            {"desktop", "webui"},
        )

    def test_device_register_list_and_revoke(self) -> None:
        registration = self._register_device()
        device = registration["device"]
        token = registration["token"]

        self.assertIsInstance(device["id"], str)
        self.assertTrue(token.startswith("ctxdev_"))

        list_response = self.client.get("/api/devices")
        self.assertEqual(list_response.status_code, 200)
        devices_payload = list_response.json()
        self.assertEqual(len(devices_payload["devices"]), 1)
        self.assertEqual(devices_payload["devices"][0]["status"], "active")

        revoke_response = self.client.post(f"/api/devices/{device['id']}/revoke")
        self.assertEqual(revoke_response.status_code, 200)
        self.assertEqual(revoke_response.json()["status"], "revoked")

        refreshed_devices = self.client.get("/api/devices").json()["devices"]
        self.assertEqual(refreshed_devices[0]["status"], "revoked")

    def test_remote_devices_report_cloud_relay_presence(self) -> None:
        registration = self._register_device()
        device = registration["device"]

        response = self.client.get("/api/remote/devices")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload["devices"]), 1)
        self.assertEqual(payload["devices"][0]["id"], device["id"])
        self.assertFalse(payload["devices"][0]["remoteStatus"]["connected"])
        self.assertEqual(payload["devices"][0]["remoteStatus"]["transport"], "cloud-relay")

    def test_remote_devices_hide_webui_bindings(self) -> None:
        self._create_browser_session()

        self.client.post(
            "/api/devices/register",
            json={
                "deviceName": "Studio",
                "platform": "macos",
                "deviceKind": "desktop",
            },
        )
        self.client.post(
            "/api/devices/register",
            json={
                "deviceName": "ContextGo WebUI on Studio",
                "platform": "macos",
                "deviceKind": "webui",
            },
        )

        api_payload = self.client.get("/api/remote/devices").json()
        self.assertEqual(len(api_payload["devices"]), 1)
        self.assertEqual(api_payload["devices"][0]["deviceKind"], "desktop")

        page_response = self.client.get("/remote/devices", headers={"host": "remote.contextgo.io"})
        self.assertEqual(page_response.status_code, 200)
        self.assertIn("Studio", page_response.text)
        self.assertNotIn("ContextGo WebUI on Studio", page_response.text)

    def test_remote_devices_hide_revoked_desktop_devices(self) -> None:
        registration = self._register_device(device_name="Studio", platform="macos")
        revoked_id = registration["device"]["id"]

        revoke_response = self.client.post(f"/api/devices/{revoked_id}/revoke")
        self.assertEqual(revoke_response.status_code, 200)

        replacement_response = self.client.post(
            "/api/devices/register",
            json={
                "deviceName": "Studio Dev",
                "platform": "macos",
                "deviceKind": "desktop",
            },
        )
        self.assertEqual(replacement_response.status_code, 201)

        api_payload = self.client.get("/api/remote/devices").json()
        self.assertEqual(len(api_payload["devices"]), 1)
        self.assertEqual(api_payload["devices"][0]["deviceName"], "Studio Dev")
        self.assertEqual(api_payload["devices"][0]["status"], "active")

        page_response = self.client.get("/remote/devices", headers={"host": "remote.contextgo.io"})
        self.assertEqual(page_response.status_code, 200)
        self.assertIn("Studio Dev", page_response.text)
        self.assertNotIn("macos · device revoked", page_response.text)
        self.assertNotIn("Studio</h2>", page_response.text)

    def test_remote_devices_page_redirects_to_login_with_next_path(self) -> None:
        response = self.client.get("/remote/devices", follow_redirects=False, headers={"host": "remote.contextgo.io"})

        self.assertEqual(response.status_code, 303)
        self.assertEqual(response.headers["location"], "/login?next=%2Fremote%2Fdevices")

        login_response = self.client.get(response.headers["location"])
        self.assertEqual(login_response.status_code, 200)
        self.assertIn("/api/auth/oauth/github/start?next=%2Fremote%2Fdevices", login_response.text)

    def test_mobile_shell_login_page_uses_shell_completion_redirect(self) -> None:
        response = self.client.get(
            "/login?next=/device/device-123",
            headers={
                "host": "remote.contextgo.io",
                "user-agent": "Mozilla/5.0 ContextGoMobileShell/1.0",
            },
        )

        self.assertEqual(response.status_code, 200)
        expected_next = (
            f"/api/auth/oauth/github/start?next={quote(self.settings.auth_base_url, safe='')}"
            "%2Fmobile-shell-login-complete%3Ftarget%3Dhttps%253A%252F%252Fremote.contextgo.io%252Fdevice%252Fdevice-123"
        )
        self.assertIn(
            expected_next,
            response.text,
        )

    def test_remote_devices_page_marks_registered_but_disconnected_devices_as_unavailable(self) -> None:
        self._register_device(device_name="Studio", platform="macos")

        response = self.client.get("/remote/devices", headers={"host": "remote.contextgo.io"})

        self.assertEqual(response.status_code, 200)
        self.assertIn("ContextGo Remote", response.text)
        self.assertIn("Studio", response.text)
        self.assertIn("macos · device active", response.text)
        self.assertIn("Unavailable", response.text)
        self.assertIn("Desktop is not connected to ContextGo Cloud relay right now.", response.text)

    def test_remote_devices_page_shows_disconnect_notices(self) -> None:
        self._create_browser_session()

        response = self.client.get(
            "/remote/devices?remoteNotice=session_replaced",
            headers={"host": "remote.contextgo.io"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("This hosted session was replaced.", response.text)
        self.assertIn("Another browser took over the live session.", response.text)

    def test_remote_devices_page_uses_cloud_relay_presence_for_available_and_live_session_states(self) -> None:
        registration = self._register_device(device_name="Studio", platform="macos")
        device = registration["device"]
        device_token = registration["token"]

        with self.client.websocket_connect(
            "/api/remote/device-connect",
            headers={"authorization": f"Bearer {device_token}"},
        ) as device_ws:
            hello = device_ws.receive_json()
            self.assertEqual(hello["type"], "hello")
            device_ws.send_json({"type": "hello", "browserEntry": {"url": "http://192.168.1.8:25809/", "ready": True}})

            available_response = self.client.get("/remote/devices", headers={"host": "remote.contextgo.io"})
            self.assertEqual(available_response.status_code, 200)
            self.assertIn("Available", available_response.text)
            self.assertIn("Desktop is online and ready through ContextGo Cloud relay.", available_response.text)
            self.assertIn(f'/device/{device["id"]}', available_response.text)
            self.assertIn("contextgo-remote://open?target=", available_response.text)

            with self.client.websocket_connect(f"/api/remote/client-connect?device_id={device['id']}") as client_ws:
                client_status = device_ws.receive_json()
                self.assertEqual(client_status["type"], "client_status")
                self.assertTrue(client_status["connected"])

                busy_response = self.client.get("/remote/devices", headers={"host": "remote.contextgo.io"})
                self.assertEqual(busy_response.status_code, 200)
                self.assertIn("Live session", busy_response.text)
                self.assertIn(
                    "Desktop is online and already attached to a browser session through ContextGo Cloud relay.",
                    busy_response.text,
                )

                client_ws.send_json({"name": "pong", "data": {"timestamp": 1}})

    def test_remote_devices_page_marks_device_without_browser_entry_as_unavailable(self) -> None:
        registration = self._register_device(device_name="Studio", platform="macos")
        device_token = registration["token"]

        with self.client.websocket_connect(
            "/api/remote/device-connect",
            headers={"authorization": f"Bearer {device_token}"},
        ) as device_ws:
            hello = device_ws.receive_json()
            self.assertEqual(hello["type"], "hello")
            response = self.client.get("/remote/devices", headers={"host": "remote.contextgo.io"})

        self.assertEqual(response.status_code, 200)
        self.assertIn("Unavailable", response.text)
        self.assertIn("Desktop relay is online through ContextGo Cloud relay, and ContextGo is still preparing the desktop browser entry.", response.text)
        self.assertIn("ContextGo Cloud relay is connected, but the desktop-hosted WebUI entry is not ready yet. Keep the desktop app running and retry in a moment.", response.text)

    def test_remote_app_page_redirects_to_login_and_preserves_device_query(self) -> None:
        response = self.client.get("/device/device-123", follow_redirects=False, headers={"host": "remote.contextgo.io"})

        self.assertEqual(response.status_code, 303)
        self.assertEqual(response.headers["location"], "/login?next=%2Fdevice%2Fdevice-123")

    def test_remote_app_page_serves_hosted_remote_shell_for_authenticated_user(self) -> None:
        self._create_browser_session()
        registration = self._register_device(device_name="Studio", platform="macos")
        device = registration["device"]
        device_token = registration["token"]

        with self.client.websocket_connect(
            "/api/remote/device-connect",
            headers={"authorization": f"Bearer {device_token}"},
        ) as device_ws:
            hello = device_ws.receive_json()
            self.assertEqual(hello["type"], "hello")
            device_ws.send_json(
                {
                    "type": "hello",
                    "browserEntry": {
                        "url": "official-remote://relay-ready",
                        "ready": True,
                    },
                }
            )

            response_holder: dict[str, object] = {}

            def fetch_remote_page() -> None:
                response_holder["response"] = self.client.get(
                    f"/device/{device['id']}",
                    follow_redirects=False,
                    headers={"host": "remote.contextgo.io"},
                )

            request_thread = threading.Thread(target=fetch_remote_page)
            request_thread.start()

            relay_request = device_ws.receive_json()
            self.assertEqual(relay_request["type"], "http_request")
            self.assertEqual(relay_request["request"]["method"], "GET")
            self.assertEqual(relay_request["request"]["path"], "/")

            device_ws.send_json(
                {
                    "type": "http_response",
                    "requestId": relay_request["requestId"],
                    "response": {
                        "statusCode": 200,
                        "headers": {
                            "content-type": "text/html; charset=utf-8",
                        },
                        "bodyBase64": base64.b64encode(
                            b'<!doctype html><html><body><div id="root">Desktop Remote</div><script type="module" src="/@vite/client"></script></body></html>'
                        ).decode("ascii"),
                        "setCookies": [],
                    },
                }
            )
            request_thread.join(timeout=3)

        response = response_holder.get("response")
        self.assertIsNotNone(response)
        assert response is not None
        self.assertEqual(response.status_code, 200)
        self.assertIn('Desktop Remote', response.text)
        self.assertIn('/@vite/client', response.text)
        self.assertIn(f'<base href="/device/{device["id"]}/">', response.text)
        self.assertNotIn('/assets/app.js', response.text)
        self.assertNotIn('http://192.168.1.8:25809/', response.text)

    def test_remote_runtime_requests_are_relayed_to_active_device(self) -> None:
        self._create_browser_session()
        registration = self._register_device(device_name="Studio", platform="macos")
        device = registration["device"]
        device_token = registration["token"]

        with self.client.websocket_connect(
            "/api/remote/device-connect",
            headers={"authorization": f"Bearer {device_token}"},
        ) as device_ws:
            hello = device_ws.receive_json()
            self.assertEqual(hello["type"], "hello")
            device_ws.send_json(
                {
                    "type": "hello",
                    "browserEntry": {
                        "url": "official-remote://relay-ready",
                        "ready": True,
                    },
                }
            )

            self.client.cookies.set("contextgo_remote_device", device["id"])

            asset_holder: dict[str, object] = {}

            def fetch_asset() -> None:
                asset_holder["response"] = self.client.get(
                    "/@vite/client",
                    headers={"host": "remote.contextgo.io"},
                )

            asset_thread = threading.Thread(target=fetch_asset)
            asset_thread.start()
            asset_request = device_ws.receive_json()
            self.assertEqual(asset_request["type"], "http_request")
            self.assertEqual(asset_request["request"]["path"], "/@vite/client")
            self.assertEqual(asset_request["request"]["query"], "")
            device_ws.send_json(
                {
                    "type": "http_response",
                    "requestId": asset_request["requestId"],
                    "response": {
                        "statusCode": 200,
                        "headers": {
                            "content-type": "application/javascript",
                        },
                        "bodyBase64": base64.b64encode(
                            (
                                'const serverHost = "localhost:5173/";\n'
                                'const hmrPort = 5173;\n'
                                'const socketHost = `${"localhost" || importMetaUrl.hostname}:${hmrPort || importMetaUrl.port}${"/"}`;\n'
                                'const directSocketHost = "localhost:5173/";\n'
                            ).encode("utf-8")
                        ).decode("ascii"),
                        "setCookies": [],
                    },
                }
            )
            asset_thread.join(timeout=3)

        asset_response = asset_holder.get("response")
        self.assertIsNotNone(asset_response)
        assert asset_response is not None
        self.assertEqual(asset_response.status_code, 200)
        self.assertIn(f'/api/remote/vite/{device["id"]}', asset_response.text)
        self.assertNotIn('localhost:5173/', asset_response.text)

    def test_mobile_shell_login_complete_redirects_back_to_shell_target(self) -> None:
        self._create_browser_session()

        response = self.client.get(
            "/mobile-shell-login-complete?target=https%3A%2F%2Fremote.contextgo.io%2Fdevice%2Fdevice-123",
            follow_redirects=False,
            headers={"host": "auth.contextgo.io"},
        )

        self.assertEqual(response.status_code, 303)
        self.assertEqual(
            response.headers["location"],
            "contextgo-remote://open?target=https%3A%2F%2Fremote.contextgo.io%2Fdevice%2Fdevice-123",
        )

    def test_mobile_shell_login_complete_sends_missing_session_back_to_remote_login(self) -> None:
        response = self.client.get(
            "/mobile-shell-login-complete?target=https%3A%2F%2Fremote.contextgo.io%2Fdevice%2Fdevice-123",
            follow_redirects=False,
            headers={"host": "auth.contextgo.io"},
        )

        self.assertEqual(response.status_code, 303)
        self.assertIn("contextgo-remote://open?target=", response.headers["location"])
        self.assertIn("oauthError%3Dmissing_session", response.headers["location"])

    def test_remote_root_redirects_to_devices_on_remote_host(self) -> None:
        response = self.client.get("/", follow_redirects=False, headers={"host": "remote.contextgo.io"})

        self.assertEqual(response.status_code, 307)
        self.assertEqual(response.headers["location"], "/remote/devices")

    def test_remote_devices_page_redirects_auth_host_requests_to_remote_host(self) -> None:
        response = self.client.get("/remote/devices", follow_redirects=False, headers={"host": "auth.contextgo.io"})

        self.assertEqual(response.status_code, 307)
        self.assertEqual(response.headers["location"], "https://remote.contextgo.io/remote/devices")

    def test_legacy_remote_app_url_is_not_served(self) -> None:
        response = self.client.get(
            "/remote/app/?device_id=device-123",
            follow_redirects=False,
            headers={"host": "remote.contextgo.io"},
        )

        self.assertEqual(response.status_code, 303)
        self.assertEqual(response.headers["location"], "/login?next=%2Fremote%2Fapp%2F%3Fdevice_id%3Ddevice-123")

    def test_renderer_build_root_prefers_explicit_environment_override(self) -> None:
        self.assertEqual(self.app_module.RENDERER_BUILD_ROOT, self.renderer_dir.resolve())

    def test_remote_auth_aliases_match_browser_runtime_expectations(self) -> None:
        session = self.client.get("/api/auth/user")
        self.assertEqual(session.status_code, 200)
        self.assertEqual(session.json(), {"success": True, "user": None})

        user, _ = self._create_browser_session()

        providers_response = self.client.get("/api/auth/oauth/providers")
        self.assertEqual(providers_response.status_code, 200)
        self.assertTrue(providers_response.json()["success"])
        self.assertIn("github", providers_response.json()["providers"])

        current_user_response = self.client.get("/api/auth/user")
        self.assertEqual(current_user_response.status_code, 200)
        self.assertEqual(current_user_response.json()["user"]["email"], user.email)

    def test_remote_relay_bridges_browser_client_and_device_connection(self) -> None:
        registration = self._register_device(device_name="Studio", platform="macos")
        device = registration["device"]
        device_token = registration["token"]

        with self.client.websocket_connect(
            "/api/remote/device-connect",
            headers={"authorization": f"Bearer {device_token}"},
        ) as device_ws:
            hello = device_ws.receive_json()
            self.assertEqual(hello["type"], "hello")
            self.assertEqual(hello["deviceId"], device["id"])

            remote_devices = self.client.get("/api/remote/devices").json()["devices"]
            self.assertTrue(remote_devices[0]["remoteStatus"]["connected"])

            with self.client.websocket_connect(f"/api/remote/client-connect?device_id={device['id']}") as client_ws:
                client_status = device_ws.receive_json()
                self.assertEqual(client_status["type"], "client_status")
                self.assertTrue(client_status["connected"])

                client_ws.send_json({"name": "conversation.get", "data": {"id": "conv-1"}})
                forwarded_to_device = device_ws.receive_json()
                self.assertEqual(forwarded_to_device["type"], "bridge")
                self.assertEqual(forwarded_to_device["payload"]["name"], "conversation.get")
                self.assertEqual(forwarded_to_device["payload"]["data"]["id"], "conv-1")

                device_ws.send_json(
                    {
                        "type": "bridge",
                        "payload": {
                            "name": "chat.response.stream",
                            "data": {"conversation_id": "conv-1", "type": "content"},
                        },
                    }
                )
                forwarded_to_client = client_ws.receive_json()
                self.assertEqual(forwarded_to_client["name"], "chat.response.stream")
                self.assertEqual(forwarded_to_client["data"]["conversation_id"], "conv-1")

    def test_remote_client_requires_authenticated_session(self) -> None:
        registration = self._register_device(device_name="Studio", platform="macos")
        device = registration["device"]
        device_token = registration["token"]

        with self.client.websocket_connect(
            "/api/remote/device-connect",
            headers={"authorization": f"Bearer {device_token}"},
        ):
            self.client.cookies.pop(self.settings.session_cookie_name, None)
            with self.assertRaises(WebSocketDisconnect):
                with self.client.websocket_connect(f"/api/remote/client-connect?device_id={device['id']}"):
                    pass

    def test_infermesh_provider_uses_browser_session(self) -> None:
        user, _session = self._create_browser_session()
        provider_payload = {
            "id": "infermesh-cloud-managed",
            "name": "InferMesh Cloud",
            "platform": "new-api",
            "baseUrl": "https://api.infermesh.test",
            "apiKey": "sk-test",
            "model": ["gpt-5.4"],
            "modelProtocols": {"gpt-5.4": "openai"},
        }

        with patch.object(
            self.app_module,
            "provision_infermesh_provider",
            AsyncMock(return_value=provider_payload),
        ) as provision:
            response = self.client.get("/api/integrations/infermesh/provider")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["provider"], provider_payload)
        provision.assert_awaited_once_with(self.settings, user)

    def test_infermesh_provider_accepts_device_token(self) -> None:
        registration = self._register_device(device_name="Studio", platform="macos")
        device_token = registration["token"]
        self.client.cookies.pop(self.settings.session_cookie_name, None)

        provider_payload = {
            "id": "infermesh-cloud-managed",
            "name": "InferMesh Cloud",
            "platform": "new-api",
            "baseUrl": "https://api.infermesh.test",
            "apiKey": "sk-test",
            "model": ["claude-sonnet-4"],
            "modelProtocols": {"claude-sonnet-4": "anthropic"},
        }

        with patch.object(
            self.app_module,
            "provision_infermesh_provider",
            AsyncMock(return_value=provider_payload),
        ):
            response = self.client.get(
                "/api/integrations/infermesh/provider",
                headers={"Authorization": f"Bearer {device_token}"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["provider"]["apiKey"], "sk-test")

    def test_sync_requires_device_token(self) -> None:
        response = self.client.post("/api/sync/push", json={"changes": []})
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["detail"], "Device token is required")

    def test_logout_redirect_allows_remote_contextgo_return_url(self) -> None:
        self._create_browser_session()

        response = self.client.get(
            "/api/auth/logout?next=https://remote.contextgo.io/login",
            follow_redirects=False,
        )

        self.assertEqual(response.status_code, 303)
        self.assertEqual(response.headers["location"], "https://remote.contextgo.io/login")

    def test_desktop_login_page_offers_continue_and_cancel_actions(self) -> None:
        response = self.client.get("/login?provider=github&desktop=1")

        self.assertEqual(response.status_code, 200)
        body = response.text
        self.assertIn("Continue with GitHub", body)
        self.assertNotIn("Continue with Google", body)
        self.assertIn(
            'href="/api/auth/oauth/github/start?next=%2Fdesktop-login-complete%3Fprovider%3Dgithub&amp;desktop=1"',
            body,
        )
        self.assertIn('href="/desktop-login-complete?provider=github&amp;error=cancelled"', body)
        self.assertIn("Cancel and Close", body)

    def test_login_page_shows_cancelled_message(self) -> None:
        response = self.client.get("/login?cancel=1")

        self.assertEqual(response.status_code, 200)
        self.assertIn("Login cancelled. You can close this window safely.", response.text)

    def test_login_page_uses_accept_language_for_localized_copy(self) -> None:
        response = self.client.get("/login?cancel=1", headers={"accept-language": "zh-CN,zh;q=0.9"})

        self.assertEqual(response.status_code, 200)
        self.assertIn("ContextGo 账号", response.text)
        self.assertIn("已取消登录。现在可以安全关闭此窗口。", response.text)

    def test_remote_devices_page_uses_synced_user_language(self) -> None:
        registration = self._register_device(device_name="Studio", platform="macos")
        self.db_module.apply_sync_changes(
            self.settings,
            registration["device"]["userId"],
            registration["device"]["id"],
            [
                {
                    "namespace": "preferences",
                    "key": "language",
                    "value": "zh-CN",
                    "deleted": False,
                    "clientUpdatedAt": "2026-04-01T12:00:00Z",
                }
            ],
        )

        response = self.client.get(
            "/remote/devices",
            headers={"host": "remote.contextgo.io", "accept-language": "en-US,en;q=0.9"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("ContextGo 远程访问", response.text)
        self.assertIn("当前登录为", response.text)
        self.assertIn("桌面端当前未连接到 ContextGo Cloud 中继。", response.text)

    def test_desktop_login_complete_page_uses_accept_language_for_errors(self) -> None:
        response = self.client.get(
            "/desktop-login-complete?provider=github&error=access_denied",
            headers={"accept-language": "zh-CN,zh;q=0.9"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("返回 ContextGo", response.text)
        self.assertIn("ContextGo 登录未完成：access_denied。", response.text)

    def test_remote_device_without_browser_entry_redirects_to_remote_notice(self) -> None:
        self._create_browser_session()
        registration = self._register_device(device_name="Studio", platform="macos")
        device = registration["device"]
        device_token = registration["token"]

        with self.client.websocket_connect(
            "/api/remote/device-connect",
            headers={"authorization": f"Bearer {device_token}"},
        ) as device_ws:
            hello = device_ws.receive_json()
            self.assertEqual(hello["type"], "hello")

            response = self.client.get(
                f"/device/{device['id']}",
                follow_redirects=False,
                headers={"host": "remote.contextgo.io", "accept-language": "zh-CN,zh;q=0.9"},
            )

        self.assertEqual(response.status_code, 303)
        self.assertEqual(response.headers["location"], "https://remote.contextgo.io/remote/devices?remoteNotice=browser_entry_unavailable")

    def test_desktop_login_complete_creates_deep_link_for_authenticated_browser_session(self) -> None:
        self._create_browser_session()

        response = self.client.get("/desktop-login-complete?provider=github")

        self.assertEqual(response.status_code, 200)
        self.assertIn("Browser sign-in succeeded. ContextGo should continue automatically.", response.text)
        self.assertIn("contextgo://cloud-login?code=", response.text)
        self.assertIn("provider=github", response.text)

    def test_desktop_login_complete_preserves_error_in_deep_link(self) -> None:
        response = self.client.get("/desktop-login-complete?provider=github&error=access_denied")

        self.assertEqual(response.status_code, 200)
        self.assertIn("contextgo://cloud-login?provider=github&amp;error=access_denied", response.text)
        self.assertIn("ContextGo sign-in could not be completed: access_denied.", response.text)

    def test_desktop_login_page_preserves_loopback_callback_actions(self) -> None:
        loopback = "http://127.0.0.1:43123/contextgo-cloud-login/test-flow"
        response = self.client.get(f"/login?provider=github&desktop=1&loopback={quote(loopback, safe='')}")

        self.assertEqual(response.status_code, 200)
        self.assertIn(quote(loopback, safe=''), response.text)
        self.assertIn(
            'href="/desktop-login-complete?provider=github&amp;error=cancelled&amp;loopback=',
            response.text,
        )
        self.assertIn("ContextGo will finish sign-in automatically", response.text)

    def test_desktop_login_complete_redirects_to_loopback_callback_with_code(self) -> None:
        self._create_browser_session()
        loopback = "http://127.0.0.1:43123/contextgo-cloud-login/test-flow"

        response = self.client.get(
            f"/desktop-login-complete?provider=github&loopback={quote(loopback, safe='')}",
            follow_redirects=False,
        )

        self.assertEqual(response.status_code, 303)
        redirected = response.headers["location"]
        parsed = urlparse(redirected)
        self.assertEqual(f"{parsed.scheme}://{parsed.netloc}{parsed.path}", loopback)
        self.assertEqual(parse_qs(parsed.query)["provider"], ["github"])
        self.assertEqual(len(parse_qs(parsed.query)["code"][0]), 43)

    def test_desktop_login_complete_redirects_to_loopback_callback_with_error(self) -> None:
        loopback = "http://127.0.0.1:43123/contextgo-cloud-login/test-flow"
        response = self.client.get(
            f"/desktop-login-complete?provider=github&error=access_denied&loopback={quote(loopback, safe='')}",
            follow_redirects=False,
        )

        self.assertEqual(response.status_code, 303)
        redirected = response.headers["location"]
        parsed = urlparse(redirected)
        self.assertEqual(f"{parsed.scheme}://{parsed.netloc}{parsed.path}", loopback)
        self.assertEqual(parse_qs(parsed.query)["provider"], ["github"])
        self.assertEqual(parse_qs(parsed.query)["error"], ["access_denied"])

    def test_desktop_login_complete_ignores_non_loopback_callback_url(self) -> None:
        self._create_browser_session()
        response = self.client.get(
            "/desktop-login-complete?provider=github&loopback=https%3A%2F%2Fevil.example%2Fcb",
            follow_redirects=False,
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("contextgo://cloud-login?code=", response.text)

    def test_desktop_login_consume_creates_session_from_one_time_code(self) -> None:
        user = self.db_module.create_user(
            settings=self.settings,
            email="yeyitech@gmail.com",
            username="yeyitech",
            display_name="Yeyi Tech",
            avatar_url=None,
        )
        code = self.db_module.create_desktop_login_code(self.settings, user.id, "google")

        consume_response = self.client.post("/api/auth/desktop/consume", json={"code": code})

        self.assertEqual(consume_response.status_code, 200)
        consume_payload = consume_response.json()
        self.assertTrue(consume_payload["success"])
        self.assertTrue(consume_payload["authenticated"])
        self.assertEqual(consume_payload["provider"], "google")
        self.assertEqual(consume_payload["user"]["email"], "yeyitech@gmail.com")

        session_response = self.client.get("/api/auth/session")
        self.assertEqual(session_response.status_code, 200)
        self.assertTrue(session_response.json()["authenticated"])

        second_consume = self.client.post("/api/auth/desktop/consume", json={"code": code})
        self.assertEqual(second_consume.status_code, 401)
        self.assertEqual(second_consume.json()["detail"], "Invalid or expired desktop login code")

    def test_oauth_callback_error_preserves_desktop_provider_context(self) -> None:
        start_response = self.client.get(
            "/api/auth/oauth/github/start",
            params={
                "next": "/desktop-login-complete?provider=github",
                "desktop": "1",
            },
            follow_redirects=False,
        )
        self.assertEqual(start_response.status_code, 302)

        redirect_url = start_response.headers["location"]
        state = parse_qs(urlparse(redirect_url).query)["state"][0]

        callback_response = self.client.get(
            f"/api/auth/oauth/github/callback?state={state}&error=access_denied",
            follow_redirects=False,
        )

        self.assertEqual(callback_response.status_code, 303)
        self.assertEqual(
            callback_response.headers["location"],
            "/desktop-login-complete?provider=github&error=access_denied",
        )

    def test_sync_push_pull_and_reject_stale_change(self) -> None:
        registration = self._register_device()
        raw_token = registration["token"]
        headers = {"Authorization": f"Bearer {raw_token}"}

        first_push = self.client.post(
            "/api/sync/push",
            headers=headers,
            json={
                "changes": [
                    {
                        "namespace": "preferences",
                        "key": "theme",
                        "value": {"mode": "light"},
                        "deleted": False,
                        "clientUpdatedAt": "2026-03-28T07:00:00Z",
                    }
                ]
            },
        )
        self.assertEqual(first_push.status_code, 200)
        first_payload = first_push.json()
        self.assertEqual(len(first_payload["accepted"]), 1)
        self.assertEqual(first_payload["rejected"], [])
        self.assertGreater(first_payload["cursor"], 0)

        pull_response = self.client.get("/api/sync/pull?cursor=0&limit=10", headers=headers)
        self.assertEqual(pull_response.status_code, 200)
        pull_payload = pull_response.json()
        self.assertEqual(len(pull_payload["events"]), 1)
        self.assertEqual(pull_payload["events"][0]["namespace"], "preferences")
        self.assertEqual(pull_payload["events"][0]["value"]["mode"], "light")
        self.assertFalse(pull_payload["hasMore"])

        stale_push = self.client.post(
            "/api/sync/push",
            headers=headers,
            json={
                "changes": [
                    {
                        "namespace": "preferences",
                        "key": "theme",
                        "value": {"mode": "dark"},
                        "deleted": False,
                        "clientUpdatedAt": "2026-03-28T06:59:59Z",
                    }
                ]
            },
        )
        self.assertEqual(stale_push.status_code, 200)
        stale_payload = stale_push.json()
        self.assertEqual(stale_payload["accepted"], [])
        self.assertEqual(stale_payload["rejected"][0]["reason"], "stale_change")
        self.assertEqual(stale_payload["cursor"], first_payload["cursor"])


if __name__ == "__main__":
    unittest.main()
