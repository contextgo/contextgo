import type { Request } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = new Map<string, unknown>();
const processConfigGet = vi.fn(async (key: string) => storage.get(key));
const WRITE_DELAYS = new Map<string, number>([
  ['cloud.webui.user', 0],
  ['cloud.webui.device', 5],
  ['cloud.webui.deviceToken', 10],
]);
const processConfigSet = vi.fn((key: string, value: unknown) => {
  const snapshot = new Map(storage);
  const delay = WRITE_DELAYS.get(key) ?? 0;

  return new Promise<unknown>((resolve) => {
    setTimeout(() => {
      snapshot.set(key, value);
      storage.clear();
      for (const [snapshotKey, snapshotValue] of snapshot.entries()) {
        storage.set(snapshotKey, snapshotValue);
      }
      resolve(value);
    }, delay);
  });
});

vi.mock('../../../../src/process/utils/initStorage', () => ({
  ProcessConfig: {
    get: processConfigGet,
    set: processConfigSet,
  },
}));

function createJsonResponse(payload: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    text: async () => JSON.stringify(payload),
  } as Response;
}

describe('CloudSessionService', () => {
  beforeEach(() => {
    storage.clear();
    processConfigGet.mockClear();
    processConfigSet.mockClear();
    vi.unstubAllGlobals();
  });

  it('auto-binds the first valid remote cloud session to the local device', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse({
          authenticated: true,
          user: {
            id: 'cloud-user-1',
            email: 'yeyitech@gmail.com',
            username: 'yeyitech',
            displayName: 'yeyitech',
            avatarUrl: null,
          },
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          success: true,
          device: {
            id: 'device-1',
            userId: 'cloud-user-1',
            deviceName: 'ContextGo WebUI on mbp',
            platform: 'macos',
            status: 'active',
            createdAt: '2026-03-28T00:00:00Z',
            updatedAt: '2026-03-28T00:00:00Z',
          },
          token: 'ctxdev_test_token',
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    const { CloudSessionService } = await import('../../../../src/process/webserver/auth/service/CloudSessionService');

    const result = await CloudSessionService.authenticateRequest({
      headers: {
        host: 'remote.contextgo.io',
        cookie: 'contextgo_session=cloud-session-token',
      } as Request['headers'],
      cookies: {},
    });

    expect(result?.id).toBe('cloud-user-1');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(processConfigSet).toHaveBeenCalledWith(
      'cloud.webui.user',
      expect.objectContaining({
        id: 'cloud-user-1',
        username: 'yeyitech',
      })
    );
    expect(storage.get('cloud.webui.user')).toEqual(
      expect.objectContaining({
        id: 'cloud-user-1',
        username: 'yeyitech',
      })
    );
    expect(storage.get('cloud.webui.device')).toEqual(
      expect.objectContaining({
        id: 'device-1',
        userId: 'cloud-user-1',
      })
    );
    expect(processConfigSet).toHaveBeenCalledWith('cloud.webui.deviceToken', 'ctxdev_test_token');
    expect(storage.get('cloud.webui.deviceToken')).toBe('ctxdev_test_token');
    expect(storage.get('cloud.deviceToken')).toBeUndefined();
  });

  it('rejects a remote cloud session for a different already-bound user', async () => {
    storage.set('cloud.webui.user', {
      id: 'bound-user',
      email: 'bound@example.com',
      username: 'bound',
      displayName: 'bound',
      avatarUrl: null,
    });
    storage.set('cloud.webui.deviceToken', 'ctxdev_existing');

    const fetchMock = vi.fn().mockResolvedValueOnce(
      createJsonResponse({
        authenticated: true,
        user: {
          id: 'another-user',
          email: 'yeyitech@gmail.com',
          username: 'yeyitech',
          displayName: 'yeyitech',
          avatarUrl: null,
        },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const { CloudSessionService } = await import('../../../../src/process/webserver/auth/service/CloudSessionService');

    const result = await CloudSessionService.authenticateRequest({
      headers: {
        host: 'remote.contextgo.io',
        cookie: 'contextgo_session=cloud-session-token',
      } as Request['headers'],
      cookies: {},
    });

    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(processConfigSet).not.toHaveBeenCalled();
  });

  it('does not treat the desktop cloud binding as an existing webui binding', async () => {
    storage.set('cloud.user', {
      id: 'desktop-user',
      email: 'yeyitech@gmail.com',
      username: 'yeyitech',
      displayName: 'yeyitech',
      avatarUrl: null,
    });
    storage.set('cloud.deviceToken', 'ctxdev_desktop');

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse({
          authenticated: true,
          user: {
            id: 'desktop-user',
            email: 'yeyitech@gmail.com',
            username: 'yeyitech',
            displayName: 'yeyitech',
            avatarUrl: null,
          },
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          success: true,
          device: {
            id: 'webui-device-1',
            userId: 'desktop-user',
            deviceName: 'ContextGo WebUI on mbp',
            platform: 'macos',
            status: 'active',
            createdAt: '2026-03-28T00:00:00Z',
            updatedAt: '2026-03-28T00:00:00Z',
          },
          token: 'ctxdev_webui_token',
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    const { CloudSessionService } = await import('../../../../src/process/webserver/auth/service/CloudSessionService');

    const result = await CloudSessionService.authenticateRequest({
      headers: {
        host: 'remote.contextgo.io',
        cookie: 'contextgo_session=cloud-session-token',
      } as Request['headers'],
      cookies: {},
    });

    expect(result?.id).toBe('desktop-user');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(storage.get('cloud.deviceToken')).toBe('ctxdev_desktop');
    expect(storage.get('cloud.webui.deviceToken')).toBe('ctxdev_webui_token');
  });
});
