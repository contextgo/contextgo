import { beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeHashRouteShellHref, normalizeHashRouteShellPath } from '@/renderer/components/layout/routerLocation';

describe('routerLocation', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('strips the /login shell while preserving the hash route', () => {
    expect(normalizeHashRouteShellPath('/login', '', '#/connectors/gitlab')).toBe('/#/connectors/gitlab');
  });

  it('preserves search parameters when normalizing the shell path', () => {
    expect(normalizeHashRouteShellPath('/login', '?from=oauth', '#/guid')).toBe('/?from=oauth#/guid');
  });

  it('leaves non-login shell paths unchanged', () => {
    expect(normalizeHashRouteShellPath('/', '', '#/guid')).toBeNull();
  });

  it('normalizes a full authenticated href generated from the login shell', () => {
    expect(normalizeHashRouteShellHref('https://remote.contextgo.io/login#/connectors/gitlab')).toBe(
      'https://remote.contextgo.io/#/connectors/gitlab'
    );
  });

  it('warms the mobile remote critical routes', async () => {
    const loadStats = {
      guid: 0,
      remoteDevices: 0,
      conversation: 0,
    };

    vi.doMock('@renderer/pages/guid', () => {
      loadStats.guid += 1;
      return {
        default: () => null,
      };
    });

    vi.doMock('@renderer/pages/RemoteDevicesPage', () => {
      loadStats.remoteDevices += 1;
      return {
        default: () => null,
      };
    });

    vi.doMock('@renderer/pages/conversation', () => {
      loadStats.conversation += 1;
      return {
        default: () => null,
      };
    });

    const { warmCriticalRendererRoutes } = await import('@/renderer/components/layout/routerLocation');

    warmCriticalRendererRoutes();
    await vi.dynamicImportSettled();

    expect(loadStats.guid).toBeGreaterThan(0);
    expect(loadStats.remoteDevices).toBeGreaterThan(0);
    expect(loadStats.conversation).toBeGreaterThan(0);
  });
});
