import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useLayoutContextMock = vi.fn();
const mockGetPluginStatusInvoke = vi.fn();
const mockGetChannelAccountsInvoke = vi.fn();
const mockGetAuthorizedTargetsInvoke = vi.fn();
const mockWebuiStatusInvoke = vi.fn();
const mockPluginStatusChangedOn = vi.fn(() => vi.fn());
const mockUserAuthorizedOn = vi.fn(() => vi.fn());

const translations: Record<string, string> = {
  'settings.agentEntry': 'IM Channels',
  'settings.agentEntryDesc': 'Manage reusable IM channel accounts here.',
  'settings.channels.title': 'IM Channel Accounts',
  'settings.channels.guide': 'Each IM type can host multiple channel instances for delivery and authorization.',
  'settings.channels.selectFirst': 'Configure one or more IM channel entries and enable message access.',
  'settings.channels.enableAfterConfig': 'Formal publication is managed in Agent Publish.',
  'settings.channels.telegramTitle': 'Telegram',
  'settings.channels.telegramDesc': 'Chat with ContextGo assistant via Telegram',
  'settings.channels.slackTitle': 'Slack',
  'settings.channels.slackDesc': 'Chat with ContextGo assistant via Slack',
  'settings.channels.discordTitle': 'Discord',
  'settings.channels.discordDesc': 'Chat with ContextGo assistant via Discord',
  'settings.channels.larkTitle': 'Lark / Feishu',
  'settings.channels.larkDesc': 'Chat with ContextGo assistant via Lark or Feishu',
  'settings.channels.dingtalkTitle': 'DingTalk',
  'settings.channels.dingtalkDesc': 'Chat with ContextGo assistant via DingTalk',
  'settings.channels.weixinTitle': 'WeChat',
  'settings.channels.weixinDesc':
    'Bridge a personal WeChat account into ContextGo. This is not a standard official bot platform.',
  'settings.channels.publication.enabled': 'Enabled',
  'settings.channels.publication.disabled': 'Disabled',
  'settings.channels.notConfigured': 'Not configured',
  'settings.channels.configured': 'Configured',
  'settings.channels.familyListTitle': 'Channel types',
  'settings.channels.familyListDescription':
    'Choose one IM type first, then complete instance onboarding on the right. An instance only counts as added after pairing succeeds.',
  'settings.channels.instanceListTitle': 'Instances',
  'settings.channels.instanceListDescription':
    'Each instance should expose one clear primary state: finish setup first, then it becomes usable.',
  'settings.channels.enabledCount': 'Enabled',
  'settings.channels.connectedCount': 'Connected',
  'settings.channels.pairedCount': 'Paired',
  'settings.channels.readyCount': 'Ready',
  'settings.channels.readyStatus': 'Ready',
  'settings.channels.pendingConfigStatus': 'Needs configuration',
  'settings.channels.pendingEnableStatus': 'Needs enablement',
  'settings.channels.pendingPairStatus': 'Needs pairing',
  'settings.channels.pairingWaiting': 'Waiting for pairing',
  'settings.channels.pairingDone': 'Paired {{count}}',
  'settings.channels.instanceAddedSuccess': 'Pairing completed. The instance is now added.',
  'settings.channels.setupFlowTitle': 'Setup flow',
  'settings.channels.setupPendingDescription':
    'Only the instance shell exists so far. Finish configuration, enable the runtime, and approve at least one pairing request in order. The instance is not considered successfully added until pairing succeeds.',
  'settings.channels.setupCompleteDescription':
    'This instance has completed at least one pairing. It now counts as successfully added and can be used for publication.',
  'settings.channels.setupStepConfigure': 'Configure credentials or sign in',
  'settings.channels.setupStepEnable': 'Enable the channel runtime',
  'settings.channels.setupStepPair': 'Approve a pairing request',
  'settings.channels.instanceDraftHint':
    'Creating the instance only starts the onboarding flow. Finish credentials or login, enable it, and complete at least one pairing. The instance is only considered added after pairing succeeds, and only then can it be used for publication.',
  'settings.channels.emptyInstances': 'No instances yet',
  'settings.channels.emptyInstancesHint':
    'This channel type has no fully onboarded instance yet. Adding one will start the setup and pairing flow directly, and it only counts as added after pairing succeeds.',
  'settings.assistant.connected': 'Connected',
  'settings.assistant.disconnected': 'Disconnected',
  'settings.activeSessions': 'Agent Publish',
  'settings.activeSessionsDesc': 'Review the current Agent and publish it into platform-native IM objects.',
};

