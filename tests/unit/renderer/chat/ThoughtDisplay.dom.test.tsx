import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/renderer/hooks/context/ThemeContext', () => ({
  useThemeContext: () => ({
    theme: 'light',
    setTheme: vi.fn(),
    colorScheme: 'default',
    setColorScheme: vi.fn(),
    fontScale: 1,
    setFontScale: vi.fn(),
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/renderer/components/Markdown', () => ({
  default: ({ children, className }: { children: string; className?: string }) => {
    const parts = children.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    return (
      <div className={className}>
        {parts.map((part, index) =>
          part.startsWith('**') && part.endsWith('**') ? <strong key={index}>{part.slice(2, -2)}</strong> : part
        )}
      </div>
    );
  },
}));

vi.mock('@arco-design/web-react', () => ({
  Button: ({
    children,
    icon,
    onClick,
    ...props
  }: {
    children?: React.ReactNode;
    icon?: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type='button' onClick={onClick} {...props}>
      {icon}
      {children}
    </button>
  ),
  Tag: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Spin: () => <div>spin</div>,
}));

import ThoughtDisplay from '@/renderer/components/chat/ThoughtDisplay';

describe('ThoughtDisplay', () => {
  it('renders a compact processing row when the run is active without a thought subject', () => {
    render(
      <ThoughtDisplay
        running
        thought={{
          subject: '',
          description: '',
        }}
      />
    );

    expect(screen.getByText('conversation.chat.processing')).toBeInTheDocument();
    expect(screen.getByText('spin')).toBeInTheDocument();
  });

  it('renders markdown formatting in live thought descriptions while running', () => {
    render(
      <ThoughtDisplay
        running
        thought={{
          subject: 'Analyzing',
          description: '**Important** next step',
        }}
      />
    );

    expect(screen.getByText('Important', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText('next step')).toBeInTheDocument();
  });

  it('renders a stop action when the run can be interrupted', () => {
    const onStop = vi.fn();

    render(
      <ThoughtDisplay
        running
        onStop={onStop}
        thought={{
          subject: 'Analyzing',
          description: 'Working through the next step',
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'conversation.group.workflow.decision.stop' }));

    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('does not render stale thought content after the run ends', () => {
    const { container } = render(
      <ThoughtDisplay
        running={false}
        thought={{
          subject: 'Analyzing',
          description: '**Important** next step',
        }}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});
