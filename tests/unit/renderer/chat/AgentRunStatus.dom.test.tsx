import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const I18N_MAP: Record<string, string> = {
  'conversation.runStatus.phase.reasoning': '思考中',
  'conversation.runStatus.phase.toolRunning': '工具执行中',
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) => {
      if (key === 'conversation.runStatus.activeTools') {
        return `${options?.count ?? 0} 个工具运行中`;
      }

      if (key === 'conversation.chat.processing') {
        return '处理中';
      }

      return I18N_MAP[key] ?? key;
    },
  }),
}));

vi.mock('@arco-design/web-react', () => ({
  Spin: () => <div>spin</div>,
}));

import AgentRunStatus from '@/renderer/components/chat/AgentRunStatus';
import type { AgentRunTrace } from '@/renderer/components/chat/AgentRunStatus/types';

const baseTrace: AgentRunTrace = {
  rawTask: '整理当前运行状态 UI',
  startedAt: new Date('2026-04-09T10:00:00.000Z').getTime(),
  backend: 'codex',
  modelId: 'gpt-5.4',
  sessionMode: 'workspace-write',
  phase: 'reasoning',
  liveThoughtText: '把运行态展示改成更贴近产品语义的摘要卡片',
  activeToolCount: 0,
};

describe('AgentRunStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-09T10:01:47.000Z'));
  });

  it('renders a single-line running summary without card actions', () => {
    render(<AgentRunStatus trace={baseTrace} running />);

    expect(screen.getByText('思考中')).toBeInTheDocument();
    expect(screen.getByText('把运行态展示改成更贴近产品语义的摘要卡片')).toBeInTheDocument();
    expect(screen.getByText('1m 47s')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('falls back to active tool summary when there is no live thought', () => {
    render(
      <AgentRunStatus
        trace={{
          ...baseTrace,
          phase: 'tool_running',
          liveThoughtText: '',
          activeToolCount: 2,
        }}
        running
      />
    );

    expect(screen.getByText('工具执行中')).toBeInTheDocument();
    expect(screen.getByText('2 个工具运行中')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /停止/i })).not.toBeInTheDocument();
  });

  it('does not render when the agent is not running', () => {
    const { container } = render(<AgentRunStatus trace={baseTrace} running={false} />);

    expect(container.firstChild).toBeNull();
  });
});
