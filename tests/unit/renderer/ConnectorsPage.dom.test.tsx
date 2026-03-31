import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const openExternalInvoke = vi.fn();
const clipboardGetStatusInvoke = vi.fn(async () => ({ success: true, data: { lifecycle: 'running', available: true, eventCount: 3, summaryCount: 1, note: 'observer running' } }));
const clipboardGetConfigInvoke = vi.fn(async () => ({ success: true, data: { enabled: true, retainFullText: false, pollIntervalMs: 800, maxTextBytes: 32768 } }));
const clipboardListRecentInvoke = vi.fn(async () => ({ success: true, data: [{ id: 'evt-1', contentType: 'plain_text', textPreview: 'hello contextgo', capturedAt: '2026-03-30T10:00:00.000Z' }] }));
const clipboardListSummariesInvoke = vi.fn(async () => ({ success: true, data: [{ id: 'sum-1', summaryDate: '2026-03-30', eventCount: 3, uniqueHashCount: 2, topDomains: [], generatedAt: '2026-03-30T11:00:00.000Z', source: 'contextgo-collect' }] }));
const clipboardSetConfigInvoke = vi.fn(async ({ config }: { config: unknown }) => ({ success: true, data: config }));
const clipboardStartInvoke = vi.fn(async () => ({ success: true, data: { lifecycle: 'running' } }));
const clipboardStopInvoke = vi.fn(async () => ({ success: true, data: { lifecycle: 'stopped' } }));
const clipboardSampleInvoke = vi.fn(async () => ({ success: true, data: { id: 'sample' } }));
const clipboardCollectInvoke = vi.fn(async () => ({ success: true, data: { eventCount: 3, summaryCount: 1, importedEvents: 0, summary: { id: 'sum-1' } } }));

const feishuGetStatusInvoke = vi.fn(async () => ({ success: true, data: { lifecycle: 'stopped', available: true, hasCredentials: true, note: 'feishu ready', command: 'npx' } }));
const feishuGetConfigInvoke = vi.fn(async () => ({ success: true, data: { enabled: true, appId: 'cli_xxx', appSecret: 'secret', apiDomain: 'open.feishu.cn', useOAuth: false, command: '@larksuiteoapi/lark-mcp', args: [] } }));
const feishuSetConfigInvoke = vi.fn(async ({ config }: { config: unknown }) => ({ success: true, data: config }));
const feishuStartInvoke = vi.fn(async () => ({ success: true, data: { lifecycle: 'running' } }));
const feishuStopInvoke = vi.fn(async () => ({ success: true, data: { lifecycle: 'stopped' } }));

const googleDriveGetStatusInvoke = vi.fn(async () => ({ success: true, data: { lifecycle: 'stopped', available: true, hasCredentials: true, hasRefreshToken: true, tokenExpiry: '2026-03-31T00:00:00.000Z', note: 'google drive ready', command: 'go', fileCount: 1, storeDir: '/tmp/contextgo-google-drive' } }));
const googleDriveGetConfigInvoke = vi.fn(async () => ({ success: true, data: { enabled: true, clientId: 'google-client-id.apps.googleusercontent.com', clientSecret: 'secret', scopes: ['https://www.googleapis.com/auth/drive.metadata.readonly'], command: 'go', args: ['run', '.'] } }));
const googleDriveSetConfigInvoke = vi.fn(async ({ config }: { config: unknown }) => ({ success: true, data: config }));
const googleDriveStartInvoke = vi.fn(async () => ({ success: true, data: { lifecycle: 'running' } }));
const googleDriveStopInvoke = vi.fn(async () => ({ success: true, data: { lifecycle: 'stopped' } }));
const googleDriveCreateAuthRequestInvoke = vi.fn(async () => ({ success: true, data: { authUrl: 'https://accounts.google.com/o/oauth2/v2/auth', state: 'state-1' } }));
const googleDriveCompleteAuthInvoke = vi.fn(async () => ({ success: true, data: { tokenCachePath: '/tmp/google-drive-token.json', scopeCount: 1 } }));
const googleDriveListFilesInvoke = vi.fn(async () => ({ success: true, data: [{ id: 'file-1', name: 'Roadmap', mimeType: 'application/vnd.google-apps.document', modifiedTime: '2026-03-30T10:00:00.000Z', ownerNames: ['Code Friday'], sizeBytes: 1024 }] }));
const googleDriveSyncNowInvoke = vi.fn(async () => ({ success: true, data: { storedCount: 1, syncedAt: '2026-03-30T11:00:00.000Z', storeDir: '/tmp/contextgo-google-drive' } }));
const googleDriveListStoredFilesInvoke = vi.fn(async () => ({ success: true, data: [{ recordId: 'rec-1', fileId: 'file-1', name: 'Roadmap', mimeType: 'application/vnd.google-apps.document', ownerNames: ['Code Friday'], sizeBytes: 1024, syncedAt: '2026-03-30T11:00:00.000Z' }] }));

