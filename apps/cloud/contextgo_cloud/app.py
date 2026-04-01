from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from html import escape
import json
import os
from pathlib import Path
from typing import Any, Dict, Literal, Optional, Union
from urllib.parse import parse_qs, quote, urlencode, urlparse

from fastapi import FastAPI, HTTPException, Query, Request, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from starlette.datastructures import URL
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .config import Settings, load_settings
from .db import (
    Device,
    User,
    apply_sync_changes,
    allocate_username,
    cleanup_expired_rows,
    consume_desktop_login_code,
    create_device,
    create_desktop_login_code,
    consume_oauth_state,
    create_oauth_state,
    create_session,
    create_user,
    delete_session,
    find_user_by_email,
    find_user_by_oauth_account,
    get_connection,
    get_device_for_user,
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
from .infermesh import InfermeshProvisionError, is_infermesh_configured, provision_infermesh_provider
from .oauth import OAuthProfile, build_authorization_url, exchange_code_for_profile, get_enabled_providers, is_provider_enabled
from .remote import RemoteRelayHub

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


class DesktopLoginConsumeRequest(BaseModel):
    code: str = Field(min_length=1, max_length=256)


settings: Settings = load_settings()
api_host = urlparse(settings.api_base_url).hostname or ""
remote_host = urlparse(settings.remote_base_url).hostname or ""
DESKTOP_LOGIN_COMPLETE_PATH = "/desktop-login-complete"
MOBILE_SHELL_LOGIN_COMPLETE_PATH = "/mobile-shell-login-complete"
REMOTE_DEVICES_PATH = "/remote/devices"
REMOTE_APP_PATH = "/remote/app"
REMOTE_APP_ASSETS_PATH = f"{REMOTE_APP_PATH}/assets"
REMOTE_DEVICE_PATH_PREFIX = "/device"
REMOTE_SHELL_SCHEME = "contextgo-remote"
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
        "remote.description": "Choose a desktop device that currently has a live cloud relay connection. Registered devices stay listed, but only relay-connected machines can open a hosted remote session.",
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
        "remote.notice.sessionReplaced.title": "This hosted session was replaced.",
        "remote.notice.sessionReplaced.detail": "Another browser took over the live session. Choose a device again to continue here.",
        "remote.notice.serviceRestarted.title": "The hosted remote session was restarted.",
        "remote.notice.serviceRestarted.detail": "Refresh the list and reopen the desktop session.",
        "remote.badge.liveSession": "Live session",
        "remote.badge.available": "Available",
        "remote.badge.unavailable": "Unavailable",
        "remote.summary.liveSession": "Desktop is online and already attached to a browser session through {transportLabel}.",
        "remote.detail.liveSession": "A second browser can still take over, but the current session is already active.",
        "remote.summary.available": "Desktop is online and ready through {transportLabel}.",
        "remote.detail.available": "This device has an authenticated outbound relay connection and can open a live WebUI session now.",
        "remote.summary.unavailable": "Desktop is not connected to {transportLabel} right now.",
        "remote.detail.unavailable": "The machine may still be registered and active, but hosted remote access stays unavailable until the desktop relay reconnects.",
        "remote.action.openLiveSession": "Open live session",
        "remote.action.unavailable": "Unavailable",
        "remote.rendererUnavailableTitle": "Hosted remote shell is unavailable",
        "remote.rendererUnavailableDetail": "The renderer build was not found on this deployment.",
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
        "remote.description": "选择一个当前已连接云中继的桌面设备。已注册设备会保留在列表中，但只有已连上中继的机器才能打开托管远程会话。",
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
        "remote.notice.sessionReplaced.title": "这个托管会话已被替换。",
        "remote.notice.sessionReplaced.detail": "另一个浏览器接管了当前实时会话。请选择设备以继续。",
        "remote.notice.serviceRestarted.title": "托管远程会话已重启。",
        "remote.notice.serviceRestarted.detail": "请刷新列表并重新打开桌面会话。",
        "remote.badge.liveSession": "会话进行中",
        "remote.badge.available": "可用",
        "remote.badge.unavailable": "不可用",
        "remote.summary.liveSession": "桌面端已在线，并且已经通过 {transportLabel} 连接到一个浏览器会话。",
        "remote.detail.liveSession": "你仍然可以由第二个浏览器接管，但当前会话已经处于活动状态。",
        "remote.summary.available": "桌面端已在线，可通过 {transportLabel} 使用。",
        "remote.detail.available": "此设备已建立经过认证的出站中继连接，现在可以直接打开实时 WebUI 会话。",
        "remote.summary.unavailable": "桌面端当前未连接到 {transportLabel}。",
        "remote.detail.unavailable": "这台机器可能仍然已注册且处于激活状态，但在桌面端重新连上中继之前，托管远程访问不可用。",
        "remote.action.openLiveSession": "打开实时会话",
        "remote.action.unavailable": "不可用",
        "remote.rendererUnavailableTitle": "托管远程 Shell 当前不可用",
        "remote.rendererUnavailableDetail": "当前部署上未找到前端构建产物。",
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
        "remote.detail.available": "這台裝置已建立經驗證的對外中繼連線，現在可以直接開啟即時 WebUI 工作階段。",
        "remote.summary.unavailable": "桌面端目前未連接到 {transportLabel}。",
        "remote.detail.unavailable": "這台機器可能仍已註冊且處於啟用狀態，但在桌面端重新連上中繼之前，託管遠端存取仍不可用。",
        "remote.action.openLiveSession": "開啟即時工作階段",
        "remote.action.unavailable": "不可用",
        "remote.rendererUnavailableTitle": "託管遠端 Shell 目前不可用",
        "remote.rendererUnavailableDetail": "目前部署上找不到前端建置產物。",
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
        "remote.detail.available": "このデバイスには認証済みのアウトバウンド リレー接続があり、今すぐライブ WebUI セッションを開けます。",
        "remote.summary.unavailable": "デスクトップは現在 {transportLabel} に接続していません。",
        "remote.detail.unavailable": "このマシンは登録済みかつ有効なままの可能性がありますが、デスクトップ リレーが再接続するまでホスト型リモート アクセスは利用できません。",
        "remote.action.openLiveSession": "ライブ セッションを開く",
        "remote.action.unavailable": "利用不可",
        "remote.rendererUnavailableTitle": "ホスト型リモート Shell は利用できません",
        "remote.rendererUnavailableDetail": "このデプロイにはレンダラーのビルド成果物が見つかりませんでした。",
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
        "remote.detail.available": "이 기기는 인증된 아웃바운드 릴레이 연결을 가지고 있어 지금 바로 라이브 WebUI 세션을 열 수 있습니다.",
        "remote.summary.unavailable": "데스크톱이 현재 {transportLabel}에 연결되어 있지 않습니다.",
        "remote.detail.unavailable": "이 기기는 여전히 등록 및 활성 상태일 수 있지만, 데스크톱 릴레이가 다시 연결되기 전까지 호스팅 원격 액세스는 사용할 수 없습니다.",
        "remote.action.openLiveSession": "라이브 세션 열기",
        "remote.action.unavailable": "사용 불가",
        "remote.rendererUnavailableTitle": "호스팅 원격 Shell을 사용할 수 없습니다",
        "remote.rendererUnavailableDetail": "이 배포에서 렌더러 빌드를 찾을 수 없습니다.",
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
        "remote.detail.available": "Bu cihaz doğrulanmış bir giden röle bağlantısına sahip ve canlı bir WebUI oturumunu hemen açabilir.",
        "remote.summary.unavailable": "Masaüstü şu anda {transportLabel} ağına bağlı değil.",
        "remote.detail.unavailable": "Makine hâlâ kayıtlı ve etkin olabilir, ancak masaüstü rölesi yeniden bağlanana kadar barındırılan uzak erişim kullanılamaz.",
        "remote.action.openLiveSession": "Canlı oturumu aç",
        "remote.action.unavailable": "Kullanılamıyor",
        "remote.rendererUnavailableTitle": "Barındırılan uzak Shell kullanılamıyor",
        "remote.rendererUnavailableDetail": "Bu dağıtımda renderer derleme çıktısı bulunamadı.",
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


@asynccontextmanager
async def lifespan(_app: FastAPI):
    initialize_database(settings)
    cleanup_expired_rows(settings)
    yield


app = FastAPI(title="ContextGo Cloud Auth Service", lifespan=lifespan)
remote_relay_hub = RemoteRelayHub()

if RENDERER_ASSETS_PATH.is_dir():
    app.mount(REMOTE_APP_ASSETS_PATH, StaticFiles(directory=str(RENDERER_ASSETS_PATH)), name="remote-app-assets")

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


def build_mobile_shell_login_complete_url(target_url: str) -> str:
    return f"{settings.auth_base_url}{MOBILE_SHELL_LOGIN_COMPLETE_PATH}?{urlencode({'target': target_url})}"


def render_remote_app_shell() -> str:
    if not RENDERER_INDEX_PATH.is_file():
        raise FileNotFoundError(RENDERER_INDEX_PATH)

    html = RENDERER_INDEX_PATH.read_text(encoding="utf-8")
    asset_prefix = f"{REMOTE_APP_ASSETS_PATH}/"
    return (
        html.replace('href="./assets/', f'href="{asset_prefix}')
        .replace('src="./assets/', f'src="{asset_prefix}')
        .replace("href='./assets/", f"href='{asset_prefix}")
        .replace("src='./assets/", f"src='{asset_prefix}")
    )


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

    if parsed.path != "/login":
        return None, False, None

    query = parse_qs(parsed.query)
    return (
        normalize_provider(query.get("provider", [None])[0]),
        query.get("desktop", [None])[0] == "1",
        normalize_loopback_callback_url(query.get("loopback", [None])[0]),
    )


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
                next_target = build_mobile_shell_login_complete_url(resolve_mobile_shell_target_url(request, next_path))
            elif next_path == "/" and is_remote_request(request):
                next_target = REMOTE_DEVICES_PATH

            if next_target != "/":
                href = f'{href}?{urlencode({"next": next_target})}'
        provider_buttons.append(f'<a class="provider" href="{escape(href)}">{escape(label)}</a>')

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
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{escape(title)}</title>
  <style>
    body {{
      margin: 0;
      font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: linear-gradient(180deg, #f4f7fb 0%, #eef3ff 100%);
      color: #0f172a;
    }}
    .wrap {{
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 32px 16px;
    }}
    .card {{
      width: min(560px, 100%);
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(15, 23, 42, 0.08);
      border-radius: 24px;
      box-shadow: 0 24px 80px rgba(15, 23, 42, 0.12);
      padding: 32px;
    }}
    h1 {{
      margin: 0 0 8px;
      font-size: 34px;
    }}
    p {{
      margin: 0;
      line-height: 1.6;
      color: #475569;
    }}
    .stack {{
      display: grid;
      gap: 14px;
      margin-top: 24px;
    }}
    .provider, button {{
      appearance: none;
      border: 0;
      border-radius: 999px;
      padding: 14px 18px;
      font-size: 15px;
      font-weight: 600;
      text-decoration: none;
      text-align: center;
      cursor: pointer;
    }}
    .provider {{
      background: #111827;
      color: white;
    }}
    .provider:hover {{
      background: #1f2937;
    }}
    .secondary {{
      background: white;
      color: #111827;
      border: 1px solid rgba(15, 23, 42, 0.12);
    }}
    .message {{
      margin-top: 18px;
      padding: 12px 14px;
      border-radius: 14px;
    }}
    .message.success {{
      background: #ecfdf5;
      color: #166534;
    }}
    .message.error {{
      background: #fef2f2;
      color: #991b1b;
    }}
    .message.info {{
      background: #eff6ff;
      color: #1d4ed8;
    }}
    .session {{
      margin-top: 20px;
    }}
    .session-header {{
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 18px;
    }}
    .avatar {{
      width: 56px;
      height: 56px;
      border-radius: 50%;
      object-fit: cover;
    }}
    .muted {{
      color: #64748b;
      font-size: 14px;
    }}
    .caption {{
      margin-top: 24px;
      font-size: 14px;
      color: #64748b;
    }}
    .intro {{
      margin-top: 16px;
    }}
    code {{
      background: rgba(15, 23, 42, 0.06);
      padding: 2px 6px;
      border-radius: 8px;
    }}
  </style>
</head>
<body>
  <div class="wrap">
    <main class="card">
      <h1>{escape(title)}</h1>
      <p>{escape(subtitle)}</p>
      {message}
      {desktop_hint}
      <div class="stack">
        {provider_markup}
      </div>
      {account_markup}
      <p class="caption">{escape(cookie_domain_text)}</p>
    </main>
  </div>
</body>
</html>"""


def build_remote_session_url(device_id: str) -> str:
    return f"{REMOTE_DEVICE_PATH_PREFIX}/{quote(device_id, safe='')}"


def build_mobile_shell_open_url(target_url: str) -> str:
    return f"{REMOTE_SHELL_SCHEME}://open?{urlencode({'target': target_url})}"


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

    if notice == "service_restarted":
        return {
            "className": "info",
            "title": cloud_text(language, "remote.notice.serviceRestarted.title"),
            "detail": cloud_text(language, "remote.notice.serviceRestarted.detail"),
        }

    return None


def describe_remote_device_availability(language: str, device_payload: dict[str, object]) -> dict[str, object]:
    remote_status = device_payload.get("remoteStatus")
    remote_data = remote_status if isinstance(remote_status, dict) else {}
    connected = remote_data.get("connected") is True
    client_connected = remote_data.get("clientConnected") is True
    transport = remote_data.get("transport") if isinstance(remote_data.get("transport"), str) else "cloud-relay"
    transport_label = cloud_text(language, "transport.cloudRelay") if transport == "cloud-relay" else transport

    if connected and client_connected:
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

    if connected:
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

    return {
        "connected": False,
        "clientConnected": False,
        "badge": cloud_text(language, "remote.badge.unavailable"),
        "badgeClass": "offline",
        "summary": cloud_text(language, "remote.summary.unavailable", transportLabel=transport_label),
        "detail": cloud_text(language, "remote.detail.unavailable"),
        "actionLabel": cloud_text(language, "remote.action.unavailable"),
        "actionHref": None,
    }


def render_remote_devices_page(
    request: Request,
    user: User,
    devices: list[dict[str, object]],
    remote_origin: str,
    notice: Optional[dict[str, str]] = None,
) -> str:
    language = detect_request_language(request, user)
    cards = []
    for device in devices:
        availability = describe_remote_device_availability(language, device)
        action_markup = ""
        if availability["actionHref"]:
            relative_target_url = str(availability["actionHref"])
            absolute_target_url = f"{remote_origin}{relative_target_url}"
            mobile_shell_url = build_mobile_shell_open_url(absolute_target_url)
            action_markup = (
                f'<a class="primary" href="{escape(relative_target_url)}">{escape(str(availability["actionLabel"]))}</a>'
                f'<a class="secondary" href="{escape(mobile_shell_url)}">{escape(cloud_text(language, "remote.openInApp"))}</a>'
            )
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
        cards.append(
            f"""
            <article class="device-card">
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
        )

    devices_markup = "\n".join(cards)
    if not devices_markup:
        devices_markup = f"""
        <section class="empty-state">
          <h2>{escape(cloud_text(language, "remote.emptyTitle"))}</h2>
          <p>{escape(cloud_text(language, "remote.emptyDetail"))}</p>
        </section>
        """

    account_name = escape(user.display_name)
    account_email = escape(user.email)
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
      background:
        radial-gradient(circle at top left, rgba(56, 189, 248, 0.18), transparent 28%),
        linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%);
      color: #0f172a;
    }}
    .wrap {{
      width: min(1100px, calc(100% - 32px));
      margin: 0 auto;
      padding: 32px 0 56px;
    }}
    .topbar {{
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 28px;
    }}
    .topbar h1 {{
      margin: 0;
      font-size: 34px;
    }}
    .topbar p {{
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
    .device-card, .empty-state {{
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid rgba(15, 23, 42, 0.08);
      border-radius: 24px;
      box-shadow: 0 20px 56px rgba(15, 23, 42, 0.08);
      padding: 24px;
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
    @media (max-width: 768px) {{
      .topbar, .device-header {{
        flex-direction: column;
      }}
      .account-card {{
        width: 100%;
      }}
    }}
  </style>
</head>
<body>
  <main class="wrap">
    <section class="topbar">
      <div>
        <h1>{escape(title)}</h1>
        <p>{escape(signed_in_as)}</p>
        <p>{escape(description)}</p>
      </div>
      <div class="account-card">
        <p><strong>{account_name}</strong></p>
        <p class="account-meta">@{escape(user.username)}</p>
        <div class="toolbar">
          <a class="secondary" href="{REMOTE_DEVICES_PATH}">{escape(refresh_label)}</a>
          <form method="post" action="/api/auth/logout?next={escape(REMOTE_DEVICES_PATH)}">
            <button class="secondary" type="submit">{escape(sign_out_label)}</button>
          </form>
        </div>
      </div>
    </section>
    {notice_markup}
    <section class="grid">
      {devices_markup}
    </section>
  </main>
</body>
</html>"""


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
        },
    }


def list_remote_devices_payload(user_id: str) -> list[dict[str, object]]:
    return [
        serialize_device(device)
        for device in list_devices_for_user(settings, user_id)
        if device.device_kind == "desktop"
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
    remote_origin = settings.remote_base_url
    language = detect_request_language(request, user)
    remote_notice = describe_remote_notice(language, request.query_params.get("remoteNotice"))
    return HTMLResponse(render_remote_devices_page(request, user, devices, remote_origin, remote_notice))


def build_remote_app_login_redirect(request: Request) -> RedirectResponse:
    return RedirectResponse(url=build_login_url(next_path=build_current_path_with_query(request)), status_code=303)


@app.get(f"{REMOTE_DEVICE_PATH_PREFIX}/{{device_id}}", response_class=HTMLResponse)
async def remote_device_page(device_id: str, request: Request):
    if not is_remote_request(request):
        return RedirectResponse(url=build_remote_url(build_remote_session_url(device_id)), status_code=307)

    user = read_current_user(request)
    if user is None:
        return build_remote_app_login_redirect(request)

    if not RENDERER_INDEX_PATH.is_file():
        language = detect_request_language(request, user)
        unavailable_html = (
            f"<h1>{escape(cloud_text(language, 'remote.rendererUnavailableTitle'))}</h1>"
            f"<p>{escape(cloud_text(language, 'remote.rendererUnavailableDetail'))}</p>"
        )
        return HTMLResponse(unavailable_html, status_code=503)

    return HTMLResponse(render_remote_app_shell())


@app.get(MOBILE_SHELL_LOGIN_COMPLETE_PATH)
async def mobile_shell_login_complete(request: Request) -> RedirectResponse:
    target_url = resolve_mobile_shell_target_url(request, request.query_params.get("target") or REMOTE_DEVICES_PATH)
    user = read_current_user(request)
    if user is None:
        login_target = build_remote_url(build_login_url(error_code="missing_session", next_path=REMOTE_DEVICES_PATH))
        return RedirectResponse(url=build_mobile_shell_open_url(login_target), status_code=303)

    return RedirectResponse(url=build_mobile_shell_open_url(target_url), status_code=303)


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
    context_provider, desktop_mode, loopback_url = peek_login_context(provider, returned_state)
    if not is_provider_enabled(settings, provider):
        return redirect_to_login("provider_not_enabled", provider=context_provider or provider, desktop=desktop_mode, loopback_url=loopback_url)

    callback_error = request.query_params.get("error")
    if callback_error:
        response = redirect_to_login(
            "access_denied" if callback_error == "access_denied" else "callback_failed",
            provider=context_provider,
            desktop=desktop_mode,
            loopback_url=loopback_url,
        )
        clear_oauth_state_cookie(response)
        return response

    expected_state = request.cookies.get(settings.oauth_state_cookie_name)
    code = request.query_params.get("code")
    if not returned_state:
        context_provider, desktop_mode, loopback_url = peek_login_context(provider, expected_state)
        response = redirect_to_login("invalid_state", provider=context_provider, desktop=desktop_mode, loopback_url=loopback_url)
        clear_oauth_state_cookie(response)
        return response

    if expected_state and expected_state != returned_state:
        context_provider, desktop_mode, loopback_url = peek_login_context(provider, expected_state)
        response = redirect_to_login("invalid_state", provider=context_provider, desktop=desktop_mode, loopback_url=loopback_url)
        clear_oauth_state_cookie(response)
        return response

    if not code:
        response = redirect_to_login("missing_code", provider=context_provider, desktop=desktop_mode, loopback_url=loopback_url)
        clear_oauth_state_cookie(response)
        return response

    next_path_hint = peek_oauth_state(settings, returned_state, provider)
    next_path = consume_oauth_state(settings, returned_state, provider)
    if next_path is None:
        next_provider, next_desktop_mode, next_loopback_url = extract_login_context(next_path_hint)
        response = redirect_to_login(
            "invalid_state",
            provider=next_provider or context_provider,
            desktop=next_desktop_mode or desktop_mode,
            loopback_url=next_loopback_url or loopback_url,
        )
        clear_oauth_state_cookie(response)
        return response

    try:
        profile = await exchange_code_for_profile(settings, provider, code)  # type: ignore[arg-type]
    except Exception:
        next_provider, next_desktop_mode, next_loopback_url = extract_login_context(next_path)
        response = redirect_to_login(
            "callback_failed",
            provider=next_provider or context_provider,
            desktop=next_desktop_mode or desktop_mode,
            loopback_url=next_loopback_url or loopback_url,
        )
        clear_oauth_state_cookie(response)
        return response

    if not profile.email or not profile.email_verified:
        next_provider, next_desktop_mode, next_loopback_url = extract_login_context(next_path)
        response = redirect_to_login(
            "email_required",
            provider=next_provider or context_provider,
            desktop=next_desktop_mode or desktop_mode,
            loopback_url=next_loopback_url or loopback_url,
        )
        clear_oauth_state_cookie(response)
        return response

    if not is_allowed_email(profile.email):
        next_provider, next_desktop_mode, next_loopback_url = extract_login_context(next_path)
        response = redirect_to_login(
            "email_not_allowed",
            provider=next_provider or context_provider,
            desktop=next_desktop_mode or desktop_mode,
            loopback_url=next_loopback_url or loopback_url,
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
    return JSONResponse(
        {
            "success": True,
            "devices": devices,
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

            if payload_type == "bridge" and isinstance(payload.get("payload"), dict):
                await remote_relay_hub.forward_bridge_to_client(device.id, payload["payload"])
    except WebSocketDisconnect:
        pass
    finally:
        await remote_relay_hub.unregister_device(device.id, websocket)
