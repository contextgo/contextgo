import { CONTEXTGO_AUTH_BASE_URL } from '@/common/config/constants';

export const OFFICIAL_REMOTE_DEVICES_ROUTE = '/remote/devices';
export const OFFICIAL_REMOTE_WEBVIEW_PARTITION = 'persist:official-remote';

export const buildOfficialDeviceListUrl = (authBaseUrl?: string): string => {
  const normalizedBaseUrl = authBaseUrl?.trim().replace(/\/+$/, '') || CONTEXTGO_AUTH_BASE_URL.replace(/\/+$/, '');
  return `${normalizedBaseUrl}/remote/devices`;
};
