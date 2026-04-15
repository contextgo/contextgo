from __future__ import annotations

from copy import deepcopy
from typing import Any


class ObsidianSyncStore:
    def __init__(self) -> None:
        self.bindings: dict[str, dict[str, Any]] = {}
        self.replicas: dict[str, dict[str, Any]] = {}
        self.batches: list[dict[str, Any]] = []
        self.next_cursor = 1

    def register_replica(self, *, space_id: str, device_id: str, platform: str, vault_fingerprint: str) -> dict[str, Any]:
        vault_binding_id = f"vault_{space_id}"
        replica_id = f"replica_{device_id}"

        self.bindings.setdefault(
            vault_binding_id,
            {
                "vault_binding_id": vault_binding_id,
                "space_id": space_id,
                "last_global_cursor": 0,
            },
        )
        self.replicas[replica_id] = {
            "replica_id": replica_id,
            "vault_binding_id": vault_binding_id,
            "device_id": device_id,
            "platform": platform,
            "vault_fingerprint": vault_fingerprint,
            "applied_cursor": 0,
            "last_push_cursor": 0,
            "last_pull_cursor": 0,
        }
        return {
            "vault_binding_id": vault_binding_id,
            "replica_id": replica_id,
            "checkpoint": {"applied_cursor": 0},
        }

    def push_batch(
        self,
        *,
        vault_binding_id: str,
        replica_id: str,
        base_cursor: int,
        entries: list[dict[str, Any]],
    ) -> dict[str, Any]:
        assigned_cursor = self.next_cursor
        self.next_cursor += 1
        batch = {
            "vault_binding_id": vault_binding_id,
            "replica_id": replica_id,
            "base_cursor": base_cursor,
            "assigned_cursor": assigned_cursor,
            "entries": deepcopy(entries),
        }
        self.batches.append(batch)
        self.bindings[vault_binding_id]["last_global_cursor"] = assigned_cursor
        self.replicas[replica_id]["last_push_cursor"] = assigned_cursor
        return {"assigned_cursor": assigned_cursor}

    def pull_batches(self, *, vault_binding_id: str, replica_id: str, after_cursor: int) -> dict[str, Any]:
        pending = [
            deepcopy(batch)
            for batch in self.batches
            if batch["vault_binding_id"] == vault_binding_id
            and batch["assigned_cursor"] > after_cursor
            and batch["replica_id"] != replica_id
        ]
        if pending:
            self.replicas[replica_id]["last_pull_cursor"] = pending[-1]["assigned_cursor"]
            self.replicas[replica_id]["applied_cursor"] = pending[-1]["assigned_cursor"]
        return {"batches": pending}
