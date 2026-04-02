import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (key === 'conversation.contextUsage.title') {
        return `Context usage ${params?.percentage}`;
      }
      if (key === 'conversation.contextUsage.used') return 'Used';
      if (key === 'conversation.contextUsage.remaining') return 'Remaining';
      if (key === 'conversation.contextUsage.limit') return 'Limit';
      if (key === 'conversation.contextUsage.contextUsed') return 'context used';
      return key;
    },
  }),
}));

vi.mock('@arco-design/web-react', () => ({
  Popover: ({ children, content }: { children: React.ReactNode; content: React.ReactNode }) => (
    <div>
      <div data-testid='popover-trigger'>{children}</div>
      <div data-testid='popover-content'>{content}</div>
    </div>
  ),
}));

import ContextUsageIndicator, { formatTokenCount } from '@/renderer/components/agent/ContextUsageIndicator';

describe('ContextUsageIndicator', () => {
  it('shows percentage and concrete usage details in the hover content', () => {
    render(<ContextUsageIndicator tokenUsage={{ totalTokens: 51200 }} contextLimit={128000} />);

    expect(screen.getByLabelText('Context usage 40.0%')).toBeInTheDocument();
    expect(screen.getByText('Context usage 40.0%')).toBeInTheDocument();
    expect(screen.getByText('Used')).toBeInTheDocument();
    expect(screen.getByText('51.2K')).toBeInTheDocument();
    expect(screen.getByText('Remaining')).toBeInTheDocument();
    expect(screen.getByText('76.8K')).toBeInTheDocument();
    expect(screen.getByText('Limit')).toBeInTheDocument();
    expect(screen.getByText('128K')).toBeInTheDocument();
  });

  it('caps the ring fill at 100% while preserving the real percentage label', () => {
    const { container } = render(<ContextUsageIndicator tokenUsage={{ totalTokens: 1500 }} contextLimit={1000} />);

    expect(screen.getByLabelText('Context usage 150.0%')).toBeInTheDocument();

    const circles = container.querySelectorAll('circle');
    const progressCircle = circles[1];
    expect(progressCircle).toBeTruthy();
    expect(progressCircle?.getAttribute('stroke-dashoffset')).toBe('0');
  });

  it('formats token counts compactly', () => {
    expect(formatTokenCount(999)).toBe('999');
    expect(formatTokenCount(1200)).toBe('1.2K');
    expect(formatTokenCount(1000000, true)).toBe('1M');
  });
});
