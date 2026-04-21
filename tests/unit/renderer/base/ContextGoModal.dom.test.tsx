/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
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

vi.mock('@arco-design/web-react', () => ({
  Modal: ({
    children,
    visible,
    className,
    style,
  }: {
    children?: React.ReactNode;
    visible?: boolean;
    className?: string;
    style?: React.CSSProperties;
  }) => {
    if (!visible) {
      return null;
    }

    return (
      <div data-testid='arco-modal' className={className} style={style}>
        {children}
      </div>
    );
  },
  Button: ({ children }: { children?: React.ReactNode }) => <button type='button'>{children}</button>,
}));

vi.mock('@icon-park/react', () => ({
  Close: ({ size, fill }: { size?: number; fill?: string }) => (
    <span data-size={size} data-fill={fill}>
      close
    </span>
  ),
}));

import ContextGoModal from '@/renderer/components/base/ContextGoModal';

describe('ContextGoModal', () => {
  it('does not render an empty footer shell when the custom footer returns nothing', () => {
    const { container } = render(
      <ContextGoModal visible={true} header='Update' footer={{ render: () => null }}>
        <div>content</div>
      </ContextGoModal>
    );

    expect(screen.getByText('Update')).toBeInTheDocument();
    expect(screen.getByText('content')).toBeInTheDocument();
    expect(container.querySelector('.flex-shrink-0.bg-transparent')).toBeNull();
  });

  it('renders the footer shell when the custom footer returns content', () => {
    const { container } = render(
      <ContextGoModal
        visible={true}
        header='Update'
        footer={{
          render: () => <div>Footer actions</div>,
        }}
      >
        <div>content</div>
      </ContextGoModal>
    );

    expect(screen.getByText('Footer actions')).toBeInTheDocument();
    expect(container.querySelector('.flex-shrink-0.bg-transparent')).not.toBeNull();
  });
});
