from __future__ import annotations

import importlib
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch
from urllib.parse import parse_qs, urlparse

from fastapi.testclient import TestClient

CLOUD_ROOT = Path(__file__).resolve().parents[1]
if str(CLOUD_ROOT) not in sys.path:
    sys.path.insert(0, str(CLOUD_ROOT))

MODULE_NAMES = (
    "contextgo_cloud.config",
    "contextgo_cloud.db",
    "contextgo_cloud.infermesh",
    "contextgo_cloud.oauth",
    "contextgo_cloud.app",
)

ENV_KEYS = (
    "CONTEXTGO_DATABASE_PATH",
    "CONTEXTGO_AUTH_BASE_URL",
    "CONTEXTGO_API_BASE_URL",
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
)


def unload_modules() -> None:
    for name in MODULE_NAMES:
        sys.modules.pop(name, None)


class CloudApiTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)

        self.previous_env = {key: os.environ.get(key) for key in ENV_KEYS}
        self.addCleanup(self._restore_environment)

        os.environ["CONTEXTGO_DATABASE_PATH"] = str(Path(self.temp_dir.name) / "contextgo-cloud.db")
        os.environ["CONTEXTGO_AUTH_BASE_URL"] = "http://testserver"
        os.environ["CONTEXTGO_API_BASE_URL"] = "http://testserver"
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
            },
        )
        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertTrue(payload["success"])
        return payload

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

    def test_device_management_requires_browser_session(self) -> None:
        response = self.client.post(
            "/api/devices/register",
            json={
                "deviceName": "Mac mini",
                "platform": "macos",
            },
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["detail"], "Authentication required")

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
