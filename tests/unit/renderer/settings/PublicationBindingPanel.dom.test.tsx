import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetBindingCatalogInvoke = vi.fn();
const mockGetActiveSessionCatalogInvoke = vi.fn();
const mockUpsertBindingInvoke = vi.fn();
const mockDeleteBindingInvoke = vi.fn();
const messageError = vi.fn();
const messageSuccess = vi.fn();

const translations: Record<string, string> = {
  'settings.channels.publication.intentTitle': 'Publish this Agent',
  'settings.channels.publication.intentDescription':
    'This page manages where the current Agent is published. The source conversation is only provenance.',
  'settings.channels.publication.intentProfile': 'Agent',
  'settings.channels.publication.intentConversation': 'Derived from',
  'settings.channels.publication.intentBackend': 'Runtime',
  'settings.channels.publication.intentWorkspace': 'Project',
  'settings.channels.publication.agentSelectorLabel': 'Agent',
  'settings.channels.publication.agentSummaryTitle': 'Current Agent',
  'settings.channels.publication.agentSummaryDescription':
    'Manage where this Agent is published across reusable IM channel instances.',
  'settings.channels.publication.summaryPublished': 'Published',
  'settings.channels.publication.summaryObjects': 'Objects',
  'settings.channels.publication.summarySessions': 'Sessions',
  'settings.channels.publication.objectListTitle': 'Published objects',
  'settings.channels.publication.objectListDescription':
    'Only the publish objects already bound to this Agent are shown here.',
  'settings.channels.publication.emptyPublishedObjects': 'This Agent is not published to any IM object yet',
  'settings.channels.publication.channelAccountInstanceLabel': 'Channel instance',
  'settings.channels.publication.sessionStatusLabel': 'Current project session',
  'settings.channels.publication.currentSessionActive': 'Active now',
  'settings.channels.publication.noActiveSession': 'No active session yet',
  'settings.channels.publication.objectParentLabel': 'Parent',
  'settings.channels.publication.sessionWorkspaceLabel': 'Project',
  'settings.channels.publication.sessionLastActiveLabel': 'Last active',
  'settings.channels.publication.addObjectButton': 'Add publish object',
  'settings.channels.publication.addObjectTitle': 'Add publish object',
  'settings.channels.publication.addObjectDescription':
    'Choose a channel instance first, then publish this Agent into one platform-native IM object.',
  'settings.channels.publication.connectorLabel': 'Channel instance',
  'settings.channels.publication.connectorPlaceholder': 'Select a channel instance',
  'settings.channels.publication.connectorRequired': 'Please select a usable channel account first',
  'settings.channels.publication.publishObjectLabel': 'Publish object',
  'settings.channels.publication.publishObjectPlaceholder': 'Select a publish object',
  'settings.channels.publication.publishObjectRequired': 'Please select a publish object first',
  'settings.channels.publication.agentRequired': 'Please select the Agent to publish',
  'settings.channels.publication.saveDurable': 'Publish Agent',
  'settings.channels.publication.updateDurable': 'Update publication',
  'settings.channels.publication.saveFailed': 'Failed to save publication binding',
  'settings.channels.publication.durableSaved': 'Agent publication saved',
  'settings.channels.publication.deleteFailed': 'Failed to delete publication binding',
  'settings.channels.publication.deleted': 'Publication binding deleted',
  'settings.channels.publication.noConnector': 'No channel account is available yet.',
  'settings.channels.publication.goToAccounts': 'Go to IM Channels',
  'settings.channels.publication.durableTag': 'Published',
  'settings.channels.publication.disabled': 'Disabled',
  'settings.channels.publication.connectorDefaultAudience': 'Channel account default entry',
  'settings.channels.publication.loadFailed': 'Failed to load publication bindings',
  'settings.channels.publication.objectKind.common.person': 'Person',
  'settings.channels.publication.objectKind.common.dm': 'Direct chat',
  'settings.channels.publication.objectKind.common.group': 'Group',
  'settings.channels.publication.objectKind.common.channel': 'Channel',
  'settings.channels.publication.objectKind.common.topic': 'Topic',
  'settings.channels.publication.objectKind.common.thread': 'Thread',
  'settings.channels.publication.objectKind.common.server': 'Server',
  'settings.channels.publication.objectKind.common.space': 'Workspace',
  'settings.channels.publication.objectKind.common.chat': 'Chat',
  'settings.channels.publication.objectKind.lark.topic': 'Topic',
  'settings.channels.publication.objectKind.slack.channel': 'Channel',
  'common.edit': 'Edit',
  'common.delete': 'Delete',
  'common.cancel': 'Cancel',
};

vi.mock('@/common/adapter/ipcBridge', () => ({
  channel: {
    getBindingCatalog: {
      invoke: (...args: unknown[]) => mockGetBindingCatalogInvoke(...args),
    },
    getActiveSessionCatalog: {
      invoke: (...args: unknown[]) => mockGetActiveSessionCatalogInvoke(...args),
    },
    upsertBinding: {
      invoke: (...args: unknown[]) => mockUpsertBindingInvoke(...args),
    },
    deleteBinding: {
      invoke: (...args: unknown[]) => mockDeleteBindingInvoke(...args),
    },
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: mockTranslate,
    i18n: { language: 'en-US' },
  }),
}));

