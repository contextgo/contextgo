from __future__ import annotations

from typing import Any

from . import db as default_db_module
from .config import Settings


class ObsidianSyncStore:
    def __init__(self, settings: Settings, db_module: Any = default_db_module) -> None:
        self.settings = settings
        self.db = db_module

    def register_replica(
        self,
        *,
        user_id: str,
        space_id: str,
        device_id: str,
        platform: str,
        vault_fingerprint: str,
        local_ready_state: str | None = None,
        root_tree_uri: str | None = None,
        local_directory_uri: str | None = None,
        landing_note_path: str | None = None,
    ) -> dict[str, Any]:
        return self.db.register_obsidian_replica(
            self.settings,
            user_id=user_id,
            space_id=space_id,
            device_id=device_id,
            platform=platform,
            vault_fingerprint=vault_fingerprint,
            local_ready_state=local_ready_state,
            root_tree_uri=root_tree_uri,
            local_directory_uri=local_directory_uri,
            landing_note_path=landing_note_path,
        )

    def push_batch(
        self,
        *,
        user_id: str,
        vault_binding_id: str,
        replica_id: str,
        base_cursor: int,
        entries: list[dict[str, Any]],
    ) -> dict[str, Any]:
        return self.db.push_obsidian_batch(
            self.settings,
            user_id=user_id,
            vault_binding_id=vault_binding_id,
            replica_id=replica_id,
            base_cursor=base_cursor,
            entries=entries,
        )

    def pull_batches(self, *, user_id: str, vault_binding_id: str, replica_id: str, after_cursor: int) -> dict[str, Any]:
        return self.db.pull_obsidian_batches(
            self.settings,
            user_id=user_id,
            vault_binding_id=vault_binding_id,
            replica_id=replica_id,
            after_cursor=after_cursor,
        )

    def get_binding_status(self, *, user_id: str, space_id: str) -> dict[str, Any] | None:
        return self.db.get_obsidian_binding_status(
            self.settings,
            user_id=user_id,
            space_id=space_id,
        )
