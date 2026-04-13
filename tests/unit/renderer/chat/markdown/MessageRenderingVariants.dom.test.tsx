/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { IMessageAcpToolCall, IMessageTips, IMessageToolCall } from '../../../../../src/common/chat/chatLib';
import MessageAcpToolCall from '../../../../../src/renderer/pages/conversation/Messages/acp/MessageAcpToolCall';
import MessageTips from '../../../../../src/renderer/pages/conversation/Messages/components/MessageTips';
import MessageToolCall from '../../../../../src/renderer/pages/conversation/Messages/components/MessageToolCall';

const markdownSpy = vi.fn(({ children }: { children?: React.ReactNode }) => <div>{children}</div>);

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

vi.mock('@renderer/components/Markdown', () => ({
  default: (props: { children?: React.ReactNode; codeVariant?: string }) => markdownSpy(props),
}));

vi.mock('@/renderer/hooks/file/useDiffPreviewHandlers', () => ({
  useDiffPreviewHandlers: () => ({
    handleFileClick: vi.fn(),
    handleDiffClick: vi.fn(),
  }),
}));

vi.mock('@/renderer/utils/file/diffUtils', () => ({
  parseDiff: () => ({ fileName: 'example.ts' }),
}));

vi.mock('@/renderer/components/base/FileChangesPanel', () => ({
  default: () => <div>file-changes-panel</div>,
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    shell: {
      openFile: { invoke: vi.fn() },
      showItemInFolder: { invoke: vi.fn() },
    },
  },
}));

vi.mock('@office-ai/platform', () => ({
  storage: {
    buildStorage: vi.fn(() => ({
      get: vi.fn(),
      set: vi.fn(),
      clear: vi.fn(),
      remove: vi.fn(),
      subscribe: vi.fn(),
    })),
  },
  theme: {
    Color: {
      FunctionalColor: {
        success: '#00aa55',
        warn: '#ff9900',
        error: '#dd3333',
      },
    },
  },
}));

vi.mock('@arco-design/web-react', () => ({
  Alert: ({ content }: { content?: React.ReactNode }) => <div>{content}</div>,
  Button: ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) => (
    <button type='button' {...props}>
      {children}
    </button>
  ),
  Card: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Message: {
    error: vi.fn(),
  },
  Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('@icon-park/react', () => ({
  Attention: () => <span>attention</span>,
  CheckOne: () => <span>check</span>,
  MessageSearch: () => <span>search</span>,
}));

describe('message code rendering variants', () => {
  it('renders shell tool calls with result-card variant', () => {
    const message: IMessageToolCall = {
      id: 'tool-1',
      conversation_id: 'conv-1',
      type: 'tool_call',
      content: {
        callId: 'call-1',
        name: 'run_shell_command',
        args: {
          command: 'echo hello',
          description: 'run greeting',
        },
      },
    };

    render(<MessageToolCall message={message} />);

    expect(markdownSpy).toHaveBeenCalledWith(expect.objectContaining({ codeVariant: 'result-card' }));
  });

  it('renders acp text payloads and raw input with result-card variant', () => {
    const message: IMessageAcpToolCall = {
      id: 'acp-1',
      conversation_id: 'conv-1',
      type: 'acp_tool_call',
      content: {
        update: {
          toolCallId: 'tool-call-1',
          kind: 'execute',
          title: 'Run shell command',
          status: 'in_progress',
          rawInput: 'echo hello',
          content: [
            {
              type: 'content',
              content: {
                type: 'text',
                text: '```bash\necho hello\n```',
              },
            },
          ],
        },
      },
    };

    render(<MessageAcpToolCall message={message} />);

    const resultCardPayloads = markdownSpy.mock.calls
      .map(([props]) => props)
      .filter((props) => props?.codeVariant === 'result-card')
      .map((props) => String(props.children));
    expect(resultCardPayloads.some((payload) => payload.includes('```bash') && payload.includes('echo hello'))).toBe(
      true
    );
    expect(resultCardPayloads.some((payload) => payload === '```\necho hello\n```')).toBe(true);
  });

  it('renders json tips with result-card variant', () => {
    const message: IMessageTips = {
      id: 'tips-1',
      conversation_id: 'conv-1',
      type: 'tips',
      content: {
        content: JSON.stringify({ ok: true, count: 1 }),
        type: 'success',
      },
    };

    render(<MessageTips message={message} />);

    expect(markdownSpy).toHaveBeenCalledWith(expect.objectContaining({ codeVariant: 'result-card' }));
    expect(screen.getByText(/"ok": true/)).toBeInTheDocument();
  });
});
