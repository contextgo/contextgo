from __future__ import annotations

import unittest

from tests.test_cloud_api import CloudApiTestCase


class ObsidianSyncApiTestCase(unittest.TestCase):
    def setUp(self) -> None:
        CloudApiTestCase.setUp(self)

    def _restore_environment(self) -> None:
        CloudApiTestCase._restore_environment(self)

    def _create_browser_session(self):
        return CloudApiTestCase._create_browser_session(self)

    def _register_device(self, device_name: str = "Mac mini", platform: str = "macos"):
        return CloudApiTestCase._register_device(self, device_name=device_name, platform=platform)
    def test_register_replica_returns_binding_and_checkpoint(self) -> None:
        registration = self._register_device(device_name="Studio", platform="macos")
        headers = {"Authorization": f"Bearer {registration['token']}"}

        response = self.client.post(
            "/api/obsidian-sync/replicas/register",
            headers=headers,
            json={
                "spaceId": "space_1",
                "deviceId": registration["device"]["id"],
                "platform": "desktop",
                "vaultFingerprint": "vault_hash_1",
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["success"])
        self.assertEqual(payload["vaultBindingId"], "vault_space_1")
        self.assertEqual(payload["replicaId"], f"replica_{registration['device']['id']}")
        self.assertEqual(payload["checkpoint"]["appliedCursor"], 0)

    def test_push_change_batch_assigns_global_cursor(self) -> None:
        registration = self._register_device(device_name="Studio", platform="macos")
        headers = {"Authorization": f"Bearer {registration['token']}"}
        binding = self.client.post(
            "/api/obsidian-sync/replicas/register",
            headers=headers,
            json={
                "spaceId": "space_1",
                "deviceId": registration["device"]["id"],
                "platform": "desktop",
                "vaultFingerprint": "vault_hash_1",
            },
        ).json()

        response = self.client.post(
            "/api/obsidian-sync/batches/push",
            headers=headers,
            json={
                "vaultBindingId": binding["vaultBindingId"],
                "replicaId": binding["replicaId"],
                "baseCursor": 0,
                "entries": [
                    {
                        "path": "Space Home.md",
                        "fileClass": "content",
                        "contentHash": "h1",
                        "body": "# home",
                    }
                ],
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["success"])
        self.assertEqual(payload["assignedCursor"], 1)

    def test_pull_batches_returns_pending_changes_for_another_replica(self) -> None:
        desktop = self._register_device(device_name="Studio", platform="macos")
        mobile = self._register_device(device_name="iPhone", platform="ios")
        desktop_headers = {"Authorization": f"Bearer {desktop['token']}"}
        mobile_headers = {"Authorization": f"Bearer {mobile['token']}"}

        desktop_binding = self.client.post(
            "/api/obsidian-sync/replicas/register",
            headers=desktop_headers,
            json={
                "spaceId": "space_1",
                "deviceId": desktop["device"]["id"],
                "platform": "desktop",
                "vaultFingerprint": "vault_hash_1",
            },
        ).json()
        mobile_binding = self.client.post(
            "/api/obsidian-sync/replicas/register",
            headers=mobile_headers,
            json={
                "spaceId": "space_1",
                "deviceId": mobile["device"]["id"],
                "platform": "mobile",
                "vaultFingerprint": "vault_hash_1",
            },
        ).json()

        push_response = self.client.post(
            "/api/obsidian-sync/batches/push",
            headers=desktop_headers,
            json={
                "vaultBindingId": desktop_binding["vaultBindingId"],
                "replicaId": desktop_binding["replicaId"],
                "baseCursor": 0,
                "entries": [
                    {
                        "path": "Space Home.md",
                        "fileClass": "content",
                        "contentHash": "h1",
                        "body": "# home",
                    }
                ],
            },
        )
        self.assertEqual(push_response.status_code, 200)

        pull_response = self.client.post(
            "/api/obsidian-sync/batches/pull",
            headers=mobile_headers,
            json={
                "vaultBindingId": mobile_binding["vaultBindingId"],
                "replicaId": mobile_binding["replicaId"],
                "afterCursor": 0,
            },
        )

        self.assertEqual(pull_response.status_code, 200)
        payload = pull_response.json()
        self.assertTrue(payload["success"])
        self.assertEqual(len(payload["batches"]), 1)
        self.assertEqual(payload["batches"][0]["assignedCursor"], 1)
