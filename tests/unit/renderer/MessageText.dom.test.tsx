/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IMessageText } from '../../../src/common/chat/chatLib';
import MessageText from '../../../src/renderer/pages/conversation/Messages/components/MessagetText';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

vi.mock('@arco-design/web-react', () => ({
  Alert: ({ content }: { content?: React.ReactNode }) => <div>{content}</div>,
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
  copyText: vi.fn(async () => undefined),
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

describe('MessageText', () => {
  beforeEach(() => {
    markdownSpy.mockClear();
  });

  it('passes result-card code variant to assistant markdown content', () => {
    render(<MessageText message={createMessage('```ts\nconst answer = 42;\n```', 'left')} />);

    expect(markdownSpy).toHaveBeenCalledWith(expect.objectContaining({ codeVariant: 'result-card' }));
  });

  it('keeps user markdown content on the default code variant', () => {
    render(<MessageText message={createMessage('```ts\nconst answer = 42;\n```')} />);

    expect(markdownSpy).toHaveBeenCalledWith(expect.objectContaining({ codeVariant: undefined }));
  });

  it('renders file preview without empty text bubble when content only contains file marker', () => {
    render(<MessageText message={createMessage('[[CONTEXTGO_FILES]]\n/tmp/voice.wav')} />);

    expect(screen.getByText('file:/tmp/voice.wav')).toBeInTheDocument();
    expect(screen.queryByText('[[CONTEXTGO_FILES]]')).not.toBeInTheDocument();
    expect(screen.queryByText('copy')).not.toBeInTheDocument();
  });

  it('renders text body together with attached file previews', () => {
    render(<MessageText message={createMessage('RTF1模式是啥意思\n\n[[CONTEXTGO_FILES]]\n/tmp/voice.wav')} />);

    expect(screen.getByText('RTF1模式是啥意思')).toBeInTheDocument();
    expect(screen.getByText('file:/tmp/voice.wav')).toBeInTheDocument();
    expect(screen.getByText('copy')).toBeInTheDocument();
  });

  it('renders file operation messages as a structured card instead of markdown', () => {
    render(<MessageText message={createMessage('📝 **File written:** `/tmp/MessageMiddleware.ts`\n\n```ts\nconst a = 1;\nconst b = 2;\n```', 'left')} />);

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
});
