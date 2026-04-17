import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetBindingCatalogInvoke = vi.fn();
const mockGetActiveSessionCatalogInvoke = vi.fn();
const mockRefreshPublicationCatalogInvoke = vi.fn();
const mockContinuationSessionInvoke = vi.fn();
const mockEndContinuationSessionInvoke = vi.fn();
const mockSetContinuationControlModeInvoke = vi.fn();
const messageError = vi.fn();
const messageSuccess = vi.fn();
const messageWarning = vi.fn();

const translations: Record<string, string> = {
  'settings.activeSessions.handoffTitle': 'Continue in IM',
  'settings.activeSessions.handoffDescription':
    'Choose one source session or conversation, then continue it in an IM target object.',
  'settings.activeSessions.sourceTitle': 'Source',
  'settings.activeSessions.sourceDescription': 'Choose a source conversation or session to continue.',
  'settings.activeSessions.targetTitle': 'Target',
  'settings.activeSessions.targetDescription': 'Choose which IM object should host the continued session.',
  'settings.activeSessions.connectorPlaceholder': 'Select a channel instance',
  'settings.activeSessions.targetPlaceholder': 'Select a target object',
  'settings.activeSessions.sourcePlaceholder': 'Select a source',
  'settings.activeSessions.selectedTag': 'Selected',
  'settings.activeSessions.activeTag': 'Active',
  'settings.activeSessions.useAsSource': 'Use as source',
  'settings.activeSessions.noConversation': 'No conversation',
  'settings.activeSessions.empty': 'No active sessions',
  'settings.activeSessions.loadFailed': 'Failed to load continuation data',
  'settings.activeSessions.sourceRequired': 'Source required',
  'settings.activeSessions.connectorRequired': 'Connector required',
  'settings.activeSessions.targetRequired': 'Target required',
  'settings.activeSessions.handoffNow': 'Continue now',
  'settings.activeSessions.mode.resume': 'Resume',
  'settings.activeSessions.mode.newThread': 'New thread',
  'settings.activeSessions.controlMode.imOwner': 'IM owner',
  'settings.activeSessions.controlMode.imObserver': 'IM observer',
  'settings.activeSessions.controlMode.desktopOwner': 'Desktop owner',
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
    refreshPublicationCatalog: {
      invoke: (...args: unknown[]) => mockRefreshPublicationCatalogInvoke(...args),
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
      {placeholder ? <option value=''>{placeholder}</option> : null}
      {options.map((option) => (
        <option key={String(option.value)} value={String(option.value)}>
          {option.label}
        </option>
      ))}
    </select>
  ),
  Spin: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

import SessionContinuationPanel from '@/renderer/components/settings/SettingsModal/contents/channels/SessionContinuationPanel';

const refreshSnapshotResponse = {
  success: true,
  data: {
    bindingCatalog: {
      connectors: [
        {
          id: 'connector-1',
          platform: 'lark',
          name: 'Feishu Ops',
          enabled: true,
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
          status: 'running',
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      agentProfiles: [],
      bindings: [],
      audiences: [
        {
          connectorId: 'connector-1',
          scopeType: 'remote_chat',
          key: 'chat:ops-room',
          title: 'Ops room',
          displayName: 'Ops room',
          subtitle: 'Incident bridge',
          remoteChatId: 'chat:ops-room',
          platformChatId: 'oc_group_1',
          remoteChatType: 'group',
          objectKey: 'chat:ops-room',
          objectKind: 'group',
          objectTitle: 'Ops room',
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      publishObjects: [],
    },
    activeSessions: [
      {
        id: 'session-1',
        externalSessionId: 'session-1',
        connectorId: 'connector-1',
        connectorName: 'Feishu Ops',
        connectorPlatform: 'lark',
        audienceKey: 'chat:ops-room',
        audienceTitle: 'Ops room',
        conversationId: 'conversation-1',
        workspace: '/tmp/workspace',
        agentType: 'codex',
        bindingTemporary: false,
        lastActivity: Date.now(),
      },
    ],
  },
};

describe('SessionContinuationPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRefreshPublicationCatalogInvoke.mockResolvedValue(refreshSnapshotResponse);
    mockGetBindingCatalogInvoke.mockResolvedValue({
      success: true,
      data: refreshSnapshotResponse.data.bindingCatalog,
    });
    mockGetActiveSessionCatalogInvoke.mockResolvedValue({
      success: true,
      data: refreshSnapshotResponse.data.activeSessions,
    });
    mockContinuationSessionInvoke.mockResolvedValue({ success: true, data: { targetExternalSessionId: 'session-2' } });
    mockEndContinuationSessionInvoke.mockResolvedValue({
      success: true,
      data: { targetExternalSessionId: 'session-1' },
    });
    mockSetContinuationControlModeInvoke.mockResolvedValue({
      success: true,
      data: { targetExternalSessionId: 'session-1' },
    });
  });

  it('loads continuation data from the explicit publication snapshot instead of stitching catalog and sessions separately', async () => {
    render(
      <MemoryRouter>
        <SessionContinuationPanel />
      </MemoryRouter>
    );

    await screen.findByText('Continue in IM');

    expect(mockRefreshPublicationCatalogInvoke).toHaveBeenCalledTimes(1);
    expect(mockGetBindingCatalogInvoke).not.toHaveBeenCalled();
    expect(mockGetActiveSessionCatalogInvoke).not.toHaveBeenCalled();
    expect(screen.getByRole('combobox', { name: 'Select a source' })).toHaveValue('session:session-1');
    expect(screen.getByRole('combobox', { name: 'Select a channel instance' })).toHaveValue('connector-1');
  });

  it('refreshes the continuation view via the explicit publication snapshot provider', async () => {
    render(
      <MemoryRouter>
        <SessionContinuationPanel />
      </MemoryRouter>
    );

    await screen.findByText('Continue in IM');

    fireEvent.click(screen.getByRole('button', { name: /Refresh/i }));

    await waitFor(() => {
      expect(mockRefreshPublicationCatalogInvoke).toHaveBeenCalledTimes(2);
    });
    expect(mockGetBindingCatalogInvoke).not.toHaveBeenCalled();
    expect(mockGetActiveSessionCatalogInvoke).not.toHaveBeenCalled();
  });
});
