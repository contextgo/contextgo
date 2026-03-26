import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const setFontScaleMock = vi.fn().mockResolvedValue(undefined);

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === 'settings.fontSizeReset') {
        return 'Reset zoom';
      }
      return key;
    },
  }),
}));

const themeContextState = {
  fontScale: 1,
  setFontScale: (...args: unknown[]) => setFontScaleMock(...args),
  theme: 'light',
};

vi.mock('@renderer/hooks/context/ThemeContext', () => ({
  useThemeContext: () => themeContextState,
}));

vi.mock('@arco-design/web-react', () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type='button' onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  Slider: ({
    value,
    onChange,
    onAfterChange,
  }: {
    value: number;
    onChange?: (value: number) => void;
    onAfterChange?: (value: number) => void;
  }) => (
    <div>
      <span data-testid='slider-value'>{value}</span>
      <button type='button' onClick={() => onChange?.(1.2)}>
        drag
      </button>
      <button type='button' onClick={() => onAfterChange?.(1.2)}>
        release
      </button>
    </div>
  ),
}));

import FontSizeControl from '@/renderer/components/settings/FontSizeControl';

describe('FontSizeControl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    themeContextState.fontScale = 1;
  });

  it('updates the displayed zoom while dragging without committing immediately', () => {
    render(<FontSizeControl />);

    expect(screen.getByText('100%')).toBeInTheDocument();

    fireEvent.click(screen.getByText('drag'));

    expect(screen.getByText('120%')).toBeInTheDocument();
    expect(setFontScaleMock).not.toHaveBeenCalled();
  });

  it('commits zoom when the drag interaction finishes', () => {
    render(<FontSizeControl />);

    fireEvent.click(screen.getByText('drag'));
    fireEvent.click(screen.getByText('release'));

    expect(setFontScaleMock).toHaveBeenCalledWith(1.2);
  });

  it('keeps button-based zoom changes immediate', () => {
    render(<FontSizeControl />);

    fireEvent.click(screen.getByText('+'));

    expect(setFontScaleMock).toHaveBeenCalledWith(1.05);
  });
});