vi.mock('@/common/adapter/ipcBridge', () => ({
  channel: {
    getPluginStatus: {
      invoke: (...args: unknown[]) => mockGetPluginStatusInvoke(...args),
    },
    getChannelAccounts: {
      invoke: (...args: unknown[]) => mockGetChannelAccountsInvoke(...args),
    },
    getAuthorizedTargets: {
      invoke: (...args: unknown[]) => mockGetAuthorizedTargetsInvoke(...args),
    },
    pluginStatusChanged: {
      on: (...args: unknown[]) => mockPluginStatusChangedOn(...args),
    },
    userAuthorized: {
      on: (...args: unknown[]) => mockUserAuthorizedOn(...args),
    },
  },
  webui: {
    getStatus: {
      invoke: (...args: unknown[]) => mockWebuiStatusInvoke(...args),
    },
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const template = (translations[key] ?? options?.defaultValue ?? key) as string;
      return template.replace(/\{\{(\w+)\}\}/g, (_match, token) => String(options?.[token] ?? ''));
    },
  }),
}));

vi.mock('@/renderer/components/base/ContextGoScrollArea', () => ({
  default: ({
    children,
    className,
    disableOverflow,
  }: {
    children?: React.ReactNode;
    className?: string;
    disableOverflow?: boolean;
  }) => (
    <div data-testid='scroll-area' data-disable-overflow={disableOverflow ? 'true' : 'false'} className={className}>
      {children}
    </div>
  ),
}));

vi.mock('@/renderer/components/settings/SettingsModal/settingsViewContext', () => ({
  useSettingsViewMode: () => 'page',
}));

vi.mock('@/renderer/hooks/context/LayoutContext', () => ({
  useLayoutContext: () => useLayoutContextMock(),
}));

vi.mock('@/renderer/components/settings/SettingsModal/contents/channels/publication/PublicationBindingPanel', () => ({
  default: () => <div>publication panel</div>,
}));

vi.mock('@/renderer/components/settings/SettingsModal/contents/channels/configForms', () => ({
  DiscordConfigForm: () => <div>discord form</div>,
  DingTalkConfigForm: () => <div>dingtalk form</div>,
  LarkConfigForm: () => <div>lark form</div>,
  SlackConfigForm: () => <div>slack form</div>,
  TelegramConfigForm: () => <div>telegram form</div>,
  WeixinConfigForm: () => <div>weixin form</div>,
}));

vi.mock('@icon-park/react', () => ({
  CheckOne: () => <span>check</span>,
}));

vi.mock('@arco-design/web-react', async () => {
  const ReactModule = await import('react');

  const Tabs = ({
    activeTab,
    onChange,
    children,
  }: {
    activeTab?: string;
    onChange?: (value: string) => void;
    children?: React.ReactNode;
  }) => {
    const items = ReactModule.Children.toArray(children) as React.ReactElement[];

    return (
      <div>
        {items.map((child) => {
          const key = String(child.key);
          return (
            <button key={key} type='button' onClick={() => onChange?.(key)}>
              {child.props.title}
              {activeTab === key ? ' active' : ''}
            </button>
          );
        })}
      </div>
    );
  };

  Tabs.TabPane = (_props: { title: React.ReactNode }) => null;

  return {
    Button: ({
      children,
      onClick,
      className,
      type: _type,
      loading: _loading,
      status: _status,
      ...props
    }: {
      children?: React.ReactNode;
      onClick?: () => void;
      className?: string;
      type?: string;
      loading?: boolean;
      status?: string;
      [key: string]: unknown;
    }) => (
      <button type='button' onClick={onClick} className={className} {...props}>
        {children}
      </button>
    ),
    Empty: ({ description }: { description?: React.ReactNode }) => <div>{description}</div>,
    Input: () => null,
    InputNumber: () => null,
    Message: {
      error: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
    },
    Select: () => null,
    Switch: ({
      checked,
      onChange,
      disabled,
    }: {
      checked?: boolean;
      onChange?: (nextValue: boolean) => void;
      disabled?: boolean;
    }) => (
      <button
        type='button'
        aria-label='switch'
        aria-pressed={checked}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
      >
        {checked ? 'on' : 'off'}
      </button>
    ),
    Tabs,
    Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  };
});

import ChannelModalContent from '@/renderer/components/settings/SettingsModal/contents/channels/ChannelModalContent';

