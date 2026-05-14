/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { readLanguageHint, writeLanguageHint } from '@/renderer/services/i18n/languageHint';

const originalLocalStorage = globalThis.localStorage;

describe('languageHint', () => {
  afterEach(() => {
    if (originalLocalStorage === undefined) {
      delete (globalThis as { localStorage?: Storage }).localStorage;
    } else {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: originalLocalStorage,
      });
    }
    vi.restoreAllMocks();
  });

  it('reads the stored language hint when localStorage is available', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: vi.fn(() => 'zh-CN'),
        setItem: vi.fn(),
      },
    });

    expect(readLanguageHint('en-US')).toBe('zh-CN');
  });

  it('falls back safely when localStorage is missing', () => {
    delete (globalThis as { localStorage?: Storage }).localStorage;

    expect(readLanguageHint('en-US')).toBe('en-US');
    expect(() => writeLanguageHint('zh-CN')).not.toThrow();
  });
});
