/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/renderer/hooks/context/ThemeContext', () => ({
  useThemeContext: () => ({
    theme: 'light',
  }),
}));

import CollapsibleContent from '@/renderer/components/chat/CollapsibleContent';

describe('CollapsibleContent', () => {
  const originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();

    if (originalScrollHeight) {
      Object.defineProperty(HTMLElement.prototype, 'scrollHeight', originalScrollHeight);
    } else {
      delete (HTMLElement.prototype as Partial<HTMLElement>).scrollHeight;
    }
  });

  it('shows the collapse toggle immediately on mount when content already exceeds maxHeight', () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get() {
        return 320;
      },
    });

    render(
      <CollapsibleContent maxHeight={120} defaultCollapsed>
        <div>Very tall content</div>
      </CollapsibleContent>
    );

    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
