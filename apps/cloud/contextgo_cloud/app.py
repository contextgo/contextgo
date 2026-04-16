from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from html import escape
import base64
import json
import os
from pathlib import Path
from typing import Any, Dict, Literal, Optional, Union
from urllib.parse import parse_qs, quote, urlencode, urlparse
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Query, Request, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse, Response
from starlette.datastructures import URL
from pydantic import BaseModel, Field

from .config import Settings, load_settings
from .db import (
    Device,
    OidcAccessToken,
    User,
    apply_sync_changes,
    allocate_username,
    cleanup_expired_rows,
    consume_oidc_authorization_code,
    consume_desktop_login_code,
    create_device,
    create_desktop_login_code,
    create_oidc_access_token,
    create_oidc_authorization_code,
    consume_oauth_state,
    create_oauth_state,
    create_session,
    create_user,
    delete_session,
    find_user_by_email,
    find_user_by_oauth_account,
    find_user_by_id,
    get_connection,
    get_device_for_user,
    get_oidc_access_token,
    get_user_by_device_token,
    get_user_by_session_token,
    initialize_database,
    list_devices_for_user,
    peek_oauth_state,
    pull_sync_events,
    revoke_device,
    touch_device,
    update_user_profile,
    upsert_oauth_account,
)
from .infermesh import (
    InfermeshProvisionError,
    build_infermesh_handoff_url,
    is_infermesh_configured,
    is_infermesh_handoff_configured,
    provision_infermesh_provider,
)
from .oidc import (
    OIDC_SUPPORTED_CLAIMS,
    OIDC_SUPPORTED_CLIENT_AUTH_METHODS,
    OIDC_SUPPORTED_ID_TOKEN_ALGORITHMS,
    OIDC_SUPPORTED_RESPONSE_TYPES,
    OIDC_SUPPORTED_SCOPES,
    OIDC_SUPPORTED_SUBJECT_TYPES,
    build_userinfo_payload,
    create_id_token,
    decode_basic_auth_header,
    load_oidc_signing_key,
    normalize_scope,
    validate_requested_scope,
    verify_pkce,
)
from .oauth import OAuthProfile, build_authorization_url, exchange_code_for_profile, get_enabled_providers, is_provider_enabled
from .obsidian_sync import ObsidianSyncStore
from .remote import RemoteHttpRelayResponse, RemoteRelayHub

ProviderId = Literal["github", "google"]


class DeviceRegisterRequest(BaseModel):
    deviceName: str = Field(min_length=1, max_length=120)
    platform: str = Field(default="unknown", min_length=1, max_length=64)
    deviceKind: str = Field(default="desktop", min_length=1, max_length=32)


class SyncChangePayload(BaseModel):
    namespace: str = Field(min_length=1, max_length=128)
    key: str = Field(min_length=1, max_length=256)
    value: Any = None
    deleted: bool = False
    clientUpdatedAt: str = Field(min_length=1, max_length=64)


class SyncPushRequest(BaseModel):
    changes: list[SyncChangePayload]


class ObsidianReplicaRegisterRequest(BaseModel):
    spaceId: str = Field(min_length=1, max_length=128)
    deviceId: Optional[str] = Field(default=None, min_length=1, max_length=128)
    platform: str = Field(min_length=1, max_length=64)
    vaultFingerprint: str = Field(min_length=1, max_length=256)
    localReadyState: Optional[str] = Field(default=None, max_length=64)
    rootTreeUri: Optional[str] = Field(default=None, max_length=4096)
    localDirectoryUri: Optional[str] = Field(default=None, max_length=4096)
    landingNotePath: Optional[str] = Field(default=None, max_length=1024)


class ObsidianBatchEntryPayload(BaseModel):
    path: str = Field(min_length=1, max_length=2048)
    fileClass: str = Field(min_length=1, max_length=64)
    contentHash: str = Field(min_length=1, max_length=256)
    body: Optional[str] = None


class ObsidianBatchPushRequest(BaseModel):
    vaultBindingId: str = Field(min_length=1, max_length=256)
    replicaId: str = Field(min_length=1, max_length=256)
    baseCursor: int = Field(ge=0)
    entries: list[ObsidianBatchEntryPayload]


class ObsidianBatchPullRequest(BaseModel):
    vaultBindingId: str = Field(min_length=1, max_length=256)
    replicaId: str = Field(min_length=1, max_length=256)
    afterCursor: int = Field(default=0, ge=0)


class DesktopLoginConsumeRequest(BaseModel):
    code: str = Field(min_length=1, max_length=256)


class OidcTokenSuccessResponse(BaseModel):
    access_token: str
    token_type: str
    expires_in: int
    scope: str
    id_token: str


class OidcAuthorizeApproveRequest(BaseModel):
    client_id: str = Field(min_length=1, max_length=256)
    redirect_uri: str = Field(min_length=1, max_length=2048)
    response_type: str = Field(min_length=1, max_length=64)
    scope: str = Field(min_length=1, max_length=256)
    state: Optional[str] = Field(default=None, max_length=1024)
    nonce: Optional[str] = Field(default=None, max_length=1024)
    code_challenge: Optional[str] = Field(default=None, max_length=512)
    code_challenge_method: Optional[str] = Field(default=None, max_length=64)


