/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Platform detection utilities
 * 平台检测工具函数
 */

/**
 * Check if running in Electron desktop environment
 * 检测是否运行在 Electron 桌面环境
 */
export const isElectronDesktop = (): boolean => {
  return typeof window !== 'undefined' && Boolean(window.electronAPI);
};

/**
 * Check if running on macOS
 * 检测是否运行在 macOS
 */
export const isMacOS = (): boolean => {
  return typeof navigator !== 'undefined' && /mac/i.test(navigator.userAgent);
};

/**
 * Check if running on Windows
 * 检测是否运行在 Windows
 */
export const isWindows = (): boolean => {
  return typeof navigator !== 'undefined' && /win/i.test(navigator.userAgent);
};

/**
 * Check if running on Linux
 * 检测是否运行在 Linux
 */
export const isLinux = (): boolean => {
  return typeof navigator !== 'undefined' && /linux/i.test(navigator.userAgent);
};

/**
 * Check if running inside a mobile shell WebView on iOS, Android, or HarmonyOS.
 * 检测是否运行在 iOS、Android 或 HarmonyOS 的 mobile shell WebView 中
 */
export const isMobileShellWebView = (): boolean => {
  return typeof navigator !== 'undefined' && /ContextGoMobileShell/i.test(navigator.userAgent);
};

export const isAndroidMobileShell = (): boolean => {
  return isMobileShellWebView() && typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
};

export type AndroidObsidianVaultSetupState =
  | {
      status: 'unprepared';
      spaceId: string;
    }
  | {
      status: 'prepared-directory';
      spaceId: string;
      vaultName: string;
      spaceDirectoryUri: string;
    };

export type AndroidObsidianVaultSetupResult =
  | AndroidObsidianVaultSetupState
  | {
      status: 'cancelled' | 'error';
      spaceId: string;
      message?: string;
    };

const ANDROID_OBSIDIAN_VAULT_SETUP_EVENT = 'contextgo:android-obsidian-vault-setup-result';

type AndroidMobileShellBridge = {
  notifyReady?: () => void;
  getObsidianVaultSetupState?: (spaceId: string) => string;
  requestObsidianVaultSetup?: (requestJson: string) => void;
};

function getAndroidMobileShellBridge(): AndroidMobileShellBridge | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return (window as typeof window & { ContextGoMobileShell?: AndroidMobileShellBridge }).ContextGoMobileShell ?? null;
}

export const getAndroidObsidianVaultSetupState = (spaceId: string): AndroidObsidianVaultSetupState | null => {
  const bridge = getAndroidMobileShellBridge();
  const raw = bridge?.getObsidianVaultSetupState?.(spaceId);
  if (!raw) {
    return null;
  }

  return JSON.parse(raw) as AndroidObsidianVaultSetupState;
};

export const requestAndroidObsidianVaultSetup = async (input: {
  spaceId: string;
  spaceName: string;
  suggestedFolderName: string;
}): Promise<AndroidObsidianVaultSetupResult> => {
  const bridge = getAndroidMobileShellBridge();
  if (!bridge?.requestObsidianVaultSetup) {
    throw new Error('Android Obsidian vault setup bridge is unavailable.');
  }

  return new Promise<AndroidObsidianVaultSetupResult>((resolve) => {
    const listener = (event: Event) => {
      const customEvent = event as CustomEvent<AndroidObsidianVaultSetupResult>;
      if (!customEvent.detail || customEvent.detail.spaceId !== input.spaceId) {
        return;
      }

      window.removeEventListener(ANDROID_OBSIDIAN_VAULT_SETUP_EVENT, listener as EventListener);
      resolve(customEvent.detail);
    };

    window.addEventListener(ANDROID_OBSIDIAN_VAULT_SETUP_EVENT, listener as EventListener);
    bridge.requestObsidianVaultSetup(JSON.stringify(input));
  });
};

const ASSET_PROTOCOL_PREFIX = 'contextgo-asset://asset/';

const shouldKeepAssetProtocolInElectron = (): boolean => {
  if (!isElectronDesktop() || typeof window === 'undefined') return false;
  const protocol = window.location.protocol;
  return protocol === 'http:' || protocol === 'https:';
};

const getAssetAbsolutePath = (url: string): string | undefined => {
  if (!url.startsWith(ASSET_PROTOCOL_PREFIX)) return undefined;

  let absPath = decodeURIComponent(url.slice(ASSET_PROTOCOL_PREFIX.length));
  if (/^\/[A-Za-z]:/.test(absPath)) {
    absPath = absPath.slice(1);
  }
  return absPath;
};

const toFileUrl = (absPath: string): string => {
  const normalized = absPath.replace(/\\/g, '/');
  if (/^[A-Za-z]:\//.test(normalized)) {
    return `file:///${encodeURI(normalized)}`;
  }
  return `file://${encodeURI(normalized)}`;
};

const hasCustomScheme = (url: string): boolean => {
  return /^[a-z][a-z0-9+.-]*:/i.test(url) && !/^https?:/i.test(url);
};

/**
 * Resolve an extension asset URL for the current environment.
 * - In Electron dev / any HTTP(S)-served renderer: keep `contextgo-asset://` because direct `file://` is blocked.
 * - In Electron packaged / local-protocol renderers: convert `contextgo-asset://asset/{path}` to `file://` for reliable image loading.
 * - In a regular browser (WebUI): convert `contextgo-asset://asset/{path}` to `/api/ext-asset?path={encodedPath}`.
 *
 * 将扩展资源 URL 转换为当前环境可用的地址
 */
export const resolveExtensionAssetUrl = (url: string | undefined): string | undefined => {
  if (!url) return url;

  const absPath = getAssetAbsolutePath(url);

  if (isElectronDesktop()) {
    if (absPath && !shouldKeepAssetProtocolInElectron()) {
      return toFileUrl(absPath);
    }
    return url;
  }

  if (absPath) {
    return `/api/ext-asset?path=${encodeURIComponent(absPath)}`;
  }

  // WebUI: file:///{absPath} -> /api/ext-asset
  if (url.startsWith('file://')) {
    let filePath = decodeURIComponent(url.replace(/^file:\/\/\/?/, ''));
    // On Windows, file:///C:/path → C:/path (strip leading / before drive letter)
    if (/^\/[A-Za-z]:/.test(filePath)) {
      filePath = filePath.slice(1);
    }
    return `/api/ext-asset?path=${encodeURIComponent(filePath)}`;
  }

  return url;
};

/**
 * Open external URL in the appropriate context
 * - Electron: uses shell.openExternal via IPC (opens on local machine)
 * - WebUI: uses window.open in client browser (opens on remote client)
 *
 * 在适当的环境中打开外部链接
 * - Electron: 通过 IPC 调用 shell.openExternal（在本地机器打开）
 * - WebUI: 使用 window.open 在客户端浏览器打开（在远程客户端打开）
 */
export const openExternalUrl = async (url: string): Promise<void> => {
  if (!url) return;

  if (isElectronDesktop()) {
    if (window.electronAPI?.shellOpenExternal) {
      await window.electronAPI.shellOpenExternal(url);
      return;
    }

    const { ipcBridge } = await import('@/common');
    await ipcBridge.shell.openExternal.invoke(url);
  } else {
    if (hasCustomScheme(url)) {
      window.location.href = url;
      return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  }
};
