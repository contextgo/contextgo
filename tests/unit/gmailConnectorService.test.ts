import { describe, expect, it, vi } from 'vitest';

import { GmailConnectorService, normalizeGmailConnectorConfig } from '../../src/process/services/space/connectors/googleWorkspace/GmailConnectorService';
import type { GmailConnectorConfig } from '../../src/common/types/connectors/gmail';

type GmailStore = {
  get: <K extends 'connector.gmail.config'>(key: K) => Promise<{ 'connector.gmail.config'?: GmailConnectorConfig }[K]>;
  set: <K extends 'connector.gmail.config'>(
    key: K,
    value: { 'connector.gmail.config'?: GmailConnectorConfig }[K]
  ) => Promise<{ 'connector.gmail.config'?: GmailConnectorConfig }[K]>;
};

const createStore = (initial?: GmailConnectorConfig): GmailStore => {
  let state = initial;
  return {
    get: vi.fn(async () => state),
    set: vi.fn(async (_key, value) => {
      state = value;
      return value;
    }),
  };
};

const createController = () => {
  let running = false;
  return {
    start: vi.fn(async () => {
      running = true;
      return {
        pid: 1357,
        command: 'go',
        args: ['run', '.'],
        note: 'gmail sidecar started',
      };
    }),
    stop: vi.fn(async () => {
      running = false;
    }),
    getRuntimeDetails: vi.fn(() => ({
      running,
      pid: running ? 1357 : undefined,
      command: 'go',
      args: ['run', '.'],
    })),
  };
};

describe('GmailConnectorService', () => {
  it('normalizes config defaults', () => {
    expect(normalizeGmailConnectorConfig()).toEqual({
      enabled: false,
      clientId: '',
      clientSecret: '',
      scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
      command: 'go',
      args: ['run', '.'],
    });
  });

  it('requires credentials before start', async () => {
    const service = new GmailConnectorService(createStore(), createController());
    const status = await service.start();

    expect(status.lifecycle).toBe('error');
    expect(status.lastError).toContain('Client ID and Client Secret');
  });

  it('starts with credentials and exposes message-list flow entry', async () => {
    const controller = createController();
    const service = new GmailConnectorService(
      createStore({
        enabled: true,
        clientId: 'gmail-client-id',
        clientSecret: 'gmail-secret',
        scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
        command: 'go',
        args: ['run', '.'],
      }),
      controller
    );

    const status = await service.start();

    expect(controller.start).toHaveBeenCalledOnce();
    expect(status).toMatchObject({
      lifecycle: 'running',
      hasCredentials: true,
      pid: 1357,
    });
  });
});