settings: Settings = load_settings()
api_host = urlparse(settings.api_base_url).hostname or ""
remote_host = urlparse(settings.remote_base_url).hostname or ""
DESKTOP_LOGIN_COMPLETE_PATH = "/desktop-login-complete"
MOBILE_SHELL_LOGIN_COMPLETE_PATH = "/mobile-shell-login-complete"
REMOTE_DEVICES_PATH = "/remote/devices"
REMOTE_DEVICE_PATH_PREFIX = "/device"
REMOTE_ACTIVE_DEVICE_COOKIE = "contextgo_remote_device"
REMOTE_DEVICE_VIEW_QUERY_KEY = "view"
REMOTE_DEVICE_VIEW_LIST = "list"
REMOTE_SHELL_SCHEME = "contextgo-remote"
OIDC_AUTHORIZE_PATH = "/oauth/authorize"
OIDC_TOKEN_PATH = "/oauth/token"
OIDC_USERINFO_PATH = "/oauth/userinfo"
OIDC_JWKS_PATH = "/oauth/jwks"
RENDERER_BUILD_ROOT_ENV = "CONTEXTGO_RENDERER_BUILD_ROOT"
FALLBACK_CLOUD_LANGUAGE = "en-US"
FALLBACK_CLOUD_SUPPORTED_LANGUAGES = ("zh-CN", "en-US", "ja-JP", "zh-TW", "ko-KR", "tr-TR")
SHORT_CLOUD_LANGUAGE_MAP = {
    "en": "en-US",
    "ja": "ja-JP",
    "ko": "ko-KR",
    "tr": "tr-TR",
    "zh": "zh-CN",
    "zh-cn": "zh-CN",
    "zh-sg": "zh-CN",
    "zh-hans": "zh-CN",
    "zh-tw": "zh-TW",
    "zh-hk": "zh-TW",
    "zh-mo": "zh-TW",
    "zh-hant": "zh-TW",
}
CLOUD_I18N = {
    "en-US": {
        "login.title": "ContextGo account",
        "login.subtitle": "Cloud-side OAuth and session service for ContextGo users.",
        "login.continue.github": "Continue with GitHub",
        "login.continue.google": "Continue with Google",
        "login.cancelAndClose": "Cancel and Close",
        "login.providersUnavailable": "No OAuth providers are configured.",
        "login.failed": "Login failed: {error}",
        "login.succeeded": "Login succeeded.",
        "login.cancelled": "Login cancelled. You can close this window safely.",
        "login.desktopHint.loopback": "Continue in your browser. ContextGo will finish sign-in automatically.",
        "login.desktopHint.deepLink": "Continue in your browser. ContextGo will reopen automatically after sign-in.",
        "login.signOut": "Sign out",
        "login.cookieDomain": "Session cookie domain: {domain}",
        "login.hostOnly": "host-only",
        "remote.title": "ContextGo Remote",
        "remote.signedInAs": "Signed in as {name} · {email}",
        "remote.description": "Choose a desktop device that currently has a live cloud relay connection. ContextGo Cloud only helps sign in, discover devices, and relay transport; the browser opens the desktop-hosted WebUI itself.",
        "remote.metric.devices": "Desktops",
        "remote.metric.ready": "Ready now",
        "remote.metric.live": "Live sessions",
        "remote.mobile.continue": "Continue on this desktop",
        "remote.refreshDevices": "Refresh devices",
        "remote.signOut": "Sign out",
        "remote.openInApp": "Open in app",
        "remote.relayConnectedAt": "Relay connected at {timestamp}",
        "remote.lastSeenAt": "Last seen at {timestamp}",
        "remote.unnamedDevice": "Unnamed device",
        "remote.deviceSubtitle": "{platform} · device {status}",
        "remote.emptyTitle": "No desktop devices are registered yet.",
        "remote.emptyDetail": "Sign in on a desktop build of ContextGo first. Once that device links to your cloud account, it will appear here automatically.",
        "remote.notice.deviceNotFound.title": "This remote device could not be found.",
        "remote.notice.deviceNotFound.detail": "It may have been revoked or linked to another cloud account.",
        "remote.notice.deviceOffline.title": "The desktop relay is offline.",
        "remote.notice.deviceOffline.detail": "Reconnect ContextGo on the desktop, then refresh this device list.",
        "remote.notice.browserEntryUnavailable.title": "Desktop browser entry is still preparing.",
        "remote.notice.browserEntryUnavailable.detail": "ContextGo Cloud relay is connected, but the desktop-hosted WebUI entry is not ready yet. Keep the desktop app running and try again in a moment.",
        "remote.notice.sessionReplaced.title": "This hosted session was replaced.",
        "remote.notice.sessionReplaced.detail": "Another browser took over the live session. Choose a device again to continue here.",
        "remote.notice.serviceRestarted.title": "The remote browser session was restarted.",
        "remote.notice.serviceRestarted.detail": "Refresh the list and reopen the desktop session. The browser should return to the desktop-hosted WebUI.",
        "remote.badge.liveSession": "Live session",
        "remote.badge.available": "Available",
        "remote.badge.unavailable": "Unavailable",
        "remote.summary.liveSession": "Desktop is online and already attached to a browser session through {transportLabel}.",
        "remote.detail.liveSession": "A second browser can still take over, but the current session is already active.",
        "remote.summary.available": "Desktop is online and ready through {transportLabel}.",
        "remote.detail.available": "This device has an authenticated outbound relay connection, and its own desktop-hosted WebUI is ready to open in the browser.",
        "remote.summary.browserEntryUnavailable": "Desktop relay is online through {transportLabel}, and ContextGo is still preparing the desktop browser entry.",
        "remote.summary.unavailable": "Desktop is not connected to {transportLabel} right now.",
        "remote.detail.unavailable": "The machine may still be registered and active, but browser remote access stays unavailable until the desktop relay reconnects and exposes its WebUI entry.",
        "remote.action.openLiveSession": "Open desktop WebUI",
        "remote.action.unavailable": "Unavailable",
        "remote.rendererUnavailableTitle": "Desktop browser entry is unavailable",
        "remote.rendererUnavailableDetail": "ContextGo Cloud relay is connected, but the desktop-hosted WebUI entry is not ready yet. Keep the desktop app running and retry in a moment.",
        "desktop.title": "Return to ContextGo",
        "desktop.action.return": "Return to ContextGo",
        "desktop.action.open": "Open ContextGo",
        "desktop.caption.autoOpen": "If ContextGo does not open automatically, use the button above.",
        "desktop.caption.deepLink": "Deep link: {url}",
        "desktop.message.invalidProvider": "Desktop sign-in is missing a valid OAuth provider.",
        "desktop.message.errorWithCode": "ContextGo sign-in could not be completed: {error}.",
        "desktop.message.missingSession": "Browser sign-in finished, but no cloud session was found for this page.",
        "desktop.message.success": "Browser sign-in succeeded. ContextGo should continue automatically.",
        "transport.cloudRelay": "ContextGo Cloud relay",
    },
    "zh-CN": {
        "login.title": "ContextGo 账号",
        "login.subtitle": "用于登录 ContextGo Cloud 并管理当前会话。",
        "login.continue.github": "使用 GitHub 继续",
        "login.continue.google": "使用 Google 继续",
        "login.cancelAndClose": "取消并关闭",
        "login.providersUnavailable": "当前未配置可用的 OAuth 登录方式。",
        "login.failed": "登录失败：{error}",
        "login.succeeded": "登录成功。",
        "login.cancelled": "已取消登录。现在可以安全关闭此窗口。",
        "login.desktopHint.loopback": "请在浏览器中继续。ContextGo 会自动完成登录。",
        "login.desktopHint.deepLink": "请在浏览器中继续。登录完成后 ContextGo 会自动重新打开。",
        "login.signOut": "退出登录",
        "login.cookieDomain": "会话 Cookie 域：{domain}",
        "login.hostOnly": "仅当前主机",
        "remote.title": "ContextGo 远程访问",
        "remote.signedInAs": "当前登录为 {name} · {email}",
        "remote.description": "选择一个当前已连接云中继的桌面设备。ContextGo Cloud 只负责登录、设备发现和中继；浏览器里打开的仍然是桌面端自己提供的 WebUI。",
        "remote.metric.devices": "桌面设备",
        "remote.metric.ready": "可立即打开",
        "remote.metric.live": "进行中的会话",
        "remote.mobile.continue": "继续进入这个桌面",
        "remote.refreshDevices": "刷新设备",
        "remote.signOut": "退出登录",
        "remote.openInApp": "在应用中打开",
        "remote.relayConnectedAt": "中继连接时间：{timestamp}",
        "remote.lastSeenAt": "最近在线时间：{timestamp}",
        "remote.unnamedDevice": "未命名设备",
        "remote.deviceSubtitle": "{platform} · 设备 {status}",
        "remote.emptyTitle": "还没有已注册的桌面设备",
        "remote.emptyDetail": "请先在桌面版 ContextGo 中登录。设备绑定到你的云账号后，会自动出现在这里。",
        "remote.notice.deviceNotFound.title": "找不到这个远程设备。",
        "remote.notice.deviceNotFound.detail": "它可能已经被撤销，或者已经关联到另一个云账号。",
        "remote.notice.deviceOffline.title": "桌面端中继当前离线。",
        "remote.notice.deviceOffline.detail": "请在桌面端重新连接 ContextGo，然后刷新设备列表。",
        "remote.notice.browserEntryUnavailable.title": "桌面浏览器入口仍在准备中。",
        "remote.notice.browserEntryUnavailable.detail": "ContextGo Cloud 中继已经连上，但桌面端自己的 WebUI 入口还没准备好。请保持桌面应用运行，稍后再试。",
        "remote.notice.sessionReplaced.title": "这个托管会话已被替换。",
        "remote.notice.sessionReplaced.detail": "另一个浏览器接管了当前实时会话。请选择设备以继续。",
        "remote.notice.serviceRestarted.title": "远程浏览器会话已重启。",
        "remote.notice.serviceRestarted.detail": "请刷新列表并重新打开桌面会话。浏览器应回到桌面端自己提供的 WebUI。",
        "remote.badge.liveSession": "会话进行中",
        "remote.badge.available": "可用",
        "remote.badge.unavailable": "不可用",
        "remote.summary.liveSession": "桌面端已在线，并且已经通过 {transportLabel} 连接到一个浏览器会话。",
        "remote.detail.liveSession": "你仍然可以由第二个浏览器接管，但当前会话已经处于活动状态。",
        "remote.summary.available": "桌面端已在线，可通过 {transportLabel} 使用。",
        "remote.detail.available": "此设备已建立经过认证的出站中继连接，而且桌面端自己的 WebUI 入口已经就绪，现在可以直接在浏览器里打开。",
        "remote.summary.browserEntryUnavailable": "桌面端已连上 {transportLabel}，ContextGo 正在准备桌面浏览器入口。",
        "remote.summary.unavailable": "桌面端当前未连接到 {transportLabel}。",
        "remote.detail.unavailable": "这台机器可能仍然已注册且处于激活状态，但在桌面端重新连上中继并暴露自己的 WebUI 入口之前，浏览器远程访问不可用。",
        "remote.action.openLiveSession": "打开桌面 WebUI",
        "remote.action.unavailable": "不可用",
        "remote.rendererUnavailableTitle": "桌面浏览器入口当前不可用",
        "remote.rendererUnavailableDetail": "ContextGo Cloud 中继已经连上，但桌面端自己的 WebUI 入口还没准备好。请保持桌面应用运行，稍后再试。",
        "desktop.title": "返回 ContextGo",
        "desktop.action.return": "返回 ContextGo",
        "desktop.action.open": "打开 ContextGo",
        "desktop.caption.autoOpen": "如果 ContextGo 没有自动打开，请点击上方按钮。",
        "desktop.caption.deepLink": "深链：{url}",
        "desktop.message.invalidProvider": "桌面登录缺少有效的 OAuth 提供方。",
        "desktop.message.errorWithCode": "ContextGo 登录未完成：{error}。",
        "desktop.message.missingSession": "浏览器端登录已完成，但这个页面没有找到对应的云会话。",
        "desktop.message.success": "浏览器端登录成功。ContextGo 应会自动继续。",
        "transport.cloudRelay": "ContextGo Cloud 中继",
    },
    "zh-TW": {
        "login.title": "ContextGo 帳號",
        "login.subtitle": "用於登入 ContextGo Cloud 並管理目前工作階段。",
        "login.continue.github": "使用 GitHub 繼續",
        "login.continue.google": "使用 Google 繼續",
        "login.cancelAndClose": "取消並關閉",
        "login.providersUnavailable": "目前未設定可用的 OAuth 登入方式。",
        "login.failed": "登入失敗：{error}",
        "login.succeeded": "登入成功。",
        "login.cancelled": "已取消登入。你現在可以安全關閉此視窗。",
        "login.desktopHint.loopback": "請在瀏覽器中繼續。ContextGo 會自動完成登入。",
        "login.desktopHint.deepLink": "請在瀏覽器中繼續。登入完成後 ContextGo 會自動重新開啟。",
        "login.signOut": "登出",
        "login.cookieDomain": "工作階段 Cookie 網域：{domain}",
        "login.hostOnly": "僅目前主機",
        "remote.title": "ContextGo 遠端存取",
        "remote.signedInAs": "目前登入為 {name} · {email}",
        "remote.description": "選擇一台目前已連上雲端中繼的桌面裝置。已註冊的裝置會保留在清單中，但只有已連上中繼的機器才能開啟託管遠端工作階段。",
        "remote.metric.devices": "桌面裝置",
        "remote.metric.ready": "可立即開啟",
        "remote.metric.live": "進行中的工作階段",
        "remote.mobile.continue": "繼續進入這台桌面",
        "remote.refreshDevices": "重新整理裝置",
        "remote.signOut": "登出",
        "remote.openInApp": "在應用程式中開啟",
        "remote.relayConnectedAt": "中繼連線時間：{timestamp}",
        "remote.lastSeenAt": "上次上線時間：{timestamp}",
        "remote.unnamedDevice": "未命名裝置",
        "remote.deviceSubtitle": "{platform} · 裝置 {status}",
        "remote.emptyTitle": "尚未註冊任何桌面裝置",
        "remote.emptyDetail": "請先在桌面版 ContextGo 中登入。裝置綁定到你的雲端帳號後，會自動顯示在這裡。",
        "remote.notice.deviceNotFound.title": "找不到這台遠端裝置。",
        "remote.notice.deviceNotFound.detail": "它可能已被撤銷，或已連結到另一個雲端帳號。",
        "remote.notice.deviceOffline.title": "桌面端中繼目前離線。",
        "remote.notice.deviceOffline.detail": "請在桌面端重新連線 ContextGo，然後重新整理裝置清單。",
        "remote.notice.browserEntryUnavailable.title": "桌面瀏覽器入口仍在準備中。",
        "remote.notice.browserEntryUnavailable.detail": "ContextGo Cloud 中繼已經連上，但桌面端自己的 WebUI 入口尚未就緒。請保持桌面應用運行，稍後再試。",
        "remote.notice.sessionReplaced.title": "這個託管工作階段已被取代。",
        "remote.notice.sessionReplaced.detail": "另一個瀏覽器接管了目前的即時工作階段。請重新選擇裝置以繼續。",
        "remote.notice.serviceRestarted.title": "託管遠端工作階段已重新啟動。",
        "remote.notice.serviceRestarted.detail": "請重新整理清單並重新開啟桌面工作階段。",
        "remote.badge.liveSession": "工作階段進行中",
        "remote.badge.available": "可用",
        "remote.badge.unavailable": "不可用",
        "remote.summary.liveSession": "桌面端已上線，且已透過 {transportLabel} 連接到瀏覽器工作階段。",
        "remote.detail.liveSession": "第二個瀏覽器仍可接管，但目前工作階段已處於活動狀態。",
        "remote.summary.available": "桌面端已上線，可透過 {transportLabel} 使用。",
        "remote.detail.available": "這台裝置已建立經驗證的對外中繼連線，桌面端自己的 WebUI 入口也已就緒，現在可以直接在瀏覽器中開啟。",
        "remote.summary.browserEntryUnavailable": "桌面端已連上 {transportLabel}，ContextGo 正在準備桌面瀏覽器入口。",
        "remote.summary.unavailable": "桌面端目前未連接到 {transportLabel}。",
        "remote.detail.unavailable": "這台機器可能仍已註冊且處於啟用狀態，但在桌面端重新連上中繼之前，託管遠端存取仍不可用。",
        "remote.action.openLiveSession": "開啟即時工作階段",
        "remote.action.unavailable": "不可用",
        "remote.rendererUnavailableTitle": "託管遠端 Shell 目前不可用",
        "remote.rendererUnavailableDetail": "ContextGo Cloud 中繼已經連上，但桌面端自己的 WebUI 入口尚未就緒。請保持桌面應用運行，稍後再試。",
        "desktop.title": "返回 ContextGo",
        "desktop.action.return": "返回 ContextGo",
        "desktop.action.open": "開啟 ContextGo",
        "desktop.caption.autoOpen": "如果 ContextGo 沒有自動開啟，請點選上方按鈕。",
        "desktop.caption.deepLink": "深層連結：{url}",
        "desktop.message.invalidProvider": "桌面登入缺少有效的 OAuth 提供者。",
        "desktop.message.errorWithCode": "ContextGo 登入未完成：{error}。",
        "desktop.message.missingSession": "瀏覽器端登入已完成，但此頁面找不到對應的雲端工作階段。",
        "desktop.message.success": "瀏覽器端登入成功。ContextGo 應會自動繼續。",
        "transport.cloudRelay": "ContextGo Cloud 中繼",
    },
    "ja-JP": {
        "login.title": "ContextGo アカウント",
        "login.subtitle": "ContextGo Cloud へのサインインと現在のセッション管理に使用します。",
        "login.continue.github": "GitHub で続行",
        "login.continue.google": "Google で続行",
        "login.cancelAndClose": "キャンセルして閉じる",
        "login.providersUnavailable": "利用可能な OAuth プロバイダーが設定されていません。",
        "login.failed": "サインインに失敗しました: {error}",
        "login.succeeded": "サインインに成功しました。",
        "login.cancelled": "サインインはキャンセルされました。このウィンドウは安全に閉じられます。",
        "login.desktopHint.loopback": "ブラウザで続行してください。ContextGo が自動的にサインインを完了します。",
        "login.desktopHint.deepLink": "ブラウザで続行してください。サインイン後に ContextGo が自動的に再度開きます。",
        "login.signOut": "サインアウト",
        "login.cookieDomain": "セッション Cookie ドメイン: {domain}",
        "login.hostOnly": "このホストのみ",
        "remote.title": "ContextGo Remote",
        "remote.signedInAs": "{name} · {email} としてサインイン中",
        "remote.description": "現在クラウドリレーに接続しているデスクトップ デバイスを選択してください。登録済みデバイスは一覧に残りますが、ホスト型リモートセッションを開けるのはリレー接続中の端末だけです。",
        "remote.metric.devices": "デスクトップ",
        "remote.metric.ready": "今すぐ開ける",
        "remote.metric.live": "進行中セッション",
        "remote.mobile.continue": "このデスクトップを続ける",
        "remote.refreshDevices": "デバイスを更新",
        "remote.signOut": "サインアウト",
        "remote.openInApp": "アプリで開く",
        "remote.relayConnectedAt": "リレー接続時刻: {timestamp}",
        "remote.lastSeenAt": "最終確認時刻: {timestamp}",
        "remote.unnamedDevice": "名称未設定のデバイス",
        "remote.deviceSubtitle": "{platform} · デバイス {status}",
        "remote.emptyTitle": "まだ登録されたデスクトップ デバイスはありません。",
        "remote.emptyDetail": "まず ContextGo のデスクトップ版でサインインしてください。デバイスがクラウド アカウントに紐付くと、ここに自動で表示されます。",
        "remote.notice.deviceNotFound.title": "このリモート デバイスは見つかりませんでした。",
        "remote.notice.deviceNotFound.detail": "無効化されたか、別のクラウド アカウントに紐付いている可能性があります。",
        "remote.notice.deviceOffline.title": "デスクトップ リレーはオフラインです。",
        "remote.notice.deviceOffline.detail": "デスクトップ側で ContextGo を再接続してから、この一覧を更新してください。",
        "remote.notice.browserEntryUnavailable.title": "デスクトップのブラウザ入口はまだ準備中です。",
        "remote.notice.browserEntryUnavailable.detail": "ContextGo Cloud relay は接続済みですが、デスクトップ側の WebUI 入口はまだ利用できません。デスクトップアプリを起動したまま少し待ってから再試行してください。",
        "remote.notice.sessionReplaced.title": "このホスト型セッションは置き換えられました。",
        "remote.notice.sessionReplaced.detail": "別のブラウザが現在のライブ セッションを引き継ぎました。続行するにはもう一度デバイスを選択してください。",
        "remote.notice.serviceRestarted.title": "ホスト型リモート セッションが再起動されました。",
        "remote.notice.serviceRestarted.detail": "一覧を更新して、デスクトップ セッションをもう一度開いてください。",
        "remote.badge.liveSession": "ライブ セッション",
        "remote.badge.available": "利用可能",
        "remote.badge.unavailable": "利用不可",
        "remote.summary.liveSession": "デスクトップはオンラインで、すでに {transportLabel} 経由でブラウザ セッションに接続されています。",
        "remote.detail.liveSession": "別のブラウザが引き継ぐことはできますが、現在のセッションはすでにアクティブです。",
        "remote.summary.available": "デスクトップはオンラインで、{transportLabel} 経由で利用できます。",
        "remote.detail.available": "このデバイスには認証済みのアウトバウンド リレー接続があり、デスクトップ側の WebUI 入口も準備できているため、そのままブラウザで開けます。",
        "remote.summary.browserEntryUnavailable": "デスクトップは {transportLabel} に接続されており、ContextGo がデスクトップのブラウザ入口を準備しています。",
        "remote.summary.unavailable": "デスクトップは現在 {transportLabel} に接続していません。",
        "remote.detail.unavailable": "このマシンは登録済みかつ有効なままの可能性がありますが、デスクトップ リレーが再接続するまでホスト型リモート アクセスは利用できません。",
        "remote.action.openLiveSession": "ライブ セッションを開く",
        "remote.action.unavailable": "利用不可",
        "remote.rendererUnavailableTitle": "ホスト型リモート Shell は利用できません",
        "remote.rendererUnavailableDetail": "ContextGo Cloud relay は接続済みですが、デスクトップ側の WebUI 入口はまだ利用できません。デスクトップアプリを起動したまま少し待ってから再試行してください。",
        "desktop.title": "ContextGo に戻る",
        "desktop.action.return": "ContextGo に戻る",
        "desktop.action.open": "ContextGo を開く",
        "desktop.caption.autoOpen": "ContextGo が自動で開かない場合は、上のボタンを使用してください。",
        "desktop.caption.deepLink": "ディープリンク: {url}",
        "desktop.message.invalidProvider": "デスクトップ サインインに有効な OAuth プロバイダーがありません。",
        "desktop.message.errorWithCode": "ContextGo のサインインを完了できませんでした: {error}。",
        "desktop.message.missingSession": "ブラウザでのサインインは完了しましたが、このページに対応するクラウド セッションが見つかりませんでした。",
        "desktop.message.success": "ブラウザでのサインインに成功しました。ContextGo が自動的に続行するはずです。",
        "transport.cloudRelay": "ContextGo Cloud relay",
    },
    "ko-KR": {
        "login.title": "ContextGo 계정",
        "login.subtitle": "ContextGo Cloud 로그인과 현재 세션 관리에 사용됩니다.",
        "login.continue.github": "GitHub로 계속",
        "login.continue.google": "Google로 계속",
        "login.cancelAndClose": "취소하고 닫기",
        "login.providersUnavailable": "사용 가능한 OAuth 공급자가 구성되어 있지 않습니다.",
        "login.failed": "로그인 실패: {error}",
        "login.succeeded": "로그인되었습니다.",
        "login.cancelled": "로그인이 취소되었습니다. 이 창은 안전하게 닫아도 됩니다.",
        "login.desktopHint.loopback": "브라우저에서 계속하세요. ContextGo가 자동으로 로그인을 완료합니다.",
        "login.desktopHint.deepLink": "브라우저에서 계속하세요. 로그인 후 ContextGo가 자동으로 다시 열립니다.",
        "login.signOut": "로그아웃",
        "login.cookieDomain": "세션 쿠키 도메인: {domain}",
        "login.hostOnly": "현재 호스트만",
        "remote.title": "ContextGo Remote",
        "remote.signedInAs": "{name} · {email} 계정으로 로그인됨",
        "remote.description": "현재 클라우드 릴레이에 연결된 데스크톱 기기를 선택하세요. 등록된 기기는 목록에 계속 남지만, 릴레이에 연결된 기기만 호스팅 원격 세션을 열 수 있습니다.",
        "remote.metric.devices": "데스크톱",
        "remote.metric.ready": "즉시 열기 가능",
        "remote.metric.live": "진행 중 세션",
        "remote.mobile.continue": "이 데스크톱으로 계속",
        "remote.refreshDevices": "기기 새로고침",
        "remote.signOut": "로그아웃",
        "remote.openInApp": "앱에서 열기",
        "remote.relayConnectedAt": "릴레이 연결 시각: {timestamp}",
        "remote.lastSeenAt": "마지막 확인 시각: {timestamp}",
        "remote.unnamedDevice": "이름 없는 기기",
        "remote.deviceSubtitle": "{platform} · 기기 {status}",
        "remote.emptyTitle": "등록된 데스크톱 기기가 아직 없습니다.",
        "remote.emptyDetail": "먼저 데스크톱용 ContextGo에서 로그인하세요. 기기가 클라우드 계정에 연결되면 여기에 자동으로 표시됩니다.",
        "remote.notice.deviceNotFound.title": "이 원격 기기를 찾을 수 없습니다.",
        "remote.notice.deviceNotFound.detail": "이미 해제되었거나 다른 클라우드 계정에 연결되었을 수 있습니다.",
        "remote.notice.deviceOffline.title": "데스크톱 릴레이가 오프라인입니다.",
        "remote.notice.deviceOffline.detail": "데스크톱에서 ContextGo를 다시 연결한 뒤 이 목록을 새로고침하세요.",
        "remote.notice.browserEntryUnavailable.title": "데스크톱 브라우저 진입점을 아직 준비 중입니다.",
        "remote.notice.browserEntryUnavailable.detail": "ContextGo Cloud relay는 연결되어 있지만 데스크톱 자체 WebUI 진입점은 아직 준비되지 않았습니다. 데스크톱 앱을 켜 둔 채 잠시 후 다시 시도하세요.",
        "remote.notice.sessionReplaced.title": "이 호스팅 세션이 다른 세션으로 대체되었습니다.",
        "remote.notice.sessionReplaced.detail": "다른 브라우저가 현재 라이브 세션을 가져갔습니다. 계속하려면 기기를 다시 선택하세요.",
        "remote.notice.serviceRestarted.title": "호스팅 원격 세션이 다시 시작되었습니다.",
        "remote.notice.serviceRestarted.detail": "목록을 새로고침하고 데스크톱 세션을 다시 여세요.",
        "remote.badge.liveSession": "라이브 세션",
        "remote.badge.available": "사용 가능",
        "remote.badge.unavailable": "사용 불가",
        "remote.summary.liveSession": "데스크톱이 온라인이며 이미 {transportLabel}을 통해 브라우저 세션에 연결되어 있습니다.",
        "remote.detail.liveSession": "다른 브라우저가 이어받을 수는 있지만 현재 세션은 이미 활성 상태입니다.",
        "remote.summary.available": "데스크톱이 온라인이며 {transportLabel}을 통해 바로 사용할 수 있습니다.",
        "remote.detail.available": "이 기기는 인증된 아웃바운드 릴레이 연결을 가지고 있고, 데스크톱 측 WebUI 진입점도 준비되어 있어 브라우저에서 바로 열 수 있습니다.",
        "remote.summary.browserEntryUnavailable": "데스크톱은 {transportLabel}에 연결되어 있으며 ContextGo가 데스크톱 브라우저 진입점을 준비하고 있습니다.",
        "remote.summary.unavailable": "데스크톱이 현재 {transportLabel}에 연결되어 있지 않습니다.",
        "remote.detail.unavailable": "이 기기는 여전히 등록 및 활성 상태일 수 있지만, 데스크톱 릴레이가 다시 연결되기 전까지 호스팅 원격 액세스는 사용할 수 없습니다.",
        "remote.action.openLiveSession": "라이브 세션 열기",
        "remote.action.unavailable": "사용 불가",
        "remote.rendererUnavailableTitle": "호스팅 원격 Shell을 사용할 수 없습니다",
        "remote.rendererUnavailableDetail": "ContextGo Cloud relay는 연결되어 있지만 데스크톱 자체 WebUI 진입점은 아직 준비되지 않았습니다. 데스크톱 앱을 켜 둔 채 잠시 후 다시 시도하세요.",
        "desktop.title": "ContextGo로 돌아가기",
        "desktop.action.return": "ContextGo로 돌아가기",
        "desktop.action.open": "ContextGo 열기",
        "desktop.caption.autoOpen": "ContextGo가 자동으로 열리지 않으면 위의 버튼을 사용하세요.",
        "desktop.caption.deepLink": "딥 링크: {url}",
        "desktop.message.invalidProvider": "데스크톱 로그인에 유효한 OAuth 공급자가 없습니다.",
        "desktop.message.errorWithCode": "ContextGo 로그인을 완료할 수 없습니다: {error}.",
        "desktop.message.missingSession": "브라우저 로그인은 끝났지만 이 페이지에 해당하는 클라우드 세션을 찾지 못했습니다.",
        "desktop.message.success": "브라우저 로그인이 완료되었습니다. ContextGo가 자동으로 이어서 진행됩니다.",
        "transport.cloudRelay": "ContextGo Cloud relay",
    },
    "tr-TR": {
        "login.title": "ContextGo hesabı",
        "login.subtitle": "ContextGo Cloud oturumu açmak ve mevcut oturumu yönetmek için kullanılır.",
        "login.continue.github": "GitHub ile devam et",
        "login.continue.google": "Google ile devam et",
        "login.cancelAndClose": "İptal et ve kapat",
        "login.providersUnavailable": "Yapılandırılmış bir OAuth sağlayıcısı yok.",
        "login.failed": "Giriş başarısız oldu: {error}",
        "login.succeeded": "Giriş başarılı.",
        "login.cancelled": "Giriş iptal edildi. Bu pencereyi güvenle kapatabilirsiniz.",
        "login.desktopHint.loopback": "Tarayıcıda devam edin. ContextGo oturumu otomatik olarak tamamlayacak.",
        "login.desktopHint.deepLink": "Tarayıcıda devam edin. Oturum açıldıktan sonra ContextGo otomatik olarak yeniden açılacak.",
        "login.signOut": "Çıkış yap",
        "login.cookieDomain": "Oturum çerezi alanı: {domain}",
        "login.hostOnly": "yalnızca bu ana makine",
        "remote.title": "ContextGo Remote",
        "remote.signedInAs": "{name} · {email} olarak oturum açıldı",
        "remote.description": "Şu anda bulut rölesine bağlı olan bir masaüstü cihaz seçin. Kayıtlı cihazlar listede kalır, ancak yalnızca röleye bağlı makineler barındırılan uzak oturumu açabilir.",
        "remote.metric.devices": "Masaüstleri",
        "remote.metric.ready": "Hemen hazır",
        "remote.metric.live": "Canlı oturumlar",
        "remote.mobile.continue": "Bu masaüstünde devam et",
        "remote.refreshDevices": "Cihazları yenile",
        "remote.signOut": "Çıkış yap",
        "remote.openInApp": "Uygulamada aç",
        "remote.relayConnectedAt": "Röle bağlantı zamanı: {timestamp}",
        "remote.lastSeenAt": "Son görülme zamanı: {timestamp}",
        "remote.unnamedDevice": "Adsız cihaz",
        "remote.deviceSubtitle": "{platform} · cihaz {status}",
        "remote.emptyTitle": "Henüz kayıtlı masaüstü cihaz yok.",
        "remote.emptyDetail": "Önce ContextGo masaüstü sürümünde oturum açın. Cihaz bulut hesabınıza bağlandıktan sonra burada otomatik olarak görünecektir.",
        "remote.notice.deviceNotFound.title": "Bu uzak cihaz bulunamadı.",
        "remote.notice.deviceNotFound.detail": "İptal edilmiş veya başka bir bulut hesabına bağlanmış olabilir.",
        "remote.notice.deviceOffline.title": "Masaüstü rölesi çevrimdışı.",
        "remote.notice.deviceOffline.detail": "Masaüstünde ContextGo'yu yeniden bağlayın, sonra bu cihaz listesini yenileyin.",
        "remote.notice.browserEntryUnavailable.title": "Masaüstü tarayıcı girişi hâlâ hazırlanıyor.",
        "remote.notice.browserEntryUnavailable.detail": "ContextGo Cloud relay bağlı, ancak masaüstünün kendi WebUI girişi henüz hazır değil. Masaüstü uygulamasını açık bırakın ve biraz sonra tekrar deneyin.",
        "remote.notice.sessionReplaced.title": "Bu barındırılan oturum değiştirildi.",
        "remote.notice.sessionReplaced.detail": "Başka bir tarayıcı canlı oturumu devraldı. Burada devam etmek için cihazı yeniden seçin.",
        "remote.notice.serviceRestarted.title": "Barındırılan uzak oturum yeniden başlatıldı.",
        "remote.notice.serviceRestarted.detail": "Listeyi yenileyin ve masaüstü oturumunu tekrar açın.",
        "remote.badge.liveSession": "Canlı oturum",
        "remote.badge.available": "Kullanılabilir",
        "remote.badge.unavailable": "Kullanılamıyor",
        "remote.summary.liveSession": "Masaüstü çevrimiçi ve zaten {transportLabel} üzerinden bir tarayıcı oturumuna bağlı.",
        "remote.detail.liveSession": "İkinci bir tarayıcı devralabilir, ancak mevcut oturum zaten etkin durumda.",
        "remote.summary.available": "Masaüstü çevrimiçi ve {transportLabel} üzerinden hazır.",
        "remote.detail.available": "Bu cihaz doğrulanmış bir giden röle bağlantısına sahip ve masaüstünün kendi WebUI girişini tarayıcıda açmaya hazır.",
        "remote.summary.browserEntryUnavailable": "Masaüstü {transportLabel} üzerinden bağlı ve ContextGo masaüstü tarayıcı girişini hazırlıyor.",
        "remote.summary.unavailable": "Masaüstü şu anda {transportLabel} ağına bağlı değil.",
        "remote.detail.unavailable": "Makine hâlâ kayıtlı ve etkin olabilir, ancak masaüstü rölesi yeniden bağlanana kadar barındırılan uzak erişim kullanılamaz.",
        "remote.action.openLiveSession": "Canlı oturumu aç",
        "remote.action.unavailable": "Kullanılamıyor",
        "remote.rendererUnavailableTitle": "Barındırılan uzak Shell kullanılamıyor",
        "remote.rendererUnavailableDetail": "ContextGo Cloud relay bağlı, ancak masaüstünün kendi WebUI girişi henüz hazır değil. Masaüstü uygulamasını açık bırakın ve biraz sonra tekrar deneyin.",
        "desktop.title": "ContextGo'ya dön",
        "desktop.action.return": "ContextGo'ya dön",
        "desktop.action.open": "ContextGo'yu aç",
        "desktop.caption.autoOpen": "ContextGo otomatik açılmazsa yukarıdaki düğmeyi kullanın.",
        "desktop.caption.deepLink": "Derin bağlantı: {url}",
        "desktop.message.invalidProvider": "Masaüstü girişi için geçerli bir OAuth sağlayıcısı eksik.",
        "desktop.message.errorWithCode": "ContextGo oturumu tamamlanamadı: {error}.",
        "desktop.message.missingSession": "Tarayıcı girişi tamamlandı, ancak bu sayfa için bir bulut oturumu bulunamadı.",
        "desktop.message.success": "Tarayıcı girişi başarılı oldu. ContextGo otomatik olarak devam etmelidir.",
        "transport.cloudRelay": "ContextGo Cloud relay",
    },
}


