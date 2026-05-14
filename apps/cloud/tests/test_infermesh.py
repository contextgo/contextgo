from __future__ import annotations

import sys
import unittest
from pathlib import Path
from typing import Any
from unittest.mock import patch

CLOUD_ROOT = Path(__file__).resolve().parents[1]
if str(CLOUD_ROOT) not in sys.path:
    sys.path.insert(0, str(CLOUD_ROOT))

from contextgo_cloud.config import Settings
from contextgo_cloud.db import User
from contextgo_cloud.infermesh import list_infermesh_token_groups, provision_infermesh_provider


class FakeResponse:
    def __init__(self, status_code: int, payload: Any = None, text: str = "") -> None:
        self.status_code = status_code
        self._payload = payload
        self.text = text
        self.is_success = 200 <= status_code < 300

    def json(self) -> Any:
        if isinstance(self._payload, BaseException):
            raise self._payload
        return self._payload

    def raise_for_status(self) -> None:
        if not self.is_success:
            raise RuntimeError(f"HTTP {self.status_code}")


class FakeAsyncClient:
    def __init__(self, responses: list[FakeResponse]) -> None:
        self.responses = responses
        self.requests: list[dict[str, Any]] = []

    async def __aenter__(self) -> "FakeAsyncClient":
        return self

    async def __aexit__(self, _exc_type: object, _exc: object, _tb: object) -> None:
        return None

    async def get(self, url: str, **kwargs: Any) -> FakeResponse:
        return self._next("GET", url, kwargs)

    async def post(self, url: str, **kwargs: Any) -> FakeResponse:
        return self._next("POST", url, kwargs)

    async def put(self, url: str, **kwargs: Any) -> FakeResponse:
        return self._next("PUT", url, kwargs)

    def _next(self, method: str, url: str, kwargs: dict[str, Any]) -> FakeResponse:
        self.requests.append({"method": method, "url": url, "kwargs": kwargs})
        if not self.responses:
            raise AssertionError(f"Unexpected request: {method} {url}")
        return self.responses.pop(0)


def build_settings() -> Settings:
    return Settings(
        database_path=":memory:",
        auth_base_url="https://auth.contextgo.io",
        api_base_url="https://api.contextgo.io",
        remote_base_url="https://remote.contextgo.io",
        session_cookie_domain=None,
        allowed_emails=(),
        github_client_id="github-id",
        github_client_secret="github-secret",
        google_client_id="google-id",
        google_client_secret="google-secret",
        infermesh_api_base_url="https://api.infermesh.test",
        infermesh_console_base_url="https://newapi.infermesh.test",
        infermesh_portal_url="https://infermesh.test",
        infermesh_admin_base_url="https://newapi-admin.infermesh.test",
        infermesh_admin_username="root",
        infermesh_admin_password="root-password",
        infermesh_admin_access_client_id=None,
        infermesh_admin_access_client_secret=None,
        infermesh_password_secret="password-secret",
        infermesh_username_prefix="cg",
        infermesh_provider_name="InferMesh Cloud",
        oidc_client_id="infermesh-oidc",
        oidc_client_secret="oidc-secret",
        oidc_client_name="InferMesh",
        oidc_redirect_uris=("https://newapi.infermesh.test/oauth/oidc",),
        oidc_signing_key_pem=None,
        oidc_signing_key_id="test-key",
    )


def build_user() -> User:
    return User(
        id="c5236b90-d204-4438-a4e1-949dae6fa57b",
        email="yeyitech@gmail.com",
        username="yeyitech",
        display_name="Yeyi",
        avatar_url=None,
        created_at="2026-05-11T00:00:00+00:00",
        updated_at="2026-05-11T00:00:00+00:00",
        last_login_at=None,
    )


