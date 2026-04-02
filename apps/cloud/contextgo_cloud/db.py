from __future__ import annotations

import hashlib
import json
import secrets
import sqlite3
import uuid
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterator, Optional

from .config import Settings


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def utc_now_iso() -> str:
    return utc_now().isoformat()


def normalize_email(email: str) -> str:
    return email.strip().lower()


def sanitize_username_candidate(value: str) -> str:
    normalized = []
    for char in value.strip().lower():
        if char.isalnum() or char in {"-", "_"}:
            normalized.append(char)
        else:
            normalized.append("-")

    compact = "".join(normalized)
    while "--" in compact:
        compact = compact.replace("--", "-")
    while "__" in compact:
        compact = compact.replace("__", "_")
    compact = compact.strip("-_")
    base = compact or "user"
    if len(base) < 3:
        base = f"user-{base}"

    trimmed = base[:32].strip("-_")
    return trimmed or "user"


def create_token() -> str:
    return secrets.token_urlsafe(32)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class User:
    id: str
    email: str
    username: str
    display_name: str
    avatar_url: Optional[str]
    created_at: str
    updated_at: str
    last_login_at: Optional[str]


@dataclass(frozen=True)
class Session:
    token: str
    user: User
    expires_at: str


@dataclass(frozen=True)
class OidcAuthorizationCode:
    code: str
    client_id: str
    user_id: str
    redirect_uri: str
    scope: str
    code_challenge: Optional[str]
    code_challenge_method: Optional[str]
    nonce: Optional[str]
    expires_at: str


@dataclass(frozen=True)
class OidcAccessToken:
    token: str
    user_id: str
    client_id: str
    scope: str
    expires_at: str


@dataclass(frozen=True)
class Device:
    id: str
    user_id: str
    device_name: str
    platform: str
    device_kind: str
    status: str
    created_at: str
    updated_at: str
    last_seen_at: str
    last_ip_address: Optional[str]
    last_user_agent: Optional[str]


@dataclass(frozen=True)
class SyncEvent:
    cursor: int
    namespace: str
    key: str
    value: Any
    deleted: bool
    client_updated_at: str
    created_at: str
    device_id: Optional[str]