const mockTranslate = (key: string) => translations[key] ?? key;

vi.mock('@icon-park/react', () => ({
  Delete: () => <span>delete-icon</span>,
  Edit: () => <span>edit-icon</span>,
  Plus: () => <span>plus-icon</span>,
  Undo: () => <span>undo-icon</span>,
}));

vi.mock('@arco-design/web-react', () => ({
  Button: ({ children, onClick, loading, disabled, icon }: any) => (
    <button type='button' onClick={onClick} disabled={loading || disabled}>
      {icon}
      {children}
    </button>
  ),
  Empty: ({ description }: { description?: React.ReactNode }) => <div>{description}</div>,
  Input: ({ value, onChange, placeholder }: any) => (
    <input value={value ?? ''} placeholder={placeholder} onChange={(event) => onChange?.(event.target.value)} />
  ),
  Message: {
    error: (...args: unknown[]) => messageError(...args),
    success: (...args: unknown[]) => messageSuccess(...args),
  },
  Select: ({ value, options = [], onChange, placeholder, allowClear }: any) => (
    <select
      value={value ?? ''}
      aria-label={placeholder ?? 'select'}
      onChange={(event) => onChange?.(event.target.value)}
    >
      {allowClear ? <option value=''>{placeholder ?? 'empty'}</option> : null}
      {options.map((option: any) => (
        <option key={String(option.value)} value={String(option.value)}>
          {option.label}
        </option>
      ))}
    </select>
  ),
  Spin: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  Tooltip: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

import PublicationBindingPanel from '@/renderer/components/settings/SettingsModal/contents/channels/publication/PublicationBindingPanel';

const catalogResponse = {
  success: true,
  data: {
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
      {
        id: 'connector-2',
        platform: 'slack',
        name: 'Slack Support',
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
      {
        id: 'connector-2',
        platform: 'slack',
        name: 'Slack Support',
        enabled: true,
        status: 'running',
        createdAt: 1000,
        updatedAt: 1000,
      },
    ],
    agentProfiles: [
      {
        id: 'agent-profile-1',
        name: 'Ops Agent',
        backend: 'codex',
        workspaceRef: '/tmp/workspace',
        version: 1,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        id: 'agent-profile-2',
        name: 'Published Support Agent',
        backend: 'openclaw-gateway',
        workspaceRef: '/tmp/support',
        publishedFromConversationId: 'conversation-2',
        version: 1,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      },
    ],
    bindings: [
      {
        id: 'binding-system-fallback',
        connectorId: 'connector-1',
        scopeType: 'connector_default',
        agentProfileId: 'agent-profile-1',
        priority: 0,
        enabled: true,
        temporary: false,
        metadata: { source: 'system-fallback-runtime' },
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        id: 'binding-topic-1',
        connectorId: 'connector-1',
        scopeType: 'remote_chat',
        scopeKey: 'feishu://topic/chat-topic/root-1',
        agentProfileId: 'agent-profile-1',
        priority: 10,
        enabled: true,
        temporary: false,
        metadata: { source: 'settings-publication-panel' },
        createdAt: 1200,
        updatedAt: 1200,
      },
    ],
    audiences: [
      {
        key: 'feishu://topic/chat-topic/root-1',
        connectorId: 'connector-1',
        scopeType: 'remote_chat',
        remoteChatId: 'feishu://topic/chat-topic/root-1',
        platformChatId: 'chat-topic',
        peerScope: 'thread',
        threadId: 'root-1',
        title: 'Ops topic',
        subtitle: 'Topic root 1',
        objectKey: 'feishu://topic/chat-topic/root-1',
        objectKind: 'topic',
        objectTitle: 'Ops topic',
        objectSubtitle: 'Topic root 1',
        parentObjectKey: 'chat-topic',
        parentObjectTitle: 'Core Ops Group',
        parentObjectKind: 'group',
        lastActive: 2000,
      },
      {
        key: 'slack://ws/team/channel/support',
        connectorId: 'connector-2',
        scopeType: 'remote_chat',
        remoteChatId: 'slack://ws/team/channel/support',
        platformChatId: 'C123',
        title: 'Support room',
        subtitle: 'Slack shared channel',
        objectKey: 'slack://ws/team/channel/support',
        objectKind: 'channel',
        objectTitle: 'Support room',
        objectSubtitle: 'Slack shared channel',
        lastActive: 1500,
      },
    ],
  },
};

const sessionCatalogResponse = {
  success: true,
  data: [
    {
      id: 'session-1',
      connectorId: 'connector-1',
      connectorName: 'Feishu Ops',
      connectorPlatform: 'lark',
      audienceTitle: 'Ops topic',
      audienceKey: 'feishu://topic/chat-topic/root-1',
      objectKey: 'feishu://topic/chat-topic/root-1',
      objectKind: 'topic',
      objectTitle: 'Ops topic',
      objectSubtitle: 'Topic root 1',
      parentObjectKey: 'chat-topic',
      parentObjectTitle: 'Core Ops Group',
      parentObjectKind: 'group',
      conversationId: 'conversation-ops-1',
      workspace: '/tmp/workspace',
      agentType: 'codex',
      createdAt: 1000,
      lastActivity: Date.now() - 5 * 60 * 1000,
      bindingId: 'binding-topic-1',
    },
  ],
};

function renderPanel(publicationIntent?: Record<string, unknown>, search = '') {
  return render(
    <MemoryRouter
      initialEntries={[{ pathname: '/', search, state: publicationIntent ? { publicationIntent } : undefined } as any]}
    >
      <PublicationBindingPanel />
    </MemoryRouter>
  );
}

describe('PublicationBindingPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBindingCatalogInvoke.mockResolvedValue(catalogResponse);
    mockGetActiveSessionCatalogInvoke.mockResolvedValue(sessionCatalogResponse);
    mockUpsertBindingInvoke.mockResolvedValue({ success: true });
    mockDeleteBindingInvoke.mockResolvedValue({ success: true });
  });

  it('shows the selected agent summary and only that agent published objects by default', async () => {
    renderPanel();

    await screen.findByText('Current Agent');

    expect(screen.getByText('Ops Agent')).toBeInTheDocument();
    expect(screen.getByText('Published objects')).toBeInTheDocument();
    expect(screen.getByText('Ops topic')).toBeInTheDocument();
    expect(screen.queryByText('Support room')).not.toBeInTheDocument();
    expect(screen.getByText(/Channel instance:\s*Feishu Ops/i)).toBeInTheDocument();
    expect(screen.getByText(/Current project session:\s*Active now/i)).toBeInTheDocument();
  });

  it('preselects the agent from publication intent and starts with an empty published-object list', async () => {
    renderPanel({
      conversationId: 'conversation-2',
      conversationName: 'Support triage',
      backend: 'openclaw-gateway',
      workspace: '/tmp/support',
      agentName: 'Published Support Agent',
    });

    await screen.findByText('Publish this Agent');

    expect(screen.getByText('Support triage')).toBeInTheDocument();
    expect(screen.getByDisplayValue('agent-profile-2')).toBeInTheDocument();
    expect(screen.getByText('This Agent is not published to any IM object yet')).toBeInTheDocument();
  });

  it('adds a new publication from the selected agent into a platform-native publish object', async () => {
    renderPanel({
      conversationId: 'conversation-2',
      conversationName: 'Support triage',
      backend: 'openclaw-gateway',
      workspace: '/tmp/support',
      agentName: 'Published Support Agent',
    });

    await screen.findByText('Current Agent');

    fireEvent.click(screen.getByRole('button', { name: /Add publish object/i }));

    fireEvent.change(screen.getByRole('combobox', { name: 'Select a channel instance' }), {
      target: { value: 'connector-2' },
    });

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Select a publish object' })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole('combobox', { name: 'Select a publish object' }), {
      target: { value: 'slack://ws/team/channel/support' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Publish Agent/i }));

    await waitFor(() => {
      expect(mockUpsertBindingInvoke).toHaveBeenCalledWith({
        binding: expect.objectContaining({
          connectorId: 'connector-2',
          scopeType: 'remote_chat',
          scopeKey: 'slack://ws/team/channel/support',
          agentProfileId: 'agent-profile-2',
          metadata: expect.objectContaining({
            publishObject: {
              nativeObjectType: 'channel',
              nativeObjectId: 'slack://ws/team/channel/support',
              parentNativeObjectId: undefined,
              displayName: 'Support room',
              discoverySource: 'inbound-learned',
            },
          }),
        }),
      });
    });
  });

  it('deletes one published object from the selected agent', async () => {
    const catalogAfterDelete = {
      ...catalogResponse,
      data: {
        ...catalogResponse.data,
        bindings: [catalogResponse.data.bindings[0]],
      },
    };

    mockGetBindingCatalogInvoke.mockResolvedValueOnce(catalogResponse).mockResolvedValueOnce(catalogAfterDelete);

    renderPanel();

    await screen.findByText('Ops topic');

    fireEvent.click(screen.getByText('delete-icon').closest('button') as HTMLButtonElement);

    await waitFor(() => {
      expect(mockDeleteBindingInvoke).toHaveBeenCalledWith({ bindingId: 'binding-topic-1' });
      expect(mockGetBindingCatalogInvoke).toHaveBeenCalledTimes(2);
    });
  });

  it('restores publication intent from url query after refresh', async () => {
    renderPanel(
      undefined,
      '?conversationId=conversation-2&conversationName=Support%20triage&backend=openclaw-gateway&workspace=%2Ftmp%2Fsupport&agentName=Published%20Support%20Agent'
    );

    await screen.findByText('Publish this Agent');

    expect(screen.getByText('Support triage')).toBeInTheDocument();
    expect(screen.getByDisplayValue('agent-profile-2')).toBeInTheDocument();
  });
});
