/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IMessageText } from '../../../src/common/chat/chatLib';
import { LayoutContext } from '../../../src/renderer/hooks/context/LayoutContext';
import MessageText from '../../../src/renderer/pages/conversation/Messages/components/MessagetText';

const { copyTextMock } = vi.hoisted(() => ({
  copyTextMock: vi.fn(async () => undefined),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

vi.mock('@arco-design/web-react', () => ({
  Alert: ({ content }: { content?: React.ReactNode }) => <div>{content}</div>,
  Button: ({
    children,
    icon,
    ...props
  }: { children?: React.ReactNode; icon?: React.ReactNode } & Record<string, unknown>) => (
    <button type='button' {...props}>
      {icon}
      {children}
    </button>
  ),
  Message: {
    error: vi.fn(),
  },
  Tooltip: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@icon-park/react', () => ({
  Copy: () => <span>copy</span>,
  DeleteOne: () => <span>delete</span>,
  FileText: () => <span>file-icon</span>,
  PreviewOpen: () => <span>preview</span>,
  Write: () => <span>write</span>,
}));

vi.mock('@/renderer/utils/ui/clipboard', () => ({
  copyText: copyTextMock,
}));

vi.mock('@renderer/components/chat/CollapsibleContent', () => ({
  default: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@renderer/components/media/FilePreview', () => ({
  default: ({ path }: { path: string }) => <div>file:{path}</div>,
}));

vi.mock('@renderer/components/media/HorizontalFileList', () => ({
  default: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

const markdownSpy = vi.fn(({ children }: { children?: React.ReactNode }) => <div>{children}</div>);

vi.mock('@renderer/components/Markdown', () => ({
  default: (props: { children?: React.ReactNode; codeVariant?: string }) => markdownSpy(props),
}));

vi.mock('@renderer/utils/chat/thinkTagFilter', () => ({
  hasThinkTags: () => false,
  stripThinkTags: (content: string) => content,
}));

vi.mock('../../../src/renderer/pages/conversation/Messages/components/MessageScheduleBadge', () => ({
  default: () => null,
}));

const createMessage = (content: string, position: 'left' | 'right' = 'right'): IMessageText => ({
  id: 'msg-1',
  conversation_id: 'conv-1',
  type: 'text',
  position,
  content: { content },
});

const renderMessage = (message: IMessageText, isMobile = false) =>
  render(
    <LayoutContext.Provider
      value={{
        isMobile,
        siderCollapsed: false,
        setSiderCollapsed: vi.fn(),
      }}
    >
      <MessageText message={message} />
    </LayoutContext.Provider>
  );

describe('MessageText', () => {
  beforeEach(() => {
    markdownSpy.mockClear();
    copyTextMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes result-card code variant to assistant markdown content', () => {
    renderMessage(createMessage('```ts\nconst answer = 42;\n```', 'left'));

    expect(markdownSpy).toHaveBeenCalledWith(expect.objectContaining({ codeVariant: 'result-card' }));
  });

  it('keeps user markdown content on the default code variant', () => {
    renderMessage(createMessage('```ts\nconst answer = 42;\n```'));

    expect(markdownSpy).toHaveBeenCalledWith(expect.objectContaining({ codeVariant: undefined }));
  });

  it('renders file preview without empty text bubble when content only contains file marker', () => {
    renderMessage(createMessage('[[CONTEXTGO_FILES]]\n/tmp/voice.wav'));

    expect(screen.getByText('file:/tmp/voice.wav')).toBeInTheDocument();
    expect(screen.queryByText('[[CONTEXTGO_FILES]]')).not.toBeInTheDocument();
    expect(screen.queryByText('copy')).not.toBeInTheDocument();
  });

  it('renders text body together with attached file previews', () => {
    renderMessage(createMessage('RTF1模式是啥意思\n\n[[CONTEXTGO_FILES]]\n/tmp/voice.wav'));

    expect(screen.getByText('RTF1模式是啥意思')).toBeInTheDocument();
    expect(screen.getByText('file:/tmp/voice.wav')).toBeInTheDocument();
    expect(screen.queryByText('copy')).not.toBeInTheDocument();
  });

  it('renders file operation messages as a structured card instead of markdown', () => {
    renderMessage(
      createMessage(
        '📝 **File written:** `/tmp/MessageMiddleware.ts`\n\n```ts\nconst a = 1;\nconst b = 2;\n```',
        'left'
      )
    );

    expect(screen.getByText('messages.fileOperation.written')).toBeInTheDocument();
    expect(screen.getAllByText('MessageMiddleware.ts').length).toBeGreaterThan(0);
    expect(screen.getByText('/tmp/MessageMiddleware.ts')).toBeInTheDocument();
    expect(screen.getByText('TS')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getAllByText('+').length).toBeGreaterThan(0);
    expect(screen.getByText('const a = 1;')).toBeInTheDocument();
    expect(screen.getByText('const b = 2;')).toBeInTheDocument();
    expect(markdownSpy).not.toHaveBeenCalled();
  });

  it('renders assistant JSON objects as a structured parameter card with raw JSON fallback', () => {
    renderMessage(
      createMessage(
        JSON.stringify({
          model: 'gemini-3-pro-image-preview',
          prompt: '一只橘猫坐在红色沙发上，电影感光影，高清细节',
          size: '1:1',
        }),
        'left'
      )
    );

    expect(screen.getByText('messages.jsonCard.parameters')).toBeInTheDocument();
    expect(screen.getByText('messages.jsonCard.model')).toBeInTheDocument();
    expect(screen.getByText('messages.jsonCard.prompt')).toBeInTheDocument();
    expect(screen.getByText('messages.jsonCard.size')).toBeInTheDocument();
    expect(screen.getByText('gemini-3-pro-image-preview')).toBeInTheDocument();
    expect(screen.getAllByText('一只橘猫坐在红色沙发上，电影感光影，高清细节').length).toBeGreaterThan(0);
    expect(screen.getByText('1:1')).toBeInTheDocument();
    expect(screen.getByText('messages.jsonCard.rawJson')).toBeInTheDocument();
    expect(screen.getByText(/"model": "gemini-3-pro-image-preview"/)).toBeInTheDocument();
    expect(markdownSpy).not.toHaveBeenCalled();
  });

  it('keeps assistant JSON arrays on the markdown code path', () => {
    renderMessage(createMessage(JSON.stringify([{ model: 'gemini-3-pro-image-preview' }]), 'left'));

    expect(markdownSpy).toHaveBeenCalledWith(expect.objectContaining({ codeVariant: 'result-card' }));
    expect(screen.queryByText('messages.jsonCard.parameters')).not.toBeInTheDocument();
  });

  it('does not reserve right-side copy padding inside user bubbles', () => {
    const { container } = renderMessage(createMessage('hello user bubble'));
    const bubble = container.querySelector('.bg-aou-2');

    expect(bubble?.className).not.toContain('pr-40px');
  });

  it('keeps copy-button padding inside assistant text cards', () => {
    const { container } = renderMessage(createMessage('hello assistant bubble', 'left'));
    const bubble = container.querySelector('.relative.min-w-0');

    expect(bubble?.className).toContain('pr-40px');
  });

  it('hides the floating copy button on mobile assistant messages', () => {
    const { container } = renderMessage(createMessage('hello assistant bubble', 'left'), true);
    const bubble = container.querySelector('.relative.min-w-0');

    expect(screen.queryByRole('button', { name: 'Copy' })).not.toBeInTheDocument();
    expect(bubble?.className).not.toContain('pr-40px');
  });

  it('copies message text after a mobile long press', async () => {
    vi.useFakeTimers();
    renderMessage(createMessage('copy me with long press', 'left'), true);

    const bubble = screen.getByText('copy me with long press').parentElement;
    expect(bubble).not.toBeNull();

    fireEvent.touchStart(bubble!);

    await act(async () => {
      vi.advanceTimersByTime(450);
      fireEvent.touchEnd(bubble!);
      await Promise.resolve();
    });

    expect(copyTextMock).toHaveBeenCalledWith('copy me with long press');
  });

  it('does not copy when the mobile touch ends before the long-press threshold', async () => {
    vi.useFakeTimers();
    renderMessage(createMessage('do not copy on tap', 'left'), true);

    const bubble = screen.getByText('do not copy on tap').parentElement;
    expect(bubble).not.toBeNull();

    fireEvent.touchStart(bubble!);

    await act(async () => {
      vi.advanceTimersByTime(200);
      fireEvent.touchEnd(bubble!);
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });

    expect(copyTextMock).not.toHaveBeenCalled();
  });
});