def load_cloud_supported_languages() -> tuple[str, ...]:
    config_path = Path(__file__).resolve().parents[3] / "src" / "common" / "config" / "i18n-config.json"
    try:
        payload = json.loads(config_path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return FALLBACK_CLOUD_SUPPORTED_LANGUAGES

    supported = tuple(
        str(item)
        for item in payload.get("supportedLanguages", [])
        if isinstance(item, str) and item in CLOUD_I18N
    )
    return supported or FALLBACK_CLOUD_SUPPORTED_LANGUAGES


CLOUD_SUPPORTED_LANGUAGES = load_cloud_supported_languages()


def match_cloud_locale(value: Optional[str]) -> Optional[str]:
    if not value:
        return None

    normalized = value.strip().replace("_", "-")
    if not normalized:
        return None

    if normalized in CLOUD_SUPPORTED_LANGUAGES:
        return normalized

    lowered = normalized.lower()
    mapped = SHORT_CLOUD_LANGUAGE_MAP.get(lowered)
    if mapped in CLOUD_SUPPORTED_LANGUAGES:
        return mapped

    primary = lowered.split("-", 1)[0]
    mapped = SHORT_CLOUD_LANGUAGE_MAP.get(primary)
    if mapped in CLOUD_SUPPORTED_LANGUAGES:
        return mapped

    return None


def normalize_cloud_locale(value: Optional[str]) -> str:
    return match_cloud_locale(value) or FALLBACK_CLOUD_LANGUAGE


def cloud_text(language: str, key: str, **kwargs: object) -> str:
    catalog = CLOUD_I18N.get(language) or CLOUD_I18N[FALLBACK_CLOUD_LANGUAGE]
    template = catalog.get(key) or CLOUD_I18N[FALLBACK_CLOUD_LANGUAGE].get(key) or key
    if not kwargs:
        return template

    normalized_kwargs = {name: str(value) for name, value in kwargs.items()}
    return template.format(**normalized_kwargs)


def read_user_cloud_language(user: Optional[User]) -> Optional[str]:
    if user is None:
        return None

    with get_connection(settings) as connection:
        row = connection.execute(
            """
            SELECT value_json
            FROM sync_items
            WHERE user_id = ? AND namespace = 'preferences' AND item_key = 'language' AND deleted = 0
            LIMIT 1
            """,
            (user.id,),
        ).fetchone()

    if row is None or row["value_json"] is None:
        return None

    try:
        value = json.loads(row["value_json"])
    except json.JSONDecodeError:
        return None

    return normalize_cloud_locale(value) if isinstance(value, str) else None


def detect_request_language(request: Request, user: Optional[User] = None) -> str:
    user_language = read_user_cloud_language(user)
    if user_language:
        return user_language

    accept_language = request.headers.get("accept-language", "")
    for raw_part in accept_language.split(","):
        locale_candidate = raw_part.split(";", 1)[0].strip()
        matched = match_cloud_locale(locale_candidate)
        if matched:
            return matched

    return FALLBACK_CLOUD_LANGUAGE


def resolve_renderer_build_root() -> Path:
    app_path = Path(__file__).resolve()
    candidates: list[Path] = []
    explicit_root = os.getenv(RENDERER_BUILD_ROOT_ENV, "").strip()
    if explicit_root:
        candidates.append(Path(explicit_root).expanduser())

    if len(app_path.parents) > 3:
        candidates.append(app_path.parents[3] / "out" / "renderer")

    candidates.append(Path.cwd() / "out" / "renderer")
    candidates.append(app_path.parents[1] / "out" / "renderer")

    resolved_candidates: list[Path] = []
    for candidate in candidates:
        resolved = candidate.resolve()
        if resolved not in resolved_candidates:
            resolved_candidates.append(resolved)

    for candidate in resolved_candidates:
        if (candidate / "index.html").is_file():
            return candidate

    return resolved_candidates[0]


RENDERER_BUILD_ROOT = resolve_renderer_build_root()
RENDERER_INDEX_PATH = RENDERER_BUILD_ROOT / "index.html"
RENDERER_ASSETS_PATH = RENDERER_BUILD_ROOT / "assets"
IOS_ASSOCIATED_APP_IDS_ENV = "CONTEXTGO_IOS_ASSOCIATED_APP_IDS"
ANDROID_APP_LINK_TARGETS_ENV = "CONTEXTGO_ANDROID_APP_LINK_TARGETS"
oidc_signing_key = load_oidc_signing_key(settings)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    initialize_database(settings)
    cleanup_expired_rows(settings)
    yield


app = FastAPI(title="ContextGo Cloud Auth Service", lifespan=lifespan)
remote_relay_hub = RemoteRelayHub()
obsidian_sync_store = ObsidianSyncStore(settings)

allowed_origins = [
    "https://contextgo.io",
    "https://www.contextgo.io",
    "https://auth.contextgo.io",
    "https://api.contextgo.io",
    "https://remote.contextgo.io",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


def is_oidc_client_enabled() -> bool:
    return bool(settings.oidc_client_id and settings.oidc_client_secret and settings.oidc_redirect_uris)


def build_oidc_discovery_document() -> dict[str, object]:
    return {
        'issuer': settings.auth_base_url,
        'authorization_endpoint': f'{settings.auth_base_url}{OIDC_AUTHORIZE_PATH}',
        'token_endpoint': f'{settings.auth_base_url}{OIDC_TOKEN_PATH}',
        'userinfo_endpoint': f'{settings.auth_base_url}{OIDC_USERINFO_PATH}',
        'jwks_uri': f'{settings.auth_base_url}{OIDC_JWKS_PATH}',
        'response_types_supported': list(OIDC_SUPPORTED_RESPONSE_TYPES),
        'subject_types_supported': list(OIDC_SUPPORTED_SUBJECT_TYPES),
        'id_token_signing_alg_values_supported': list(OIDC_SUPPORTED_ID_TOKEN_ALGORITHMS),
        'scopes_supported': list(OIDC_SUPPORTED_SCOPES),
        'token_endpoint_auth_methods_supported': list(OIDC_SUPPORTED_CLIENT_AUTH_METHODS),
        'claims_supported': list(OIDC_SUPPORTED_CLAIMS),
    }


def ensure_oidc_client_enabled() -> None:
    if not is_oidc_client_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail='OIDC provider is not configured',
        )


def validate_oidc_client(client_id: Optional[str], redirect_uri: Optional[str]) -> tuple[str, str]:
    ensure_oidc_client_enabled()

    normalized_client_id = (client_id or '').strip()
    normalized_redirect_uri = (redirect_uri or '').strip()
    if normalized_client_id != settings.oidc_client_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid OIDC client')

    if normalized_redirect_uri not in settings.oidc_redirect_uris:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid OIDC redirect URI')

    return normalized_client_id, normalized_redirect_uri


def build_oidc_redirect_url(redirect_uri: str, params: dict[str, Optional[str]]) -> str:
    serialized = {key: value for key, value in params.items() if value is not None}
    return str(URL(redirect_uri).include_query_params(**serialized))


def build_oidc_authorize_error_response(
    *,
    redirect_uri: Optional[str],
    error: str,
    state_value: Optional[str],
    description: Optional[str] = None,
) -> RedirectResponse:
    if redirect_uri:
        return RedirectResponse(
            url=build_oidc_redirect_url(
                redirect_uri,
                {
                    'error': error,
                    'error_description': description,
                    'state': state_value,
                },
            ),
            status_code=303,
        )

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=description or error)


def build_oidc_token_error(
    error: str,
    description: str,
    *,
    status_code: int = status.HTTP_400_BAD_REQUEST,
    headers: Optional[dict[str, str]] = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            'error': error,
            'error_description': description,
        },
        headers=headers,
    )


def authenticate_oidc_access_token(request: Request) -> tuple[Optional[User], Optional[OidcAccessToken]]:
    bearer_token = read_bearer_token(request)
    if not bearer_token:
        return None, None

    access_token = get_oidc_access_token(settings, bearer_token)
    if access_token is None:
        return None, None

    user = find_user_by_id(settings, access_token.user_id)
    if user is None:
        return None, None

    return user, access_token


def read_oidc_client_credentials(request: Request, payload: dict[str, str]) -> tuple[Optional[str], Optional[str]]:
    basic_client_id, basic_client_secret = decode_basic_auth_header(request.headers.get('authorization'))
    client_id = (basic_client_id or payload.get('client_id') or '').strip() or None
    client_secret = (basic_client_secret or payload.get('client_secret') or '').strip() or None
    return client_id, client_secret

def is_allowed_email(email: str) -> bool:
    if not settings.allowed_emails:
        return True

    return email in settings.allowed_emails


def build_cookie_domain() -> Optional[str]:
    return settings.session_cookie_domain or None


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_csv_env(name: str) -> list[str]:
    return [item.strip() for item in os.getenv(name, "").split(",") if item.strip()]


def build_current_path_with_query(request: Request) -> str:
    query = request.url.query
    return f"{request.url.path}?{query}" if query else request.url.path


def get_request_hostname(request: Request) -> str:
    return (request.headers.get("host") or "").split(":")[0].strip().lower()


def is_remote_request(request: Request) -> bool:
    return get_request_hostname(request) == remote_host


def build_remote_url(path: str) -> str:
    return f"{settings.remote_base_url}{path}"


def is_mobile_shell_request(request: Request) -> bool:
    return "contextgomobileshell/" in request.headers.get("user-agent", "").lower()


def resolve_mobile_shell_target_url(request: Request, next_path: str) -> str:
    safe_next_path = pick_next_path(next_path)
    if safe_next_path == "/":
        return build_remote_url(REMOTE_DEVICES_PATH)

    if safe_next_path.startswith("http://") or safe_next_path.startswith("https://"):
        return safe_next_path

    if safe_next_path.startswith(REMOTE_DEVICE_PATH_PREFIX) or safe_next_path.startswith("/remote/"):
        return build_remote_url(safe_next_path)

    if is_remote_request(request):
        return build_remote_url(safe_next_path)

    return f"{str(request.base_url).rstrip('/')}{safe_next_path}"


def build_mobile_shell_login_complete_url(target_url: str, provider: Optional[str] = None) -> str:
    query = {"target": target_url}
    if provider:
        query["provider"] = provider

    return f"{settings.auth_base_url}{MOBILE_SHELL_LOGIN_COMPLETE_PATH}?{urlencode(query)}"


def set_session_cookie(response: Union[RedirectResponse, JSONResponse, HTMLResponse], token: str) -> None:
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        httponly=True,
        secure=settings.auth_base_url.startswith("https://"),
        samesite="lax",
        domain=build_cookie_domain(),
        path="/",
        max_age=settings.session_ttl_seconds,
    )


def clear_session_cookie(response: Union[RedirectResponse, JSONResponse, HTMLResponse]) -> None:
    response.delete_cookie(
        key=settings.session_cookie_name,
        domain=build_cookie_domain(),
        path="/",
    )


def set_oauth_state_cookie(response: RedirectResponse, state: str) -> None:
    response.set_cookie(
        key=settings.oauth_state_cookie_name,
        value=state,
        httponly=True,
        secure=settings.auth_base_url.startswith("https://"),
        samesite="lax",
        path="/api/auth/oauth",
        max_age=settings.oauth_state_ttl_seconds,
    )


def clear_oauth_state_cookie(response: RedirectResponse) -> None:
    response.delete_cookie(
        key=settings.oauth_state_cookie_name,
        path="/api/auth/oauth",
    )


def read_current_user(request: Request) -> Optional[User]:
    return read_current_user_from_session_token(request.cookies.get(settings.session_cookie_name))


def read_current_user_from_session_token(raw_token: Optional[str]) -> Optional[User]:
    if not raw_token:
        return None

    return get_user_by_session_token(settings, raw_token)


