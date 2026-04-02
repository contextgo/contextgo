import { act, fireEvent, render } from '@testing-library/react';
import React, { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
const mockMeasureTextLineCount = vi.fn();
const mockGetTextLayoutStyle = vi.fn(() => ({
  font: 'normal 400 14px Inter',
  lineHeight: 20,
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    conversation: {
      warmup: {
        invoke: vi.fn().mockResolvedValue(undefined),
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
}));

vi.mock('@/renderer/hooks/chat/useInputFocusRing', () => ({
  useInputFocusRing: () => mockUseInputFocusRing(),
}));

vi.mock('@/renderer/hooks/chat/useCompositionInput', () => ({
  useCompositionInput: () => ({
    isComposing: { current: false },
    compositionHandlers: {},
    createKeyDownHandler: (onEnterPress: () => void) => {
      return (event: React.KeyboardEvent) => {
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

vi.mock('@/renderer/utils/chat/textLayout', () => ({
  getTextLayoutStyle: (...args: unknown[]) => mockGetTextLayoutStyle(...args),
  measureTextLineCount: (...args: unknown[]) => mockMeasureTextLineCount(...args),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@icon-park/react', () => ({
  ArrowUp: () => React.createElement('span', {}, 'ArrowUp'),
  CloseSmall: () => React.createElement('span', {}, 'CloseSmall'),
}));

vi.mock('@arco-design/web-react', () => ({
  Button: ({ onClick, children, icon, ...props }: React.ComponentProps<'button'>) =>
    React.createElement('button', { onClick, ...props }, icon ?? children),
  Input: {
    TextArea: ({
      value,
      onChange,
      style,
      autoSize: _autoSize,
      onFocus,
      onBlur,
      onKeyDown,
      ...props
    }: React.ComponentProps<'textarea'> & {
      onChange?: (value: string, event?: React.ChangeEvent<HTMLTextAreaElement>) => void;
      autoSize?: unknown;
    }) =>
      React.createElement('textarea', {
        value,
        style,
        onFocus,
        onBlur,
        onKeyDown,
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

import SendBox from '@/renderer/components/chat/sendbox';

const Harness: React.FC<{ lockMultiLine?: boolean }> = ({ lockMultiLine = false }) => {
  const [value, setValue] = useState('');

  return (
    <SendBox
      value={value}
      onChange={setValue}
      onSend={vi.fn().mockResolvedValue(undefined)}
      lockMultiLine={lockMultiLine}
    />
  );
};

const setupTextarea = (textarea: HTMLTextAreaElement) => {
  Object.defineProperty(textarea, 'offsetWidth', {
    configurable: true,
    value: 180,
  });
};

describe('SendBox layout mode with pretext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockMeasureTextLineCount.mockReturnValue(1);
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('switches to multi-line mode when pretext reports multiple lines', async () => {
    const { container } = render(<Harness />);
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea).toBeTruthy();
    setupTextarea(textarea);

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    mockMeasureTextLineCount.mockReturnValue(2);

    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'A wrapped line candidate' } });
      await vi.runAllTimersAsync();
    });

    expect(mockMeasureTextLineCount).toHaveBeenCalledWith({
      text: 'A wrapped line candidate',
      maxWidth: 180,
      font: 'normal 400 14px Inter',
      lineHeight: 20,
    });
    expect(textarea.style.minHeight).toBe('80px');
    expect(textarea.style.whiteSpace).toBe('pre-wrap');
  });

  it('returns to single-line mode when pretext reports one line and layout is not locked', async () => {
    const { container } = render(<Harness />);
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea).toBeTruthy();
    setupTextarea(textarea);

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    mockMeasureTextLineCount.mockReturnValue(2);
    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'Long enough to wrap' } });
      await vi.runAllTimersAsync();
    });

    expect(textarea.style.minHeight).toBe('80px');

    mockMeasureTextLineCount.mockReturnValue(1);
    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'short' } });
      await vi.runAllTimersAsync();
    });

    expect(textarea.style.minHeight).toBe('20px');
    expect(textarea.style.whiteSpace).toBe('nowrap');
  });

  it('keeps multi-line mode when line count shrinks but multi-line mode is locked', async () => {
    const { container } = render(<Harness lockMultiLine />);
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea).toBeTruthy();
    setupTextarea(textarea);

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    mockMeasureTextLineCount.mockReturnValue(2);
    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'Long enough to wrap' } });
      await vi.runAllTimersAsync();
    });

    expect(textarea.style.minHeight).toBe('80px');

    mockMeasureTextLineCount.mockReturnValue(1);
    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'short' } });
      await vi.runAllTimersAsync();
    });

    expect(textarea.style.minHeight).toBe('80px');
    expect(textarea.style.whiteSpace).toBe('pre-wrap');
  });
});
