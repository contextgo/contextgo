import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetBindingCatalogInvoke = vi.fn();
const mockGetActiveSessionCatalogInvoke = vi.fn();
const mockRefreshPublicationSnapshotInvoke = vi.fn();
const mockUpsertPublicationInvoke = vi.fn();
const mockDeletePublicationInvoke = vi.fn();
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
  'settings.channels.publication.discoveryStatusLabel': 'Discovery status',
  'settings.channels.publication.discoveryHintOfficial':
    '{{count}} objects are available from channel discovery for this instance.',
  'settings.channels.publication.discoveryHintLearned':
    '{{count}} objects are available from recent IM activity for this instance.',
  'settings.channels.publication.discoveryHintEmpty': 'No publish objects have been discovered for this instance yet.',
  'settings.channels.publication.discoveryHintEmptyAction': 'Use manual fallback',
  'settings.channels.publication.discoveryHintEmptyHelp':
    'Use a target key directly, or let the target speak in IM first so ContextGo can learn it.',
  'settings.channels.publication.capabilityTitle': 'Platform capabilities',
  'settings.channels.publication.capabilityDescription':
    'These are the native command and interaction surfaces this platform can expose for the current publication flow.',
  'settings.channels.publication.capabilityWeixinBoundary':
    'This WeChat integration is a constrained bridge surface. Do not expect the same official command, menu, or management surfaces available on official bot platforms.',
  'settings.channels.publication.capabilityIntegrationOfficial': 'Official bot platform',
  'settings.channels.publication.capabilityIntegrationBridge': 'Bridge-limited platform',
  'settings.channels.publication.capabilityDiscoveryOfficial': 'Official object directory',
  'settings.channels.publication.capabilityDiscoveryMixed': 'Mixed discovery',
  'settings.channels.publication.capabilityDiscoveryLearned': 'Learned / manual discovery',
  'settings.channels.publication.capabilitySurface.command': 'Native commands',
  'settings.channels.publication.capabilitySurface.menu': 'Menu entry',
  'settings.channels.publication.capabilitySurface.messageButtons': 'Message buttons',
  'settings.channels.publication.capabilitySurface.cardActions': 'Card actions',
  'settings.channels.publication.capabilitySurface.threadReply': 'Thread-aware replies',
  'settings.channels.publication.capabilitySurface.none': 'No official command surface',
  'settings.channels.publication.optionSourceOfficial': 'Synced directory',
  'settings.channels.publication.optionSourceLearned': 'Recent activity',
  'settings.channels.publication.optionSourceManual': 'Manual target',
  'settings.channels.publication.scope.remoteUser': 'Specific user / DM',
  'settings.channels.publication.scope.remoteChat': 'Specific group / channel / topic',
  'settings.channels.publication.scopeKeyRemoteUserPlaceholder': 'Remote user key, for example: user_123456',
  'settings.channels.publication.scopeKeyRemoteChatPlaceholder':
    'Audience key, for example: group:alpha or -100123456:thread:9',
  'settings.channels.publication.manualKeyHint':
    'Let the target speak in IM first when possible. Manual target keys are only for audiences that have not been discovered yet.',
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
  'settings.channels.publication.objectQualityFallback': 'Needs identification',
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
  'common.refresh': 'Refresh',
};

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
    upsertPublication: {
      invoke: (...args: unknown[]) => mockUpsertPublicationInvoke(...args),
    },
    deletePublication: {
      invoke: (...args: unknown[]) => mockDeletePublicationInvoke(...args),
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

type MockButtonProps = {
  children?: React.ReactNode;
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
};

type MockInputProps = {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
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
  allowClear?: boolean;
};

vi.mock('@icon-park/react', () => ({
  Delete: () => <span>delete-icon</span>,
  Edit: () => <span>edit-icon</span>,
  Plus: () => <span>plus-icon</span>,
  Refresh: () => <span>refresh-icon</span>,
  Undo: () => <span>undo-icon</span>,
}));

vi.mock('@arco-design/web-react', () => ({
  Button: ({ children, onClick, loading, disabled, icon }: MockButtonProps) => (
    <button type='button' onClick={onClick} disabled={loading || disabled}>
      {icon}
      {children}
    </button>
  ),
  Empty: ({ description }: { description?: React.ReactNode }) => <div>{description}</div>,
  Input: ({ value, onChange, placeholder }: MockInputProps) => (
    <input value={value ?? ''} placeholder={placeholder} onChange={(event) => onChange?.(event.target.value)} />
  ),
  Message: {
    error: (...args: unknown[]) => messageError(...args),
    success: (...args: unknown[]) => messageSuccess(...args),
  },
  Select: ({ value, options = [], onChange, placeholder, allowClear }: MockSelectProps) => (
    <select
      value={value ?? ''}
      aria-label={placeholder ?? 'select'}
      onChange={(event) => onChange?.(event.target.value)}
    >
      {allowClear ? <option value=''>{placeholder ?? 'empty'}</option> : null}
      {options.map((option) => (
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
      {
        id: 'connector-3',
        platform: 'weixin',
        name: 'WeChat Personal',
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
      {
        id: 'connector-3',
        platform: 'weixin',
        name: 'WeChat Personal',
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
        channelAccountId: 'connector-1',
        scopeType: 'channel_account_default',
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
        channelAccountId: 'connector-1',
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
        channelAccountId: 'connector-1',
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
        objectSource: 'inbound-learned',
        objectQuality: 'fallback',
        lastActive: 2000,
      },
      {
        key: 'feishu://topic/chat-topic/root-2',
        channelAccountId: 'connector-1',
        scopeType: 'remote_chat',
        remoteChatId: 'feishu://topic/chat-topic/root-2',
        platformChatId: 'chat-topic',
        peerScope: 'thread',
        threadId: 'root-2',
        title: 'Release topic',
        subtitle: 'Topic root 2',
        objectKey: 'feishu://topic/chat-topic/root-2',
        objectKind: 'topic',
        objectTitle: 'Release topic',
        objectSubtitle: 'Topic root 2',
        parentObjectKey: 'chat-topic',
        parentObjectTitle: 'Core Ops Group',
        parentObjectKind: 'group',
        publishObjectCatalogEntryId: 'connector-1::topic::feishu://topic/chat-topic/root-2::chat-topic',
        objectSource: 'inbound-learned',
        objectQuality: 'resolved',
        lastActive: 1800,
      },
      {
        key: 'slack://ws/team/channel/support',
        channelAccountId: 'connector-2',
        scopeType: 'remote_chat',
        remoteChatId: 'slack://ws/team/channel/support',
        platformChatId: 'C123',
        title: 'Support room',
        subtitle: 'Slack shared channel',
        objectKey: 'slack://ws/team/channel/support',
        objectKind: 'channel',
        objectTitle: 'Support room',
        objectSubtitle: 'Slack shared channel',
        objectSource: 'official-pull',
        lastActive: 1500,
      },
    ],
    discoverySummaries: [
      {
        channelAccountId: 'connector-1',
        state: 'learned',
        discoveredCount: 2,
      },
      {
        channelAccountId: 'connector-2',
        state: 'official',
        discoveredCount: 1,
      },
      {
        channelAccountId: 'connector-3',
        state: 'empty',
        discoveredCount: 0,
      },
    ],
    capabilitySummaries: [
      {
        channelAccountId: 'connector-1',
        integrationModel: 'official-bot-platform',
        discoveryMode: 'official-pull',
        actionSurfaces: ['menu-entry', 'card-action-callbacks', 'thread-aware-reply'],
      },
      {
        channelAccountId: 'connector-2',
        integrationModel: 'official-bot-platform',
        discoveryMode: 'official-pull',
        actionSurfaces: ['native-command-entry', 'message-action-buttons', 'thread-aware-reply'],
      },
      {
        channelAccountId: 'connector-3',
        integrationModel: 'bridge-limited',
        discoveryMode: 'learned-manual',
        actionSurfaces: [],
      },
    ],
  },
};

const sessionCatalogResponse = {
  success: true,
  data: [
    {
      id: 'session-1',
      channelAccountId: 'connector-1',
      channelAccountName: 'Feishu Ops',
      channelAccountPlatform: 'lark',
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

const publicationEntryPublishObject = {
  id: 'connector-1::topic::feishu://topic/chat-topic/root-1::chat-topic',
  channelAccountId: 'connector-1',
  nativeObjectType: 'topic',
  nativeObjectId: 'feishu://topic/chat-topic/root-1',
  parentNativeObjectId: 'chat-topic',
  displayProfile: {
    title: 'Ops topic',
    subtitle: 'Topic root 1',
    parentTitle: 'Core Ops Group',
    source: 'inbound-learned',
    quality: 'fallback',
    resolvedAt: 2000,
  },
  refreshState: {
    status: 'needs-refresh',
    reason: 'technical-fallback',
    updatedAt: 2000,
  },
  createdAt: 1200,
  updatedAt: 2000,
};

const publicationSnapshotResponse = {
  success: true,
  data: {
    catalog: {
      ...catalogResponse.data,
      publications: [
        {
          id: 'binding-topic-1',
          agentProfileId: 'agent-profile-1',
          channelAccountId: 'connector-1',
          channelAccountName: 'Feishu Ops',
          channelAccountPlatform: 'lark',
          enabled: true,
          createdAt: 1000,
          updatedAt: 1200,
          binding: catalogResponse.data.bindings[1],
          publishObject: publicationEntryPublishObject,
          currentSession: sessionCatalogResponse.data[0],
        },
      ],
    },
    activeSessions: sessionCatalogResponse.data,
    refreshedAt: 2000,
  },
};

function renderPanel(publicationIntent?: Record<string, unknown>, search = '') {
  const initialEntries: React.ComponentProps<typeof MemoryRouter>['initialEntries'] = [
    { pathname: '/', search, state: publicationIntent ? { publicationIntent } : undefined },
  ];

  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <PublicationBindingPanel />
    </MemoryRouter>
  );
}

describe('PublicationBindingPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBindingCatalogInvoke.mockResolvedValue(catalogResponse);
    mockGetActiveSessionCatalogInvoke.mockResolvedValue(sessionCatalogResponse);
    mockRefreshPublicationSnapshotInvoke.mockResolvedValue(publicationSnapshotResponse);
    mockUpsertPublicationInvoke.mockResolvedValue({ success: true });
    mockDeletePublicationInvoke.mockResolvedValue({ success: true });
  });

  it('shows the selected agent summary and only that agent published objects by default', async () => {
    renderPanel();

    await screen.findByText('Ops Agent');

    expect(screen.getByText('Ops Agent')).toBeInTheDocument();
    expect(screen.getByText('Published objects')).toBeInTheDocument();
    expect(screen.getByText('Ops topic')).toBeInTheDocument();
    expect(screen.queryByText('Support room')).not.toBeInTheDocument();
    expect(screen.getByText(/Channel instance:\s*Feishu Ops/i)).toBeInTheDocument();
    expect(screen.getByText(/Current project session:\s*Active now/i)).toBeInTheDocument();
  });

  it('shows an explicit fallback badge when a published object still relies on low-confidence identity', async () => {
    renderPanel();

    await screen.findByText('Ops topic');

    expect(screen.getByText('Needs identification')).toBeInTheDocument();
  });

  it('renders published objects from explicit publication entries even without audience reconstruction', async () => {
    mockRefreshPublicationSnapshotInvoke.mockResolvedValueOnce({
      success: true,
      data: {
        catalog: {
          ...catalogResponse.data,
          audiences: [],
          publications: [
            {
              id: 'binding-topic-1',
              agentProfileId: 'agent-profile-1',
              channelAccountId: 'connector-1',
              channelAccountName: 'Feishu Ops',
              channelAccountPlatform: 'lark',
              enabled: true,
              createdAt: 1000,
              updatedAt: 1200,
              binding: catalogResponse.data.bindings[1],
              publishObject: publicationEntryPublishObject,
              currentSession: sessionCatalogResponse.data[0],
            },
          ],
        },
        activeSessions: sessionCatalogResponse.data,
        refreshedAt: 2000,
      },
    });

    renderPanel();

    await screen.findByText('Ops topic');

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
    await waitFor(() => {
      expect(screen.getAllByRole('combobox')[0]).toHaveValue('agent-profile-2');
    });
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
    expect(screen.getByText('Platform capabilities')).toBeInTheDocument();
    expect(screen.getByText('Official bot platform')).toBeInTheDocument();
    expect(screen.getByText('Official object directory')).toBeInTheDocument();
    expect(screen.getByText('Discovery status')).toBeInTheDocument();
    expect(
      screen.getByText('{{count}} objects are available from channel discovery for this instance.')
    ).toBeInTheDocument();
    expect(screen.getByText('Support room · Channel · Synced directory · Slack shared channel')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Select a publish object' }), {
      target: { value: 'slack://ws/team/channel/support' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Publish Agent/i }));

    await waitFor(() => {
      expect(mockUpsertPublicationInvoke).toHaveBeenCalledWith({
        publication: expect.objectContaining({
          channelAccountId: 'connector-2',
          scopeType: 'remote_chat',
          scopeKey: 'slack://ws/team/channel/support',
          agentProfileId: 'agent-profile-2',
          publishObject: {
            nativeObjectType: 'channel',
            nativeObjectId: 'slack://ws/team/channel/support',
            parentNativeObjectId: undefined,
            displayName: 'Support room',
            discoverySource: 'inbound-learned',
          },
        }),
      });
    });
  });

  it('surfaces a manual fallback action when no publish objects have been discovered', async () => {
    renderPanel();

    await screen.findByText('Ops Agent');

    fireEvent.click(screen.getByRole('button', { name: /Add publish object/i }));

    fireEvent.change(screen.getByRole('combobox', { name: 'Select a channel instance' }), {
      target: { value: 'connector-3' },
    });

    expect(screen.getByText('No publish objects have been discovered for this instance yet.')).toBeInTheDocument();
    expect(
      screen.getByText('Use a target key directly, or let the target speak in IM first so ContextGo can learn it.')
    ).toBeInTheDocument();
    expect(screen.getByText('Bridge-limited platform')).toBeInTheDocument();
    expect(screen.getByText('Learned / manual discovery')).toBeInTheDocument();
    expect(screen.getByText('No official command surface')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Use manual fallback' }));

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('Audience key, for example: group:alpha or -100123456:thread:9')
      ).toBeInTheDocument();
    });
  });

  it('prefers process-provided discovery summary over audience-level inference', async () => {
    renderPanel();

    await screen.findByText('Ops Agent');

    fireEvent.click(screen.getByRole('button', { name: /Add publish object/i }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Select a channel instance' }), {
      target: { value: 'connector-2' },
    });

    await waitFor(() => {
      expect(
        screen.getByText('{{count}} objects are available from channel discovery for this instance.')
      ).toBeInTheDocument();
    });
  });

  it('sorts learned publish object options by quality before recency', async () => {
    renderPanel();

    await screen.findByText('Ops Agent');

    fireEvent.click(screen.getByRole('button', { name: /Add publish object/i }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Select a channel instance' }), {
      target: { value: 'connector-1' },
    });

    const optionTexts = screen
      .getAllByRole('option')
      .map((option) => option.textContent)
      .filter((value): value is string => Boolean(value));

    expect(optionTexts).toContain('Release topic · Topic · Recent activity · Core Ops Group · Topic root 2');
    expect(optionTexts).toContain('Ops topic · Topic · Recent activity · Core Ops Group · Topic root 1');
    expect(optionTexts.indexOf('Release topic · Topic · Recent activity · Core Ops Group · Topic root 2')).toBeLessThan(
      optionTexts.indexOf('Ops topic · Topic · Recent activity · Core Ops Group · Topic root 1')
    );
  });

  it('deletes one published object from the selected agent', async () => {
    const catalogAfterDelete = {
      ...catalogResponse,
      data: {
        ...catalogResponse.data,
        bindings: [catalogResponse.data.bindings[0]],
      },
    };
    const snapshotAfterDelete = {
      success: true,
      data: {
        catalog: catalogAfterDelete.data,
        activeSessions: sessionCatalogResponse.data,
        refreshedAt: 3000,
      },
    };

    mockRefreshPublicationSnapshotInvoke
      .mockResolvedValueOnce(publicationSnapshotResponse)
      .mockResolvedValueOnce(snapshotAfterDelete);

    renderPanel();

    await screen.findByText('Ops topic');

    fireEvent.click(screen.getByText('delete-icon').closest('button') as HTMLButtonElement);

    await waitFor(() => {
      expect(mockDeletePublicationInvoke).toHaveBeenCalledWith({ publicationId: 'binding-topic-1' });
      expect(mockRefreshPublicationSnapshotInvoke).toHaveBeenCalledTimes(2);
    });
  });

  it('edits one publication while preserving the publication identity', async () => {
    renderPanel();

    await screen.findByText('Ops topic');

    fireEvent.click(screen.getByText('edit-icon').closest('button') as HTMLButtonElement);

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Select a publish object' })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole('combobox', { name: 'Select a publish object' }), {
      target: { value: 'feishu://topic/chat-topic/root-2' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Update publication/i }));

    await waitFor(() => {
      expect(mockUpsertPublicationInvoke).toHaveBeenCalledWith({
        publication: expect.objectContaining({
          publicationId: 'binding-topic-1',
          channelAccountId: 'connector-1',
          scopeKey: 'feishu://topic/chat-topic/root-2',
          agentProfileId: 'agent-profile-1',
          publishObject: expect.objectContaining({
            nativeObjectId: 'feishu://topic/chat-topic/root-2',
            displayName: 'Release topic',
          }),
        }),
      });
    });
  });

  it('restores publication intent from url query after refresh', async () => {
    renderPanel(
      undefined,
      '?conversationId=conversation-2&conversationName=Support%20triage&backend=openclaw-gateway&workspace=%2Ftmp%2Fsupport&agentName=Published%20Support%20Agent'
    );

    await screen.findByText('Publish this Agent');

    expect(screen.getByText('Support triage')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByRole('combobox')[0]).toHaveValue('agent-profile-2');
    });
  });

  it('refreshes the publication snapshot explicitly for initial load and manual refresh', async () => {
    renderPanel();

    await screen.findByText('Ops Agent');

    expect(mockRefreshPublicationSnapshotInvoke).toHaveBeenCalledTimes(1);
    expect(mockGetBindingCatalogInvoke).not.toHaveBeenCalled();
    expect(mockGetActiveSessionCatalogInvoke).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Refresh/i }));

    await waitFor(() => {
      expect(mockRefreshPublicationSnapshotInvoke).toHaveBeenCalledTimes(2);
    });
  });
});