def pick_next_path(value: Optional[str]) -> str:
    if not value:
        return "/"

    trimmed = value.strip()
    if trimmed.startswith("/") and not trimmed.startswith("//"):
        return trimmed

    parsed = urlparse(trimmed)
    hostname = (parsed.hostname or "").strip().lower()
    if parsed.scheme not in ("http", "https") or not hostname:
        return "/"

    cookie_domain = (settings.session_cookie_domain or "").lstrip(".").lower()
    allowed_hosts = {
        (urlparse(settings.auth_base_url).hostname or "").lower(),
        (urlparse(settings.api_base_url).hostname or "").lower(),
        "127.0.0.1",
        "::1",
        "localhost",
    }
    is_contextgo_host = hostname == "contextgo.io" or hostname.endswith(".contextgo.io")

    if is_contextgo_host:
        pass
    elif cookie_domain:
        if hostname != cookie_domain and not hostname.endswith(f".{cookie_domain}"):
            return "/"
    elif hostname not in allowed_hosts:
        return "/"

    if parsed.scheme != "https" and hostname not in {"127.0.0.1", "::1", "localhost"}:
        return "/"

    return trimmed


def build_logout_response(request: Request, next_value: Optional[str]) -> RedirectResponse:
    raw_token = request.cookies.get(settings.session_cookie_name)
    if raw_token:
        delete_session(settings, raw_token)

    redirect_target = pick_next_path(next_value)
    if redirect_target == "/":
        redirect_target = "/login"

    response = RedirectResponse(url=redirect_target, status_code=303)
    clear_session_cookie(response)
    return response


def build_login_url(
    *,
    error_code: Optional[str] = None,
    success: bool = False,
    cancel: bool = False,
    provider: Optional[str] = None,
    desktop: bool = False,
    next_path: Optional[str] = None,
) -> str:
    query: Dict[str, str] = {}
    if error_code:
        query["oauthError"] = error_code
    if success:
        query["success"] = "1"
    if cancel:
        query["cancel"] = "1"
    if provider:
        query["provider"] = provider
    if desktop:
        query["desktop"] = "1"
    if next_path:
        safe_next_path = pick_next_path(next_path)
        if safe_next_path != "/":
            query["next"] = safe_next_path

    return f"/login?{urlencode(query)}" if query else "/login"


def normalize_provider(value: Optional[str]) -> Optional[ProviderId]:
    if value in ("github", "google"):
        return value

    return None


def normalize_loopback_callback_url(value: Optional[str]) -> Optional[str]:
    if not value:
        return None

    trimmed = value.strip()
    if not trimmed:
        return None

    parsed = urlparse(trimmed)
    hostname = (parsed.hostname or "").strip().lower()
    if parsed.scheme != "http" or hostname not in {"127.0.0.1", "::1", "localhost"}:
        return None

    try:
        port = parsed.port
    except ValueError:
        return None

    if port is None:
        return None

    normalized_path = parsed.path or "/"
    return parsed._replace(path=normalized_path, query="", fragment="").geturl()


def build_desktop_login_complete_url(
    provider: Optional[str] = None,
    error_code: Optional[str] = None,
    loopback_url: Optional[str] = None,
) -> str:
    query: Dict[str, str] = {}
    if provider:
        query["provider"] = provider
    if error_code:
        query["error"] = error_code

    normalized_loopback_url = normalize_loopback_callback_url(loopback_url)
    if normalized_loopback_url:
        query["loopback"] = normalized_loopback_url

    return f"{DESKTOP_LOGIN_COMPLETE_PATH}?{urlencode(query)}" if query else DESKTOP_LOGIN_COMPLETE_PATH


def build_desktop_login_deep_link(
    *,
    code: Optional[str] = None,
    provider: Optional[str] = None,
    error_code: Optional[str] = None,
) -> str:
    query: Dict[str, str] = {}
    if code:
        query["code"] = code
    if provider:
        query["provider"] = provider
    if error_code:
        query["error"] = error_code

    return f"contextgo://cloud-login?{urlencode(query)}" if query else "contextgo://cloud-login"


def extract_login_context(next_path: Optional[str]) -> tuple[Optional[str], bool, Optional[str]]:
    if not next_path:
        return None, False, None

    parsed = urlparse(next_path)
    if parsed.path == DESKTOP_LOGIN_COMPLETE_PATH:
        query = parse_qs(parsed.query)
        return (
            normalize_provider(query.get("provider", [None])[0]),
            True,
            normalize_loopback_callback_url(query.get("loopback", [None])[0]),
        )

    if parsed.path == MOBILE_SHELL_LOGIN_COMPLETE_PATH:
        query = parse_qs(parsed.query)
        return (
            normalize_provider(query.get("provider", [None])[0]),
            False,
            None,
        )

    if parsed.path != "/login":
        return None, False, None

    query = parse_qs(parsed.query)
    return (
        normalize_provider(query.get("provider", [None])[0]),
        query.get("desktop", [None])[0] == "1",
        normalize_loopback_callback_url(query.get("loopback", [None])[0]),
    )


def is_mobile_shell_login_context(next_path: Optional[str]) -> bool:
    if not next_path:
        return False

    return urlparse(next_path).path == MOBILE_SHELL_LOGIN_COMPLETE_PATH


def redirect_to_mobile_shell_login_error(error_code: Optional[str], provider: Optional[str] = None) -> RedirectResponse:
    login_target = build_remote_url(build_login_url(error_code=error_code, provider=provider, next_path=REMOTE_DEVICES_PATH))
    return RedirectResponse(url=build_mobile_shell_open_url(login_target), status_code=303)


def redirect_to_login_context(
    error_code: Optional[str],
    *,
    provider: Optional[str],
    desktop: bool,
    loopback_url: Optional[str],
    mobile_shell: bool,
) -> RedirectResponse:
    if mobile_shell:
        return redirect_to_mobile_shell_login_error(error_code, provider=provider)

    return redirect_to_login(error_code, provider=provider, desktop=desktop, loopback_url=loopback_url)


def peek_login_context(provider: str, state_value: Optional[str]) -> tuple[Optional[str], bool, Optional[str]]:
    next_path = peek_oauth_state(settings, state_value, provider) if state_value else None
    next_provider, desktop_mode, loopback_url = extract_login_context(next_path)
    if next_provider:
        return next_provider, desktop_mode, loopback_url

    fallback_provider = provider if provider in ("github", "google") else None
    return fallback_provider, desktop_mode, loopback_url


def render_login_page(request: Request, user: Optional[User]) -> str:
    language = detect_request_language(request, user)
    oauth_error = request.query_params.get("oauthError")
    success = request.query_params.get("success")
    cancel = request.query_params.get("cancel")
    selected_provider = normalize_provider(request.query_params.get("provider"))
    desktop_mode = request.query_params.get("desktop") == "1"
    desktop_loopback_url = normalize_loopback_callback_url(request.query_params.get("loopback"))
    next_path = pick_next_path(request.query_params.get("next"))

    provider_ids = get_enabled_providers(settings)
    if selected_provider in provider_ids:
        provider_ids = [selected_provider]

    provider_buttons = []
    for provider in provider_ids:
        label = cloud_text(language, f"login.continue.{provider}")
        href = f"/api/auth/oauth/{provider}/start"
        if desktop_mode:
            href = f'{href}?{urlencode({"next": build_desktop_login_complete_url(provider, loopback_url=desktop_loopback_url), "desktop": "1"})}'
        else:
            next_target = next_path
            if is_mobile_shell_request(request):
                next_target = build_mobile_shell_login_complete_url(
                    resolve_mobile_shell_target_url(request, next_path),
                    provider=provider,
                )
            elif next_path == "/" and is_remote_request(request):
                next_target = REMOTE_DEVICES_PATH

            if next_target != "/":
                href = f'{href}?{urlencode({"next": next_target})}'
        provider_buttons.append(f'<a class="provider {escape(provider)}" href="{escape(href)}">{escape(label)}</a>')

    if desktop_mode:
        provider_buttons.append(
            f'<a class="secondary" href="{escape(build_desktop_login_complete_url(selected_provider, "cancelled", desktop_loopback_url))}">{escape(cloud_text(language, "login.cancelAndClose"))}</a>'
        )

    provider_markup = "\n".join(provider_buttons) or f'<p>{escape(cloud_text(language, "login.providersUnavailable"))}</p>'
    message = ""
    if oauth_error:
        message = f'<p class="message error">{escape(cloud_text(language, "login.failed", error=oauth_error))}</p>'
    elif success:
        message = f'<p class="message success">{escape(cloud_text(language, "login.succeeded"))}</p>'
    elif cancel:
        message = f'<p class="message info">{escape(cloud_text(language, "login.cancelled"))}</p>'

    desktop_hint = ""
    if desktop_mode:
        hint_key = "login.desktopHint.loopback" if desktop_loopback_url else "login.desktopHint.deepLink"
        desktop_hint = f'<p class="caption intro">{escape(cloud_text(language, hint_key))}</p>'

    account_markup = ""
    if user:
        avatar = ""
        if user.avatar_url:
            avatar = f'<img class="avatar" src="{escape(user.avatar_url)}" alt="{escape(user.display_name)}" />'
        account_markup = f"""
        <section class="card session">
          <div class="session-header">
            {avatar}
            <div>
              <h2>{escape(user.display_name)}</h2>
              <p>{escape(user.email)}</p>
              <p class="muted">@{escape(user.username)}</p>
            </div>
          </div>
          <form method="post" action="/api/auth/logout">
            <button class="secondary" type="submit">{escape(cloud_text(language, "login.signOut"))}</button>
          </form>
        </section>
        """

    cookie_domain = settings.session_cookie_domain or cloud_text(language, "login.hostOnly")
    title = cloud_text(language, "login.title")
    subtitle = cloud_text(language, "login.subtitle")
    cookie_domain_text = cloud_text(language, "login.cookieDomain", domain=cookie_domain)
    return f"""<!doctype html>
<html lang="{escape(language)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>{escape(title)}</title>
  <style>
    :root {{
      color-scheme: light;
      --bg-top: #f4efe7;
      --bg-bottom: #dce6f2;
      --panel: rgba(255, 252, 246, 0.94);
      --panel-border: rgba(124, 58, 34, 0.12);
      --text-strong: #1f2937;
      --text-muted: #667085;
      --brand: #c65d2e;
      --brand-strong: #a9471b;
      --brand-soft: rgba(198, 93, 46, 0.12);
      --line: rgba(31, 41, 55, 0.12);
      --shadow: 0 28px 80px rgba(76, 48, 33, 0.18);
    }}
    * {{
      box-sizing: border-box;
    }}
    html {{
      min-height: 100%;
      background: linear-gradient(180deg, var(--bg-top) 0%, var(--bg-bottom) 100%);
    }}
    body {{
      margin: 0;
      min-height: 100vh;
      color: var(--text-strong);
      font-family: "SF Pro Display", "PingFang SC", "Helvetica Neue", sans-serif;
      background:
        radial-gradient(circle at top left, rgba(255, 255, 255, 0.78), transparent 36%),
        radial-gradient(circle at bottom right, rgba(198, 93, 46, 0.14), transparent 28%),
        linear-gradient(180deg, var(--bg-top) 0%, var(--bg-bottom) 100%);
    }}
    body::before,
    body::after {{
      content: "";
      position: fixed;
      inset: auto;
      width: 220px;
      height: 220px;
      border-radius: 999px;
      pointer-events: none;
      filter: blur(6px);
      opacity: 0.8;
    }}
    body::before {{
      top: -72px;
      right: -48px;
      background: radial-gradient(circle, rgba(198, 93, 46, 0.22) 0%, rgba(198, 93, 46, 0) 70%);
    }}
    body::after {{
      bottom: -88px;
      left: -56px;
      background: radial-gradient(circle, rgba(15, 23, 42, 0.12) 0%, rgba(15, 23, 42, 0) 72%);
    }}
    .wrap {{
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding:
        calc(28px + env(safe-area-inset-top, 0px))
        max(18px, env(safe-area-inset-right, 0px))
        calc(24px + env(safe-area-inset-bottom, 0px))
        max(18px, env(safe-area-inset-left, 0px));
    }}
    .shell {{
      width: min(100%, 448px);
      position: relative;
    }}
    .badge {{
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(255, 250, 244, 0.78);
      border: 1px solid rgba(198, 93, 46, 0.18);
      color: #93502d;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      backdrop-filter: blur(12px);
    }}
    .badge::before {{
      content: "";
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: var(--brand);
      box-shadow: 0 0 0 5px rgba(198, 93, 46, 0.14);
    }}
    .card {{
      margin-top: 14px;
      width: 100%;
      background: var(--panel);
      backdrop-filter: blur(18px);
      border: 1px solid var(--panel-border);
      border-radius: 30px;
      box-shadow: var(--shadow);
      padding: 28px;
      position: relative;
      overflow: hidden;
    }}
    .card::before {{
      content: "";
      position: absolute;
      inset: 0 0 auto 0;
      height: 126px;
      background: linear-gradient(135deg, rgba(198, 93, 46, 0.16), rgba(255, 255, 255, 0));
      pointer-events: none;
    }}
    .hero {{
      position: relative;
      z-index: 1;
    }}
    h1 {{
      margin: 16px 0 10px;
      font-size: clamp(32px, 6vw, 42px);
      line-height: 1.02;
      letter-spacing: -0.04em;
    }}
    .subtitle {{
      margin: 0;
      font-size: 15px;
      line-height: 1.7;
      color: var(--text-muted);
      max-width: 30ch;
    }}
    .message {{
      margin-top: 18px;
      padding: 14px 16px;
      border-radius: 18px;
      font-size: 14px;
      line-height: 1.5;
      border: 1px solid transparent;
    }}
    .message.success {{
      background: rgba(22, 101, 52, 0.08);
      border-color: rgba(22, 101, 52, 0.12);
      color: #166534;
    }}
    .message.error {{
      background: rgba(185, 28, 28, 0.08);
      border-color: rgba(185, 28, 28, 0.12);
      color: #991b1b;
    }}
    .message.info {{
      background: rgba(29, 78, 216, 0.08);
      border-color: rgba(29, 78, 216, 0.12);
      color: #1d4ed8;
    }}
    .intro {{
      margin-top: 16px;
      font-size: 14px;
      line-height: 1.6;
      color: #7b6a5f;
    }}
    .stack {{
      display: grid;
      gap: 12px;
      margin-top: 24px;
      position: relative;
      z-index: 1;
    }}
    .provider, .secondary, button {{
      appearance: none;
      display: flex;
      width: 100%;
      align-items: center;
      justify-content: center;
      gap: 10px;
      min-height: 56px;
      padding: 14px 18px;
      border-radius: 18px;
      box-sizing: border-box;
      font-size: 15px;
      font-weight: 700;
      line-height: 1.35;
      text-decoration: none;
      text-align: center;
      white-space: normal;
      overflow-wrap: anywhere;
      transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease;
      cursor: pointer;
    }}
    .provider::before {{
      content: "";
      width: 18px;
      height: 18px;
      flex: 0 0 18px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.22);
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.28);
    }}
    .provider:hover, .secondary:hover, button:hover {{
      transform: translateY(-1px);
    }}
    .provider.github {{
      background: linear-gradient(135deg, #202938 0%, #101828 100%);
      color: #fff;
      box-shadow: 0 16px 28px rgba(16, 24, 40, 0.18);
    }}
    .provider.google {{
      background: linear-gradient(135deg, #d86437 0%, #c14b24 100%);
      color: #fff;
      box-shadow: 0 16px 28px rgba(193, 75, 36, 0.24);
    }}
    .secondary, button.secondary {{
      border: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.82);
      color: var(--text-strong);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
    }}
    .session {{
      margin-top: 22px;
      padding: 18px;
      border-radius: 22px;
      background: rgba(255, 255, 255, 0.7);
      border: 1px solid rgba(31, 41, 55, 0.08);
    }}
    .session-header {{
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 16px;
    }}
    .avatar {{
      width: 56px;
      height: 56px;
      border-radius: 50%;
      object-fit: cover;
    }}
    .session h2 {{
      margin: 0 0 4px;
      font-size: 18px;
    }}
    .session p {{
      margin: 0;
      line-height: 1.6;
      color: var(--text-muted);
    }}
    .muted {{
      color: #8a7a6e;
      font-size: 13px;
    }}
    .footer {{
      display: grid;
      gap: 8px;
      margin-top: 18px;
      position: relative;
      z-index: 1;
    }}
    .caption {{
      margin: 0;
      font-size: 12px;
      line-height: 1.6;
      color: #8a7a6e;
    }}
    @media (max-width: 768px) {{
      .wrap {{
        place-items: stretch;
        min-height: auto;
      }}
      .shell {{
        width: 100%;
      }}
      .card {{
        margin-top: 12px;
        padding: 24px 18px 20px;
        border-radius: 26px;
      }}
      h1 {{
        font-size: 34px;
      }}
      .subtitle {{
        max-width: none;
      }}
      .session-header {{
        align-items: flex-start;
      }}
    }}
  </style>
</head>
<body>
  <div class="wrap">
    <main class="shell">
      <div class="badge">ContextGo Cloud</div>
      <section class="card">
        <div class="hero">
          <h1>{escape(title)}</h1>
          <p class="subtitle">{escape(subtitle)}</p>
        </div>
        {message}
        {desktop_hint}
        <div class="stack">
          {provider_markup}
        </div>
        {account_markup}
        <div class="footer">
          <p class="caption">{escape(cookie_domain_text)}</p>
        </div>
      </section>
    </main>
  </div>
</body>
</html>"""


def build_remote_session_url(device_id: str) -> str:
    return f"{REMOTE_DEVICE_PATH_PREFIX}/{quote(device_id, safe='')}"


def build_mobile_shell_open_url(target_url: str, code: Optional[str] = None) -> str:
    query = {"target": target_url}
    if code:
        query["code"] = code

    return f"{REMOTE_SHELL_SCHEME}://open?{urlencode(query)}"


