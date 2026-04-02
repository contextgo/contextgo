/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const { mockMessage, mockTestPlugin, mockEnablePlugin, mockGetPluginStatus } = vi.hoisted(() => ({
  mockMessage: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
  mockTestPlugin: vi.fn(),
  mockEnablePlugin: vi.fn(),
  mockGetPluginStatus: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrOptions?: string | { defaultValue?: string; username?: string }) => {
      if (typeof fallbackOrOptions === 'string') {
        return fallbackOrOptions;
      }
      return fallbackOrOptions?.defaultValue ?? key;
    },
  }),
}));

vi.mock('@arco-design/web-react', async () => {
  const actual = await vi.importActual<typeof import('@arco-design/web-react')>('@arco-design/web-react');
  return {
    ...actual,
    Message: mockMessage,
  };
});

vi.mock('@/common/adapter/ipcBridge', () => ({
  channel: {
    testPlugin: { invoke: mockTestPlugin },
    enablePlugin: { invoke: mockEnablePlugin },
    getPluginStatus: { invoke: mockGetPluginStatus },
    syncChannelSettings: { invoke: vi.fn(async () => ({ success: true })) },
    getPendingPairings: { invoke: vi.fn(async () => ({ success: true, data: [] })) },
    getAuthorizedUsers: { invoke: vi.fn(async () => ({ success: true, data: [] })) },
    pairingRequested: { on: vi.fn(() => vi.fn()) },
    userAuthorized: { on: vi.fn(() => vi.fn()) },
    approvePairing: { invoke: vi.fn(async () => ({ success: true })) },
    rejectPairing: { invoke: vi.fn(async () => ({ success: true })) },
    revokeUser: { invoke: vi.fn(async () => ({ success: true })) },
  },
  acpConversation: {
    getAvailableAgents: { invoke: vi.fn(async () => ({ success: true, data: [] })) },
  },
}));

vi.mock('@/common/config/storage', () => ({
  ConfigStorage: {
    get: vi.fn(async () => undefined),
    set: vi.fn(async () => {}),
  },
}));

vi.mock('@/renderer/components/settings/SettingsModal/contents/channels/ChannelModelSelector', () => ({
  default: () => <div data-testid='model-selector' />,
}));

import DiscordConfigForm from '@/renderer/components/settings/SettingsModal/contents/channels/configForms/DiscordConfigForm';

const noopModelSelection = {
  currentModel: undefined,
  isLoading: false,
  onSelectModel: vi.fn(),
} as any;

describe('DiscordConfigForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTestPlugin.mockResolvedValue({
      success: true,
      data: { success: true, botUsername: 'contextgo-bot' },
    });
    mockEnablePlugin.mockResolvedValue({ success: true });
    mockGetPluginStatus.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'discord_default',
          type: 'discord',
          name: 'Discord Bot',
          enabled: true,
          connected: true,
          status: 'running',
          botUsername: 'contextgo-bot',
          hasToken: true,
        },
      ],
    });
  });

  it('renders Discord credential fields', () => {
    render(
      <DiscordConfigForm
        pluginId='discord_default'
        pluginStatus={null}
        modelSelection={noopModelSelection}
        onStatusChange={vi.fn()}
      />
    );

    expect(screen.getByPlaceholderText('Discord bot token')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Test & Connect' })).toBeTruthy();
  });

  it('tests and auto-enables Discord plugin with token', async () => {
    const onStatusChange = vi.fn();

    render(
      <DiscordConfigForm
        pluginId='discord_default'
        pluginStatus={null}
        modelSelection={noopModelSelection}
        onStatusChange={onStatusChange}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Discord bot token'), {
      target: { value: 'discord-test-token' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Test & Connect' }));

    await waitFor(() => {
      expect(mockTestPlugin).toHaveBeenCalledWith({
        pluginId: 'discord_default',
        token: 'discord-test-token',
      });
    });

    await waitFor(() => {
      expect(mockEnablePlugin).toHaveBeenCalledWith({
        pluginId: 'discord_default',
        config: {
          token: 'discord-test-token',
          requireMention: true,
        },
      });
    });

    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'discord',
          enabled: true,
          connected: true,
        })
      );
    });
  });
});
