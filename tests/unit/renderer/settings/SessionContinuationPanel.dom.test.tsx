import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetBindingCatalogInvoke = vi.fn();
const mockGetActiveSessionCatalogInvoke = vi.fn();
const mockRefreshPublicationSnapshotInvoke = vi.fn();
const mockContinuationSessionInvoke = vi.fn();
const mockEndContinuationSessionInvoke = vi.fn();
const mockSetContinuationControlModeInvoke = vi.fn();
const messageError = vi.fn();
const messageSuccess = vi.fn();
const messageWarning = vi.fn();

const translations: Record<string, string> = {
  'settings.activeSessions.handoffTitle': 'Continue in IM',
  'settings.activeSessions.handoffDescription':
    'Reuse an existing IM object or hand off a conversation into a new one.',
  'settings.activeSessions.sourceTitle': 'Source',
  'settings.activeSessions.sourceDescription': 'Pick a conversation or session to continue from.',
  'settings.activeSessions.sourcePlaceholder': 'Select source',
  'settings.activeSessions.targetTitle': 'Target',
  'settings.activeSessions.targetDescription': 'Pick a channel instance and publish object.',
  'settings.activeSessions.connectorPlaceholder': 'Select connector',
  'settings.activeSessions.targetPlaceholder': 'Select target',
  'settings.activeSessions.mode.resume': 'Resume current thread',
  'settings.activeSessions.mode.newThread': 'Start new thread',
  'settings.activeSessions.mode.resumeHint': 'Resume in the current IM thread.',
  'settings.activeSessions.mode.newThreadHint': 'Start a new IM thread.',
  'settings.activeSessions.controlMode.imOwner': 'IM owner',
  'settings.activeSessions.controlMode.imObserver': 'Observer',
  'settings.activeSessions.controlMode.imOwnerHint': 'IM side keeps control.',
  'settings.activeSessions.controlMode.imObserverHint': 'Desktop keeps control.',
  'settings.activeSessions.submitResume': 'Resume in IM',
  'settings.activeSessions.submitNewThread': 'Start in new thread',
  'settings.activeSessions.loadFailed': 'Failed to load session continuation data',
  'settings.activeSessions.empty': 'No sessions',
  'settings.activeSessions.noConversation': 'No conversation',
  'settings.activeSessions.selectedTag': 'Selected',
  'settings.activeSessions.activeTag': 'Active',
  'settings.activeSessions.handoffTag': 'Handoff',
  'settings.activeSessions.useAsSource': 'Use as source',
  'common.refresh': 'Refresh',
};

const mockTranslate = (key: string) => translations[key] ?? key;

vi.mock('@/common/adapter/ipcBridge', () => ({
  channel: {
    getBindingCatalog: {
      invoke: (...args: unknown[]) => mockGetBindingCatalogInvoke(...args),
    },
    getActiveSessionCatalog: {
      invoke: (...args: unknown[]) => mockGetActiveSessionCatalogInvoke(...args),
    },
    refreshPublicationSnapshot: {
      invoke: (...args: unknown[]) => mockRefreshPublicationSnapshotInvoke(...args),
    },
    continuationSession: {
      invoke: (...args: unknown[]) => mockContinuationSessionInvoke(...args),
    },
    endContinuationSession: {
      invoke: (...args: unknown[]) => mockEndContinuationSessionInvoke(...args),
    },
    setContinuationControlMode: {
      invoke: (...args: unknown[]) => mockSetContinuationControlModeInvoke(...args),
    },
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: mockTranslate,
    i18n: { language: 'en-US' },
  }),
}));

type MockButtonProps = {
  children?: React.ReactNode;
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
};

type MockSelectOption = {
  value: string;
  label: React.ReactNode;
};

type MockSelectProps = {
  value?: string;
  options?: MockSelectOption[];
  onChange?: (value: string) => void;
  placeholder?: string;
};

vi.mock('@icon-park/react', () => ({
  Refresh: () => <span>refresh-icon</span>,
}));