def describe_remote_notice(language: str, notice: Optional[str]) -> Optional[dict[str, str]]:
    if notice == "device_not_found":
        return {
            "className": "error",
            "title": cloud_text(language, "remote.notice.deviceNotFound.title"),
            "detail": cloud_text(language, "remote.notice.deviceNotFound.detail"),
        }

    if notice == "device_offline":
        return {
            "className": "info",
            "title": cloud_text(language, "remote.notice.deviceOffline.title"),
            "detail": cloud_text(language, "remote.notice.deviceOffline.detail"),
        }

    if notice == "session_replaced":
        return {
            "className": "info",
            "title": cloud_text(language, "remote.notice.sessionReplaced.title"),
            "detail": cloud_text(language, "remote.notice.sessionReplaced.detail"),
        }

    if notice == "browser_entry_unavailable":
        return {
            "className": "info",
            "title": cloud_text(language, "remote.notice.browserEntryUnavailable.title"),
            "detail": cloud_text(language, "remote.notice.browserEntryUnavailable.detail"),
        }

    if notice == "service_restarted":
        return {
            "className": "info",
            "title": cloud_text(language, "remote.notice.serviceRestarted.title"),
            "detail": cloud_text(language, "remote.notice.serviceRestarted.detail"),
        }

    return None


def resolve_remote_browser_entry_url(remote_status: dict[str, object]) -> Optional[str]:
    browser_entry_url = remote_status.get("browserEntryUrl")
    if not isinstance(browser_entry_url, str):
        return None

    normalized = browser_entry_url.strip()
    return normalized or None


def read_active_remote_device_id(request: Request) -> Optional[str]:
    raw_device_id = request.cookies.get(REMOTE_ACTIVE_DEVICE_COOKIE)
    if not raw_device_id:
        return None

    normalized = raw_device_id.strip()
    return normalized or None


def set_active_remote_device_cookie(response: Response, device_id: str) -> None:
    response.set_cookie(
        key=REMOTE_ACTIVE_DEVICE_COOKIE,
        value=device_id,
        httponly=True,
        secure=settings.remote_base_url.startswith("https://"),
        samesite="lax",
        path="/",
        max_age=settings.session_ttl_seconds,
    )


def clear_active_remote_device_cookie(response: Response) -> None:
    response.delete_cookie(key=REMOTE_ACTIVE_DEVICE_COOKIE, path="/")


def should_force_remote_device_picker(request: Request) -> bool:
    return request.query_params.get(REMOTE_DEVICE_VIEW_QUERY_KEY) == REMOTE_DEVICE_VIEW_LIST or bool(
        request.query_params.get("remoteNotice")
    )


def is_remote_control_plane_path(path: str) -> bool:
    return (
        path == "/"
        or path.startswith(f"{REMOTE_DEVICE_PATH_PREFIX}/")
        or path.startswith(REMOTE_DEVICES_PATH)
        or path.startswith("/api/remote/")
        or path == DESKTOP_LOGIN_COMPLETE_PATH
        or path == MOBILE_SHELL_LOGIN_COMPLETE_PATH
        or path == "/healthz"
        or path == "/api/healthz"
    )


def should_rewrite_vite_client(path: str, headers: dict[str, str]) -> bool:
    if path != "/@vite/client":
        return False

    content_type = headers.get("content-type", "")
    return "javascript" in content_type or "ecmascript" in content_type or not content_type


def should_rewrite_remote_html(path: str, headers: dict[str, str]) -> bool:
    if path != "/":
        return False

    content_type = headers.get("content-type", "")
    return "text/html" in content_type or "application/xhtml+xml" in content_type


def rewrite_remote_html_source(source: str, device_id: str) -> str:
    base_href = f"{REMOTE_DEVICE_PATH_PREFIX}/{quote(device_id, safe='')}/"
    base_tag = f'<base href="{base_href}">'
    rewritten = source.replace('./assets/', '/assets/')

    if "<base " in rewritten.lower():
        return rewritten

    lower_source = rewritten.lower()
    head_close = lower_source.find("</head>")
    if head_close >= 0:
        return f"{rewritten[:head_close]}  {base_tag}\n{rewritten[head_close:]}"

    body_open = lower_source.find("<body")
    if body_open >= 0:
        return f"{rewritten[:body_open]}{base_tag}\n{rewritten[body_open:]}"

    return f"{base_tag}\n{rewritten}"


def rewrite_vite_client_source(source: str, device_id: str) -> str:
    vite_socket_path = f'/api/remote/vite/{quote(device_id, safe="")}'
    replacements = {
        'const serverHost = "localhost:5173/";': f'const serverHost = `${{importMetaUrl.host}}{vite_socket_path}`;',
        'const hmrPort = 5173;': 'const hmrPort = null;',
        'const socketHost = `${"localhost" || importMetaUrl.hostname}:${hmrPort || importMetaUrl.port}${"/"}`;': f'const socketHost = `${{importMetaUrl.host}}{vite_socket_path}`;',
        'const directSocketHost = "localhost:5173/";': 'const directSocketHost = socketHost;',
    }

    rewritten = source
    for old_snippet, new_snippet in replacements.items():
        rewritten = rewritten.replace(old_snippet, new_snippet)

    return rewritten


async def relay_remote_http_request(
    request: Request,
    *,
    user: User,
    device: Device,
    desktop_path: str,
) -> Response:
    request_id = uuid4().hex
    request_headers = {key: value for key, value in request.headers.items()}
    request_headers["x-forwarded-host"] = request.headers.get("host", "")
    if request.client and request.client.host:
        request_headers["x-forwarded-for"] = request.client.host

    request_body = await request.body()
    relay_response = await remote_relay_hub.begin_http_request(
        user_id=user.id,
        device_id=device.id,
        request_id=request_id,
        payload={
            "type": "http_request",
            "requestId": request_id,
            "request": {
                "method": request.method,
                "path": desktop_path,
                "query": request.url.query,
                "headers": request_headers,
                "bodyBase64": base64.b64encode(request_body).decode("ascii") if request_body else "",
            },
        },
    )
    if relay_response is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Remote device is offline")

    body = relay_response.body
    response_headers = {
        key: value
        for key, value in relay_response.headers.items()
        if key.lower() not in {"connection", "content-length", "transfer-encoding", "set-cookie"}
    }

    if should_rewrite_vite_client(desktop_path, response_headers):
        rewritten_body = rewrite_vite_client_source(body.decode("utf-8"), device.id)
        body = rewritten_body.encode("utf-8")
        response_headers["content-length"] = str(len(body))

    if should_rewrite_remote_html(desktop_path, response_headers):
        rewritten_body = rewrite_remote_html_source(body.decode("utf-8"), device.id)
        body = rewritten_body.encode("utf-8")
        response_headers["content-length"] = str(len(body))

    response = Response(content=body, status_code=relay_response.status_code, headers=response_headers)
    for set_cookie in relay_response.set_cookies:
        response.headers.append("set-cookie", set_cookie)

    return response


def describe_remote_device_availability(language: str, device_payload: dict[str, object]) -> dict[str, object]:
    remote_status = device_payload.get("remoteStatus")
    remote_data = remote_status if isinstance(remote_status, dict) else {}
    connected = remote_data.get("connected") is True
    client_connected = remote_data.get("clientConnected") is True
    browser_entry_ready = remote_data.get("browserEntryReady") is True
    transport = remote_data.get("transport") if isinstance(remote_data.get("transport"), str) else "cloud-relay"
    transport_label = cloud_text(language, "transport.cloudRelay") if transport == "cloud-relay" else transport

    if connected and browser_entry_ready:
        if client_connected:
            return {
                "connected": True,
                "clientConnected": True,
                "badge": cloud_text(language, "remote.badge.liveSession"),
                "badgeClass": "busy",
                "summary": cloud_text(language, "remote.summary.liveSession", transportLabel=transport_label),
                "detail": cloud_text(language, "remote.detail.liveSession"),
                "actionLabel": cloud_text(language, "remote.action.openLiveSession"),
                "actionHref": build_remote_session_url(str(device_payload.get("id", ""))),
            }

        return {
            "connected": True,
            "clientConnected": False,
            "badge": cloud_text(language, "remote.badge.available"),
            "badgeClass": "ready",
            "summary": cloud_text(language, "remote.summary.available", transportLabel=transport_label),
            "detail": cloud_text(language, "remote.detail.available"),
            "actionLabel": cloud_text(language, "remote.action.openLiveSession"),
            "actionHref": build_remote_session_url(str(device_payload.get("id", ""))),
        }

    if connected:
        return {
            "connected": False,
            "clientConnected": client_connected,
            "badge": cloud_text(language, "remote.badge.unavailable"),
            "badgeClass": "offline",
            "summary": cloud_text(language, "remote.summary.browserEntryUnavailable", transportLabel=transport_label),
            "detail": cloud_text(language, "remote.rendererUnavailableDetail"),
            "actionLabel": cloud_text(language, "remote.action.unavailable"),
            "actionHref": None,
        }

    return {
        "connected": False,
        "clientConnected": client_connected,
        "badge": cloud_text(language, "remote.badge.unavailable"),
        "badgeClass": "offline",
        "summary": cloud_text(language, "remote.summary.unavailable", transportLabel=transport_label),
        "detail": cloud_text(language, "remote.detail.unavailable", transportLabel=transport_label),
        "actionLabel": cloud_text(language, "remote.action.unavailable"),
        "actionHref": None,
    }

def remote_device_sort_priority(device_payload: dict[str, object]) -> int:
    remote_status = device_payload.get("remoteStatus")
    remote_data = remote_status if isinstance(remote_status, dict) else {}
    connected = remote_data.get("connected") is True
    client_connected = remote_data.get("clientConnected") is True
    browser_entry_ready = remote_data.get("browserEntryReady") is True

    if connected and browser_entry_ready and not client_connected:
        return 3

    if connected and browser_entry_ready and client_connected:
        return 2

    if connected:
        return 1

    return 0



def remote_device_sort_timestamp(device_payload: dict[str, object]) -> float:
    raw_timestamp = device_payload.get("updatedAt") or device_payload.get("lastSeenAt")
    if not isinstance(raw_timestamp, str):
        return 0.0

    normalized = raw_timestamp.strip()
    if not normalized:
        return 0.0

    try:
        return datetime.fromisoformat(normalized.replace("Z", "+00:00")).timestamp()
    except ValueError:
        return 0.0



def sort_remote_devices_for_display(devices: list[dict[str, object]]) -> list[dict[str, object]]:
    return sorted(
        devices,
        key=lambda device: (
            -remote_device_sort_priority(device),
            -remote_device_sort_timestamp(device),
            str(device.get("deviceName") or "").lower(),
        ),
    )


def can_open_remote_device(device_payload: dict[str, object]) -> bool:
    remote_status = device_payload.get("remoteStatus")
    remote_data = remote_status if isinstance(remote_status, dict) else {}
    return remote_data.get("connected") is True and remote_data.get("browserEntryReady") is True


def resolve_remote_device_selection(request: Request, devices: list[dict[str, object]]) -> dict[str, object]:
    ordered_devices = sort_remote_devices_for_display(devices)
    openable_devices = [device for device in ordered_devices if can_open_remote_device(device)]
    active_device_id = read_active_remote_device_id(request)
    force_picker = should_force_remote_device_picker(request)

    preferred_device: Optional[dict[str, object]] = None
    preferred_source: Optional[str] = None
    if active_device_id:
        preferred_device = next(
            (device for device in openable_devices if str(device.get("id") or "") == active_device_id),
            None,
        )
        if preferred_device is not None:
            preferred_source = "last_active"

    if preferred_device is None and len(openable_devices) == 1:
        preferred_device = openable_devices[0]
        preferred_source = "single_available"

    preferred_device_id = str(preferred_device.get("id") or "") if preferred_device is not None else None
    if preferred_device_id == "":
        preferred_device_id = None

    auto_open_device_id = None if force_picker else preferred_device_id
    auto_open_reason = preferred_source if auto_open_device_id else None

    return {
        "preferredDeviceId": preferred_device_id,
        "preferredSource": preferred_source,
        "autoOpenDeviceId": auto_open_device_id,
        "autoOpenReason": auto_open_reason,
        "openableDeviceCount": len(openable_devices),
        "forcePicker": force_picker,
    }



def build_remote_device_card_markup(
    language: str,
    device: dict[str, object],
    availability: dict[str, object],
    remote_origin: str,
    *,
    mobile_shell_request: bool,
    featured: bool = False,
) -> str:
    action_markup = ""
    if availability["actionHref"]:
        relative_target_url = str(availability["actionHref"])
        absolute_target_url = f"{remote_origin}{relative_target_url}"
        mobile_shell_url = build_mobile_shell_open_url(absolute_target_url)
        action_markup = f'<a class="primary" href="{escape(relative_target_url)}">{escape(str(availability["actionLabel"]))}</a>'
        if not mobile_shell_request:
            action_markup += f'<a class="secondary" href="{escape(mobile_shell_url)}">{escape(cloud_text(language, "remote.openInApp"))}</a>'
    else:
        action_markup = f'<span class="secondary disabled" aria-disabled="true">{escape(cloud_text(language, "remote.action.unavailable"))}</span>'

    connected_at = ""
    remote_status = device.get("remoteStatus")
    remote_data = remote_status if isinstance(remote_status, dict) else {}
    if isinstance(remote_data.get("connectedAt"), str) and remote_data["connectedAt"]:
        connected_at = f'<p class="meta">{escape(cloud_text(language, "remote.relayConnectedAt", timestamp=str(remote_data["connectedAt"])))}</p>'
    elif isinstance(device.get("lastSeenAt"), str) and device["lastSeenAt"]:
        connected_at = f'<p class="meta">{escape(cloud_text(language, "remote.lastSeenAt", timestamp=str(device["lastSeenAt"])))}</p>'

    device_name = str(device.get("deviceName") or cloud_text(language, "remote.unnamedDevice"))
    platform = str(device.get("platform", "unknown"))
    status = str(device.get("status", "unknown"))
    subtitle = cloud_text(language, "remote.deviceSubtitle", platform=platform, status=status)
    featured_class = " featured" if featured else ""
    return f"""
            <article class="device-card{featured_class}">
              <div class="device-header">
                <div>
                  <h2>{escape(device_name)}</h2>
                  <p class="device-subtitle">{escape(subtitle)}</p>
                </div>
                <span class="badge badge-{escape(str(availability["badgeClass"]))}">{escape(str(availability["badge"]))}</span>
              </div>
              <p class="summary">{escape(str(availability["summary"]))}</p>
              <p class="detail">{escape(str(availability["detail"]))}</p>
              {connected_at}
              <div class="actions">
                {action_markup}
              </div>
            </article>
            """



