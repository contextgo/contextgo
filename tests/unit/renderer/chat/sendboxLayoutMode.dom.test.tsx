import { readFileSync } from 'node:fs';
import path from 'node:path';
import { act, fireEvent, render, screen } from '@testing-library/react';
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
  usePreviewComposer: () => mockUsePreviewContext(),
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
  CloseOne: () => React.createElement('span', {}, 'CloseOne'),
  CloseSmall: () => React.createElement('span', {}, 'CloseSmall'),
  FileText: () => React.createElement('span', {}, 'FileText'),
  Square: () => React.createElement('span', {}, 'Square'),
  SquareSmall: () => React.createElement('span', {}, 'SquareSmall'),
}));

vi.mock('@arco-design/web-react', () => ({
  Button: ({ onClick, children, icon, ...props }: React.ComponentProps<'button'>) =>
    React.createElement('button', { onClick, ...props }, icon, children),
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
  Drawer: ({ visible, title, children }: { visible?: boolean; title?: React.ReactNode; children?: React.ReactNode }) =>
    visible
      ? React.createElement(
          'div',
          {
            role: 'dialog',
          },
          React.createElement('div', {}, title),
          children
        )
      : null,
  Tag: ({ children }: { children: React.ReactNode }) => React.createElement('div', {}, children),
  Tooltip: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, {}, children),
}));

import SendBox from '@/renderer/components/chat/sendbox';
import SendContextPreview from '@/renderer/components/chat/SendContextPreview';

