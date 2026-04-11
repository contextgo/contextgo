const SETTINGS_ROUTE_ALIAS_MAP: Record<string, readonly string[]> = {
  'agent-publish': ['/settings/agent-publish', '/settings/active-sessions'],
  channels: ['/settings/channels', '/settings/agent-entry'],
  system: ['/settings/system', '/settings/display'],
};

export const SETTINGS_NAV_DRAWER_EVENT = 'settings.nav-drawer';

type SettingsNavDrawerEventDetail = {
  open?: boolean;
};

export const normalizeSettingsAnchor = (anchor: string): string => (anchor === 'display' ? 'system' : anchor);

export function matchesSettingsNavPath(pathname: string, itemPath: string): boolean {
  const directPath = '/settings/' + itemPath;
  const candidates = SETTINGS_ROUTE_ALIAS_MAP[itemPath] ?? [directPath];

  return candidates.some((candidate) => pathname === candidate || pathname.startsWith(candidate + '/'));
}

export function dispatchSettingsNavDrawerEvent(detail: SettingsNavDrawerEventDetail = {}): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent<SettingsNavDrawerEventDetail>(SETTINGS_NAV_DRAWER_EVENT, { detail }));
}
