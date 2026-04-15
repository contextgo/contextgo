import { CONTEXTGO_AUTH_BASE_URL } from '@/common/config/constants';
import { isContextGoHostname } from '@/common/utils';
import type { CloudStatus } from '@/common/types/cloud';

export const OFFICIAL_REMOTE_DEVICES_ROUTE = '/remote/devices';
export const OFFICIAL_REMOTE_WEBVIEW_PARTITION = 'persist:contextgo-cloud-auth';
export const OFFICIAL_REMOTE_DEVICE_ID_QUERY_KEY = 'deviceId';
export const OFFICIAL_REMOTE_VIEW_QUERY_KEY = 'view';
export const OFFICIAL_REMOTE_VIEW_LIST = 'list';

const OFFICIAL_REMOTE_PREFERRED_DEVICE_ID_KEY = 'contextgo.officialRemote.preferredDeviceId';

type OfficialRemoteListOptions = {
  forcePicker?: boolean;
};

export const buildOfficialDeviceListUrl = (authBaseUrl?: string, options?: OfficialRemoteListOptions): string => {
  const normalizedBaseUrl = authBaseUrl?.trim().replace(/\/+$/, '') || CONTEXTGO_AUTH_BASE_URL.replace(/\/+$/, '');
  const url = new URL('/remote/devices', `${normalizedBaseUrl}/`);

  if (options?.forcePicker) {
    url.searchParams.set(OFFICIAL_REMOTE_VIEW_QUERY_KEY, OFFICIAL_REMOTE_VIEW_LIST);
  }

  return url.toString();
};

type OfficialRemoteRouteOptions = {
  preferredDeviceId?: string | null;
  forcePicker?: boolean;
};

export const buildOfficialRemoteDevicesRoute = (options?: OfficialRemoteRouteOptions): string => {
  const searchParams = new URLSearchParams();

  const preferredDeviceId = options?.preferredDeviceId?.trim();
  if (preferredDeviceId) {
    searchParams.set(OFFICIAL_REMOTE_DEVICE_ID_QUERY_KEY, preferredDeviceId);
  }

  if (options?.forcePicker) {
    searchParams.set(OFFICIAL_REMOTE_VIEW_QUERY_KEY, OFFICIAL_REMOTE_VIEW_LIST);
  }

  const query = searchParams.toString();
  return query ? `${OFFICIAL_REMOTE_DEVICES_ROUTE}?${query}` : OFFICIAL_REMOTE_DEVICES_ROUTE;
};

export const isOfficialRemotePickerView = (searchParams: URLSearchParams): boolean => {
  return searchParams.get(OFFICIAL_REMOTE_VIEW_QUERY_KEY) === OFFICIAL_REMOTE_VIEW_LIST;
};

export const buildOfficialDeviceUrl = (authBaseUrl: string | undefined, deviceId: string): string => {
  const normalizedDeviceId = deviceId.trim();
  if (!normalizedDeviceId) {
    return buildOfficialDeviceListUrl(authBaseUrl);
  }

  const normalizedBaseUrl = authBaseUrl?.trim().replace(/\/+$/, '') || CONTEXTGO_AUTH_BASE_URL.replace(/\/+$/, '');
  return `${normalizedBaseUrl}/device/${encodeURIComponent(normalizedDeviceId)}`;
};

