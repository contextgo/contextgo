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
const messageWarning = vi.fn();
const mockI18n = { language: 'en-US' };

const translations: Record<string, string> = {
  'settings.channels.publication.title': 'Publication setup',
  'settings.channels.publication.description':
    'Choose a usable channel account first, then publish the Agent as a long-term entry to the right IM target.',
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
  'settings.channels.publication.durableTitle': 'Long-term entry',
  'settings.channels.publication.durableDescription': 'Best for stable publication.',
  'settings.channels.publication.saveDurable': 'Save durable publication',
  'settings.channels.publication.updateDurable': 'Update durable publication',
  'settings.channels.publication.saveFailed': 'Failed to save publication binding',
  'settings.channels.publication.durableSaved': 'Durable publication saved',
  'settings.channels.publication.deleteFailed': 'Failed to delete publication binding',
  'settings.channels.publication.deleted': 'Publication binding deleted',
  'settings.channels.publication.existingTitle': 'Published entries',
  'settings.channels.publication.existingDescription': 'Review active long-term publication rules.',
  'settings.channels.publication.durableListTitle': 'Long-term entries',
  'settings.channels.publication.emptyDurable': 'No long-term entries yet',
  'settings.channels.publication.noConnector': 'No channel account is available yet.',
  'settings.channels.publication.editingDurable': 'Editing durable binding',
  'settings.channels.publication.durableTag': 'Long-term',
  'settings.channels.publication.enabled': 'Enabled',
  'settings.channels.publication.disabled': 'Disabled',
  'settings.channels.publication.connectorDefaultAudience': 'Channel account default entry',
  'settings.channels.publication.loadFailed': 'Failed to load publication bindings',
  'settings.channels.publication.scope.connectorDefault': 'Entire channel account',
  'settings.channels.publication.scope.remoteUser': 'Specific user / DM',
  'settings.channels.publication.scope.remoteChat': 'Specific group / channel / topic',
  'settings.channels.publication.scope.connector_default': 'Entire channel account',
  'settings.channels.publication.scope.remote_user': 'Specific user / DM',
  'settings.channels.publication.scope.remote_chat': 'Specific group / channel / topic',
  'settings.channels.publication.intentTitle': 'Ready to publish this Agent',
  'settings.channels.publication.intentDescription': 'Publish a reusable Agent entry.',
  'settings.channels.publication.intentProfile': 'Published Agent',
  'settings.channels.publication.intentConversation': 'Source conversation',
  'settings.channels.publication.intentBackend': 'Runtime backend',
  'settings.channels.publication.intentWorkspace': 'Working directory',
  'settings.channels.publication.intentSelectedHint': 'The current conversation is preselected below.',
  'settings.channels.publication.connectorGuide.weixin': 'WeChat guide',
  'settings.channels.publication.connectorGuide.multiSession': 'Multi-session guide',
  'settings.channels.publication.targetTypeLabel': '2. Publish target type',
  'settings.channels.publication.targetTypeHint.connectorDefault': 'Share one default Agent entry.',
  'settings.channels.publication.targetTypeHint.remoteUser': 'One person gets one entry.',
  'settings.channels.publication.targetTypeHint.remoteChat': 'One group or topic gets one entry.',
  'settings.channels.publication.fallbackTitle': 'Currently only using fallback runtime',
  'settings.channels.publication.fallbackDescription': 'Fallback runtime is active.',
  'settings.channels.publication.fallbackHint': 'Create a long-term publication when needed.',
  'settings.channels.publication.discoveryTitle': 'Discovered targets',
  'settings.channels.publication.discoveryDescription':
    'Recent IM targets discovered through this channel account. Click one to prefill the publication form below.',
  'settings.channels.publication.discoveryEmpty': 'No IM targets discovered yet',
  'settings.channels.publication.connectorResourceNote': 'A channel account is a reusable IM resource.',
  'settings.channels.publication.summaryAudiences': 'Discovered targets',
  'settings.channels.publication.summaryDurable': 'Durable entries',
  'settings.channels.publication.summaryPublished': 'Published',
  'settings.channels.publication.summaryConversations': 'Conversations',
  'settings.channels.publication.accountOverview': 'Manage long-term published targets and their conversations here.',
  'settings.channels.publication.publishedTargetsTitle': 'Published targets',
  'settings.channels.publication.publishedTargetsDescription':
    'Review the targets that are already published long-term and the latest conversations they have produced.',
  'settings.channels.publication.emptyPublishedTargets': 'No published targets yet',
  'settings.channels.publication.addTargetTitle': 'Add publication',
  'settings.channels.publication.addTargetDescription':
    'Pick the target first, then publish the current Agent there long-term. New messages from this target will enter the current Agent.',
  'settings.channels.publication.connectorSummaryReady': 'Ready to publish',
  'settings.channels.publication.connectorSummaryTargets': '{{count}} discovered targets',
  'settings.channels.publication.stepTargetTitle': '2. Choose the publish target',
  'settings.channels.publication.stepTargetDescription':
    'This channel account is usable now. Pick one discovered target first, then configure the long-term publication rule below.',
  'settings.channels.publication.stepPublishTitle': '3. Set the publication rule',
  'settings.channels.publication.stepPublishDescription':
    'Focus on long-term publication rules so audiences consistently land on the right Agent entry.',
  'settings.channels.publication.bindingTargetLabel': 'Applies to',
  'settings.channels.publication.audienceTransportLabel': 'Target detail',
  'settings.channels.publication.audienceSessionRuleLabel': 'Session behavior',
  'settings.channels.publication.audienceKind.connector': 'Channel account default',
  'settings.channels.publication.audienceKind.direct': 'Direct chat',
  'settings.channels.publication.audienceKind.group': 'Group',
  'settings.channels.publication.audienceKind.channel': 'Channel',
  'settings.channels.publication.audienceKind.topic': 'Topic',
  'settings.channels.publication.audienceKind.thread': 'Thread',
  'settings.channels.publication.audienceKind.chat': 'Chat target',
  'settings.channels.publication.sessionHint.connector':
    'All unmatched traffic on this channel account shares one default published entry.',
  'settings.channels.publication.sessionHint.direct': 'One person or DM keeps one isolated long-term session.',
  'settings.channels.publication.sessionHint.group': 'Everyone in this group shares one long-term session surface.',
  'settings.channels.publication.sessionHint.channel': 'Everyone in this channel shares one long-term session surface.',
  'settings.channels.publication.sessionHint.topic': 'Each topic is isolated as its own long-term session.',
  'settings.channels.publication.sessionHint.thread': 'Each thread is isolated as its own long-term session.',
  'settings.channels.publication.sessionHint.chat':
    'This exact peer key is used as one isolated long-term session surface.',
  'common.refresh': 'Refresh',
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
    i18n: mockI18n,
  }),
}));

