import { fireEvent, render } from '@testing-library/react';
import React, { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockWarmupInvoke = vi.fn().mockResolvedValue(undefined);
const mockUseConversationContextSafe = vi.fn(() => ({ conversationId: 'test-conv-1' }));
const mockUseLayoutContext = vi.fn(() => ({ isMobile: false }));
const mockUsePreviewContext = vi.fn(() => ({
  setSendBoxHandler: vi.fn(),
  domSnippets: [],
  removeDomSnippet: vi.fn(),
  clearDomSnippets: vi.fn(),
}));
const mockUseInputFocusRing = vi.fn(() => ({
  activeBorderColor: '#000',
  inactiveBorderColor: '#ccc',
  activeShadow: '0 0 0 2px rgba(0,0,0,0.1)',
}));
const mockUseDragUpload = vi.fn(() => ({
  isFileDragging: false,
  dragHandlers: {},
}));
const mockUsePasteService = vi.fn(() => ({
  onPaste: vi.fn(),
  onFocus: vi.fn(),
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    conversation: {
      warmup: {
        invoke: (...args: unknown[]) => mockWarmupInvoke(...args),
      },
    },
  },
}));

vi.mock('@/renderer/hooks/context/ConversationContext', () => ({
  useConversationContextSafe: () => mockUseConversationContextSafe(),
}));

vi.mock('@/renderer/hooks/context/LayoutContext', () => ({
  useLayoutContext: () => mockUseLayoutContext(),
}));

vi.mock('@/renderer/pages/conversation/Preview', () => ({
  usePreviewContext: () => mockUsePreviewContext(),
  usePreviewComposer: () => mockUsePreviewContext(),
}));

vi.mock('@/renderer/hooks/chat/useInputFocusRing', () => ({
  useInputFocusRing: () => mockUseInputFocusRing(),
}));

vi.mock('@/renderer/hooks/chat/useCompositionInput', () => ({
  useCompositionInput: () => ({
    isComposing: { current: false },
    compositionHandlers: {},
    createKeyDownHandler: (onEnterPress: () => void, onKeyDownIntercept?: (e: React.KeyboardEvent) => boolean) => {
      return (event: React.KeyboardEvent) => {
        if (onKeyDownIntercept?.(event)) {
          return;
        }
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          onEnterPress();
        }
      };
    },
  }),
}));

vi.mock('@/renderer/hooks/file/useDragUpload', () => ({
  useDragUpload: () => mockUseDragUpload(),
}));

vi.mock('@/renderer/hooks/file/usePasteService', () => ({
  usePasteService: () => mockUsePasteService(),
}));

vi.mock('@arco-design/web-react', () => ({
  Button: ({ onClick, children, icon, ...props }: React.ComponentProps<'button'>) =>
    React.createElement('button', { onClick, ...props }, icon ?? children),
  Input: {
    TextArea: ({
      onFocus,
      onBlur,
      onChange,
      autoSize: _autoSize,
      ...props
    }: React.ComponentProps<'textarea'> & {
      onChange?: (value: string, event?: React.ChangeEvent<HTMLTextAreaElement>) => void;
      autoSize?: unknown;
    }) =>
      React.createElement('textarea', {
        onFocus,
        onBlur,
        ...props,
        onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => {
          onChange?.(event.target.value, event);
        },
      }),
  },
  Message: {
    useMessage: () => [{ warning: vi.fn() }, null],
  },
  Tag: ({ children }: { children: React.ReactNode }) => React.createElement('div', {}, children),
}));

vi.mock('@icon-park/react', () => ({
  ArrowUp: () => React.createElement('span', {}, 'ArrowUp'),
  CloseSmall: () => React.createElement('span', {}, 'CloseSmall'),
  SquareSmall: () => React.createElement('span', {}, 'SquareSmall'),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@renderer/hooks/ui/useLatestRef', () => ({
  useLatestRef: (value: unknown) => ({ current: value }),
}));

vi.mock('@renderer/services/FileService', () => ({
  allSupportedExts: [],
}));

vi.mock('@/renderer/components/chat/SlashCommandMenu', () => ({
  __esModule: true,
  default: () => React.createElement('div', {}, 'SlashCommandMenu'),
}));

vi.mock('@/renderer/hooks/chat/useSlashCommandController', () => ({
  useSlashCommandController: () => ({
    isOpen: false,
    filteredCommands: [],
    activeIndex: 0,
    setActiveIndex: vi.fn(),
    onSelectByIndex: vi.fn(),
    onKeyDown: vi.fn(() => false),
  }),
}));

vi.mock('@/renderer/utils/ui/focus', () => ({
  blurActiveElement: vi.fn(),
  shouldBlockMobileInputFocus: vi.fn(() => false),
}));

import SendBox from '@/renderer/components/chat/sendbox';

const Harness: React.FC<{
  onQueue?: (message: string) => void;
  onSteer?: (message: string) => void;
  onEditLatestPending?: () => void;
}> = ({ onQueue, onSteer, onEditLatestPending }) => {
  const [value, setValue] = useState('');

  return (
    <SendBox
      value={value}
      onChange={setValue}
      onSend={vi.fn().mockResolvedValue(undefined)}
      onQueue={onQueue}
      onSteer={onSteer}
      onEditLatestPending={onEditLatestPending}
    />
  );
};

describe('SendBox shortcut actions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('queues the current input when Tab is pressed', () => {
    const onQueue = vi.fn();
    const { container } = render(<Harness onQueue={onQueue} />);

    const textarea = container.querySelector('textarea');
    expect(textarea).toBeTruthy();

    fireEvent.change(textarea!, { target: { value: 'queue me' } });
    fireEvent.keyDown(textarea!, { key: 'Tab' });

    expect(onQueue).toHaveBeenCalledWith('queue me');
    expect((textarea as HTMLTextAreaElement).value).toBe('');
  });

  it('adds a steer message when Ctrl+Enter is pressed', () => {
    const onSteer = vi.fn();
    const { container } = render(<Harness onSteer={onSteer} />);

    const textarea = container.querySelector('textarea');
    expect(textarea).toBeTruthy();

    fireEvent.change(textarea!, { target: { value: 'guide this' } });
    fireEvent.keyDown(textarea!, { key: 'Enter', ctrlKey: true });

    expect(onSteer).toHaveBeenCalledWith('guide this');
  });

  it('restores the latest pending message when Option+ArrowUp is pressed', () => {
    const onEditLatestPending = vi.fn();
    const { container } = render(<Harness onEditLatestPending={onEditLatestPending} />);

    const textarea = container.querySelector('textarea');
    expect(textarea).toBeTruthy();

    fireEvent.keyDown(textarea!, { key: 'ArrowUp', altKey: true });

    expect(onEditLatestPending).toHaveBeenCalledTimes(1);
  });
});