export const extractOfficialRemoteDeviceId = (candidateUrl: string): string | null => {
  try {
    const parsed = new URL(candidateUrl);
    const match = parsed.pathname.match(/^\/device\/([^/]+)\/?$/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
};

const getSafeStorage = (): Storage | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export const readPreferredOfficialRemoteDeviceId = (
  storage: Pick<Storage, 'getItem'> | null = getSafeStorage()
): string | null => {
  const deviceId = storage?.getItem(OFFICIAL_REMOTE_PREFERRED_DEVICE_ID_KEY)?.trim();
  return deviceId ? deviceId : null;
};

export const rememberPreferredOfficialRemoteDeviceId = (
  deviceId: string,
  storage: Pick<Storage, 'setItem'> | null = getSafeStorage()
): void => {
  const normalizedDeviceId = deviceId.trim();
  if (!normalizedDeviceId) {
    return;
  }

  storage?.setItem(OFFICIAL_REMOTE_PREFERRED_DEVICE_ID_KEY, normalizedDeviceId);
};

export const clearPreferredOfficialRemoteDeviceId = (
  storage: Pick<Storage, 'removeItem'> | null = getSafeStorage()
): void => {
  storage?.removeItem(OFFICIAL_REMOTE_PREFERRED_DEVICE_ID_KEY);
};

export const shouldPreferOfficialRemoteShell = (params: {
  currentHref: string;
  isDesktopRuntime: boolean;
  isMobileShellRuntime: boolean;
}): boolean => {
  if (extractOfficialRemoteDeviceId(params.currentHref)) {
    return false;
  }

  if (params.isDesktopRuntime) {
    return false;
  }

  if (params.isMobileShellRuntime) {
    return true;
  }

  try {
    return isContextGoHostname(new URL(params.currentHref).hostname);
  } catch {
    return false;
  }
};

const isLegacyOfficialRemoteReady = (cloudStatus: CloudStatus | null): boolean => {
  const officialRemoteStatus = cloudStatus?.officialRemote;
  return Boolean(
    cloudStatus?.officialRemoteReady === true ||
    (officialRemoteStatus?.running === true && officialRemoteStatus.browserEntryReady === true)
  );
};

const isHostRuntimeDesired = (cloudStatus: CloudStatus | null): boolean => {
  if (typeof cloudStatus?.hostRuntime?.officialRemoteDesired === 'boolean') {
    return cloudStatus.hostRuntime.officialRemoteDesired;
  }

  return cloudStatus?.officialRemote?.desired === true;
};

export const isCurrentHostRuntimeReady = (cloudStatus: CloudStatus | null): boolean => {
  if (!cloudStatus?.authenticated) {
    return false;
  }

  if (typeof cloudStatus.hostRuntime?.officialRemoteReady === 'boolean') {
    return cloudStatus.hostRuntime.officialRemoteReady;
  }

  return isLegacyOfficialRemoteReady(cloudStatus);
};

export const shouldEnsureCurrentHostRuntime = (cloudStatus: CloudStatus | null): boolean => {
  if (!cloudStatus?.authenticated || !cloudStatus.device || !cloudStatus.deviceTokenAvailable) {
    return false;
  }

  if (cloudStatus.officialRemote?.needsAttention === true) {
    return false;
  }

  return !isCurrentHostRuntimeReady(cloudStatus);
};

export const getCurrentHostRuntimeStatusKey = (cloudStatus: CloudStatus | null): string => {
  if (!cloudStatus?.authenticated) {
    return 'settings.webui.officialRemoteStatusShort.signedOut';
  }

  if (isCurrentHostRuntimeReady(cloudStatus)) {
    return 'settings.webui.officialRemoteStatusShort.ready';
  }

  if (cloudStatus.officialRemote?.needsAttention === true) {
    return 'settings.webui.officialRemoteStatusShort.relogin';
  }

  if (!cloudStatus.deviceTokenAvailable) {
    return 'settings.webui.officialRemoteStatusShort.linking';
  }

  if (isHostRuntimeDesired(cloudStatus)) {
    return cloudStatus.hostRuntime?.running === true
      ? 'settings.webui.officialRemoteStatusShort.preparing'
      : 'settings.webui.officialRemoteStatusShort.connecting';
  }

  return 'settings.webui.officialRemoteStatusShort.unavailable';
};

export const getCurrentHostRuntimeDetailStatusKey = (cloudStatus: CloudStatus | null): string => {
  switch (getCurrentHostRuntimeStatusKey(cloudStatus)) {
    case 'settings.webui.officialRemoteStatusShort.ready':
      return 'settings.webui.officialRemoteDeviceReady';
    case 'settings.webui.officialRemoteStatusShort.relogin':
      return 'settings.webui.officialRemoteNeedsRelogin';
    case 'settings.webui.officialRemoteStatusShort.linking':
      return 'settings.webui.officialRemoteDevicePending';
    case 'settings.webui.officialRemoteStatusShort.preparing':
      return 'settings.webui.officialRemotePreparing';
    case 'settings.webui.officialRemoteStatusShort.connecting':
      return 'settings.webui.officialRemoteConnecting';
    case 'settings.webui.officialRemoteStatusShort.signedOut':
      return 'settings.webui.officialRemoteSignedOut';
    default:
      return 'settings.webui.officialRemoteUnavailable';
  }
};

export type OfficialRemoteRouteViewMode = 'device-list' | 'remote-device' | 'local-device' | 'resolving-device';

export type HostedOfficialRemoteIntent =
  | { kind: 'none' }
  | { kind: 'device-list' }
  | { kind: 'device-switch'; deviceId: string }
  | { kind: 'self-open'; deviceId: string };

const parseOfficialRemoteIntentFromSearchParams = (
  searchParams: URLSearchParams,
  displayedDeviceId?: string | null
): HostedOfficialRemoteIntent => {
  const normalizedDisplayedDeviceId = displayedDeviceId?.trim() || null;
  const nestedRequestedDeviceId = searchParams.get(OFFICIAL_REMOTE_DEVICE_ID_QUERY_KEY)?.trim() || null;

  if (!nestedRequestedDeviceId) {
    return { kind: 'device-list' };
  }

  if (normalizedDisplayedDeviceId && nestedRequestedDeviceId === normalizedDisplayedDeviceId) {
    return { kind: 'self-open', deviceId: nestedRequestedDeviceId };
  }

  return { kind: 'device-switch', deviceId: nestedRequestedDeviceId };
};

export const resolveHostedOfficialRemoteIntent = (
  candidateUrl: string,
  options?: {
    displayedDeviceId?: string | null;
  }
): HostedOfficialRemoteIntent => {
  try {
    const currentUrl = new URL(candidateUrl);
    const normalizedDisplayedDeviceId = options?.displayedDeviceId?.trim() || null;

    if (currentUrl.pathname === OFFICIAL_REMOTE_DEVICES_ROUTE) {
      return parseOfficialRemoteIntentFromSearchParams(currentUrl.searchParams, normalizedDisplayedDeviceId);
    }

    const currentPathDeviceId = extractOfficialRemoteDeviceId(candidateUrl);
    if (!currentPathDeviceId) {
      return { kind: 'none' };
    }

    if (normalizedDisplayedDeviceId && currentPathDeviceId !== normalizedDisplayedDeviceId) {
      return { kind: 'device-switch', deviceId: currentPathDeviceId };
    }

    const hashRoute = currentUrl.hash.startsWith('#') ? currentUrl.hash.slice(1).trim() : currentUrl.hash.trim();
    if (!hashRoute) {
      return { kind: 'none' };
    }

    const normalizedHashRoute = hashRoute.startsWith('/') ? hashRoute : `/${hashRoute}`;
    const hashRouteUrl = new URL(normalizedHashRoute, 'https://contextgo.invalid');
    if (hashRouteUrl.pathname !== OFFICIAL_REMOTE_DEVICES_ROUTE) {
      return { kind: 'none' };
    }

    return parseOfficialRemoteIntentFromSearchParams(hashRouteUrl.searchParams, normalizedDisplayedDeviceId);
  } catch {
    return { kind: 'none' };
  }
};

type ResolveOfficialRemoteRouteViewModeParams = {
  requestedDeviceId?: string | null;
  currentDeviceId?: string | null;
  isDesktopRuntime: boolean;
  forcePickerView: boolean;
  cloudStatusResolved: boolean;
};

export const resolveOfficialRemoteRouteViewMode = (
  params: ResolveOfficialRemoteRouteViewModeParams
): OfficialRemoteRouteViewMode => {
  const requestedDeviceId = params.requestedDeviceId?.trim();
  if (params.forcePickerView || !requestedDeviceId) {
    return 'device-list';
  }

  if (!params.isDesktopRuntime) {
    return 'remote-device';
  }

  if (!params.cloudStatusResolved) {
    return 'resolving-device';
  }

  const currentDeviceId = params.currentDeviceId?.trim();
  if (currentDeviceId && currentDeviceId === requestedDeviceId) {
    return 'local-device';
  }

  return 'remote-device';
};

type ResolveAuthenticatedStartupPathParams = {
  activeTabId: string | null;
  openTabIds: string[];
  preferOfficialRemoteShell: boolean;
  preferredRemoteDeviceId?: string | null;
};

export const resolveAuthenticatedStartupPath = (params: ResolveAuthenticatedStartupPathParams): string => {
  if (params.preferOfficialRemoteShell) {
    const preferredRemoteDeviceId = params.preferredRemoteDeviceId?.trim() || readPreferredOfficialRemoteDeviceId();
    return buildOfficialRemoteDevicesRoute({ preferredDeviceId: preferredRemoteDeviceId });
  }

  const hasPersistedActiveTab = Boolean(
    params.activeTabId && params.openTabIds.some((tabId) => tabId === params.activeTabId)
  );

  if (hasPersistedActiveTab && params.activeTabId) {
    return `/conversation/${params.activeTabId}`;
  }

  return '/guid';
};

export const OFFICIAL_REMOTE_SWITCHER_EVENT = 'official-remote:switcher';

export type OfficialRemoteSwitcherEventDetail = {
  source?: 'settings-webui' | 'user-menu';
};

export const dispatchOfficialRemoteSwitcherEvent = (detail: OfficialRemoteSwitcherEventDetail = {}): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent<OfficialRemoteSwitcherEventDetail>(OFFICIAL_REMOTE_SWITCHER_EVENT, { detail }));
};
