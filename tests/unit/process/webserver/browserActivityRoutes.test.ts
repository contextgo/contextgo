/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockIngest = vi.fn();
const mockListSpaces = vi.fn();
const mockGetSpace = vi.fn();

vi.mock('@process/services/context/contextServiceSingleton', () => ({
  contextEventBus: {},
  contextService: {},
}));

vi.mock('@process/services/database/space/SqliteSpaceRepository', () => ({
  SqliteSpaceRepository: vi.fn(class SqliteSpaceRepositoryMock {}),
}));

vi.mock('@process/services/space/SpaceServiceImpl', () => ({
  SpaceServiceImpl: vi.fn(
    class SpaceServiceImplMock {
      listSpaces = mockListSpaces;
      getSpace = mockGetSpace;
    }
  ),
}));

vi.mock('@process/services/space/browser/activity/BrowserActivityStoreService', () => ({
  BrowserActivityStoreService: vi.fn(class BrowserActivityStoreServiceMock {}),
}));

vi.mock('@process/services/space/browser/activity/BrowserActivityConnectorService', () => ({
  BrowserActivityConnectorService: vi.fn(
    class BrowserActivityConnectorServiceMock {
      ingest = mockIngest;
    }
  ),
}));

describe('browserActivityRoutes', () => {
  let server: ReturnType<express.Express['listen']> | null = null;
  let baseUrl = '';

  beforeEach(async () => {
    vi.clearAllMocks();
    mockListSpaces.mockResolvedValue([
      {
        id: 'space-default',
        name: 'Default Space',
        engine: 'vault',
        isDefault: true,
        createTime: Date.now(),
        modifyTime: Date.now(),
      },
    ]);
    mockGetSpace.mockResolvedValue(undefined);
    mockIngest.mockResolvedValue({
      sourceId: 'source-1',
      documentId: 'doc-1',
      chunkCount: 2,
    });

    const { registerBrowserActivityRoutes } = await import('../../../../src/process/webserver/routes/browserActivityRoutes');
    const app = express();
    app.use(express.json());
    registerBrowserActivityRoutes(app);

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const address = server?.address();
        if (address && typeof address === 'object') {
          baseUrl = `http://127.0.0.1:${address.port}`;
        }
        resolve();
      });
    });
  });

  afterEach(async () => {
    if (!server) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    server = null;
  });

  it('accepts browser extension payloads and forwards navigation events into browser activity ingestion', async () => {
    const response = await fetch(`${baseUrl}/api/connectors/browser-activity/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-ContextGo-Client': 'contextgo-browser-extension',
        'X-ContextGo-Session': 'session-1',
      },
      body: JSON.stringify({
        connector: 'browser_extension',
        browser_family: 'chrome',
        profile_label: 'work',
        events: [
          {
            event_type: 'navigation_completed',
            recorded_at: '2026-04-11T07:00:00.000Z',
            url: 'https://example.com/post',
            title: 'Example Post',
            excerpt: 'Captured from browser',
            domain: 'example.com',
            tab_id: 12,
            window_id: 2,
            active: true,
            transition_type: 'link',
          },
          {
            event_type: 'tab_closed',
            recorded_at: '2026-04-11T07:01:00.000Z',
          },
        ],
      }),
    });

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockIngest).toHaveBeenCalledTimes(1);
    expect(mockIngest).toHaveBeenCalledWith(
      expect.objectContaining({
        spaceId: 'space-default',
        sessionId: 'session-1',
        url: 'https://example.com/post',
        title: 'Example Post',
        excerpt: 'Captured from browser',
        source: 'browser-extension',
        metadata: expect.objectContaining({
          connectorId: 'contextgo-browser-extension',
          browserFamily: 'chrome',
          profileLabel: 'work',
          eventType: 'navigation_completed',
          clientName: 'contextgo-browser-extension',
        }),
        tags: expect.arrayContaining(['connector:browser-extension', 'browser:chrome', 'profile:work']),
      })
    );
    expect(body).toEqual({
      success: true,
      data: expect.objectContaining({
        accepted: 1,
        rejected: 1,
        spaceId: 'space-default',
        connectorId: 'contextgo-browser-extension',
      }),
    });
  });

  it('rejects malformed payloads', async () => {
    const response = await fetch(`${baseUrl}/api/connectors/browser-activity/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['invalid']),
    });

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      success: false,
      msg: 'Invalid browser activity payload',
    });
  });
});