const mockTranslate = (key: string, options?: Record<string, unknown>) => {
  if (key === 'settings.channels.publication.connectorHint') {
    return `Managing publication targets through ${options?.name ?? ''} on ${options?.platform ?? ''}.`;
  }
  if (key === 'settings.channels.publication.connectorSummaryTargets') {
    return `${options?.count ?? ''} discovered targets`;
  }
  return translations[key] ?? key;
};

vi.mock('@icon-park/react', () => ({
  Delete: () => <span>delete-icon</span>,
  Edit: () => <span>edit-icon</span>,
  Plus: () => <span>plus-icon</span>,
  Refresh: () => <span>refresh-icon</span>,
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
  InputNumber: ({ value, onChange, placeholder, min }: any) => (
    <input
      type='number'
      min={min}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(event) => onChange?.(Number(event.target.value))}
    />
  ),
  Message: {
    error: (...args: unknown[]) => messageError(...args),
    success: (...args: unknown[]) => messageSuccess(...args),
    warning: (...args: unknown[]) => messageWarning(...args),
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
        lastActive: 1500,
      },
    ],
  },
};

const activeSessionCatalogResponse = {
  success: true,
  data: [],
};

function renderPanel(publicationIntent?: Record<string, unknown>) {
  return render(
    <MemoryRouter
      initialEntries={[{ pathname: '/', state: publicationIntent ? { publicationIntent } : undefined } as any]}
    >
      <PublicationBindingPanel />
    </MemoryRouter>
  );
}

function hasTextContent(expected: string) {
  return (_content: string, element: Element | null) => element?.textContent?.trim() === expected;
}

