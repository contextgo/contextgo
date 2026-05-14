/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { IMessageCodexToolCall, IMessageToolGroup } from '../../../../src/common/chat/chatLib';
import MessageToolGroupSummary, {
  type StepSummaryEntry,
} from '../../../../src/renderer/pages/conversation/Messages/components/MessageToolGroupSummary';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) => {
      if (!options || typeof options.count !== 'number') {
        return key;
      }
      return `${key}:${options.count}`;
    },
  }),
}));

vi.mock('@arco-design/web-react', () => ({
  Badge: ({ text, status, className }: { text?: React.ReactNode; status?: string; className?: string }) => (
    <span data-status={status} className={className}>
      {text ?? 'badge'}
    </span>
  ),
  Tooltip: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@arco-design/web-react/icon', () => ({
  IconDown: () => <span>down</span>,
  IconRight: () => <span>right</span>,
}));

vi.mock('@icon-park/react', () => ({
  DeleteOne: () => <span>delete</span>,
  EditTwo: () => <span>edit</span>,
  FileText: () => <span>file</span>,
  PreviewOpen: () => <span>preview</span>,
  Search: () => <span>search</span>,
  Terminal: () => <span>terminal</span>,
  Tool: () => <span>tool</span>,
  Write: () => <span>write</span>,
}));

describe('MessageToolGroupSummary', () => {
  it('renders one compact summary row for mixed file and tool steps and reveals details on expand', () => {
    const toolMessage: IMessageToolGroup = {
      id: 'tool-1',
      conversation_id: 'conv-1',
      type: 'tool_group',
      position: 'left',
      content: [
        {
          callId: 'call-1',
          name: 'ReadWorkspace',
          description: 'inspect repo structure',
          renderOutputAsMarkdown: false,
          status: 'Success',
        },
      ],
    };

    const steps: StepSummaryEntry[] = [
      {
        type: 'file_operation',
        id: 'step-file-1',
        operation: { kind: 'read', path: '/tmp/IScheduleEventEmitter.ts' },
      },
      {
        type: 'file_operation',
        id: 'step-file-2',
        operation: { kind: 'read', path: '/tmp/IScheduleJobExecutor.ts' },
      },
      {
        type: 'tool',
        id: 'step-tool-1',
        message: toolMessage,
      },
      {
        type: 'file_operation',
        id: 'step-file-3',
        operation: { kind: 'written', path: '/tmp/ScheduleService.ts', method: 'fs/write_text_file' },
      },
    ];

    render(<MessageToolGroupSummary steps={steps} />);

    expect(screen.getAllByText('messages.stepSummary.viewSteps')).toHaveLength(1);
    expect(screen.getByText('messages.fileOperation.summary.read:2')).toBeInTheDocument();
    expect(screen.getByText('messages.fileOperation.summary.written:1')).toBeInTheDocument();
    expect(screen.getByText('messages.stepSummary.tools:1')).toBeInTheDocument();
    expect(screen.queryByText('IScheduleEventEmitter.ts')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('messages.stepSummary.viewSteps'));

    expect(screen.getByText(/IScheduleEventEmitter\.ts/)).toBeInTheDocument();
    expect(screen.getByText(/IScheduleJobExecutor\.ts/)).toBeInTheDocument();
    expect(screen.getByText(/ScheduleService\.ts/)).toBeInTheDocument();
    expect(screen.getByText('fs/write_text_file')).toBeInTheDocument();
    expect(screen.getByText('ReadWorkspace(inspect repo structure)')).toBeInTheDocument();

    fireEvent.click(screen.getByText('messages.stepSummary.viewSteps'));

    expect(screen.queryByText(/IScheduleEventEmitter\.ts/)).not.toBeInTheDocument();
    expect(screen.queryByText('ReadWorkspace(inspect repo structure)')).not.toBeInTheDocument();
  });

  it('normalizes non-string tool descriptions instead of crashing', () => {
    const toolMessage: IMessageToolGroup = {
      id: 'tool-structured',
      conversation_id: 'conv-1',
      type: 'tool_group',
      position: 'left',
      content: [
        {
          callId: 'call-structured',
          name: 'ReadWorkspace',
          description: { command: ['ls', '-la'], cwd: '/tmp' } as unknown as string,
          renderOutputAsMarkdown: false,
          status: 'Success',
        },
      ],
    };

    const steps: StepSummaryEntry[] = [
      {
        type: 'tool',
        id: 'step-tool-structured',
        message: toolMessage,
      },
    ];

    render(<MessageToolGroupSummary steps={steps} />);

    fireEvent.click(screen.getByText('messages.stepSummary.viewSteps'));

    expect(screen.getByText(/ReadWorkspace/)).toBeInTheDocument();
    expect(screen.getByText(/"command"/)).toBeInTheDocument();
    expect(screen.getByText(/"cwd": "\/tmp"/)).toBeInTheDocument();
  });

  it('renders edit icon markers for codex patch tool calls', () => {
    const codexMessage: IMessageCodexToolCall = {
      id: 'codex-1',
      conversation_id: 'conv-1',
      type: 'codex_tool_call',
      position: 'left',
      content: {
        toolCallId: 'codex-call-1',
        status: 'success',
        kind: 'patch',
        subtype: 'turn_diff',
        description:
          'Edit /Users/bytedance/contextgo/contextgo/src/process/services/context/TextChunkingService.ts(edit)',
        content: [
          {
            type: 'diff',
            filePath: '/Users/bytedance/contextgo/contextgo/src/process/services/context/TextChunkingService.ts',
          },
        ],
        startTime: 1,
        endTime: 2,
        data: { files: [] },
      },
    };

    const steps: StepSummaryEntry[] = [
      {
        type: 'tool',
        id: 'step-codex-tool-1',
        message: codexMessage,
      },
    ];

    const { container } = render(<MessageToolGroupSummary steps={steps} />);

    fireEvent.click(screen.getByText('messages.stepSummary.viewSteps'));

    expect(
      screen.getByText(
        'Edit /Users/bytedance/contextgo/contextgo/src/process/services/context/TextChunkingService.ts(edit)'
      )
    ).toBeInTheDocument();
    expect(container.querySelector('.step-item-icon-chip--edit')).not.toBeNull();
  });
});
