import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        'conversation.runStatus.runtimePlan.title': '计划',
        'conversation.runStatus.runtimePlan.expand': '展开',
        'conversation.runStatus.runtimePlan.collapse': '收起',
        'conversation.runStatus.runtimePlan.status.pending': '待处理',
        'conversation.runStatus.runtimePlan.status.in_progress': '进行中',
        'conversation.runStatus.runtimePlan.status.completed': '已完成',
      };

      if (key === 'conversation.runStatus.runtimePlan.progressLabel') {
        return `已完成 ${String(options?.completed ?? 0)} / ${String(options?.total ?? 0)}`;
      }

      if (key === 'conversation.runStatus.runtimePlan.pendingSummary') {
        return `还有 ${String(options?.count ?? 0)} 个步骤待完成`;
      }

      if (key === 'conversation.runStatus.runtimePlan.completedSummary') {
        return `${String(options?.count ?? 0)} 个步骤已完成`;
      }

      return map[key] ?? String(options?.defaultValue ?? key);
    },
  }),
}));

vi.mock('@arco-design/web-react', () => ({
  Button: ({ children, onClick, icon, ...props }: { children?: React.ReactNode; onClick?: () => void; icon?: React.ReactNode }) => (
    <button type='button' onClick={onClick} {...props}>
      {icon}
      {children}
    </button>
  ),
  Progress: ({ percent }: { percent: number }) => <div>{`progress:${percent}`}</div>,
  Tag: ({ children, color }: { children: React.ReactNode; color?: string }) => <span data-color={color}>{children}</span>,
}));

vi.mock('@icon-park/react', () => ({
  Down: () => <span>down</span>,
  Up: () => <span>up</span>,
}));

import RuntimePlanCard from '@/renderer/components/chat/RuntimePlanCard';

describe('RuntimePlanCard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a collapsed runtime summary first and expands to show all steps', () => {
    render(
      <RuntimePlanCard
        running
        entries={[
          { content: '整理上下文模型', status: 'completed' },
          { content: '同步当前会话计划', status: 'in_progress' },
          { content: '回写工作区摘要', status: 'pending' },
        ]}
      />
    );

    expect(screen.getByText('计划')).toBeInTheDocument();
    expect(screen.getByText('同步当前会话计划')).toBeInTheDocument();
    expect(screen.getByText('1/3')).toBeInTheDocument();
    expect(screen.getByText('33%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /展开/i })).toBeInTheDocument();
    expect(screen.queryByText('整理上下文模型')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /展开/i }));

    expect(screen.getByRole('button', { name: /收起/i })).toBeInTheDocument();
    expect(screen.getByText('progress:33')).toBeInTheDocument();
    expect(screen.getByText('整理上下文模型')).toBeInTheDocument();
    expect(screen.getByText('回写工作区摘要')).toBeInTheDocument();
    expect(screen.getAllByText('已完成').length).toBeGreaterThan(0);
    expect(screen.getByText('进行中')).toBeInTheDocument();
    expect(screen.getByText('待处理')).toBeInTheDocument();
    expect(screen.getByText('进行中')).toHaveAttribute('data-color', 'arcoblue');
  });

  it('returns null when there is no plan to render', () => {
    const { container } = render(<RuntimePlanCard entries={[]} />);

    expect(container.firstChild).toBeNull();
  });

  it('keeps the finished plan briefly and fades it out after the run settles', () => {
    const { rerender } = render(
      <RuntimePlanCard
        running
        entries={[
          { content: '同步当前会话计划', status: 'in_progress' },
          { content: '回写工作区摘要', status: 'pending' },
        ]}
      />
    );

    rerender(
      <RuntimePlanCard
        running={false}
        entries={[
          { content: '同步当前会话计划', status: 'completed' },
          { content: '回写工作区摘要', status: 'completed' },
        ]}
      />
    );

    rerender(<RuntimePlanCard running={false} entries={[]} />);

    expect(screen.getByText('2 个步骤已完成')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(899);
    });
    expect(screen.getByText('2 个步骤已完成')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(242);
    });
    expect(screen.queryByText('2 个步骤已完成')).not.toBeInTheDocument();
  });
});