vi.mock('@/common', () => ({
  ipcBridge: {
    shell: {
      openExternal: {
        invoke: (...args: unknown[]) => openExternalInvoke(...args),
      },
    },
    clipboardConnector: {
      getStatus: { invoke: clipboardGetStatusInvoke },
      getConfig: { invoke: clipboardGetConfigInvoke },
      listRecentEvents: { invoke: clipboardListRecentInvoke },
      listSummaries: { invoke: clipboardListSummariesInvoke },
      setConfig: { invoke: clipboardSetConfigInvoke },
      start: { invoke: clipboardStartInvoke },
      stop: { invoke: clipboardStopInvoke },
      sampleNow: { invoke: clipboardSampleInvoke },
      collectNow: { invoke: clipboardCollectInvoke },
      statusChanged: { on: vi.fn(() => () => void 0) },
    },
    feishuConnector: {
      getStatus: { invoke: feishuGetStatusInvoke },
      getConfig: { invoke: feishuGetConfigInvoke },
      setConfig: { invoke: feishuSetConfigInvoke },
      start: { invoke: feishuStartInvoke },
      stop: { invoke: feishuStopInvoke },
      statusChanged: { on: vi.fn(() => () => void 0) },
    },
    googleDriveConnector: {
      getStatus: { invoke: googleDriveGetStatusInvoke },
      getConfig: { invoke: googleDriveGetConfigInvoke },
      setConfig: { invoke: googleDriveSetConfigInvoke },
      start: { invoke: googleDriveStartInvoke },
      stop: { invoke: googleDriveStopInvoke },
      createAuthRequest: { invoke: googleDriveCreateAuthRequestInvoke },
      completeAuth: { invoke: googleDriveCompleteAuthInvoke },
      listFiles: { invoke: googleDriveListFilesInvoke },
      syncNow: { invoke: googleDriveSyncNowInvoke },
      listStoredFiles: { invoke: googleDriveListStoredFilesInvoke },
      statusChanged: { on: vi.fn(() => () => void 0) },
    },
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === 'settings.connectors.count') {
        return `${options?.count ?? 0} connectors`;
      }

      if (key === 'settings.connectors.summaryTemplate') {
        return `${options?.name ?? ''} / ${options?.category ?? ''}`;
      }

      const labels: Record<string, string> = {
        'settings.connectors.title': 'Connector',
        'settings.connectors.description': 'Connector catalog',
        'settings.connectors.kind': 'Context Connector',
        'settings.connectors.resources': 'Resources',
        'settings.connectors.auth': 'Authentication',
        'settings.connectors.officialSite': 'Official Site',
        'settings.connectors.openWebsite': 'Open Website',
        'settings.connectors.note': 'Connector note',
        'settings.connectors.stagePriority': 'Priority',
        'settings.connectors.stagePlanned': 'Planned',
        'settings.connectors.categories.contextgo': 'ContextGo Family',
        'settings.connectors.categories.googleWorkspace': 'Google Workspace',
        'settings.connectors.categories.collaboration': 'Collaboration',
        'settings.connectors.categories.development': 'Development',
        'settings.connectors.categories.knowledge': 'Knowledge',
        'settings.connectors.categories.design': 'Design',
        'settings.connectors.categories.storage': 'Storage',
        'settings.connectors.categories.business': 'Business',
        'settings.connectors.categories.data': 'Data',
        'settings.connectors.resourceTypes.clipboard': 'Clipboard',
        'settings.connectors.resourceTypes.browserHistory': 'Browser History',
        'settings.connectors.resourceTypes.webPages': 'Web Pages',
        'settings.connectors.resourceTypes.files': 'Files',
        'settings.connectors.resourceTypes.docs': 'Docs',
        'settings.connectors.resourceTypes.sheets': 'Sheets',
        'settings.connectors.resourceTypes.chat': 'Chat',
        'settings.connectors.resourceTypes.calendar': 'Calendar',
        'settings.connectors.resourceTypes.repositories': 'Repositories',
        'settings.connectors.resourceTypes.issues': 'Issues',
        'settings.connectors.resourceTypes.tasks': 'Tasks',
        'settings.connectors.resourceTypes.analytics': 'Analytics',
        'settings.connectors.resourceTypes.databases': 'Databases',
        'settings.connectors.resourceTypes.wiki': 'Wiki',
        'settings.connectors.resourceTypes.email': 'Email',
        'settings.connectors.resourceTypes.designs': 'Designs',
        'settings.connectors.resourceTypes.crm': 'CRM',
        'settings.connectors.resourceTypes.commerce': 'Commerce',
        'settings.connectors.resourceTypes.incidents': 'Incidents',
        'settings.connectors.authTypes.oauth': 'OAuth',
        'settings.connectors.authTypes.bot': 'Bot Token',
        'settings.connectors.authTypes.apiKey': 'API Key',
        'settings.connectors.authTypes.pat': 'Personal Access Token',
        'settings.connectors.authTypes.serviceAccount': 'Service Account',
        'settings.connectors.authTypes.native': 'Local Permission',
        'settings.connectors.authTypes.extension': 'Extension Pairing',
        'settings.connectors.authTypes.none': 'No Auth',
        'common.website': 'Website',
      };

      return labels[key] || key;
    },
  }),
}));

