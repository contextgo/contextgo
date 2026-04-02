/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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

vi.mock('@renderer/components/Markdown', () => ({
  default: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@renderer/utils/chat/thinkTagFilter', () => ({
  hasThinkTags: () => false,
  stripThinkTags: (content: string) => content,
}));

vi.mock('../../../src/renderer/pages/conversation/Messages/components/MessageCronBadge', () => ({
  default: () => null,
}));

const createMessage = (content: string): IMessageText => ({
  id: 'msg-1',
  conversation_id: 'conv-1',
  type: 'text',
  position: 'right',
  content: { content },
});

describe('MessageText', () => {
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
});