@contextmanager
def get_connection(settings: Settings) -> Iterator[sqlite3.Connection]:
    connection = sqlite3.connect(settings.database_path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode = WAL")
    connection.execute("PRAGMA foreign_keys = ON")

    try:
        yield connection
        connection.commit()
    finally:
        connection.close()


def _table_columns(connection: sqlite3.Connection, table_name: str) -> set[str]:
    rows = connection.execute(f"PRAGMA table_info({table_name})").fetchall()
    return {str(row["name"]) for row in rows}


def _ensure_device_kind_column(connection: sqlite3.Connection) -> None:
    device_columns = _table_columns(connection, "devices")
    if "device_kind" not in device_columns:
        connection.execute("ALTER TABLE devices ADD COLUMN device_kind TEXT NOT NULL DEFAULT 'desktop'")

    connection.execute(
        "UPDATE devices SET device_kind = 'desktop' WHERE TRIM(COALESCE(device_kind, '')) = ''"
    )


def _cleanup_duplicate_devices(connection: sqlite3.Connection) -> None:
    rows = connection.execute(
        """
        SELECT id, user_id, device_name, platform, device_kind, status, updated_at, created_at
        FROM devices
        ORDER BY
          CASE status WHEN 'active' THEN 0 ELSE 1 END,
          updated_at DESC,
          created_at DESC,
          id DESC
        """
    ).fetchall()

    seen: set[tuple[str, str, str, str]] = set()
    duplicate_ids: list[str] = []
    for row in rows:
        key = (
            str(row["user_id"]),
            str(row["device_name"]),
            str(row["platform"]),
            str(row["device_kind"] or "desktop"),
        )
        if key in seen:
            duplicate_ids.append(str(row["id"]))
            continue

        seen.add(key)

    if not duplicate_ids:
        return

    placeholders = ", ".join(["?"] * len(duplicate_ids))
    connection.execute(f"DELETE FROM devices WHERE id IN ({placeholders})", duplicate_ids)


def _ensure_device_identity_index(connection: sqlite3.Connection) -> None:
    connection.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_user_identity
        ON devices (user_id, device_name, platform, device_kind)
        """
    )


def initialize_database(settings: Settings) -> None:
    database_path = Path(settings.database_path)
    database_path.parent.mkdir(parents=True, exist_ok=True)

    with get_connection(settings) as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
              id TEXT PRIMARY KEY,
              email TEXT NOT NULL UNIQUE,
              username TEXT NOT NULL UNIQUE,
              display_name TEXT NOT NULL,
              avatar_url TEXT,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              last_login_at TEXT
            );

            CREATE TABLE IF NOT EXISTS oauth_accounts (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              provider TEXT NOT NULL,
              provider_user_id TEXT NOT NULL,
              email TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              UNIQUE(provider, provider_user_id),
              FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS sessions (
              token_hash TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              created_at TEXT NOT NULL,
              expires_at TEXT NOT NULL,
              last_seen_at TEXT NOT NULL,
              ip_address TEXT,
              user_agent TEXT,
              FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS devices (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              device_name TEXT NOT NULL,
              platform TEXT NOT NULL,
              device_kind TEXT NOT NULL DEFAULT 'desktop',
              device_token_hash TEXT NOT NULL UNIQUE,
              status TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              last_seen_at TEXT NOT NULL,
              last_ip_address TEXT,
              last_user_agent TEXT,
              FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS oauth_states (
              state TEXT PRIMARY KEY,
              provider TEXT NOT NULL,
              next_path TEXT NOT NULL,
              created_at TEXT NOT NULL,
              expires_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS desktop_login_codes (
              code TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              provider TEXT NOT NULL,
              created_at TEXT NOT NULL,
              expires_at TEXT NOT NULL,
              FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS oidc_authorization_codes (
              code_hash TEXT PRIMARY KEY,
              client_id TEXT NOT NULL,
              user_id TEXT NOT NULL,
              redirect_uri TEXT NOT NULL,
              scope TEXT NOT NULL,
              code_challenge TEXT,
              code_challenge_method TEXT,
              nonce TEXT,
              created_at TEXT NOT NULL,
              expires_at TEXT NOT NULL,
              FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS oidc_access_tokens (
              token_hash TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              client_id TEXT NOT NULL,
              scope TEXT NOT NULL,
              created_at TEXT NOT NULL,
              expires_at TEXT NOT NULL,
              FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS sync_items (
              user_id TEXT NOT NULL,
              namespace TEXT NOT NULL,
              item_key TEXT NOT NULL,
              value_json TEXT,
              deleted INTEGER NOT NULL DEFAULT 0,
              client_updated_at TEXT NOT NULL,
              server_version INTEGER NOT NULL,
              updated_at TEXT NOT NULL,
              updated_by_device_id TEXT,
              PRIMARY KEY (user_id, namespace, item_key),
              FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
              FOREIGN KEY(updated_by_device_id) REFERENCES devices(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS sync_events (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id TEXT NOT NULL,
              device_id TEXT,
              namespace TEXT NOT NULL,
              item_key TEXT NOT NULL,
              value_json TEXT,
              deleted INTEGER NOT NULL DEFAULT 0,
              client_updated_at TEXT NOT NULL,
              created_at TEXT NOT NULL,
              FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
              FOREIGN KEY(device_id) REFERENCES devices(id) ON DELETE SET NULL
            );
            """
        )
        _ensure_device_kind_column(connection)
        _cleanup_duplicate_devices(connection)
        _ensure_device_identity_index(connection)


