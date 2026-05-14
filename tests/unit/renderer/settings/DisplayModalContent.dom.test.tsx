import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        'settings.theme': 'Theme',
        'settings.fontSize': 'Font Size',
        'settings.cssSettings': 'CSS Settings',
      };

      return labels[key] || key;
    },
  }),
}));

vi.mock('@/renderer/components/settings/ThemeSwitcher', () => ({
  ThemeSwitcher: () => <div data-testid='theme-switcher'>theme-switcher</div>,
}));

vi.mock('@/renderer/components/settings/FontSizeControl', () => ({
  default: () => <div data-testid='font-size-control'>font-size-control</div>,
}));

vi.mock('@/renderer/components/base/ContextGoScrollArea', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/renderer/components/settings/SettingsModal/settingsViewContext', () => ({
  useSettingsViewMode: () => 'page',
}));

import DisplayModalContent from '@/renderer/components/settings/SettingsModal/contents/DisplayModalContent';

describe('DisplayModalContent', () => {
  it('keeps theme and font-size settings but hides CSS settings', () => {
    render(<DisplayModalContent />);

    expect(screen.getByText('Theme')).toBeInTheDocument();
    expect(screen.getByText('Font Size')).toBeInTheDocument();
    expect(screen.getByTestId('theme-switcher')).toBeInTheDocument();
    expect(screen.getByTestId('font-size-control')).toBeInTheDocument();
    expect(screen.queryByText('CSS Settings')).not.toBeInTheDocument();
  });
});