def render_remote_devices_page(
    request: Request,
    user: User,
    devices: list[dict[str, object]],
    remote_origin: str,
    notice: Optional[dict[str, str]] = None,
) -> str:
    language = detect_request_language(request, user)
    mobile_shell_request = is_mobile_shell_request(request)
    ordered_devices = sort_remote_devices_for_display(devices)
    selection = resolve_remote_device_selection(request, ordered_devices)
    preferred_device_id = str(selection.get("preferredDeviceId") or "") if mobile_shell_request else ""

    device_entries: list[dict[str, object]] = []
    for device in ordered_devices:
        availability = describe_remote_device_availability(language, device)
        device_entries.append({"device": device, "availability": availability})

    featured_entry: Optional[dict[str, object]] = None
    if mobile_shell_request:
        if preferred_device_id:
            featured_entry = next(
                (
                    entry for entry in device_entries if str(entry["device"].get("id") or "") == preferred_device_id
                ),
                None,
            )

    card_markup_items = []
    featured_device_id = str(featured_entry["device"].get("id") or "") if featured_entry else None
    for entry in device_entries:
        device_id = str(entry["device"].get("id") or "")
        if mobile_shell_request and featured_device_id and device_id == featured_device_id:
            continue

        card_markup_items.append(
            build_remote_device_card_markup(
                language,
                entry["device"],
                entry["availability"],
                remote_origin,
                mobile_shell_request=mobile_shell_request,
            )
        )

    cards_markup = "\n".join(card_markup_items)
    featured_markup = ""
    if featured_entry is not None:
        featured_markup = f"""
        <section class="continue-section">
          <h2>{escape(cloud_text(language, "remote.mobile.continue"))}</h2>
          {build_remote_device_card_markup(language, featured_entry["device"], featured_entry["availability"], remote_origin, mobile_shell_request=mobile_shell_request, featured=True)}
        </section>
        """

    account_name = escape(str(user.display_name or user.username or user.email))
    account_email = escape(user.email)
    account_username = escape(str(user.username or user.email))
    notice_markup = ""
    if notice is not None:
        notice_markup = f"""
        <section class="notice notice-{escape(notice["className"])}">
          <strong>{escape(notice["title"])}</strong>
          <p>{escape(notice["detail"])}</p>
        </section>
        """

    title = cloud_text(language, "remote.title")
    signed_in_as = cloud_text(language, "remote.signedInAs", name=user.display_name, email=user.email)
    description = cloud_text(language, "remote.description")
    refresh_label = cloud_text(language, "remote.refreshDevices")
    sign_out_label = cloud_text(language, "remote.signOut")
    ready_count = sum(1 for entry in device_entries if entry["availability"]["connected"] and not entry["availability"]["clientConnected"])
    live_count = sum(1 for entry in device_entries if entry["availability"]["clientConnected"])
    metrics_markup = f"""
        <div class="stats-grid">
          <article class="stat-pill">
            <span class="stat-value">{len(device_entries)}</span>
            <span class="stat-label">{escape(cloud_text(language, "remote.metric.devices"))}</span>
          </article>
          <article class="stat-pill">
            <span class="stat-value">{ready_count}</span>
            <span class="stat-label">{escape(cloud_text(language, "remote.metric.ready"))}</span>
          </article>
          <article class="stat-pill">
            <span class="stat-value">{live_count}</span>
            <span class="stat-label">{escape(cloud_text(language, "remote.metric.live"))}</span>
          </article>
        </div>
    """

    if mobile_shell_request:
        header_markup = f"""
        <section class="mobile-shell-hero">
          <div class="hero-copy">
            <p class="signed-in">{escape(signed_in_as)}</p>
            <h1>{escape(title)}</h1>
            <p>{escape(description)}</p>
          </div>
          {metrics_markup}
          <div class="account-card mobile-toolbar-card">
            <p><strong>{account_name}</strong></p>
            <p class="account-meta">@{account_username}</p>
            <div class="toolbar">
              <a class="secondary" href="{REMOTE_DEVICES_PATH}">{escape(refresh_label)}</a>
              <form method="post" action="/api/auth/logout?next={escape(REMOTE_DEVICES_PATH)}">
                <button class="secondary" type="submit">{escape(sign_out_label)}</button>
              </form>
            </div>
          </div>
          {featured_markup}
        </section>
        """
    else:
        header_markup = f"""
        <section class="topbar">
          <div>
            <h1>{escape(title)}</h1>
            <p>{escape(signed_in_as)}</p>
            <p>{escape(description)}</p>
          </div>
          <div class="account-card">
            <p><strong>{account_name}</strong></p>
            <p class="account-meta">{account_email}</p>
            <div class="toolbar">
              <a class="secondary" href="{REMOTE_DEVICES_PATH}">{escape(refresh_label)}</a>
              <form method="post" action="/api/auth/logout?next={escape(REMOTE_DEVICES_PATH)}">
                <button class="secondary" type="submit">{escape(sign_out_label)}</button>
              </form>
            </div>
          </div>
        </section>
        """

    devices_markup = ""
    if cards_markup:
        container_class = "device-stack" if mobile_shell_request else "grid"
        devices_markup = f"""
        <section class="{container_class}">
          {cards_markup}
        </section>
        """
    elif featured_entry is None:
        devices_markup = f"""
        <section class="empty-state">
          <h2>{escape(cloud_text(language, "remote.emptyTitle"))}</h2>
          <p>{escape(cloud_text(language, "remote.emptyDetail"))}</p>
        </section>
        """

    body_class = "mobile-shell" if mobile_shell_request else ""
    return f"""<!doctype html>
<html lang="{escape(language)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>{escape(title)}</title>
  <style>
    :root {{
      color-scheme: light;
    }}
    html {{
      min-height: 100%;
      background: #eef4ff;
    }}
    body {{
      margin: 0;
      font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background:
        radial-gradient(circle at top left, rgba(56, 189, 248, 0.18), transparent 28%),
        linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%);
      color: #0f172a;
      min-height: 100vh;
    }}
    .wrap {{
      width: min(1100px, calc(100% - 32px));
      margin: 0 auto;
      padding:
        calc(24px + env(safe-area-inset-top, 0px))
        max(16px, env(safe-area-inset-right, 0px))
        calc(40px + env(safe-area-inset-bottom, 0px))
        max(16px, env(safe-area-inset-left, 0px));
      box-sizing: border-box;
    }}
    .topbar {{
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 28px;
    }}
    .topbar h1, .mobile-shell-hero h1 {{
      margin: 0;
      font-size: 34px;
    }}
    .topbar p, .mobile-shell-hero p {{
      margin: 8px 0 0;
      color: #475569;
      line-height: 1.6;
    }}
    .account-card {{
      min-width: 260px;
      background: rgba(255, 255, 255, 0.86);
      border: 1px solid rgba(15, 23, 42, 0.08);
      border-radius: 20px;
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
      padding: 18px 20px;
    }}
    .account-card p {{
      margin: 0;
      line-height: 1.5;
    }}
    .account-meta {{
      color: #475569;
      font-size: 14px;
      margin-top: 4px;
    }}
    .toolbar {{
      display: flex;
      gap: 12px;
      align-items: center;
      margin-top: 14px;
    }}
    .grid {{
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    }}
    .device-stack {{
      display: grid;
      gap: 16px;
    }}
    .notice {{
      margin-bottom: 16px;
      padding: 16px 18px;
      border-radius: 18px;
      border: 1px solid rgba(15, 23, 42, 0.08);
      box-shadow: 0 16px 36px rgba(15, 23, 42, 0.06);
      background: rgba(255, 255, 255, 0.92);
    }}
    .notice strong {{
      display: block;
      font-size: 15px;
    }}
    .notice p {{
      margin: 8px 0 0;
      color: #475569;
      line-height: 1.6;
    }}
    .notice-error {{
      background: #fff7f7;
      border-color: rgba(220, 38, 38, 0.15);
    }}
    .notice-info {{
      background: #f8fbff;
      border-color: rgba(37, 99, 235, 0.12);
    }}
    .device-card, .empty-state, .mobile-shell-hero {{
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid rgba(15, 23, 42, 0.08);
      border-radius: 24px;
      box-shadow: 0 20px 56px rgba(15, 23, 42, 0.08);
      padding: 24px;
    }}
    .mobile-shell-hero {{
      display: grid;
      gap: 18px;
      margin-bottom: 20px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.97) 0%, rgba(244, 248, 255, 0.98) 100%);
    }}
    .mobile-shell-hero .signed-in {{
      margin: 0 0 10px;
      color: #334155;
      font-weight: 700;
    }}
    .stats-grid {{
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }}
    .stat-pill {{
      display: grid;
      gap: 4px;
      padding: 16px;
      background: rgba(255, 255, 255, 0.78);
      border: 1px solid rgba(15, 23, 42, 0.08);
      border-radius: 18px;
    }}
    .stat-value {{
      font-size: 24px;
      font-weight: 800;
      line-height: 1;
      color: #0f172a;
    }}
    .stat-label {{
      font-size: 12px;
      font-weight: 700;
      color: #475569;
      letter-spacing: 0.01em;
    }}
    .continue-section {{
      display: grid;
      gap: 14px;
    }}
    .continue-section h2 {{
      margin: 0;
      font-size: 18px;
    }}
    .device-card.featured {{
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(239, 246, 255, 0.95) 100%);
      border-color: rgba(37, 99, 235, 0.12);
      box-shadow: 0 22px 60px rgba(37, 99, 235, 0.10);
    }}
    .device-header {{
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
    }}
    .device-header h2, .empty-state h2 {{
      margin: 0;
      font-size: 24px;
    }}
    .device-subtitle {{
      margin: 8px 0 0;
      color: #64748b;
    }}
    .summary {{
      margin: 18px 0 0;
      color: #0f172a;
      line-height: 1.7;
      font-weight: 600;
    }}
    .detail, .meta, .empty-state p {{
      margin: 10px 0 0;
      color: #475569;
      line-height: 1.7;
    }}
    .badge {{
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 8px 12px;
      font-size: 13px;
      font-weight: 700;
      white-space: nowrap;
    }}
    .badge-ready {{
      background: #ecfdf5;
      color: #166534;
    }}
    .badge-busy {{
      background: #eff6ff;
      color: #1d4ed8;
    }}
    .badge-offline {{
      background: #f8fafc;
      color: #64748b;
    }}
    .actions {{
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 18px;
    }}
    a.primary, a.secondary, button.secondary, .secondary.disabled {{
      appearance: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      padding: 0 18px;
      border-radius: 999px;
      text-decoration: none;
      font-size: 14px;
      font-weight: 700;
      border: 1px solid rgba(15, 23, 42, 0.1);
      box-sizing: border-box;
      flex: 1 1 180px;
    }}
    a.primary {{
      background: #111827;
      border-color: #111827;
      color: white;
    }}
    a.secondary, button.secondary, .secondary.disabled {{
      background: white;
      color: #0f172a;
    }}
    .secondary.disabled {{
      color: #94a3b8;
      cursor: not-allowed;
    }}
    form {{
      margin: 0;
    }}
    body.mobile-shell .wrap {{
      width: min(760px, calc(100% - 24px));
    }}
    body.mobile-shell .toolbar {{
      width: 100%;
      flex-wrap: wrap;
    }}
    body.mobile-shell .toolbar a.secondary,
    body.mobile-shell .toolbar button.secondary {{
      flex: 1 1 160px;
    }}
    body.mobile-shell .actions {{
      flex-direction: column;
    }}
    body.mobile-shell .actions > * {{
      width: 100%;
      flex-basis: auto;
    }}
    @media (max-width: 768px) {{
      .wrap {{
        width: 100%;
        padding-top: calc(18px + env(safe-area-inset-top, 0px));
        padding-bottom: calc(28px + env(safe-area-inset-bottom, 0px));
      }}
      .topbar, .device-header {{
        flex-direction: column;
      }}
      .topbar h1, .mobile-shell-hero h1 {{
        font-size: 28px;
      }}
      .account-card {{
        width: 100%;
        min-width: 0;
        box-sizing: border-box;
      }}
      .toolbar {{
        width: 100%;
        flex-direction: column;
        align-items: stretch;
      }}
      .toolbar a.secondary, .toolbar button.secondary {{
        width: 100%;
      }}
      .grid {{
        grid-template-columns: 1fr;
      }}
      .device-card, .empty-state, .mobile-shell-hero {{
        border-radius: 20px;
        padding: 20px;
      }}
      .device-header h2, .empty-state h2 {{
        font-size: 21px;
      }}
      .actions {{
        flex-direction: column;
      }}
      .actions > * {{
        width: 100%;
      }}
      a.primary, a.secondary, button.secondary, .secondary.disabled {{
        width: 100%;
        flex-basis: auto;
      }}
      .stats-grid {{
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }}
    }}
  </style>
</head>
<body class="{body_class}">
  <main class="wrap">
    {header_markup}
    {notice_markup}
    {devices_markup}
  </main>
</body>
</html>"""


def load_remote_renderer_index_html() -> str:
    if not RENDERER_INDEX_PATH.is_file():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Remote renderer build is unavailable",
        )

    html = RENDERER_INDEX_PATH.read_text(encoding="utf-8")
    return html.replace('./assets/', '/assets/')


def resolve_renderer_asset_path(asset_path: str) -> Optional[Path]:
    normalized = asset_path.strip().lstrip('/')
    if not normalized:
        return None

    assets_root = RENDERER_ASSETS_PATH.resolve()
    candidate = (assets_root / normalized).resolve()
    try:
        candidate.relative_to(assets_root)
    except ValueError:
        return None

    if not candidate.is_file():
        return None

    return candidate


def render_desktop_login_complete_page(language: str, deep_link_url: str, is_error: bool, message: str) -> str:
    escaped_deep_link_url = escape(deep_link_url)
    escaped_message = escape(message)
    status_class = "error" if is_error else "success"
    action_label = cloud_text(language, "desktop.action.return") if is_error else cloud_text(language, "desktop.action.open")
    script_deep_link_url = json.dumps(deep_link_url)
    title = cloud_text(language, "desktop.title")
    caption_auto_open = cloud_text(language, "desktop.caption.autoOpen")
    caption_deep_link_label = cloud_text(language, "desktop.caption.deepLink", url="").rstrip()

    return f"""<!doctype html>
<html lang="{escape(language)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{escape(title)}</title>
  <style>
    body {{
      margin: 0;
      font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
      color: #0f172a;
    }}
    .wrap {{
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
    }}
    .card {{
      width: min(520px, 100%);
      background: rgba(255, 255, 255, 0.94);
      border: 1px solid rgba(15, 23, 42, 0.08);
      border-radius: 24px;
      box-shadow: 0 24px 80px rgba(15, 23, 42, 0.12);
      padding: 32px;
    }}
    h1 {{
      margin: 0 0 8px;
      font-size: 32px;
    }}
    p {{
      margin: 0;
      line-height: 1.6;
      color: #475569;
    }}
    .message {{
      margin-top: 18px;
      padding: 14px 16px;
      border-radius: 16px;
    }}
    .message.success {{
      background: #ecfdf5;
      color: #166534;
    }}
    .message.error {{
      background: #fef2f2;
      color: #991b1b;
    }}
    .stack {{
      display: grid;
      gap: 12px;
      margin-top: 24px;
    }}
    .primary {{
      display: inline-flex;
      justify-content: center;
      align-items: center;
      min-height: 48px;
      border-radius: 999px;
      background: #111827;
      color: white;
      text-decoration: none;
      font-weight: 600;
      padding: 0 20px;
    }}
    .caption {{
      margin-top: 18px;
      font-size: 14px;
      color: #64748b;
    }}
    code {{
      background: rgba(15, 23, 42, 0.06);
      padding: 2px 6px;
      border-radius: 8px;
      word-break: break-all;
    }}
  </style>
</head>
<body>
  <div class="wrap">
    <main class="card">
      <h1>{escape(title)}</h1>
      <p class="message {status_class}">{escaped_message}</p>
      <div class="stack">
        <a class="primary" href="{escaped_deep_link_url}">{escape(action_label)}</a>
      </div>
      <p class="caption">{escape(caption_auto_open)}</p>
      <p class="caption">{escape(caption_deep_link_label)} <code>{escaped_deep_link_url}</code></p>
    </main>
  </div>
  <script>
    window.setTimeout(() => {{
      window.location.href = {script_deep_link_url};
    }}, 80);
  </script>
</body>
</html>"""


def redirect_to_login(
    error_code: Optional[str] = None,
    success: bool = False,
    provider: Optional[str] = None,
    desktop: bool = False,
    loopback_url: Optional[str] = None,
) -> RedirectResponse:
    if desktop:
        return RedirectResponse(
            url=build_desktop_login_complete_url(provider=provider, error_code=error_code, loopback_url=loopback_url),
            status_code=303,
        )

    return RedirectResponse(
        url=build_login_url(error_code=error_code, success=success, provider=provider, desktop=desktop),
        status_code=303,
    )


def build_session_payload(user: Optional[User]) -> dict[str, object]:
    if user is None:
        return {
            "authenticated": False,
            "user": None,
        }

    return {
        "authenticated": True,
        "user": {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "displayName": user.display_name,
            "avatarUrl": user.avatar_url,
        },
    }


def serialize_device(device: Device) -> dict[str, object]:
    remote_status = remote_relay_hub.get_presence(device.id)
    return {
        "id": device.id,
        "userId": device.user_id,
        "deviceName": device.device_name,
        "platform": device.platform,
        "deviceKind": device.device_kind,
        "status": device.status,
        "createdAt": device.created_at,
        "updatedAt": device.updated_at,
        "lastSeenAt": device.last_seen_at,
        "lastIpAddress": device.last_ip_address,
        "lastUserAgent": device.last_user_agent,
        "remoteStatus": {
            "connected": remote_status.connected,
            "connectedAt": remote_status.connected_at,
            "clientConnected": remote_status.client_connected,
            "clientConnectedAt": remote_status.client_connected_at,
            "transport": remote_status.transport,
            "browserEntryUrl": remote_status.browser_entry_url,
            "browserEntryReady": remote_status.browser_entry_ready,
            "browserEntryReason": remote_status.browser_entry_reason,
        },
    }


def list_remote_devices_payload(user_id: str) -> list[dict[str, object]]:
    return [
        serialize_device(device)
        for device in list_devices_for_user(settings, user_id)
        if device.device_kind == "desktop" and device.status == "active"
    ]


def require_current_user(request: Request) -> User:
    user = read_current_user(request)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    return user


def read_bearer_token(request: Request) -> Optional[str]:
    authorization = request.headers.get("authorization", "").strip()
    bearer_prefix = "bearer "
    if not authorization.lower().startswith(bearer_prefix):
        return None

    token = authorization[len(bearer_prefix) :].strip()
    return token or None


def read_bearer_token_from_header(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None

    bearer_prefix = "bearer "
    normalized = authorization.strip()
    if not normalized.lower().startswith(bearer_prefix):
        return None

    token = normalized[len(bearer_prefix) :].strip()
    return token or None


def read_user_and_device_from_device_token(raw_token: Optional[str]) -> tuple[Optional[User], Optional[Device]]:
    if not raw_token:
        return None, None

    return get_user_by_device_token(settings, raw_token)


def require_current_device(request: Request) -> tuple[User, Device]:
    raw_token = read_bearer_token(request)
    if raw_token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Device token is required",
        )

    user, device = read_user_and_device_from_device_token(raw_token)
    if user is None or device is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid device token",
        )

    touch_device(
        settings=settings,
        device_id=device.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return user, device


def require_current_user_or_device(request: Request) -> User:
    user = read_current_user(request)
    if user is not None:
        return user

    device_user, _device = require_current_device(request)
    return device_user


def find_or_create_user(profile: OAuthProfile) -> User:
    user = find_user_by_oauth_account(settings, profile.provider, profile.provider_user_id)
    if user is None:
        user = find_user_by_email(settings, profile.email)

    if user is None:
        username = allocate_username(settings, profile.username_candidate, profile.email)
        user = create_user(
            settings=settings,
            email=profile.email,
            username=username,
            display_name=profile.display_name,
            avatar_url=profile.avatar_url,
        )
    else:
        update_user_profile(
            settings=settings,
            user_id=user.id,
            display_name=profile.display_name,
            avatar_url=profile.avatar_url,
        )
        refreshed_user = find_user_by_email(settings, profile.email)
        if refreshed_user is not None:
            user = refreshed_user

    upsert_oauth_account(
        settings=settings,
        user_id=user.id,
        provider=profile.provider,
        provider_user_id=profile.provider_user_id,
        email=profile.email,
    )
    return user


@app.get("/healthz")
async def healthz() -> JSONResponse:
    return JSONResponse({"ok": True})


@app.get("/api/healthz")
async def api_healthz() -> JSONResponse:
    return JSONResponse({"ok": True})


@app.get("/", response_class=HTMLResponse, response_model=None)
async def root(request: Request):
    host = get_request_hostname(request)
    if host == api_host:
        return JSONResponse(
            {
                "service": "contextgo-cloud-auth",
                "authBaseUrl": settings.auth_base_url,
                "apiBaseUrl": settings.api_base_url,
                "remoteBaseUrl": settings.remote_base_url,
                "providers": get_enabled_providers(settings),
            }
        )

    if host == remote_host:
        return RedirectResponse(url=REMOTE_DEVICES_PATH, status_code=307)

    return HTMLResponse(render_login_page(request, read_current_user(request)))


@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request) -> HTMLResponse:
    return HTMLResponse(render_login_page(request, read_current_user(request)))


