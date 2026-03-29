import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const openExternalInvoke = vi.fn();

vi.mock('@/common', () => ({
  ipcBridge: {
    shell: {
      openExternal: {
        invoke: (...args: unknown[]) => openExternalInvoke(...args),
      },
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

    expect(screen.getAllByText(fallbackConnector.name).length).toBeGreaterThan(0);
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

    const gitHubButton = screen
      .getAllByRole('button')
      .find((button) => button.textContent?.includes('GitHub') && button.textContent?.includes('github.com'));

    expect(gitHubButton).toBeDefined();
    fireEvent.click(gitHubButton!);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'GitHub' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Open Website' }));

    expect(openExternalInvoke).toHaveBeenCalledWith('https://github.com');
  });

  it('renders the connector kind label on the same title row', () => {
    render(
      <MemoryRouter initialEntries={['/connectors/google-drive']}>
        <Routes>
          <Route path='/connectors' element={<ConnectorsPage />} />
          <Route path='/connectors/:connectorId' element={<ConnectorsPage />} />
        </Routes>
      </MemoryRouter>
    );

    const title = screen.getByRole('heading', { name: 'Connector' });
    const titleRow = title.parentElement;

    expect(titleRow).not.toBeNull();
    expect(titleRow).toHaveTextContent('Connector');
    expect(titleRow).toHaveTextContent('Context Connector');
  });

  it('renders ContextGo family connector metadata', async () => {
    render(
      <MemoryRouter initialEntries={['/connectors/contextgo-browser-extension']}>
        <Routes>
          <Route path='/connectors' element={<ConnectorsPage />} />
          <Route path='/connectors/:connectorId' element={<ConnectorsPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'ContextGo Browser Extension' })).toBeInTheDocument();
    });

    expect(screen.getAllByText('ContextGo Family').length).toBeGreaterThan(0);
    expect(screen.getByText('Browser History')).toBeInTheDocument();
    expect(screen.getByText('Web Pages')).toBeInTheDocument();
    expect(screen.getAllByText('Extension Pairing').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Open Website' }));

    expect(openExternalInvoke).toHaveBeenCalledWith('https://contextgo.io');
  });

  it('includes the expanded content-source connector catalog', () => {
    expect(CONNECTORS.map((connector) => connector.id)).toEqual(
      expect.arrayContaining([
        'arxiv',
        'reddit',
        'rss',
        'tianyancha',
        'wechat',
        'x',
        'xiaohongshu',
        'youtube',
        'chrome-history',
        'file-format',
        'search',
        'google-keep',
        'google-workspace-admin-export',
        'microsoft-365-graph',
        'onenote-export',
        'apple-notes-export',
        'evernote',
        'roam',
        'hacker-news',
        'linkedin',
        'product-hunt',
        'investment-database',
      ])
    );
  });

  it('toggles connector categories without removing connector actions from the DOM tree', async () => {
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

    fireEvent.click(categoryToggle);

    await waitFor(() => {
      expect(clipboardButton).toBeVisible();
    });
  });
});