import ConnectorsPage from '@/renderer/pages/connectors';
import { CONNECTORS } from '@/renderer/pages/connectors/connectors';

const LocationProbe: React.FC = () => {
  const location = useLocation();
  return <div data-testid='location-probe'>{location.pathname}</div>;
};

describe('ConnectorsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects invalid routes to the first connector detail page', async () => {
    const fallbackConnector = CONNECTORS[0];

    render(
      <MemoryRouter initialEntries={['/connectors/unknown']}>
        <Routes>
          <Route path='/connectors' element={<ConnectorsPage />} />
          <Route path='/connectors/:connectorId' element={<ConnectorsPage />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('location-probe')).toHaveTextContent(`/connectors/${fallbackConnector.id}`);
    });
  });

  it('switches detail content and opens the connector website', async () => {
    render(
      <MemoryRouter initialEntries={['/connectors/google-drive']}>
        <Routes>
          <Route path='/connectors' element={<ConnectorsPage />} />
          <Route path='/connectors/:connectorId' element={<ConnectorsPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Google Drive' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Open Website' }));
    expect(openExternalInvoke).toHaveBeenCalledWith('https://drive.google.com');
  });

  it('renders overview/config tabs and support sources for the clipboard connector', async () => {
    render(
      <MemoryRouter initialEntries={['/connectors/contextgo-clipboard']}>
        <Routes>
          <Route path='/connectors' element={<ConnectorsPage />} />
          <Route path='/connectors/:connectorId' element={<ConnectorsPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Overview' })).toBeInTheDocument();
    });

    expect(screen.getByText('Support Sources')).toBeInTheDocument();
    expect(screen.getByText('Connector Repository')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));

    await waitFor(() => {
      expect(screen.getByTestId('clipboard-connector-panel')).toBeInTheDocument();
    });
  });

  it('renders the Feishu sidecar panel on the Lark connector page after switching tabs', async () => {
    render(
      <MemoryRouter initialEntries={['/connectors/lark']}>
        <Routes>
          <Route path='/connectors' element={<ConnectorsPage />} />
          <Route path='/connectors/:connectorId' element={<ConnectorsPage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));

    await waitFor(() => {
      expect(screen.getByTestId('feishu-connector-panel')).toBeInTheDocument();
    });

    expect(screen.getByText('Feishu OpenAPI Runtime')).toBeInTheDocument();
    expect(screen.getByText('cli_xxx')).toBeInTheDocument();
  });

  it('renders the Google Drive sidecar panel on the google-drive connector page after switching tabs', async () => {
    render(
      <MemoryRouter initialEntries={['/connectors/google-drive']}>
        <Routes>
          <Route path='/connectors' element={<ConnectorsPage />} />
          <Route path='/connectors/:connectorId' element={<ConnectorsPage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));

    await waitFor(() => {
      expect(screen.getByTestId('google-drive-connector-panel')).toBeInTheDocument();
    });

    expect(screen.getByText('Google Drive Runtime')).toBeInTheDocument();
    expect(screen.getByText('google-client-id.apps.googleusercontent.com')).toBeInTheDocument();
    expect(screen.getByText('Drive Files (Stored)')).toBeInTheDocument();
    expect(screen.getAllByText('Roadmap').length).toBeGreaterThan(0);
  });

  it('keeps the connector list stable when category sections collapse', async () => {
    render(
      <MemoryRouter initialEntries={['/connectors/contextgo-clipboard']}>
        <Routes>
          <Route path='/connectors' element={<ConnectorsPage />} />
          <Route path='/connectors/:connectorId' element={<ConnectorsPage />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    );

    const categoryToggle = screen.getByRole('button', { name: /ContextGo Family/i });
    const clipboardButton = screen.getByRole('button', { name: /ContextGo Clipboard/i });

    expect(clipboardButton).toBeVisible();
    fireEvent.click(categoryToggle);
    expect(screen.getByTestId('location-probe')).toHaveTextContent('/connectors/contextgo-clipboard');
    expect(clipboardButton).not.toBeVisible();
  });
});