function renderSessionsPage(state?: Record<string, unknown>) {
  const initialEntries: React.ComponentProps<typeof MemoryRouter>['initialEntries'] = [
    { pathname: '/settings/agent-publish', state },
  ];
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ChannelModalContent mode='sessions' />
    </MemoryRouter>
  );
}

function renderChannelsPage() {
  const initialEntries: React.ComponentProps<typeof MemoryRouter>['initialEntries'] = [
    { pathname: '/settings/channels' },
  ];
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ChannelModalContent mode='channels' />
    </MemoryRouter>
  );
}

describe('ChannelModalContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLayoutContextMock.mockReturnValue({
      isMobile: false,
    });
    mockGetPluginStatusInvoke.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'telegram_default',
          type: 'telegram',
          name: 'Telegram',
          enabled: true,
          connected: true,
          status: 'running',
          botUsername: 'contextgo_bot',
          activeUsers: 1,
          hasToken: true,
        },
        {
          id: 'slack_default',
          type: 'slack',
          name: 'Slack',
          enabled: false,
          connected: false,
          status: 'stopped',
          activeUsers: 0,
          hasToken: true,
        },
      ],
    });
    mockGetChannelAccountsInvoke.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'telegram_default',
          platform: 'telegram',
          name: 'Telegram',
          enabled: true,
          configured: true,
          status: 'running',
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          id: 'slack_default',
          platform: 'slack',
          name: 'Slack',
          enabled: false,
          configured: true,
          status: 'stopped',
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });
    mockGetAuthorizedTargetsInvoke.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'remote-telegram-1',
          channelAccountId: 'telegram_default',
          targetId: 'user:tg-123',
          targetType: 'direct',
          remoteUserId: 'tg-123',
          platformChatId: 'tg-123',
          platformType: 'telegram',
          authorizedAt: 1000,
        },
      ],
    });
    mockWebuiStatusInvoke.mockResolvedValue({
      success: true,
      data: {
        localUrl: 'http://localhost:25808',
        networkUrl: 'http://192.168.0.2:25808',
      },
    });
  });

  it('renders the publication page with a simplified long-term publishing description', () => {
    renderSessionsPage({
      publicationIntent: {
        conversationId: 'conversation-1',
      },
    });

    expect(screen.getByText('publication panel')).toBeInTheDocument();
    expect(screen.getByText('Agent Publish')).toBeInTheDocument();
    expect(
      screen.getByText('Review the current Agent and publish it into platform-native IM objects.')
    ).toBeInTheDocument();
  });

  it('renders a connector-style two-column channel layout and switches the right detail pane', async () => {
    renderChannelsPage();

    await waitFor(() => {
      expect(mockGetPluginStatusInvoke).toHaveBeenCalled();
      expect(mockGetChannelAccountsInvoke).toHaveBeenCalled();
      expect(mockGetAuthorizedTargetsInvoke).toHaveBeenCalled();
    });

    expect(screen.getByText('IM Channels')).toBeInTheDocument();
    expect(screen.getByTestId('scroll-area')).toHaveAttribute('data-disable-overflow', 'true');
    expect(screen.getAllByRole('button', { name: /Telegram/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Slack/i }).length).toBeGreaterThan(0);
    expect(screen.getByText('telegram form')).toBeInTheDocument();
    expect(screen.queryByText('slack form')).not.toBeInTheDocument();
    expect(screen.getAllByText('@contextgo_bot').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ready').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Paired 1').length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole('button', { name: /Slack/i })[0]);

    await waitFor(() => {
      expect(screen.getByText('slack form')).toBeInTheDocument();
    });

    expect(screen.queryByText('telegram form')).not.toBeInTheDocument();
    expect(screen.getAllByText('Needs enablement').length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        'Each instance should expose one clear primary state: finish setup first, then it becomes usable.'
      )
    ).toBeInTheDocument();
  });

  it('keeps page scrolling enabled for the mobile channel settings layout', async () => {
    useLayoutContextMock.mockReturnValue({
      isMobile: true,
    });

    renderChannelsPage();

    await waitFor(() => {
      expect(mockGetPluginStatusInvoke).toHaveBeenCalled();
    });

    expect(screen.getByTestId('scroll-area')).toHaveAttribute('data-disable-overflow', 'false');
  });

  it('uses a list-first mobile flow and opens instance details only after selection', async () => {
    useLayoutContextMock.mockReturnValue({
      isMobile: true,
    });

    renderChannelsPage();

    await waitFor(() => {
      expect(mockGetPluginStatusInvoke).toHaveBeenCalled();
      expect(mockGetChannelAccountsInvoke).toHaveBeenCalled();
    });

    expect(screen.getByTestId('channel-mobile-list')).toBeInTheDocument();
    expect(screen.queryByTestId('channel-mobile-detail')).toBeNull();
    expect(screen.queryByText('telegram form')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('channel-instance-trigger-telegram_default'));

    await waitFor(() => {
      expect(screen.getByTestId('channel-mobile-detail')).toBeInTheDocument();
    });

    expect(screen.getByText('telegram form')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('channel-mobile-back'));

    await waitFor(() => {
      expect(screen.getByTestId('channel-mobile-list')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('channel-mobile-detail')).toBeNull();
    expect(screen.queryByText('telegram form')).not.toBeInTheDocument();
  });

  it('hides implicit builtin defaults when no real instance exists', async () => {
    mockGetPluginStatusInvoke.mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: 'telegram_default',
          type: 'telegram',
          name: 'Default',
          enabled: false,
          connected: false,
          status: 'stopped',
          activeUsers: 0,
          hasToken: false,
        },
      ],
    });
    mockGetChannelAccountsInvoke.mockResolvedValueOnce({
      success: true,
      data: [],
    });

    renderChannelsPage();

    await waitFor(() => {
      expect(mockGetPluginStatusInvoke).toHaveBeenCalled();
      expect(mockGetChannelAccountsInvoke).toHaveBeenCalled();
    });

    expect(screen.getByText('No instances yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add and pair' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Default/i })).not.toBeInTheDocument();
  });

  it('hides legacy-only builtin statuses that do not have a backing channel account', async () => {
    mockGetPluginStatusInvoke.mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: 'weixin_default',
          type: 'weixin',
          name: 'Weixin Bot',
          enabled: true,
          connected: true,
          status: 'running',
          activeUsers: 0,
          hasToken: true,
        },
      ],
    });
    mockGetChannelAccountsInvoke.mockResolvedValueOnce({
      success: true,
      data: [],
    });

    renderChannelsPage();

    await waitFor(() => {
      expect(mockGetPluginStatusInvoke).toHaveBeenCalled();
      expect(mockGetChannelAccountsInvoke).toHaveBeenCalled();
    });

    fireEvent.click(screen.getAllByRole('button', { name: /WeChat/i })[0]);

    expect(screen.getByText('No instances yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add and pair' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Weixin Bot/i })).not.toBeInTheDocument();
    expect(screen.queryByText('weixin form')).toBeNull();
  });

  it('renders builtin channel logos for the selected family and instance cards', async () => {
    renderChannelsPage();

    await waitFor(() => {
      expect(mockGetPluginStatusInvoke).toHaveBeenCalled();
    });

    const telegramLogos = screen.getAllByAltText('Telegram');
    expect(telegramLogos.length).toBeGreaterThan(0);
    expect(telegramLogos[0]).toHaveAttribute('src');

    const slackLogos = screen.getAllByAltText('Slack');
    expect(slackLogos.length).toBeGreaterThan(0);
    expect(slackLogos[0]).toHaveAttribute('src');
  });

  it('marks draft instances as not configured and shows the draft hint', async () => {
    mockGetPluginStatusInvoke.mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: 'slack_default',
          type: 'slack',
          name: 'Slack',
          enabled: false,
          connected: false,
          status: 'stopped',
          activeUsers: 0,
          hasToken: false,
        },
      ],
    });
    mockGetChannelAccountsInvoke.mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: 'slack_default',
          platform: 'slack',
          name: 'Slack',
          enabled: false,
          configured: false,
          status: 'stopped',
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
    });

    renderChannelsPage();

    await waitFor(() => {
      expect(mockGetPluginStatusInvoke).toHaveBeenCalled();
      expect(mockGetChannelAccountsInvoke).toHaveBeenCalled();
    });

    expect(screen.getAllByText('Not configured').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Waiting for pairing').length).toBeGreaterThan(0);
    expect(screen.getByText('Setup flow')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Only the instance shell exists so far. Finish configuration, enable the runtime, and approve at least one pairing request in order. The instance is not considered successfully added until pairing succeeds.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Creating the instance only starts the onboarding flow. Finish credentials or login, enable it, and complete at least one pairing. The instance is only considered added after pairing succeeds, and only then can it be used for publication.'
      )
    ).toBeInTheDocument();
  });
});