class InfermeshIntegrationTestCase(unittest.IsolatedAsyncioTestCase):
    async def test_token_groups_falls_back_to_default_when_group_endpoint_is_not_json(self) -> None:
        fake_client = FakeAsyncClient([FakeResponse(404, ValueError("not json"), text="<html></html>")])

        with patch("contextgo_cloud.infermesh.httpx.AsyncClient", return_value=fake_client):
            groups = await list_infermesh_token_groups(build_settings())

        self.assertEqual(groups, [{"name": "default", "displayName": "default"}])
        self.assertEqual(fake_client.requests[0]["url"], "https://newapi.infermesh.test/api/group/")

    async def test_provider_resets_existing_contextgo_user_password_before_creating_token(self) -> None:
        settings = build_settings()
        user = build_user()
        existing_username = "cgo-c5236b90"
        fake_client = FakeAsyncClient(
            [
                FakeResponse(200, {"success": False, "message": "用户名或密码错误，或用户已被封禁"}),
                FakeResponse(200, {"success": True, "data": {"id": 1}}),
                FakeResponse(500, {"success": False, "message": "Error 1062 (23000): Duplicate entry 'cgo-c5236b90' for key 'users.username'"}),
                FakeResponse(200, {"success": True, "data": {"items": [{"id": 2, "username": existing_username}]}}),
                FakeResponse(
                    200,
                    {
                        "success": True,
                        "data": {
                            "id": 2,
                            "username": existing_username,
                            "display_name": "Existing",
                            "role": 1,
                            "status": 1,
                            "group": "default",
                            "quota": 0,
                            "remark": "",
                        },
                    },
                ),
                FakeResponse(200, {"success": True}),
                FakeResponse(200, {"success": True, "data": {"id": 2}}),
                FakeResponse(200, {"success": True, "data": {"items": []}}),
                FakeResponse(200, {"success": True, "data": {"items": []}}),
                FakeResponse(200, {"success": True, "data": {}}),
                FakeResponse(
                    200,
                    {
                        "success": True,
                        "data": {
                            "items": [
                                {
                                    "id": 11,
                                    "name": "ContextGo Auto Connect (default)",
                                    "group": "default",
                                }
                            ]
                        },
                    },
                ),
                FakeResponse(200, {"success": True, "data": {"key": "sk-infermesh"}}),
                FakeResponse(200, {"data": [{"id": "gpt-5.4"}]}),
            ]
        )

        with patch("contextgo_cloud.infermesh.httpx.AsyncClient", return_value=fake_client):
            provider = await provision_infermesh_provider(settings, user, group="default")

        self.assertEqual(provider["apiKey"], "sk-infermesh")
        self.assertEqual(provider["model"], ["gpt-5.4"])
        reset_request = next(item for item in fake_client.requests if item["method"] == "PUT")
        self.assertEqual(reset_request["url"], "https://newapi-admin.infermesh.test/api/user/")
        self.assertEqual(reset_request["kwargs"]["json"]["username"], existing_username)
        self.assertTrue(reset_request["kwargs"]["json"]["password"].startswith("Cg"))

    async def test_provider_falls_back_to_unfiltered_token_search_when_keyword_search_misses(self) -> None:
        settings = build_settings()
        user = build_user()
        fake_client = FakeAsyncClient(
            [
                FakeResponse(200, {"success": True, "data": {"id": 2}}),
                FakeResponse(200, {"success": True, "data": {"items": []}}),
                FakeResponse(
                    200,
                    {
                        "success": True,
                        "data": {
                            "items": [
                                {
                                    "id": 11,
                                    "name": "ContextGo Auto Connect (default)",
                                    "group": "default",
                                }
                            ]
                        },
                    },
                ),
                FakeResponse(200, {"success": True, "data": {"key": "sk-infermesh"}}),
                FakeResponse(200, {"data": [{"id": "gpt-5.4"}]}),
            ]
        )

        with patch("contextgo_cloud.infermesh.httpx.AsyncClient", return_value=fake_client):
            provider = await provision_infermesh_provider(settings, user, group="default")

        self.assertEqual(provider["apiKey"], "sk-infermesh")
        search_requests = [item for item in fake_client.requests if item["url"].endswith("/api/token/search")]
        create_token_requests = [item for item in fake_client.requests if item["url"].endswith("/api/token/")]
        self.assertEqual(search_requests[0]["kwargs"]["params"]["keyword"], "ContextGo Auto Connect")
        self.assertEqual(search_requests[1]["kwargs"]["params"]["keyword"], "")
        self.assertEqual(create_token_requests, [])


if __name__ == "__main__":
    unittest.main()
