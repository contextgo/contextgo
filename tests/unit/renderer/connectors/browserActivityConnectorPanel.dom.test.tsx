import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const bridgeMocks = vi.hoisted(() => ({
  spaceListInvoke: vi.fn(async () => [
    { id: 'space-selected', name: 'Selected Space', isDefault: false, createTime: 1, modifyTime: 1 },
    { id: 'space-default', name: 'Default Space', isDefault: true, createTime: 2, modifyTime: 2 },
  ]),
  spaceEnsureDefaultInvoke: vi.fn(async () => ({
    id: 'space-default',
    name: 'Default Space',
    isDefault: true,
    createTime: 2,
    modifyTime: 2,
  })),
  browserActivityGetStatusInvoke: vi.fn(async () => ({
    success: true,
    data: {
      eventCount: 3,
      latestVisitedAt: '2026-04-10T08:00:00.000Z',
      latestDomain: 'example.com',
    },
  })),
  browserActivityListRecentInvoke: vi.fn(async () => ({
    success: true,
    data: [
      {
        id: 'entry-1',
        spaceId: 'space-selected',
        url: 'https://example.com/articles/contextgo',
        title: 'ContextGo Browser Activity',
        domain: 'example.com',
        visitedAt: '2026-04-10T08:00:00.000Z',
        source: 'browser-extension',
        tags: [],
      },
    ],
  })),
  browserActivityIngestInvoke: vi.fn(async () => ({
    success: true,
    data: {
      entry: { id: 'entry-2' },
      sourceId: 'source-2',
      chunkCount: 1,
    },
  })),
  messageError: vi.fn(),
  messageSuccess: vi.fn(),
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    space: {
      list: { invoke: bridgeMocks.spaceListInvoke },
      ensureDefault: { invoke: bridgeMocks.spaceEnsureDefaultInvoke },
    },
    browserActivityConnector: {
      getStatus: { invoke: bridgeMocks.browserActivityGetStatusInvoke },
      listRecent: { invoke: bridgeMocks.browserActivityListRecentInvoke },
      ingest: { invoke: bridgeMocks.browserActivityIngestInvoke },
    },
  },
}));

vi.mock('@arco-design/web-react', async () => {
  const actual = await vi.importActual<typeof import('@arco-design/web-react')>('@arco-design/web-react');
  return {
    ...actual,
    Message: {
      error: bridgeMocks.messageError,
      success: bridgeMocks.messageSuccess,
    },
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        'settings.connectors.browserActivity.runtimeTitle': 'Browser Activity Runtime',
        'settings.connectors.browserActivity.contextEngineReady': 'Context Engine Ready',
        'settings.connectors.browserActivity.currentSpace': 'Current Space',
        'settings.connectors.browserActivity.eventCount': 'Events',
        'settings.connectors.browserActivity.latestVisited': 'Latest Visited',
        'settings.connectors.browserActivity.latestDomain': 'Latest Domain',
        'settings.connectors.browserActivity.runtimeNote': 'Browser activity runtime note',
        'settings.connectors.browserActivity.refreshAction': 'Refresh',
        'settings.connectors.browserActivity.ingestTitle': 'Manual Ingest',
        'settings.connectors.browserActivity.urlLabel': 'URL',
        'settings.connectors.browserActivity.urlPlaceholder': 'https://example.com/article',
        'settings.connectors.browserActivity.titleLabel': 'Title',
        'settings.connectors.browserActivity.titlePlaceholder': 'Page title',
        'settings.connectors.browserActivity.excerptLabel': 'Excerpt',
        'settings.connectors.browserActivity.excerptPlaceholder': 'Optional summary or extracted page text',
        'settings.connectors.browserActivity.ingestAction': 'Ingest into Context Engine',
        'settings.connectors.browserActivity.ingestSuccess': 'Browser activity ingested into Context Engine.',
        'settings.connectors.browserActivity.ingestFailed': 'Failed to ingest browser activity.',
        'settings.connectors.browserActivity.loadFailed': 'Failed to load browser activity connector state.',
        'settings.connectors.browserActivity.spaceUnavailable': 'Space is unavailable.',
        'settings.connectors.browserActivity.recentTitle': 'Recent Activity',
        'settings.connectors.browserActivity.empty': 'No browser activity has been ingested yet.',
        'settings.connectors.browserActivity.sourceExtension': 'Extension',
        'settings.connectors.browserActivity.sourceManual': 'Manual',
      };
      return labels[key] || key;
    },
  }),
}));

import BrowserActivityConnectorPanel from '@/renderer/pages/connectors/panels/BrowserActivityConnectorPanel';
import { STORAGE_KEYS } from '@/common/config/storageKeys';

describe('BrowserActivityConnectorPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('uses the selected space to load browser activity state', async () => {
    localStorage.setItem(STORAGE_KEYS.SELECTED_SPACE_ID, 'space-selected');

    render(<BrowserActivityConnectorPanel connectorId='contextgo-browser-extension' />);

    await waitFor(() => {
      expect(screen.getByTestId('browser-activity-connector-panel')).toBeInTheDocument();
    });

    expect(bridgeMocks.spaceListInvoke).toHaveBeenCalled();
    expect(bridgeMocks.browserActivityGetStatusInvoke).toHaveBeenCalledWith({ spaceId: 'space-selected' });
    expect(bridgeMocks.browserActivityListRecentInvoke).toHaveBeenCalledWith({ spaceId: 'space-selected', limit: 8 });
    expect(screen.getAllByText('space-selected').length).toBeGreaterThan(0);
    expect(screen.getByText('ContextGo Browser Activity')).toBeInTheDocument();
  });

  it('submits manual ingest requests for the active space', async () => {
    localStorage.setItem(STORAGE_KEYS.SELECTED_SPACE_ID, 'space-selected');

    render(<BrowserActivityConnectorPanel connectorId='contextgo-browser-extension' />);

    await waitFor(() => {
      expect(screen.getByText('Browser Activity Runtime')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('https://example.com/article'), {
      target: { value: 'https://example.com/new' },
    });
    fireEvent.change(screen.getByPlaceholderText('Page title'), {
      target: { value: 'New Article' },
    });
    fireEvent.change(screen.getByPlaceholderText('Optional summary or extracted page text'), {
      target: { value: 'Fresh summary' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Ingest into Context Engine' }));

    await waitFor(() => {
      expect(bridgeMocks.browserActivityIngestInvoke).toHaveBeenCalledWith({
        spaceId: 'space-selected',
        url: 'https://example.com/new',
        title: 'New Article',
        excerpt: 'Fresh summary',
        source: 'manual-import',
      });
    });
    expect(bridgeMocks.messageSuccess).toHaveBeenCalledWith('Browser activity ingested into Context Engine.');
  });
});