def _row_to_user(row: Optional[sqlite3.Row]) -> Optional[User]:
    if row is None:
        return None

    return User(
        id=row["id"],
        email=row["email"],
        username=row["username"],
        display_name=row["display_name"],
        avatar_url=row["avatar_url"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        last_login_at=row["last_login_at"],
    )


def _row_to_device(row: Optional[sqlite3.Row]) -> Optional[Device]:
    if row is None:
        return None

    return Device(
        id=row["id"],
        user_id=row["user_id"],
        device_name=row["device_name"],
        platform=row["platform"],
        device_kind=row["device_kind"] if "device_kind" in row.keys() else "desktop",
        status=row["status"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        last_seen_at=row["last_seen_at"],
        last_ip_address=row["last_ip_address"],
        last_user_agent=row["last_user_agent"],
    )


def get_device_for_user(settings: Settings, user_id: str, device_id: str) -> Optional[Device]:
    with get_connection(settings) as connection:
        row = connection.execute(
            "SELECT * FROM devices WHERE id = ? AND user_id = ?",
            (device_id, user_id),
        ).fetchone()
    return _row_to_device(row)


def find_user_by_email(settings: Settings, email: str) -> Optional[User]:
    with get_connection(settings) as connection:
        row = connection.execute(
            "SELECT * FROM users WHERE email = ?",
            (normalize_email(email),),
        ).fetchone()
        return _row_to_user(row)


def find_user_by_oauth_account(settings: Settings, provider: str, provider_user_id: str) -> Optional[User]:
    with get_connection(settings) as connection:
        row = connection.execute(
            """
            SELECT users.*
            FROM oauth_accounts
            JOIN users ON users.id = oauth_accounts.user_id
            WHERE oauth_accounts.provider = ? AND oauth_accounts.provider_user_id = ?
            """,
            (provider, provider_user_id),
        ).fetchone()
        return _row_to_user(row)


def find_user_by_username(settings: Settings, username: str) -> Optional[User]:
    with get_connection(settings) as connection:
        row = connection.execute(
            "SELECT * FROM users WHERE username = ?",
            (username,),
        ).fetchone()
        return _row_to_user(row)


def find_user_by_id(settings: Settings, user_id: str) -> Optional[User]:
    with get_connection(settings) as connection:
        row = connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return _row_to_user(row)


def create_user(settings: Settings, email: str, username: str, display_name: str, avatar_url: Optional[str]) -> User:
    user_id = str(uuid.uuid4())
    now = utc_now_iso()
    normalized_email = normalize_email(email)

    with get_connection(settings) as connection:
        connection.execute(
            """
            INSERT INTO users (id, email, username, display_name, avatar_url, created_at, updated_at, last_login_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (user_id, normalized_email, username, display_name, avatar_url, now, now, now),
        )
        row = connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()

    user = _row_to_user(row)
    if user is None:
        raise RuntimeError("Failed to create user")

    return user


def update_user_profile(settings: Settings, user_id: str, display_name: str, avatar_url: Optional[str]) -> None:
    now = utc_now_iso()
    with get_connection(settings) as connection:
        connection.execute(
            """
            UPDATE users
            SET display_name = ?, avatar_url = ?, updated_at = ?, last_login_at = ?
            WHERE id = ?
            """,
            (display_name, avatar_url, now, now, user_id),
        )


def upsert_oauth_account(
    settings: Settings,
    user_id: str,
    provider: str,
    provider_user_id: str,
    email: str,
) -> None:
    now = utc_now_iso()
    with get_connection(settings) as connection:
        existing = connection.execute(
            """
            SELECT id FROM oauth_accounts
            WHERE provider = ? AND provider_user_id = ?
            """,
            (provider, provider_user_id),
        ).fetchone()

        if existing:
            connection.execute(
                """
                UPDATE oauth_accounts
                SET user_id = ?, email = ?, updated_at = ?
                WHERE id = ?
                """,
                (user_id, normalize_email(email), now, existing["id"]),
            )
            return

        connection.execute(
            """
            INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id, email, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                user_id,
                provider,
                provider_user_id,
                normalize_email(email),
                now,
                now,
            ),
        )


def allocate_username(settings: Settings, seed: str, email: str) -> str:
    base_candidate = sanitize_username_candidate(seed or email.split("@")[0] or "user")

    for index in range(100):
        suffix = "" if index == 0 else f"-{index + 1}"
        max_base_length = 32 - len(suffix)
        candidate_base = base_candidate[:max_base_length].strip("-_") or "user"
        candidate = f"{candidate_base}{suffix}"

        if find_user_by_username(settings, candidate) is None:
            return candidate

    raise RuntimeError("Failed to allocate username")


def create_session(
    settings: Settings,
    user: User,
    ip_address: Optional[str],
    user_agent: Optional[str],
) -> Session:
    raw_token = create_token()
    hashed = token_hash(raw_token)
    now = utc_now()
    expires_at = now + timedelta(seconds=settings.session_ttl_seconds)

    with get_connection(settings) as connection:
        connection.execute(
            """
            INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_seen_at, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                hashed,
                user.id,
                now.isoformat(),
                expires_at.isoformat(),
                now.isoformat(),
                ip_address,
                user_agent,
            ),
        )

    return Session(
        token=raw_token,
        user=user,
        expires_at=expires_at.isoformat(),
    )


def get_user_by_session_token(settings: Settings, raw_token: str) -> Optional[User]:
    hashed = token_hash(raw_token)
    now = utc_now_iso()

    with get_connection(settings) as connection:
        row = connection.execute(
            """
            SELECT users.*, sessions.expires_at
            FROM sessions
            JOIN users ON users.id = sessions.user_id
            WHERE sessions.token_hash = ?
            """,
            (hashed,),
        ).fetchone()

        if row is None:
            return None

        expires_at = row["expires_at"]
        if expires_at <= now:
            connection.execute("DELETE FROM sessions WHERE token_hash = ?", (hashed,))
            return None

        connection.execute(
            "UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?",
            (now, hashed),
        )

        return _row_to_user(row)


def delete_session(settings: Settings, raw_token: str) -> None:
    with get_connection(settings) as connection:
        connection.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash(raw_token),))


def cleanup_expired_rows(settings: Settings) -> None:
    now = utc_now_iso()
    with get_connection(settings) as connection:
        connection.execute("DELETE FROM sessions WHERE expires_at <= ?", (now,))
        connection.execute("DELETE FROM oauth_states WHERE expires_at <= ?", (now,))
        connection.execute("DELETE FROM desktop_login_codes WHERE expires_at <= ?", (now,))
        connection.execute("DELETE FROM oidc_authorization_codes WHERE expires_at <= ?", (now,))
        connection.execute("DELETE FROM oidc_access_tokens WHERE expires_at <= ?", (now,))


def create_oauth_state(settings: Settings, provider: str, next_path: str) -> str:
    state = create_token()
    now = utc_now()
    expires_at = now + timedelta(seconds=settings.oauth_state_ttl_seconds)

    with get_connection(settings) as connection:
        connection.execute(
            """
            INSERT INTO oauth_states (state, provider, next_path, created_at, expires_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (state, provider, next_path, now.isoformat(), expires_at.isoformat()),
        )

    return state


def create_desktop_login_code(settings: Settings, user_id: str, provider: str) -> str:
    code = create_token()
    now = utc_now()
    expires_at = now + timedelta(seconds=settings.oauth_state_ttl_seconds)

    with get_connection(settings) as connection:
        connection.execute(
            """
            INSERT INTO desktop_login_codes (code, user_id, provider, created_at, expires_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (code, user_id, provider, now.isoformat(), expires_at.isoformat()),
        )

    return code


def create_oidc_authorization_code(
    settings: Settings,
    *,
    client_id: str,
    user_id: str,
    redirect_uri: str,
    scope: str,
    code_challenge: Optional[str],
    code_challenge_method: Optional[str],
    nonce: Optional[str],
) -> str:
    code = create_token()
    now = utc_now()
    expires_at = now + timedelta(seconds=settings.oidc_authorization_code_ttl_seconds)

    with get_connection(settings) as connection:
        connection.execute(
            """
            INSERT INTO oidc_authorization_codes (
              code_hash, client_id, user_id, redirect_uri, scope,
              code_challenge, code_challenge_method, nonce, created_at, expires_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                token_hash(code),
                client_id,
                user_id,
                redirect_uri,
                scope,
                code_challenge,
                code_challenge_method,
                nonce,
                now.isoformat(),
                expires_at.isoformat(),
            ),
        )

    return code


def consume_oidc_authorization_code(settings: Settings, code: str) -> Optional[OidcAuthorizationCode]:
    now = utc_now_iso()
    hashed = token_hash(code)

    with get_connection(settings) as connection:
        row = connection.execute(
            """
            SELECT * FROM oidc_authorization_codes
            WHERE code_hash = ?
            """,
            (hashed,),
        ).fetchone()

        connection.execute(
            "DELETE FROM oidc_authorization_codes WHERE code_hash = ?",
            (hashed,),
        )

    if row is None or row["expires_at"] <= now:
        return None

    return OidcAuthorizationCode(
        code=code,
        client_id=row["client_id"],
        user_id=row["user_id"],
        redirect_uri=row["redirect_uri"],
        scope=row["scope"],
        code_challenge=row["code_challenge"],
        code_challenge_method=row["code_challenge_method"],
        nonce=row["nonce"],
        expires_at=row["expires_at"],
    )


def create_oidc_access_token(
    settings: Settings,
    *,
    user_id: str,
    client_id: str,
    scope: str,
) -> OidcAccessToken:
    token = f"ctxat_{create_token()}"
    now = utc_now()
    expires_at = now + timedelta(seconds=settings.oidc_access_token_ttl_seconds)

    with get_connection(settings) as connection:
        connection.execute(
            """
            INSERT INTO oidc_access_tokens (token_hash, user_id, client_id, scope, created_at, expires_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                token_hash(token),
                user_id,
                client_id,
                scope,
                now.isoformat(),
                expires_at.isoformat(),
            ),
        )

    return OidcAccessToken(
        token=token,
        user_id=user_id,
        client_id=client_id,
        scope=scope,
        expires_at=expires_at.isoformat(),
    )


def get_oidc_access_token(settings: Settings, token: str) -> Optional[OidcAccessToken]:
    now = utc_now_iso()
    hashed = token_hash(token)

    with get_connection(settings) as connection:
        row = connection.execute(
            """
            SELECT * FROM oidc_access_tokens
            WHERE token_hash = ?
            """,
            (hashed,),
        ).fetchone()

    if row is None:
        return None

    if row["expires_at"] <= now:
        with get_connection(settings) as connection:
            connection.execute("DELETE FROM oidc_access_tokens WHERE token_hash = ?", (hashed,))
        return None

    return OidcAccessToken(
        token=token,
        user_id=row["user_id"],
        client_id=row["client_id"],
        scope=row["scope"],
        expires_at=row["expires_at"],
    )


def consume_desktop_login_code(settings: Settings, code: str) -> Optional[tuple[User, str]]:
    now = utc_now_iso()

    with get_connection(settings) as connection:
        row = connection.execute(
            """
            SELECT code, user_id, provider, expires_at
            FROM desktop_login_codes
            WHERE code = ?
            """,
            (code,),
        ).fetchone()

        connection.execute(
            "DELETE FROM desktop_login_codes WHERE code = ?",
            (code,),
        )

    if row is None or row["expires_at"] <= now:
        return None

    user = find_user_by_id(settings, row["user_id"])
    if user is None:
        return None

    return user, row["provider"]


def peek_oauth_state(settings: Settings, state: str, provider: str) -> Optional[str]:
    now = utc_now_iso()

    with get_connection(settings) as connection:
        row = connection.execute(
            """
            SELECT next_path, expires_at FROM oauth_states
            WHERE state = ? AND provider = ?
            """,
            (state, provider),
        ).fetchone()

    if row is None or row["expires_at"] <= now:
        return None

    return row["next_path"]


def consume_oauth_state(settings: Settings, state: str, provider: str) -> Optional[str]:
    now = utc_now_iso()

    with get_connection(settings) as connection:
        row = connection.execute(
            """
            SELECT next_path, expires_at FROM oauth_states
            WHERE state = ? AND provider = ?
            """,
            (state, provider),
        ).fetchone()

        connection.execute(
            "DELETE FROM oauth_states WHERE state = ?",
            (state,),
        )

    if row is None or row["expires_at"] <= now:
        return None

    return row["next_path"]


def create_device(
    settings: Settings,
    user_id: str,
    device_name: str,
    platform: str,
    device_kind: str,
    ip_address: Optional[str],
    user_agent: Optional[str],
) -> tuple[Device, str]:
    normalized_device_name = device_name.strip() or "Unnamed device"
    normalized_platform = platform.strip() or "unknown"
    normalized_device_kind = device_kind.strip().lower() or "desktop"
    token = f"ctxdev_{create_token()}"
    now = utc_now_iso()

    with get_connection(settings) as connection:
        existing = connection.execute(
            """
            SELECT id, created_at
            FROM devices
            WHERE user_id = ? AND device_name = ? AND platform = ? AND device_kind = ?
            ORDER BY updated_at DESC
            LIMIT 1
            """,
            (user_id, normalized_device_name, normalized_platform, normalized_device_kind),
        ).fetchone()

        device_id = existing["id"] if existing else str(uuid.uuid4())
        created_at = existing["created_at"] if existing else now

        connection.execute(
            """
            INSERT INTO devices (
              id, user_id, device_name, platform, device_kind, device_token_hash, status,
              created_at, updated_at, last_seen_at, last_ip_address, last_user_agent
            )
            VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              device_name = excluded.device_name,
              platform = excluded.platform,
              device_kind = excluded.device_kind,
              device_token_hash = excluded.device_token_hash,
              status = 'active',
              updated_at = excluded.updated_at,
              last_seen_at = excluded.last_seen_at,
              last_ip_address = excluded.last_ip_address,
              last_user_agent = excluded.last_user_agent
            """,
            (
                device_id,
                user_id,
                normalized_device_name,
                normalized_platform,
                normalized_device_kind,
                token_hash(token),
                created_at,
                now,
                now,
                ip_address,
                user_agent,
            ),
        )

        connection.execute(
            """
            UPDATE devices
            SET status = 'revoked', updated_at = ?
            WHERE user_id = ? AND device_name = ? AND platform = ? AND device_kind = ? AND id <> ? AND status = 'active'
            """,
            (now, user_id, normalized_device_name, normalized_platform, normalized_device_kind, device_id),
        )
        row = connection.execute("SELECT * FROM devices WHERE id = ?", (device_id,)).fetchone()

    device = _row_to_device(row)
    if device is None:
        raise RuntimeError("Failed to create device")

    return device, token


def get_device_by_token(settings: Settings, raw_token: str) -> Optional[Device]:
    with get_connection(settings) as connection:
        row = connection.execute(
            """
            SELECT * FROM devices
            WHERE device_token_hash = ? AND status = 'active'
            """,
            (token_hash(raw_token),),
        ).fetchone()
        return _row_to_device(row)


def get_user_by_device_token(settings: Settings, raw_token: str) -> tuple[Optional[User], Optional[Device]]:
    hashed = token_hash(raw_token)
    with get_connection(settings) as connection:
        row = connection.execute(
            """
            SELECT devices.*, users.id AS user_id_alias, users.email, users.username, users.display_name,
                   users.avatar_url, users.created_at AS user_created_at, users.updated_at AS user_updated_at,
                   users.last_login_at
            FROM devices
            JOIN users ON users.id = devices.user_id
            WHERE devices.device_token_hash = ? AND devices.status = 'active'
            """,
            (hashed,),
        ).fetchone()

    if row is None:
        return None, None

    device = Device(
        id=row["id"],
        user_id=row["user_id"],
        device_name=row["device_name"],
        platform=row["platform"],
        device_kind=row["device_kind"] if "device_kind" in row.keys() else "desktop",
        status=row["status"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        last_seen_at=row["last_seen_at"],
        last_ip_address=row["last_ip_address"],
        last_user_agent=row["last_user_agent"],
    )
    user = User(
        id=row["user_id_alias"],
        email=row["email"],
        username=row["username"],
        display_name=row["display_name"],
        avatar_url=row["avatar_url"],
        created_at=row["user_created_at"],
        updated_at=row["user_updated_at"],
        last_login_at=row["last_login_at"],
    )
    return user, device


def list_devices_for_user(settings: Settings, user_id: str) -> list[Device]:
    with get_connection(settings) as connection:
        rows = connection.execute(
            """
            SELECT * FROM devices
            WHERE user_id = ?
            ORDER BY created_at DESC
            """,
            (user_id,),
        ).fetchall()

    return [device for row in rows if (device := _row_to_device(row)) is not None]


def revoke_device(settings: Settings, user_id: str, device_id: str) -> bool:
    now = utc_now_iso()
    with get_connection(settings) as connection:
        result = connection.execute(
            """
            UPDATE devices
            SET status = 'revoked', updated_at = ?
            WHERE id = ? AND user_id = ? AND status = 'active'
            """,
            (now, device_id, user_id),
        )
        return result.rowcount > 0


def touch_device(settings: Settings, device_id: str, ip_address: Optional[str], user_agent: Optional[str]) -> None:
    now = utc_now_iso()
    with get_connection(settings) as connection:
        connection.execute(
            """
            UPDATE devices
            SET updated_at = ?, last_seen_at = ?, last_ip_address = ?, last_user_agent = ?
            WHERE id = ?
            """,
            (now, now, ip_address, user_agent, device_id),
        )


def _parse_timestamp(value: str) -> datetime:
    normalized = value.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def apply_sync_changes(
    settings: Settings,
    user_id: str,
    device_id: Optional[str],
    changes: list[dict[str, Any]],
) -> dict[str, Any]:
    accepted: list[dict[str, Any]] = []
    rejected: list[dict[str, Any]] = []
    now = utc_now_iso()

    with get_connection(settings) as connection:
        latest_cursor_row = connection.execute(
            "SELECT COALESCE(MAX(id), 0) AS cursor FROM sync_events WHERE user_id = ?",
            (user_id,),
        ).fetchone()
        latest_cursor = int(latest_cursor_row["cursor"]) if latest_cursor_row is not None else 0

        for change in changes:
            namespace = str(change.get("namespace", "")).strip()
            item_key = str(change.get("key", "")).strip()
            client_updated_at = str(change.get("clientUpdatedAt", "")).strip()

            if not namespace or not item_key or not client_updated_at:
                rejected.append(
                    {
                        "namespace": namespace,
                        "key": item_key,
                        "reason": "invalid_payload",
                    }
                )
                continue

            try:
                incoming_time = _parse_timestamp(client_updated_at)
            except ValueError:
                rejected.append(
                    {
                        "namespace": namespace,
                        "key": item_key,
                        "reason": "invalid_timestamp",
                    }
                )
                continue

            current = connection.execute(
                """
                SELECT client_updated_at
                FROM sync_items
                WHERE user_id = ? AND namespace = ? AND item_key = ?
                """,
                (user_id, namespace, item_key),
            ).fetchone()

            if current is not None:
                current_time = _parse_timestamp(current["client_updated_at"])
                if incoming_time < current_time:
                    rejected.append(
                        {
                            "namespace": namespace,
                            "key": item_key,
                            "reason": "stale_change",
                        }
                    )
                    continue

            deleted = bool(change.get("deleted", False))
            value = None if deleted else change.get("value")
            value_json = None if deleted else json.dumps(value, ensure_ascii=False, separators=(",", ":"))

            cursor = connection.execute(
                """
                INSERT INTO sync_events (
                  user_id, device_id, namespace, item_key, value_json, deleted, client_updated_at, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id,
                    device_id,
                    namespace,
                    item_key,
                    value_json,
                    1 if deleted else 0,
                    client_updated_at,
                    now,
                ),
            ).lastrowid

            latest_cursor = max(latest_cursor, int(cursor))
            connection.execute(
                """
                INSERT INTO sync_items (
                  user_id, namespace, item_key, value_json, deleted,
                  client_updated_at, server_version, updated_at, updated_by_device_id
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id, namespace, item_key)
                DO UPDATE SET
                  value_json = excluded.value_json,
                  deleted = excluded.deleted,
                  client_updated_at = excluded.client_updated_at,
                  server_version = excluded.server_version,
                  updated_at = excluded.updated_at,
                  updated_by_device_id = excluded.updated_by_device_id
                """,
                (
                    user_id,
                    namespace,
                    item_key,
                    value_json,
                    1 if deleted else 0,
                    client_updated_at,
                    cursor,
                    now,
                    device_id,
                ),
            )
            accepted.append(
                {
                    "namespace": namespace,
                    "key": item_key,
                    "cursor": cursor,
                }
            )

    return {
        "accepted": accepted,
        "rejected": rejected,
        "cursor": latest_cursor,
    }


def pull_sync_events(settings: Settings, user_id: str, cursor: int, limit: int) -> dict[str, Any]:
    bounded_limit = max(1, min(limit, 500))
    with get_connection(settings) as connection:
        rows = connection.execute(
            """
            SELECT id, device_id, namespace, item_key, value_json, deleted, client_updated_at, created_at
            FROM sync_events
            WHERE user_id = ? AND id > ?
            ORDER BY id ASC
            LIMIT ?
            """,
            (user_id, cursor, bounded_limit + 1),
        ).fetchall()

    events: list[dict[str, Any]] = []
    next_cursor = cursor
    has_more = len(rows) > bounded_limit
    for row in rows[:bounded_limit]:
        next_cursor = max(next_cursor, int(row["id"]))
        events.append(
            {
                "cursor": row["id"],
                "deviceId": row["device_id"],
                "namespace": row["namespace"],
                "key": row["item_key"],
                "value": None if row["deleted"] else json.loads(row["value_json"]) if row["value_json"] else None,
                "deleted": bool(row["deleted"]),
                "clientUpdatedAt": row["client_updated_at"],
                "createdAt": row["created_at"],
            }
        )

    return {
        "events": events,
        "cursor": next_cursor,
        "hasMore": has_more,
    }