describe('PublicationBindingPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBindingCatalogInvoke.mockResolvedValue(catalogResponse);
    mockGetActiveSessionCatalogInvoke.mockResolvedValue(activeSessionCatalogResponse);
    mockUpsertBindingInvoke.mockResolvedValue({ success: true });
    mockDeleteBindingInvoke.mockResolvedValue({ success: true });
  });

  it('shows channel account entries on the left and switches the management console with the selected account', async () => {
    renderPanel();

    await screen.findByText('1. Choose a usable channel account');

    expect(screen.getByRole('button', { name: /Feishu Ops/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Slack Support/i })).toBeInTheDocument();
    expect(screen.getByText('Ops topic')).toBeInTheDocument();
    expect(screen.queryByText('Support room')).not.toBeInTheDocument();
    expect(screen.getByText('Published targets')).toBeInTheDocument();
    expect(screen.getAllByText(hasTextContent('Published: 0')).length).toBeGreaterThanOrEqual(2);

    fireEvent.click(screen.getByRole('button', { name: /Slack Support/i }));

    await waitFor(() => {
      expect(screen.getByText('Support room')).toBeInTheDocument();
    });
    expect(screen.queryByText('Ops topic')).not.toBeInTheDocument();
    expect(screen.getAllByText('Slack Support').length).toBeGreaterThanOrEqual(2);
  });

  it('keeps discovered targets readable instead of exposing routing internals', async () => {
    renderPanel();

    await screen.findByText('1. Choose a usable channel account');

    expect(screen.getByText('Ops topic')).toBeInTheDocument();
    expect(screen.getAllByText('Topic root 1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Topic')).toBeInTheDocument();
    expect(screen.queryByText('Peer key:')).not.toBeInTheDocument();
    expect(screen.queryByText('Parent target:')).not.toBeInTheDocument();
    expect(screen.queryByText('feishu://topic/chat-topic/root-1')).not.toBeInTheDocument();
    expect(screen.getAllByText(hasTextContent('Published: 0')).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(hasTextContent('Discovered targets: 1')).length).toBeGreaterThanOrEqual(2);
  });

  it('preselects the published agent from publication intent and fills target selectors from a discovered audience shortcut', async () => {
    renderPanel({
      conversationId: 'conversation-2',
      backend: 'openclaw-gateway',
      workspace: '/tmp/support',
      agentName: 'Published Support Agent',
    });

    await screen.findByText('Ready to publish this Agent');

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

  it('drops conversation totals after deleting the published target even if the session catalog still contains history', async () => {
    const publishedCatalog = {
      ...catalogResponse,
      data: {
        ...catalogResponse.data,
        bindings: [
          ...catalogResponse.data.bindings,
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
      },
    };
    const catalogAfterDelete = {
      ...publishedCatalog,
      data: {
        ...publishedCatalog.data,
        bindings: [...catalogResponse.data.bindings],
      },
    };

    mockGetBindingCatalogInvoke.mockResolvedValueOnce(publishedCatalog).mockResolvedValueOnce(catalogAfterDelete);
    mockGetActiveSessionCatalogInvoke.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'session-topic-1',
          connectorId: 'connector-1',
          channelAccountId: 'connector-1',
          connectorName: 'Feishu Ops',
          channelAccountName: 'Feishu Ops',
          connectorPlatform: 'lark',
          channelAccountPlatform: 'lark',
          remoteIdentityId: 'remote-identity-1',
          audienceTitle: 'Ops topic',
          audienceKey: 'feishu://topic/chat-topic/root-1',
          conversationId: 'conversation-1',
          workspace: '/tmp/workspace',
          agentType: 'openclaw-gateway',
          createdAt: Date.now() - 60_000,
          lastActivity: Date.now() - 10_000,
          bindingId: 'binding-topic-1',
        },
      ],
    });

    renderPanel();

    await screen.findAllByText(hasTextContent('Published: 1'));
    expect(screen.getAllByText(hasTextContent('Conversations: 1')).length).toBeGreaterThanOrEqual(2);

    fireEvent.click(screen.getByText('delete-icon').closest('button') as HTMLButtonElement);

    await waitFor(() => {
      expect(mockGetBindingCatalogInvoke).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(screen.getAllByText(hasTextContent('Published: 0')).length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText(hasTextContent('Conversations: 0')).length).toBeGreaterThanOrEqual(2);
    });
  });
});
