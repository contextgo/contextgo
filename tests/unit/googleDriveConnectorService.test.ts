/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';

import { GoogleDriveConnectorService, normalizeGoogleDriveConnectorConfig } from '../../src/process/services/space/connectors/googleDrive/GoogleDriveConnectorService';
import type { GoogleDriveConnectorConfig } from '../../src/common/types/connectors/googleDrive';

type GoogleDriveStore = {
  get: <K extends 'connector.googleDrive.config'>(key: K) => Promise<{ 'connector.googleDrive.config'?: GoogleDriveConnectorConfig }[K]>;
  set: <K extends 'connector.googleDrive.config'>(
    key: K,
    value: { 'connector.googleDrive.config'?: GoogleDriveConnectorConfig }[K]
  ) => Promise<{ 'connector.googleDrive.config'?: GoogleDriveConnectorConfig }[K]>;
};

const createStore = (initial?: GoogleDriveConnectorConfig): GoogleDriveStore => {
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
        pid: 2468,
        command: 'go',
        args: ['run', '.'],
        note: 'google drive sidecar started',
      };
    }),
    stop: vi.fn(async () => {
      running = false;
    }),
    getRuntimeDetails: vi.fn(() => ({
      running,
      pid: running ? 2468 : undefined,
      command: 'go',
      args: ['run', '.'],
    })),
  };
};

describe('GoogleDriveConnectorService', () => {
  it('normalizes config defaults', () => {
    expect(normalizeGoogleDriveConnectorConfig()).toMatchObject({
      enabled: false,
      clientId: '',
      clientSecret: '',
      command: 'go',
      args: ['run', '.'],
    });
  });

  it('requires client credentials before start', async () => {
    const service = new GoogleDriveConnectorService(createStore(), createController());
    const status = await service.start();

    expect(status.lifecycle).toBe('error');
    expect(status.lastError).toContain('Client ID and Client Secret');
  });

  it('starts managed sidecar with credentials', async () => {
    const controller = createController();
    const service = new GoogleDriveConnectorService(
      createStore({
        enabled: true,
        clientId: 'google-client-id.apps.googleusercontent.com',
        clientSecret: 'secret',
        scopes: ['https://www.googleapis.com/auth/drive.metadata.readonly'],
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
      pid: 2468,
      command: 'go',
    });
  });
});