vi.mock('@arco-design/web-react', () => ({
  Button: ({ children, onClick, loading, disabled, icon }: MockButtonProps) => (
    <button type='button' onClick={onClick} disabled={loading || disabled}>
      {icon}
      {children}
    </button>
  ),
  Empty: ({ description }: { description?: React.ReactNode }) => <div>{description}</div>,
  Message: {
    error: (...args: unknown[]) => messageError(...args),
    success: (...args: unknown[]) => messageSuccess(...args),
    warning: (...args: unknown[]) => messageWarning(...args),
  },
  Select: ({ value, options = [], onChange, placeholder }: MockSelectProps) => (
    <select
      value={value ?? ''}
      aria-label={placeholder ?? 'select'}
      onChange={(event) => onChange?.(event.target.value)}
    >
      <option value=''>{placeholder ?? 'empty'}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
  Spin: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

import SessionContinuationPanel from '@/renderer/components/settings/SettingsModal/contents/channels/SessionContinuationPanel';

const snapshotResponse = {
  success: true,
  data: {
    catalog: {
      connectors: [
        {
          id: 'connector-1',
          platform: 'lark',
          name: 'Feishu Ops',
          enabled: true,
          configured: true,
          status: 'running',
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      channelAccounts: [
        {
          id: 'connector-1',
          platform: 'lark',
          name: 'Feishu Ops',
          enabled: true,
          configured: true,
          status: 'running',
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      agentProfiles: [],
      bindings: [],
      audiences: [
        {
          key: 'group:ops-room',
          connectorId: 'connector-1',
          scopeType: 'group',
          title: 'Ops Room',
          subtitle: 'Lark group',
          displayName: 'Ops Room',
          remoteChatId: 'chat-1',
          remoteChatType: 'group',
          remoteUserId: null,
          platformChatId: 'oc_chat_1',
        },
      ],
      publishObjects: [],
    },
    activeSessions: [
      {
        id: 'session-1',
        connectorId: 'connector-1',
        connectorName: 'Feishu Ops',
        connectorPlatform: 'lark',
        audienceTitle: 'Ops Room',
        conversationId: 'conversation-1',
        workspace: 'Project Alpha',
        lastActivity: Date.now() - 60_000,
        agentType: 'codex',
        bindingTemporary: false,
      },
    ],
    refreshedAt: Date.now(),
  },
};

function renderPanel() {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/settings/continuation' } as const]}>
      <SessionContinuationPanel />
    </MemoryRouter>
  );
}

describe('SessionContinuationPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBindingCatalogInvoke.mockResolvedValue({ success: true, data: snapshotResponse.data.catalog });
    mockGetActiveSessionCatalogInvoke.mockResolvedValue({ success: true, data: snapshotResponse.data.activeSessions });
    mockRefreshPublicationSnapshotInvoke.mockResolvedValue(snapshotResponse);
    mockContinuationSessionInvoke.mockResolvedValue({ success: true, data: { id: 'continuation-1' } });
    mockEndContinuationSessionInvoke.mockResolvedValue({ success: true, data: true });
    mockSetContinuationControlModeInvoke.mockResolvedValue({ success: true, data: true });
  });

  it('loads source and target options via refreshPublicationSnapshot on first render', async () => {
    renderPanel();

    await screen.findByText('Continue in IM');
    await waitFor(() => expect(screen.getByText('Use as source')).toBeInTheDocument());

    expect(mockRefreshPublicationSnapshotInvoke).toHaveBeenCalled();
    expect(mockRefreshPublicationSnapshotInvoke).toHaveBeenLastCalledWith(undefined);
    expect(mockGetActiveSessionCatalogInvoke).not.toHaveBeenCalled();
    expect(mockGetBindingCatalogInvoke).not.toHaveBeenCalled();
  });

  it('reuses refreshPublicationSnapshot when the user manually refreshes', async () => {
    renderPanel();

    await waitFor(() => expect(mockRefreshPublicationSnapshotInvoke).toHaveBeenCalled());
    const callCountBeforeManualRefresh = mockRefreshPublicationSnapshotInvoke.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: /Refresh/ }));

    await waitFor(() =>
      expect(mockRefreshPublicationSnapshotInvoke.mock.calls.length).toBe(callCountBeforeManualRefresh + 1)
    );
    expect(mockGetActiveSessionCatalogInvoke).not.toHaveBeenCalled();
    expect(mockGetBindingCatalogInvoke).not.toHaveBeenCalled();
  });
});
