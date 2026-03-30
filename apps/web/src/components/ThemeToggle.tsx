'use client';

import { LaptopMinimal, Moon, SunMedium } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'contextgo-theme';

type ThemeMode = 'light' | 'dark' | 'system';

type ThemeDict = {
  toggle: string;
  light: string;
  dark: string;
  system: string;
};

const orderedModes: ThemeMode[] = ['system', 'light', 'dark'];

const getInitialMode = (): ThemeMode => {
  if (typeof document !== 'undefined') {
    const rootMode = document.documentElement.dataset.themeMode;

    if (rootMode === 'light' || rootMode === 'dark' || rootMode === 'system') {
      return rootMode;
    }
  }

  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  }

  return 'system';
};

const getResolvedTheme = (mode: ThemeMode): 'light' | 'dark' => {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  return mode;
};

const applyTheme = (mode: ThemeMode) => {
  const root = document.documentElement;
  root.dataset.themeMode = mode;
  root.dataset.theme = getResolvedTheme(mode);
};

export default function ThemeToggle({ dict }: { dict: ThemeDict }) {
  const [mode, setMode] = useState<ThemeMode>(getInitialMode);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
    applyTheme(mode);
  }, [mode]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (mode === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [mode]);

  const currentLabel = useMemo(() => {
    switch (mode) {
      case 'light':
        return dict.light;
      case 'dark':
        return dict.dark;
      default:
        return dict.system;
    }
  }, [dict.dark, dict.light, dict.system, mode]);

  const CurrentIcon = useMemo(() => {
    switch (mode) {
      case 'light':
        return SunMedium;
      case 'dark':
        return Moon;
      default:
        return LaptopMinimal;
    }
  }, [mode]);

  const handleToggle = () => {
    const nextMode = orderedModes[(orderedModes.indexOf(mode) + 1) % orderedModes.length];
    setMode(nextMode);
    localStorage.setItem(STORAGE_KEY, nextMode);
    applyTheme(nextMode);
  };

  return (
    <button
      type='button'
      onClick={handleToggle}
      className='theme-button-secondary inline-flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors'
      title={`${dict.toggle}: ${currentLabel}`}
      aria-label={`${dict.toggle}: ${currentLabel}`}
      suppressHydrationWarning
    >
      <CurrentIcon size={16} />
      <span className='hidden lg:inline'>{currentLabel}</span>
    </button>
  );
}