@app.get(REMOTE_DEVICES_PATH, response_class=HTMLResponse)
async def remote_devices_page(request: Request) -> HTMLResponse:
    if not is_remote_request(request):
        return RedirectResponse(url=build_remote_url(REMOTE_DEVICES_PATH), status_code=307)

    user = read_current_user(request)
    if user is None:
        return RedirectResponse(url=build_login_url(next_path=REMOTE_DEVICES_PATH), status_code=303)

    devices = list_remote_devices_payload(user.id)
    selection = resolve_remote_device_selection(request, devices)
    auto_open_device_id = selection.get("autoOpenDeviceId")
    if isinstance(auto_open_device_id, str) and auto_open_device_id:
        return RedirectResponse(url=build_remote_url(build_remote_session_url(auto_open_device_id)), status_code=303)

    language = detect_request_language(request, user)
    remote_notice = describe_remote_notice(language, request.query_params.get("remoteNotice"))
    return HTMLResponse(render_remote_devices_page(request, user, devices, settings.remote_base_url, remote_notice))


def build_remote_app_login_redirect(request: Request) -> RedirectResponse:
    return RedirectResponse(url=build_login_url(next_path=build_current_path_with_query(request)), status_code=303)


@app.get(f"{REMOTE_DEVICE_PATH_PREFIX}/{{device_id}}", response_model=None)
async def remote_device_page(device_id: str, request: Request) -> Response:
    if not is_remote_request(request):
        return RedirectResponse(url=build_remote_url(build_remote_session_url(device_id)), status_code=307)

    user = read_current_user(request)
    if user is None:
        return build_remote_app_login_redirect(request)

    device = get_device_for_user(settings, user.id, device_id)
    if device is None or device.device_kind != "desktop":
        return RedirectResponse(url=build_remote_url(f"{REMOTE_DEVICES_PATH}?remoteNotice=device_not_found"), status_code=303)

    remote_status = serialize_device(device).get("remoteStatus")
    remote_data = remote_status if isinstance(remote_status, dict) else {}
    if remote_data.get("connected") is not True or remote_data.get("browserEntryReady") is not True:
        return RedirectResponse(url=build_remote_url(f"{REMOTE_DEVICES_PATH}?remoteNotice=browser_entry_unavailable"), status_code=303)

    response = await relay_remote_http_request(request, user=user, device=device, desktop_path="/")
    set_active_remote_device_cookie(response, device.id)
    return response


@app.api_route(
    f"{REMOTE_DEVICE_PATH_PREFIX}/{{device_id}}/{{desktop_path:path}}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    response_model=None,
)
async def remote_device_prefixed_relay(device_id: str, desktop_path: str, request: Request) -> Response:
    if not is_remote_request(request):
        return RedirectResponse(url=build_remote_url(build_remote_session_url(device_id)), status_code=307)

    user = read_current_user(request)
    if user is None:
        return build_remote_app_login_redirect(request)

    device = get_device_for_user(settings, user.id, device_id)
    if device is None or device.device_kind != "desktop":
        return RedirectResponse(url=build_remote_url(f"{REMOTE_DEVICES_PATH}?remoteNotice=device_not_found"), status_code=303)

    remote_status = serialize_device(device).get("remoteStatus")
    remote_data = remote_status if isinstance(remote_status, dict) else {}
    if remote_data.get("connected") is not True or remote_data.get("browserEntryReady") is not True:
        return RedirectResponse(url=build_remote_url(f"{REMOTE_DEVICES_PATH}?remoteNotice=browser_entry_unavailable"), status_code=303)

    response = await relay_remote_http_request(request, user=user, device=device, desktop_path=f"/{desktop_path}")
    set_active_remote_device_cookie(response, device.id)
    return response


@app.get(MOBILE_SHELL_LOGIN_COMPLETE_PATH)
async def mobile_shell_login_complete(request: Request) -> RedirectResponse:
    target_url = resolve_mobile_shell_target_url(request, request.query_params.get("target") or REMOTE_DEVICES_PATH)
    provider = normalize_provider(request.query_params.get("provider"))
    user = read_current_user(request)
    if user is None:
        login_target = build_remote_url(build_login_url(error_code="missing_session", next_path=REMOTE_DEVICES_PATH))
        return RedirectResponse(url=build_mobile_shell_open_url(login_target), status_code=303)

    code = create_desktop_login_code(settings, user.id, provider or "google")
    return RedirectResponse(url=build_mobile_shell_open_url(target_url, code=code), status_code=303)


@app.get(DESKTOP_LOGIN_COMPLETE_PATH, response_class=HTMLResponse)
async def desktop_login_complete(request: Request):
    provider = normalize_provider(request.query_params.get("provider"))
    error_code = request.query_params.get("error")
    loopback_url = normalize_loopback_callback_url(request.query_params.get("loopback"))
    language = detect_request_language(request, read_current_user(request))

    def build_result_redirect(**params: str) -> RedirectResponse:
        callback_url = URL(loopback_url)
        callback_url = callback_url.include_query_params(**params)
        return RedirectResponse(url=str(callback_url), status_code=303)

    if provider is None:
        if loopback_url:
            return build_result_redirect(error="invalid_provider")

        deep_link_url = build_desktop_login_deep_link(error_code="invalid_provider")
        return HTMLResponse(
            render_desktop_login_complete_page(
                language=language,
                deep_link_url=deep_link_url,
                is_error=True,
                message=cloud_text(language, "desktop.message.invalidProvider"),
            )
        )

    if error_code:
        if loopback_url:
            return build_result_redirect(provider=provider, error=error_code)

        deep_link_url = build_desktop_login_deep_link(provider=provider, error_code=error_code)
        return HTMLResponse(
            render_desktop_login_complete_page(
                language=language,
                deep_link_url=deep_link_url,
                is_error=True,
                message=cloud_text(language, "desktop.message.errorWithCode", error=error_code),
            )
        )

    user = read_current_user(request)
    if user is None:
        if loopback_url:
            return build_result_redirect(provider=provider, error="missing_session")

        deep_link_url = build_desktop_login_deep_link(provider=provider, error_code="missing_session")
        return HTMLResponse(
            render_desktop_login_complete_page(
                language=language,
                deep_link_url=deep_link_url,
                is_error=True,
                message=cloud_text(language, "desktop.message.missingSession"),
            )
        )

    code = create_desktop_login_code(settings, user.id, provider)
    if loopback_url:
        return build_result_redirect(provider=provider, code=code)

    deep_link_url = build_desktop_login_deep_link(code=code, provider=provider)
    return HTMLResponse(
        render_desktop_login_complete_page(
            language=language,
            deep_link_url=deep_link_url,
            is_error=False,
            message=cloud_text(language, "desktop.message.success"),
        )
    )


@app.get("/api/auth/providers")
async def auth_providers() -> JSONResponse:
    return JSONResponse({"success": True, "providers": get_enabled_providers(settings)})


@app.get("/api/auth/oauth/providers")
async def auth_oauth_providers() -> JSONResponse:
    return JSONResponse({"success": True, "providers": get_enabled_providers(settings)})


@app.get("/api/auth/user")
async def auth_current_user_alias(request: Request) -> JSONResponse:
    user = read_current_user(request)
    if user is None:
        return JSONResponse({"success": True, "user": None})

    return JSONResponse(
        {
            "success": True,
            "user": {
                "id": user.id,
                "username": user.username,
                "displayName": user.display_name,
                "email": user.email,
                "avatarUrl": user.avatar_url,
                "authSource": "cloud",
            },
        }
    )


@app.get("/api/auth/session")
async def auth_session(request: Request) -> JSONResponse:
    return JSONResponse(build_session_payload(read_current_user(request)))


@app.get("/api/integrations/infermesh/handoff")
async def infermesh_handoff(request: Request) -> JSONResponse:
    if not is_infermesh_handoff_configured(settings):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="InferMesh integration is not configured",
        )

    _browser_user = require_current_user(request)
    user = require_current_user_or_device(request)
    try:
        handoff_url = build_infermesh_handoff_url(settings, user)
    except InfermeshProvisionError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(error),
        ) from error

    return JSONResponse({"success": True, "url": handoff_url})


@app.get("/api/integrations/infermesh/provider")
async def infermesh_provider(request: Request) -> JSONResponse:
    if not is_infermesh_configured(settings):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="InferMesh integration is not configured",
        )

    user = require_current_user_or_device(request)
    try:
        provider = await provision_infermesh_provider(settings, user)
    except InfermeshProvisionError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(error),
        ) from error

    return JSONResponse({"success": True, "provider": provider})


@app.get("/api/auth/logout")
async def auth_logout_get(request: Request, next: Optional[str] = Query(default=None)) -> RedirectResponse:
    return build_logout_response(request, next)


@app.post("/api/auth/logout")
async def auth_logout(request: Request, next: Optional[str] = Query(default=None)) -> RedirectResponse:
    return build_logout_response(request, next)


@app.post("/logout")
async def auth_logout_alias(request: Request, next: Optional[str] = Query(default=None)) -> RedirectResponse:
    return build_logout_response(request, next)


@app.get('/.well-known/openid-configuration')
async def oidc_openid_configuration() -> JSONResponse:
    ensure_oidc_client_enabled()
    return JSONResponse(build_oidc_discovery_document())


@app.get(OIDC_JWKS_PATH)
async def oidc_jwks() -> JSONResponse:
    ensure_oidc_client_enabled()
    return JSONResponse({'keys': [oidc_signing_key.jwk]})


@app.get(OIDC_AUTHORIZE_PATH)
async def oidc_authorize(request: Request) -> RedirectResponse:
    client_id = request.query_params.get('client_id')
    redirect_uri = request.query_params.get('redirect_uri')
    state_value = request.query_params.get('state')

    try:
        validated_client_id, validated_redirect_uri = validate_oidc_client(client_id, redirect_uri)
    except HTTPException as error:
        return build_oidc_authorize_error_response(
            redirect_uri=redirect_uri,
            error='invalid_request',
            state_value=state_value,
            description=str(error.detail),
        )

    response_type = (request.query_params.get('response_type') or '').strip()
    if response_type != 'code':
        return build_oidc_authorize_error_response(
            redirect_uri=validated_redirect_uri,
            error='unsupported_response_type',
            state_value=state_value,
            description='Only authorization code flow is supported',
        )

    normalized_scope = normalize_scope(request.query_params.get('scope'))
    if not normalized_scope or not validate_requested_scope(normalized_scope):
        return build_oidc_authorize_error_response(
            redirect_uri=validated_redirect_uri,
            error='invalid_scope',
            state_value=state_value,
            description='Requested OIDC scopes are invalid',
        )

    code_challenge = request.query_params.get('code_challenge')
    code_challenge_method = request.query_params.get('code_challenge_method')
    if code_challenge_method and code_challenge_method not in {'plain', 'S256'}:
        return build_oidc_authorize_error_response(
            redirect_uri=validated_redirect_uri,
            error='invalid_request',
            state_value=state_value,
            description='Unsupported code_challenge_method',
        )

    user = read_current_user(request)
    if user is None:
        login_target = build_current_path_with_query(request)
        return RedirectResponse(url=build_login_url(next_path=login_target), status_code=303)

    authorization_code = create_oidc_authorization_code(
        settings,
        client_id=validated_client_id,
        user_id=user.id,
        redirect_uri=validated_redirect_uri,
        scope=normalized_scope,
        code_challenge=code_challenge,
        code_challenge_method=code_challenge_method,
        nonce=request.query_params.get('nonce'),
    )
    return RedirectResponse(
        url=build_oidc_redirect_url(
            validated_redirect_uri,
            {
                'code': authorization_code,
                'state': state_value,
            },
        ),
        status_code=303,
    )


@app.post(OIDC_TOKEN_PATH)
async def oidc_token(request: Request) -> JSONResponse:
    ensure_oidc_client_enabled()
    raw_body = (await request.body()).decode('utf-8')
    parsed_body = parse_qs(raw_body, keep_blank_values=True)
    payload = {
        key: values[-1] if values else ''
        for key, values in parsed_body.items()
    }
    client_id, client_secret = read_oidc_client_credentials(request, payload)
    if client_id != settings.oidc_client_id or client_secret != settings.oidc_client_secret:
        return build_oidc_token_error(
            'invalid_client',
            'OIDC client authentication failed',
            status_code=status.HTTP_401_UNAUTHORIZED,
            headers={'WWW-Authenticate': 'Basic realm="ContextGo OIDC"'},
        )

    if payload.get('grant_type') != 'authorization_code':
        return build_oidc_token_error('unsupported_grant_type', 'Only authorization_code grant is supported')

    code = (payload.get('code') or '').strip()
    redirect_uri = (payload.get('redirect_uri') or '').strip()
    if not code or not redirect_uri:
        return build_oidc_token_error('invalid_request', 'code and redirect_uri are required')

    code_record = consume_oidc_authorization_code(settings, code)
    if code_record is None:
        return build_oidc_token_error('invalid_grant', 'Authorization code is invalid or expired')

    if code_record.client_id != settings.oidc_client_id or code_record.redirect_uri != redirect_uri:
        return build_oidc_token_error('invalid_grant', 'Authorization code does not match the OIDC client')

    if not verify_pkce(payload.get('code_verifier'), code_record.code_challenge, code_record.code_challenge_method):
        return build_oidc_token_error('invalid_grant', 'PKCE verification failed')

    user = find_user_by_id(settings, code_record.user_id)
    if user is None:
        return build_oidc_token_error('invalid_grant', 'Authorization code user no longer exists')

    access_token = create_oidc_access_token(
        settings,
        user_id=user.id,
        client_id=code_record.client_id,
        scope=code_record.scope,
    )
    id_token = create_id_token(
        signing_key=oidc_signing_key,
        settings=settings,
        user=user,
        audience=code_record.client_id,
        nonce=code_record.nonce,
    )
    response_payload = OidcTokenSuccessResponse(
        access_token=access_token.token,
        token_type='Bearer',
        expires_in=settings.oidc_access_token_ttl_seconds,
        scope=code_record.scope,
        id_token=id_token,
    )
    return JSONResponse(response_payload.model_dump())


@app.get(OIDC_USERINFO_PATH)
async def oidc_userinfo(request: Request) -> JSONResponse:
    ensure_oidc_client_enabled()
    user, _access_token = authenticate_oidc_access_token(request)
    if user is None:
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={'detail': 'Invalid or missing access token'},
            headers={'WWW-Authenticate': 'Bearer realm="ContextGo OIDC"'},
        )

    return JSONResponse(build_userinfo_payload(user))


@app.get("/.well-known/apple-app-site-association")
async def apple_app_site_association() -> JSONResponse:
    app_ids = parse_csv_env(IOS_ASSOCIATED_APP_IDS_ENV)
    details = [{"appIDs": app_ids, "components": [{"/": "/remote/*"}, {"/": "/login"}]}] if app_ids else []
    return JSONResponse(
        {
            "applinks": {
                "apps": [],
                "details": details,
            }
        }
    )


@app.get("/.well-known/assetlinks.json")
async def android_asset_links() -> JSONResponse:
    statements = []
    for raw_item in parse_csv_env(ANDROID_APP_LINK_TARGETS_ENV):
        package_name, separator, fingerprint_list = raw_item.partition("@")
        if not separator or not package_name or not fingerprint_list:
            continue

        fingerprints = [fingerprint.strip() for fingerprint in fingerprint_list.split(";") if fingerprint.strip()]
        if not fingerprints:
            continue

        statements.append(
            {
                "relation": ["delegate_permission/common.handle_all_urls"],
                "target": {
                    "namespace": "android_app",
                    "package_name": package_name.strip(),
                    "sha256_cert_fingerprints": fingerprints,
                },
            }
        )

    return JSONResponse(statements)


