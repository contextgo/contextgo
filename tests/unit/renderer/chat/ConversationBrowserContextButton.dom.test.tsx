import type { TBrowserContextAsset, TChatConversation } from '@/common/config/storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  browserContextCreateInvokeMock,
  browserContextUpdateInvokeMock,
  browserContextAssertBindableInvokeMock,
  conversationUpdateInvokeMock,
  warningMock,
  errorMock,
  onOpenUrlMock,
} = vi.hoisted(() => ({
  browserContextCreateInvokeMock: vi.fn(),
  browserContextUpdateInvokeMock: vi.fn(),
  browserContextAssertBindableInvokeMock: vi.fn(),
  conversationUpdateInvokeMock: vi.fn(),
  warningMock: vi.fn(),
  errorMock: vi.fn(),
  onOpenUrlMock: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) => {
      if (key === 'conversation.browser.conversationLabel') {
        return `${options?.name} Browser`;
      }
      return key;
    },
  }),
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    browserContext: {
      create: {
        invoke: browserContextCreateInvokeMock,
      },
      update: {
        invoke: browserContextUpdateInvokeMock,
      },
      assertBindable: {
        invoke: browserContextAssertBindableInvokeMock,
      },
    },
    conversation: {
      update: {
        invoke: conversationUpdateInvokeMock,
      },
    },
  },
}));

vi.mock('@arco-design/web-react', () => {
  const Button = ({
    children,
    icon,
    onClick,
  }: {
    children?: React.ReactNode;
    icon?: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type='button' onClick={onClick}>
      {icon}
      {children}
    </button>
  );

  const Input = ({
    value,
    onChange,
    onPressEnter,
    placeholder,
  }: {
    value?: string;
    onChange?: (value: string) => void;
    onPressEnter?: () => void;
    placeholder?: string;
  }) => (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange?.(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          onPressEnter?.();
        }
      }}
    />
  );

  const Modal = ({
    visible,
    title,
    children,
    onOk,
    onCancel,
    okText,
    cancelText,
  }: {
    visible?: boolean;
    title?: React.ReactNode;
    children?: React.ReactNode;
    onOk?: () => void;
    onCancel?: () => void;
    okText?: React.ReactNode;
    cancelText?: React.ReactNode;
  }) =>
    visible ? (
      <div data-testid='modal'>
        <div>{title}</div>
        {children}
        <button type='button' onClick={onOk}>
          {okText}
        </button>
        <button type='button' onClick={onCancel}>
          {cancelText}
        </button>
      </div>
    ) : null;

  const Tooltip = ({ children }: { children: React.ReactNode }) => <>{children}</>;

  return {
    Button,
    Input,
    Modal,
    Tooltip,
    Message: {
      warning: warningMock,
      error: errorMock,
    },
  };
});

vi.mock('@icon-park/react', () => ({
  Earth: () => <span>earth</span>,
}));

import ConversationBrowserContextButton from '@/renderer/pages/conversation/platforms/ConversationBrowserContextButton';

const createConversation = (overrides?: Partial<TChatConversation>): TChatConversation =>
  ({
    id: 'conversation-1',
    type: 'acp',
    name: 'Research Thread',
    createTime: 1,
    modifyTime: 1,
    extra: {
      spaceId: 'space-alpha',
      ...overrides?.extra,
    },
    model: {
      id: 'provider-1',
      name: 'Provider',
      platform: 'acp',
      useModel: 'claude-sonnet',
    },
    ...overrides,
  }) as TChatConversation;

describe('ConversationBrowserContextButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    conversationUpdateInvokeMock.mockResolvedValue(true);
    browserContextUpdateInvokeMock.mockResolvedValue({
      success: true,
      data: {
        id: 'asset-1',
        label: 'Research Thread Browser',
        metadata: {
          homeUrl: 'https://example.com/',
        },
      },
    });
  });

  it('creates and binds a managed browser context asset for the conversation', async () => {
    browserContextCreateInvokeMock.mockResolvedValue({
      success: true,
      data: {
        id: 'asset-1',
        label: 'Research Thread Browser',
        metadata: {
          homeUrl: 'https://example.com/',
        },
      } satisfies Partial<TBrowserContextAsset>,
    });

    render(<ConversationBrowserContextButton conversation={createConversation()} onOpenUrl={onOpenUrlMock} />);

    fireEvent.click(screen.getByRole('button'));
    fireEvent.change(screen.getByPlaceholderText('conversation.browser.startUrlPlaceholder'), {
      target: { value: 'example.com' },
    });
    fireEvent.click(screen.getByText('common.create'));

    await waitFor(() => {
      expect(browserContextCreateInvokeMock).toHaveBeenCalledWith({
        spaceId: 'space-alpha',
        label: 'Research Thread Browser',
        kind: 'managed',
        consentStatus: 'granted',
        grantedAt: expect.any(Number),
        metadata: {
          homeUrl: 'https://example.com/',
          sourceConversationId: 'conversation-1',
        },
      });
    });

    expect(conversationUpdateInvokeMock).toHaveBeenCalledWith({
      id: 'conversation-1',
      updates: {
        extra: {
          browserContextAssetId: 'asset-1',
        },
      },
      mergeExtra: true,
    });
    expect(onOpenUrlMock).toHaveBeenCalledWith('https://example.com/', {
      title: 'Research Thread Browser',
      browserContextAssetId: 'asset-1',
    });
    expect(browserContextUpdateInvokeMock).toHaveBeenCalledWith({
      id: 'asset-1',
      lastUsedAt: expect.any(Number),
    });
  });

  it('opens the bound browser context asset in the preview pane', async () => {
    browserContextAssertBindableInvokeMock.mockResolvedValue({
      success: true,
      data: {
        id: 'asset-9',
        label: 'Bound Browser',
        metadata: {
          homeUrl: 'https://bound.example.com',
        },
      } satisfies Partial<TBrowserContextAsset>,
    });

    render(
      <ConversationBrowserContextButton
        conversation={createConversation({
          extra: {
            spaceId: 'space-alpha',
            browserContextAssetId: 'asset-9',
          },
        })}
        onOpenUrl={onOpenUrlMock}
      />
    );

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(browserContextAssertBindableInvokeMock).toHaveBeenCalledWith({
        id: 'asset-9',
        spaceId: 'space-alpha',
      });
    });

    expect(onOpenUrlMock).toHaveBeenCalledWith('https://bound.example.com', {
      title: 'Bound Browser',
      browserContextAssetId: 'asset-9',
    });
    expect(browserContextUpdateInvokeMock).toHaveBeenCalledWith({
      id: 'asset-9',
      lastUsedAt: expect.any(Number),
    });
  });
});
