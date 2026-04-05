import { render, screen } from '@testing-library/react';
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
  Tag: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Spin: () => <div>spin</div>,
}));

import ThoughtDisplay from '@/renderer/components/chat/ThoughtDisplay';

describe('ThoughtDisplay', () => {
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