@app.post("/api/auth/desktop/consume")
async def auth_desktop_consume(request: Request, payload: DesktopLoginConsumeRequest) -> JSONResponse:
    consumed = consume_desktop_login_code(settings, payload.code)
    if consumed is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired desktop login code",
        )

    user, provider = consumed
    session = create_session(
        settings=settings,
        user=user,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    response = JSONResponse({"success": True, "provider": provider, **build_session_payload(user)})
    set_session_cookie(response, session.token)
    return response


@app.get("/api/auth/oauth/{provider}/start")
async def auth_oauth_start(provider: str, request: Request) -> RedirectResponse:
    desktop_mode = request.query_params.get("desktop") == "1"
    next_path = pick_next_path(request.query_params.get("next"))
    _, _, loopback_url = extract_login_context(next_path)
    if not is_provider_enabled(settings, provider):
        return redirect_to_login(
            "provider_not_enabled",
            provider=provider,
            desktop=desktop_mode,
            loopback_url=loopback_url,
        )

    state = create_oauth_state(settings, provider, next_path)
    authorization_url = build_authorization_url(settings, provider, state)  # type: ignore[arg-type]

    response = RedirectResponse(url=authorization_url, status_code=302)
    set_oauth_state_cookie(response, state)
    return response


@app.get("/api/auth/oauth/{provider}/callback")
async def auth_oauth_callback(provider: str, request: Request) -> RedirectResponse:
    returned_state = request.query_params.get("state")
    returned_next_path_hint = peek_oauth_state(settings, returned_state, provider) if returned_state else None
    mobile_shell_mode = is_mobile_shell_login_context(returned_next_path_hint)
    context_provider, desktop_mode, loopback_url = peek_login_context(provider, returned_state)
    if not is_provider_enabled(settings, provider):
        return redirect_to_login_context(
            "provider_not_enabled",
            provider=context_provider or provider,
            desktop=desktop_mode,
            loopback_url=loopback_url,
            mobile_shell=mobile_shell_mode,
        )

    callback_error = request.query_params.get("error")
    if callback_error:
        response = redirect_to_login_context(
            "access_denied" if callback_error == "access_denied" else "callback_failed",
            provider=context_provider,
            desktop=desktop_mode,
            loopback_url=loopback_url,
            mobile_shell=mobile_shell_mode,
        )
        clear_oauth_state_cookie(response)
        return response

    expected_state = request.cookies.get(settings.oauth_state_cookie_name)
    expected_next_path_hint = peek_oauth_state(settings, expected_state, provider) if expected_state else None
    code = request.query_params.get("code")
    if not returned_state:
        context_provider, desktop_mode, loopback_url = peek_login_context(provider, expected_state)
        response = redirect_to_login_context(
            "invalid_state",
            provider=context_provider,
            desktop=desktop_mode,
            loopback_url=loopback_url,
            mobile_shell=is_mobile_shell_login_context(expected_next_path_hint),
        )
        clear_oauth_state_cookie(response)
        return response

    if expected_state and expected_state != returned_state and not (mobile_shell_mode and expected_next_path_hint is None):
        context_provider, desktop_mode, loopback_url = peek_login_context(provider, expected_state)
        response = redirect_to_login_context(
            "invalid_state",
            provider=context_provider,
            desktop=desktop_mode,
            loopback_url=loopback_url,
            mobile_shell=is_mobile_shell_login_context(expected_next_path_hint),
        )
        clear_oauth_state_cookie(response)
        return response

    if not code:
        response = redirect_to_login_context(
            "missing_code",
            provider=context_provider,
            desktop=desktop_mode,
            loopback_url=loopback_url,
            mobile_shell=mobile_shell_mode,
        )
        clear_oauth_state_cookie(response)
        return response

    next_path_hint = returned_next_path_hint
    next_path = consume_oauth_state(settings, returned_state, provider)
    if next_path is None:
        next_provider, next_desktop_mode, next_loopback_url = extract_login_context(next_path_hint)
        response = redirect_to_login_context(
            "invalid_state",
            provider=next_provider or context_provider,
            desktop=next_desktop_mode or desktop_mode,
            loopback_url=next_loopback_url or loopback_url,
            mobile_shell=is_mobile_shell_login_context(next_path_hint),
        )
        clear_oauth_state_cookie(response)
        return response

    try:
        profile = await exchange_code_for_profile(settings, provider, code)  # type: ignore[arg-type]
    except Exception:
        next_provider, next_desktop_mode, next_loopback_url = extract_login_context(next_path)
        response = redirect_to_login_context(
            "callback_failed",
            provider=next_provider or context_provider,
            desktop=next_desktop_mode or desktop_mode,
            loopback_url=next_loopback_url or loopback_url,
            mobile_shell=is_mobile_shell_login_context(next_path),
        )
        clear_oauth_state_cookie(response)
        return response

    if not profile.email or not profile.email_verified:
        next_provider, next_desktop_mode, next_loopback_url = extract_login_context(next_path)
        response = redirect_to_login_context(
            "email_required",
            provider=next_provider or context_provider,
            desktop=next_desktop_mode or desktop_mode,
            loopback_url=next_loopback_url or loopback_url,
            mobile_shell=is_mobile_shell_login_context(next_path),
        )
        clear_oauth_state_cookie(response)
        return response

    if not is_allowed_email(profile.email):
        next_provider, next_desktop_mode, next_loopback_url = extract_login_context(next_path)
        response = redirect_to_login_context(
            "email_not_allowed",
            provider=next_provider or context_provider,
            desktop=next_desktop_mode or desktop_mode,
            loopback_url=next_loopback_url or loopback_url,
            mobile_shell=is_mobile_shell_login_context(next_path),
        )
        clear_oauth_state_cookie(response)
        return response

    user = find_or_create_user(profile)
    session = create_session(
        settings=settings,
        user=user,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    response = RedirectResponse(
        url=next_path if next_path != "/" else build_remote_url(REMOTE_DEVICES_PATH),
        status_code=303,
    )
    set_session_cookie(response, session.token)
    clear_oauth_state_cookie(response)
    return response


@app.post("/api/devices/register")
async def api_device_register(request: Request, payload: DeviceRegisterRequest) -> JSONResponse:
    user = require_current_user(request)
    device_name = payload.deviceName.strip()
    platform = payload.platform.strip()
    device_kind = payload.deviceKind.strip().lower()
    if not device_name or not platform or not device_kind:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="deviceName, platform, and deviceKind are required",
        )

    device, raw_token = create_device(
        settings=settings,
        user_id=user.id,
        device_name=device_name,
        platform=platform,
        device_kind=device_kind,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content={
            "success": True,
            "device": serialize_device(device),
            "token": raw_token,
        },
    )


@app.get("/api/devices")
async def api_devices(request: Request) -> JSONResponse:
    user = require_current_user(request)
    devices = [serialize_device(device) for device in list_devices_for_user(settings, user.id)]
    return JSONResponse(
        {
            "success": True,
            "devices": devices,
        }
    )


@app.get("/api/remote/devices")
async def api_remote_devices(request: Request) -> JSONResponse:
    user = require_current_user(request)
    devices = list_remote_devices_payload(user.id)
    selection = resolve_remote_device_selection(request, devices)
    return JSONResponse(
        {
            "success": True,
            "devices": devices,
            "selection": selection,
        }
    )


@app.post("/api/devices/{device_id}/revoke")
async def api_device_revoke(device_id: str, request: Request) -> JSONResponse:
    user = require_current_user(request)
    revoked = revoke_device(settings, user.id, device_id)
    if not revoked:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")

    return JSONResponse({"success": True, "deviceId": device_id, "status": "revoked"})


@app.post("/api/sync/push")
async def api_sync_push(request: Request, payload: SyncPushRequest) -> JSONResponse:
    user, device = require_current_device(request)
    result = apply_sync_changes(
        settings=settings,
        user_id=user.id,
        device_id=device.id,
        changes=[change.model_dump() for change in payload.changes],
    )
    return JSONResponse({"success": True, **result})


@app.get("/api/sync/pull")
async def api_sync_pull(
    request: Request,
    cursor: int = Query(default=0, ge=0),
    limit: int = Query(default=200, ge=1, le=500),
) -> JSONResponse:
    user, _device = require_current_device(request)
    result = pull_sync_events(
        settings=settings,
        user_id=user.id,
        cursor=cursor,
        limit=limit,
    )
    return JSONResponse({"success": True, **result})


@app.post("/api/obsidian-sync/replicas/register")
async def api_obsidian_sync_register_replica(
    request: Request, payload: ObsidianReplicaRegisterRequest
) -> JSONResponse:
    user, device = require_current_device(request)
    result = obsidian_sync_store.register_replica(
        user_id=user.id,
        space_id=payload.spaceId,
        device_id=payload.deviceId or device.id,
        platform=payload.platform,
        vault_fingerprint=payload.vaultFingerprint,
        local_ready_state=payload.localReadyState,
        root_tree_uri=payload.rootTreeUri,
        local_directory_uri=payload.localDirectoryUri,
        landing_note_path=payload.landingNotePath,
    )
    return JSONResponse(
        {
            "success": True,
            "vaultBindingId": result["vault_binding_id"],
            "replicaId": result["replica_id"],
            "checkpoint": {
                "appliedCursor": result["checkpoint"]["applied_cursor"],
            },
        }
    )


@app.post("/api/obsidian-sync/batches/push")
async def api_obsidian_sync_push_batch(request: Request, payload: ObsidianBatchPushRequest) -> JSONResponse:
    user, _device = require_current_device(request)
    result = obsidian_sync_store.push_batch(
        user_id=user.id,
        vault_binding_id=payload.vaultBindingId,
        replica_id=payload.replicaId,
        base_cursor=payload.baseCursor,
        entries=[
            {
                "path": entry.path,
                "file_class": entry.fileClass,
                "content_hash": entry.contentHash,
                "body": entry.body,
            }
            for entry in payload.entries
        ],
    )
    return JSONResponse(
        {
            "success": True,
            "assignedCursor": result["assigned_cursor"],
        }
    )


@app.post("/api/obsidian-sync/batches/pull")
async def api_obsidian_sync_pull_batches(request: Request, payload: ObsidianBatchPullRequest) -> JSONResponse:
    user, _device = require_current_device(request)
    result = obsidian_sync_store.pull_batches(
        user_id=user.id,
        vault_binding_id=payload.vaultBindingId,
        replica_id=payload.replicaId,
        after_cursor=payload.afterCursor,
    )
    return JSONResponse(
        {
            "success": True,
            "batches": [
                {
                    "vaultBindingId": batch["vaultBindingId"],
                    "replicaId": batch["replicaId"],
                    "baseCursor": batch["baseCursor"],
                    "assignedCursor": batch["assignedCursor"],
                    "entries": [
                        {
                            "path": entry["path"],
                            "fileClass": entry.get("fileClass") or entry.get("file_class"),
                            "contentHash": entry.get("contentHash") or entry.get("content_hash"),
                            "body": entry.get("body"),
                        }
                        for entry in batch["entries"]
                    ],
                }
                for batch in result["batches"]
            ],
        }
    )


@app.get("/api/obsidian-sync/spaces/{space_id}")
async def api_obsidian_sync_space_status(space_id: str, request: Request) -> JSONResponse:
    user, _device = require_current_device(request)
    binding = obsidian_sync_store.get_binding_status(user_id=user.id, space_id=space_id)
    return JSONResponse(
        {
            "success": True,
            "binding": binding,
        }
    )


@app.api_route("/{relay_path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"], response_model=None)
async def remote_device_runtime_relay(relay_path: str, request: Request) -> Response:
    if not is_remote_request(request) or is_remote_control_plane_path(request.url.path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Route not found")

    user = read_current_user(request)
    if user is None:
        return build_remote_app_login_redirect(request)

    active_device_id = read_active_remote_device_id(request)
    if not active_device_id:
        return RedirectResponse(url=build_remote_url(REMOTE_DEVICES_PATH), status_code=303)

    device = get_device_for_user(settings, user.id, active_device_id)
    if device is None or device.device_kind != "desktop":
        response = RedirectResponse(url=build_remote_url(f"{REMOTE_DEVICES_PATH}?remoteNotice=device_not_found"), status_code=303)
        clear_active_remote_device_cookie(response)
        return response

    remote_status = serialize_device(device).get("remoteStatus")
    remote_data = remote_status if isinstance(remote_status, dict) else {}
    if remote_data.get("connected") is not True or remote_data.get("browserEntryReady") is not True:
        response = RedirectResponse(url=build_remote_url(f"{REMOTE_DEVICES_PATH}?remoteNotice=browser_entry_unavailable"), status_code=303)
        clear_active_remote_device_cookie(response)
        return response

    response = await relay_remote_http_request(request, user=user, device=device, desktop_path=f"/{relay_path}")
    set_active_remote_device_cookie(response, device.id)
    return response


def read_requested_websocket_protocols(websocket: WebSocket) -> list[str]:
    header_value = websocket.headers.get("sec-websocket-protocol", "")
    return [item.strip() for item in header_value.split(",") if item.strip()]


@app.websocket("/api/remote/vite/{device_id}")
async def remote_vite_connect(device_id: str, websocket: WebSocket) -> None:
    user = read_current_user_from_session_token(websocket.cookies.get(settings.session_cookie_name))
    if user is None:
        await websocket.close(code=4401, reason="Authentication required")
        return

    device = get_device_for_user(settings, user.id, device_id)
    if device is None or device.device_kind != "desktop":
        await websocket.close(code=4404, reason="Device not found")
        return

    requested_protocols = read_requested_websocket_protocols(websocket)
    await websocket.accept(subprotocol=requested_protocols[0] if requested_protocols else None)

    socket_id = uuid4().hex
    registered = await remote_relay_hub.register_vite_client(
        user_id=user.id,
        device_id=device.id,
        socket_id=socket_id,
        websocket=websocket,
        connected_at=utc_now_iso(),
    )
    if not registered:
        await websocket.close(code=4404, reason="Device offline")
        return

    sent = await remote_relay_hub.forward_vite_to_device(
        device.id,
        {
            "type": "vite_client_connect",
            "socketId": socket_id,
            "query": websocket.scope.get("query_string", b"").decode("utf-8"),
            "protocols": requested_protocols,
        },
    )
    if not sent:
        await remote_relay_hub.unregister_vite_client(socket_id, websocket)
        await websocket.close(code=4404, reason="Device offline")
        return

    try:
        while True:
            data = await websocket.receive_text()
            await remote_relay_hub.forward_vite_to_device(
                device.id,
                {
                    "type": "vite_client_frame",
                    "socketId": socket_id,
                    "data": data,
                },
            )
    except WebSocketDisconnect as exc:
        await remote_relay_hub.forward_vite_to_device(
            device.id,
            {
                "type": "vite_client_disconnect",
                "socketId": socket_id,
                "code": exc.code,
                "reason": "Remote Vite client disconnected",
            },
        )
    finally:
        await remote_relay_hub.unregister_vite_client(socket_id, websocket)


async def handle_remote_client_websocket(websocket: WebSocket, device_id: str) -> None:
    user = read_current_user_from_session_token(websocket.cookies.get(settings.session_cookie_name))
    if user is None:
        await websocket.close(code=4401, reason="Authentication required")
        return

    device = get_device_for_user(settings, user.id, device_id)
    if device is None:
        await websocket.close(code=4404, reason="Device not found")
        return

    await websocket.accept()
    registered = await remote_relay_hub.register_client(
        user_id=user.id,
        device_id=device.id,
        websocket=websocket,
        connected_at=utc_now_iso(),
    )
    if not registered:
        await websocket.close(code=4404, reason="Device offline")
        return

    try:
        while True:
            payload = await websocket.receive_json()
            if not isinstance(payload, dict):
                continue

            if payload.get("name") == "pong":
                continue

            await remote_relay_hub.forward_bridge_to_device(device.id, payload)
    except WebSocketDisconnect:
        pass
    finally:
        await remote_relay_hub.unregister_client(device.id, websocket)


@app.websocket("/")
async def root_websocket(websocket: WebSocket) -> None:
    device_id = websocket.query_params.get("device_id")
    if not device_id:
        await websocket.close(code=4400, reason="device_id is required")
        return

    await handle_remote_client_websocket(websocket, device_id)


@app.websocket("/api/remote/client-connect")
async def remote_client_connect(websocket: WebSocket) -> None:
    device_id = websocket.query_params.get("device_id")
    if not device_id:
        await websocket.close(code=4400, reason="device_id is required")
        return

    await handle_remote_client_websocket(websocket, device_id)


@app.websocket("/api/remote/device-connect")
async def remote_device_connect(websocket: WebSocket) -> None:
    raw_token = read_bearer_token_from_header(websocket.headers.get("authorization"))
    user, device = read_user_and_device_from_device_token(raw_token)
    if user is None or device is None:
        await websocket.close(code=4401, reason="Invalid device token")
        return

    touch_device(
        settings=settings,
        device_id=device.id,
        ip_address=websocket.client.host if websocket.client else None,
        user_agent=websocket.headers.get("user-agent"),
    )

    await websocket.accept()
    await remote_relay_hub.register_device(
        user_id=user.id,
        device_id=device.id,
        websocket=websocket,
        connected_at=utc_now_iso(),
    )
    await websocket.send_json(
        {
            "type": "hello",
            "deviceId": device.id,
            "connectedAt": utc_now_iso(),
            "transport": "cloud-relay",
        }
    )

    try:
        while True:
            payload = await websocket.receive_json()
            if not isinstance(payload, dict):
                continue

            payload_type = payload.get("type")
            if payload_type == "pong":
                continue

            if payload_type == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            if payload_type == "hello":
                browser_entry = payload.get("browserEntry") if isinstance(payload.get("browserEntry"), dict) else {}
                browser_entry_url = browser_entry.get("url") if isinstance(browser_entry.get("url"), str) else None
                browser_entry_reason = browser_entry.get("reason") if isinstance(browser_entry.get("reason"), str) else None
                browser_entry_ready = browser_entry.get("ready") is True
                await remote_relay_hub.update_device_browser_entry(
                    device.id,
                    websocket,
                    browser_entry_url=browser_entry_url.strip() if browser_entry_url else None,
                    browser_entry_ready=browser_entry_ready,
                    browser_entry_reason=browser_entry_reason.strip() if browser_entry_reason else None,
                )
                continue

            if payload_type == "bridge" and isinstance(payload.get("payload"), dict):
                await remote_relay_hub.forward_bridge_to_client(device.id, payload["payload"])
                continue

            if payload_type == "http_response" and isinstance(payload.get("response"), dict):
                response_payload = payload["response"]
                body_base64 = response_payload.get("bodyBase64") if isinstance(response_payload.get("bodyBase64"), str) else ""
                body = base64.b64decode(body_base64) if body_base64 else b""
                headers = response_payload.get("headers") if isinstance(response_payload.get("headers"), dict) else {}
                normalized_headers = {
                    str(key): str(value)
                    for key, value in headers.items()
                    if isinstance(key, str) and isinstance(value, str)
                }
                set_cookies = response_payload.get("setCookies") if isinstance(response_payload.get("setCookies"), list) else []
                await remote_relay_hub.resolve_http_response(
                    device_id=device.id,
                    request_id=str(payload.get("requestId") or ""),
                    response=RemoteHttpRelayResponse(
                        status_code=int(response_payload.get("statusCode") or 200),
                        headers=normalized_headers,
                        body=body,
                        set_cookies=[str(item) for item in set_cookies if isinstance(item, str)],
                    ),
                )
                continue

            if payload_type == "http_error":
                await remote_relay_hub.reject_http_response(
                    device_id=device.id,
                    request_id=str(payload.get("requestId") or ""),
                    message=str(payload.get("message") or "Remote device HTTP relay failed"),
                )
                continue

            if payload_type == "vite_client_frame" and isinstance(payload.get("socketId"), str):
                await remote_relay_hub.send_vite_client_text(str(payload["socketId"]), str(payload.get("data") or ""))
                continue

            if payload_type == "vite_client_disconnect" and isinstance(payload.get("socketId"), str):
                await remote_relay_hub.disconnect_vite_client(
                    str(payload["socketId"]),
                    code=int(payload.get("code") or 1000),
                    reason=str(payload.get("reason") or "Desktop Vite relay disconnected"),
                )
    except WebSocketDisconnect:
        pass
    finally:
        await remote_relay_hub.unregister_device(device.id, websocket)