const Harness: React.FC<{ lockMultiLine?: boolean; initialValue?: string }> = ({
  lockMultiLine = false,
  initialValue = '',
}) => {
  const [value, setValue] = useState(initialValue);

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

const createContextPreview = () => ({
  searchMode: 'hybrid' as const,
  queryTerms: ['alpha'],
  budgetTokens: 2400,
  spentTokens: 680,
  sectionCount: 3,
  omittedCount: 1,
  memoryRefCount: 2,
  sourceRefCount: 1,
  profileRefCount: 1,
  artifactRefCount: 0,
  threadSummaryIncluded: true,
  mountedSectionCount: 2,
  mountedProfileCount: 1,
  pinnedInstructionCount: 1,
  sections: [
    {
      id: 'section-1',
      kind: 'thread-state' as const,
      source: 'mounted' as const,
      summary: 'Thread snapshot',
      tokenCount: 120,
    },
  ],
});

describe('SendBox layout mode with pretext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockUseLayoutContext.mockReturnValue({ isMobile: false });
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

  it('uses the standard square stop glyph as the only danger action while loading', () => {
    render(
      <SendBox
        value=''
        onChange={vi.fn()}
        onSend={vi.fn().mockResolvedValue(undefined)}
        onStop={vi.fn().mockResolvedValue(undefined)}
        loading
      />
    );

    const stopButton = screen.getByRole('button', { name: 'conversation.group.workflow.decision.stop' });
    const stopStyle = stopButton.getAttribute('style') ?? '';

    expect(stopButton).toHaveTextContent('Square');
    expect(stopStyle).toContain('rgb(var(--danger-6))');
    expect(stopStyle).toContain('rgba(var(--danger-6), 0.12)');
    expect(stopStyle).toContain('rgba(var(--danger-6), 0.24)');
  });

  it('keeps bottom controls in a single aligned row on mobile multi-line mode', () => {
    mockUseLayoutContext.mockReturnValue({ isMobile: true });

    const { container } = render(
      <SendBox
        value={'Already wrapped\ncontent'}
        onChange={vi.fn()}
        onSend={vi.fn().mockResolvedValue(undefined)}
        tools={<div>tool-group</div>}
        sendButtonPrefix={<div>context-usage</div>}
      />
    );

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea).toBeTruthy();
    expect(screen.getByText('tool-group')).toBeInTheDocument();
    expect(screen.getByText('context-usage')).toBeInTheDocument();

    const controlsBlock = screen.getByText('tool-group').closest('div[class*=justify-between]');
    expect(controlsBlock?.className).toContain('items-end');

    const mobileToolsTrack = screen.getByText('tool-group').parentElement;
    const mobileTools = mobileToolsTrack?.parentElement;
    const mobileToolsShell = mobileTools?.parentElement;
    expect(mobileTools?.className).toContain('sendbox-tools-scroll-mobile');
    expect(mobileTools?.className).toContain('sendbox-tools-scroll-mobile-bottom');
    expect(mobileToolsTrack?.className).toContain('sendbox-tools-scroll-mobile-track');
    expect(mobileToolsShell?.className).toContain('sendbox-tools-mobile-shell');
    expect(mobileToolsShell?.className).toContain('flex-1');

    const actionsRow = screen.getByText('context-usage').parentElement;
    expect(actionsRow?.className).toContain('sendbox-mobile-actions');
    expect(actionsRow?.className).toContain('items-end');
  });

  it('keeps mobile tool rows bottom-aligned when mixing icon buttons and pills', () => {
    mockUseLayoutContext.mockReturnValue({ isMobile: true });

    const { container } = render(
      <SendBox
        value={'Already wrapped\ncontent'}
        onChange={vi.fn()}
        onSend={vi.fn().mockResolvedValue(undefined)}
        tools={
          <div className='sendbox-tool-cluster'>
            <button type='button' className='sendbox-tool-button'>
              plus
            </button>
            <div className='sendbox-tool-pill-row'>
              <button type='button' className='sendbox-model-btn agent-mode-compact-pill'>
                permission
              </button>
            </div>
          </div>
        }
      />
    );

    const mobileTools = container.querySelector('.sendbox-tools-scroll-mobile') as HTMLDivElement | null;
    const mobileToolsTrack = container.querySelector('.sendbox-tools-scroll-mobile-track') as HTMLDivElement | null;
    const mobileToolsShell = container.querySelector('.sendbox-tools-mobile-shell') as HTMLDivElement | null;
    const toolCluster = container.querySelector('.sendbox-tool-cluster') as HTMLDivElement | null;
    const pillRow = container.querySelector('.sendbox-tool-pill-row') as HTMLDivElement | null;

    expect(mobileTools).toBeTruthy();
    expect(mobileToolsTrack).toBeTruthy();
    expect(mobileToolsShell).toBeTruthy();
    expect(mobileTools?.className).toContain('sendbox-tools-scroll-mobile');
    expect(mobileTools?.className).toContain('sendbox-tools-scroll-mobile-bottom');
    expect(mobileToolsTrack?.className).toContain('sendbox-tools-scroll-mobile-track');
    expect(mobileToolsShell?.className).toContain('sendbox-tools-mobile-shell');
    expect(toolCluster?.className).toContain('sendbox-tool-cluster');
    expect(pillRow?.className).toContain('sendbox-tool-pill-row');
  });

  it('restores desktop textarea focus after a transient window blur', async () => {
    const { container } = render(<Harness initialValue='draft text' />);
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea).toBeTruthy();
    setupTextarea(textarea);

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    await act(async () => {
      textarea.focus();
      fireEvent.focus(textarea);
    });

    textarea.setSelectionRange(5, 5);
    fireEvent.select(textarea);

    expect(document.activeElement).toBe(textarea);

    await act(async () => {
      window.dispatchEvent(new Event('blur'));
      textarea.blur();
    });

    expect(document.activeElement).not.toBe(textarea);

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await vi.runAllTimersAsync();
    });

    expect(document.activeElement).toBe(textarea);
    expect(textarea.selectionStart).toBe(5);
    expect(textarea.selectionEnd).toBe(5);
  });

  it('does not steal focus when the textarea was not focused before window blur', async () => {
    const { container } = render(<Harness initialValue='draft text' />);
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    const button = container.querySelector('button') as HTMLButtonElement;
    expect(textarea).toBeTruthy();
    expect(button).toBeTruthy();
    setupTextarea(textarea);

    await act(async () => {
      vi.advanceTimersByTime(100);
      textarea.blur();
      button.focus();
      window.dispatchEvent(new Event('blur'));
      window.dispatchEvent(new Event('focus'));
      await vi.runAllTimersAsync();
    });

    expect(document.activeElement).not.toBe(textarea);
    expect(document.activeElement).toBe(button);
  });

  it('opens the shared context preview drawer from the status-row button', () => {
    const { container } = render(<SendContextPreview preview={createContextPreview()} active />);

    fireEvent.click(screen.getByRole('button', { name: 'messages.contextPreview.composerTag' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);
    expect(container.querySelector('.sendbox-context-preview__scroll')).toBeNull();
    expect(container.querySelector('.sendbox-context-preview__header')).toBeNull();
    expect(container.querySelector('.sendbox-context-preview__meta')).toBeNull();
    expect(screen.getByText('messages.contextPreview.subtitle')).toBeInTheDocument();
    expect(screen.getByText('messages.contextPreview.short.memoryRefs')).toBeInTheDocument();
    expect(screen.getByText('Thread snapshot')).toBeInTheDocument();
  });

  it('does not reserve a fixed run-status height for absent plan rows', () => {
    const css = readFileSync(path.join(process.cwd(), 'src/renderer/components/chat/sendbox.css'), 'utf8');

    expect(css).not.toContain('conversation-run-status-stack--double');
    expect(css).not.toContain('conversation-run-status-stack--triple');
    expect(css).not.toContain('conversation-run-status-stack--active');
    expect(css).not.toMatch(/conversation-run-status-stack--single[^{]*\{[^}]*min-height/s);
  });
});
