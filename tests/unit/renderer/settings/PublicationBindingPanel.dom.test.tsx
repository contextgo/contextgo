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
  'settings.channels.publication.connectorLabel': '1. Choose a usable channel account',
  'settings.channels.publication.connectorGuide': 'Only usable channel accounts are shown here.',
  'settings.channels.publication.connectorRequired': 'Please select a usable channel account first',
  'settings.channels.publication.agentRequired': 'Please select the Agent to publish',
  'settings.channels.publication.agentPlaceholder': 'Select the published Agent',
  'settings.channels.publication.audiencePlaceholder': 'Select a discovered target',
  'settings.channels.publication.scopeKeyRequired': 'Please select or enter a target key',
  'settings.channels.publication.scopeKeyRemoteUserPlaceholder': 'Remote user key',
  'settings.channels.publication.scopeKeyRemoteChatPlaceholder': 'Audience key',
  'settings.channels.publication.manualKeyHint': 'Manual target keys are only for undiscovered audiences.',
  'settings.channels.publication.manualScopeToggle': 'Enter target key manually',
  'settings.channels.publication.saveDurable': 'Save durable publication',
  'settings.channels.publication.updateDurable': 'Update durable publication',
  'settings.channels.publication.saveFailed': 'Failed to save publication binding',
  'settings.channels.publication.durableSaved': 'Durable publication saved',
  'settings.channels.publication.deleteFailed': 'Failed to delete publication binding',
  'settings.channels.publication.deleted': 'Publication binding deleted',
  'settings.channels.publication.noConnector': 'No channel account is available yet.',
  'settings.channels.publication.editingDurable': 'Editing durable binding',
  'settings.channels.publication.durableTag': 'Long-term',
  'settings.channels.publication.disabled': 'Disabled',
  'settings.channels.publication.connectorDefaultAudience': 'Channel account default entry',
  'settings.channels.publication.loadFailed': 'Failed to load publication bindings',
  'settings.channels.publication.scope.connectorDefault': 'Entire channel account',
  'settings.channels.publication.scope.remoteUser': 'Specific user / DM',
  'settings.channels.publication.scope.remoteChat': 'Specific group / channel / topic',
  'settings.channels.publication.scope.connector_default': 'Entire channel account',
  'settings.channels.publication.scope.remote_user': 'Specific user / DM',
  'settings.channels.publication.scope.remote_chat': 'Specific group / channel / topic',
  'settings.channels.publication.intentTitle': 'Publish this Agent as a reusable entry',
  'settings.channels.publication.intentDescription':
    'This page publishes a reusable Agent from a specific workspace and runtime. The source conversation is only provenance, not the thing being published.',
  'settings.channels.publication.intentProfile': 'Agent profile',
  'settings.channels.publication.intentConversation': 'Derived from',
  'settings.channels.publication.intentBackend': 'Agent type / runtime',
  'settings.channels.publication.intentWorkspace': 'Workspace',
  'settings.channels.publication.connectorGuide.weixin': 'WeChat guide',
  'settings.channels.publication.connectorGuide.multiSession': 'Multi-session guide',
  'settings.channels.publication.targetTypeLabel': '2. Publish target type',
  'settings.channels.publication.targetTypeHint.connectorDefault': 'Share one default Agent entry.',
  'settings.channels.publication.targetTypeHint.remoteUser': 'One person gets one entry.',
  'settings.channels.publication.targetTypeHint.remoteChat': 'One group or topic gets one entry.',
  'settings.channels.publication.summaryAudiences': 'Audiences',
  'settings.channels.publication.summaryPublished': 'Published',
  'settings.channels.publication.summaryObjects': 'Objects',
  'settings.channels.publication.summarySessions': 'Sessions',
  'settings.channels.publication.accountOverview':
    'Manage the long-term Agent entries on this channel account and the conversations they receive.',
  'settings.channels.publication.objectListTitle': 'Published objects',
  'settings.channels.publication.objectListDescription':
    'Review the platform-native IM objects already discovered or published on this channel account.',
  'settings.channels.publication.emptyObjects': 'No IM objects discovered yet',
  'settings.channels.publication.objectDetailTitle': 'Object details',
  'settings.channels.publication.objectDetailDescription':
    'Inspect this specific IM object, its publication rules, and the sessions already linked to it.',
  'settings.channels.publication.objectParentLabel': 'Parent',
  'settings.channels.publication.objectPublishedTitle': 'Publication bindings',
  'settings.channels.publication.objectPublishedDescription':
    'These long-term rules publish an Agent into this specific IM object.',
  'settings.channels.publication.objectPublishedEmpty': 'This object has no publication bindings yet',
  'settings.channels.publication.objectSessionsTitle': 'Related sessions',
  'settings.channels.publication.objectSessionsDescription':
    'Sessions already associated with this IM object through the selected channel account.',
  'settings.channels.publication.objectSessionsEmpty': 'No sessions have been created for this object yet',
  'settings.channels.publication.sessionWorkspaceLabel': 'Workspace',
  'settings.channels.publication.sessionLastActiveLabel': 'Last active',
  'settings.channels.publication.sessionAgentTypeLabel': 'Agent type',
  'settings.channels.publication.addTargetTitle': 'Add publication',
  'settings.channels.publication.addTargetDescription':
    'Pick the target first, then publish the Agent above there long-term. New messages from that target will route into this Agent.',
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
        backend: 'openclaw-gateway',
        version: 1,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        id: 'agent-profile-2',
        name: 'Published Support Agent',
        backend: 'openclaw-gateway',
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

  it('shows object list and related sessions for the selected IM object', async () => {
    renderPanel();

    await screen.findByText('Published objects');

    expect(screen.getAllByText('Ops topic').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /Ops topic/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/Parent:\s*Core Ops Group/i).length).toBeGreaterThan(0);
      expect(screen.getByText('Related sessions')).toBeInTheDocument();
      expect(screen.getByText('conversation-ops-1')).toBeInTheDocument();
      expect(screen.getByText(/Workspace:\s*\/tmp\/workspace/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Slack Support/i }));

    const [supportRoomButton] = await screen.findAllByRole('button', { name: /Support room/i });
    fireEvent.click(supportRoomButton);

    await waitFor(() => {
      expect(screen.getAllByText('Support room').length).toBeGreaterThan(0);
      expect(screen.getByText('This object has no publication bindings yet')).toBeInTheDocument();
      expect(screen.getByText('No sessions have been created for this object yet')).toBeInTheDocument();
    });
  });

  it('preselects the published agent from publication intent and scopes the editor from the selected object', async () => {
    renderPanel({
      conversationId: 'conversation-2',
      conversationName: 'Support triage',
      backend: 'openclaw-gateway',
      workspace: '/tmp/support',
      agentName: 'Published Support Agent',
    });

    await screen.findByText('Publish this Agent as a reusable entry');

    expect(screen.getByText(/Derived from:/i)).toBeInTheDocument();
    expect(screen.getByText('Support triage')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByRole('combobox')[1]).toHaveValue('agent-profile-2');
    });

    fireEvent.click(screen.getByRole('button', { name: /Ops topic/i }));

    await waitFor(() => {
      const comboboxes = screen.getAllByRole('combobox');
      expect(comboboxes[0]).toHaveValue('remote_chat');
      expect(comboboxes[1]).toHaveValue('feishu://topic/chat-topic/root-1');
    });
  });

  it('saves a durable publication for the selected object', async () => {
    renderPanel();

    await screen.findByText('Published objects');

    fireEvent.click(screen.getByRole('button', { name: /Slack Support/i }));

    const [supportRoomButton] = await screen.findAllByRole('button', { name: /Support room/i });
    fireEvent.click(supportRoomButton);

    await waitFor(() => {
      const comboboxes = screen.getAllByRole('combobox');
      expect(comboboxes[0]).toHaveValue('remote_chat');
      expect(comboboxes[1]).toHaveValue('slack://ws/team/channel/support');
    });

    fireEvent.click(screen.getByRole('button', { name: /Save durable publication/i }));

    await waitFor(() => {
      expect(mockUpsertBindingInvoke).toHaveBeenCalledWith({
        binding: expect.objectContaining({
          connectorId: 'connector-2',
          scopeType: 'remote_chat',
          scopeKey: 'slack://ws/team/channel/support',
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

  it('deletes an existing publication binding from the selected object', async () => {
    const catalogAfterDelete = {
      ...catalogResponse,
      data: {
        ...catalogResponse.data,
        bindings: [catalogResponse.data.bindings[0]],
      },
    };

    mockGetBindingCatalogInvoke.mockResolvedValueOnce(catalogResponse).mockResolvedValueOnce(catalogAfterDelete);

    renderPanel();

    await screen.findByText('Publication bindings');
    expect(screen.getByText('Ops Agent')).toBeInTheDocument();

    fireEvent.click(screen.getByText('delete-icon').closest('button') as HTMLButtonElement);

    await waitFor(() => {
      expect(mockGetBindingCatalogInvoke).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(screen.getByText('This object has no publication bindings yet')).toBeInTheDocument();
    });
  });

  it('restores publication intent from url query after refresh', async () => {
    renderPanel(
      undefined,
      '?conversationId=conversation-2&conversationName=Support%20triage&backend=openclaw-gateway&workspace=%2Ftmp%2Fsupport&agentName=Published%20Support%20Agent'
    );

    await screen.findByText('Publish this Agent as a reusable entry');

    expect(screen.getByText(/Derived from:/i)).toBeInTheDocument();
    expect(screen.getByText('Support triage')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByRole('combobox')[1]).toHaveValue('agent-profile-2');
    });
  });
});
