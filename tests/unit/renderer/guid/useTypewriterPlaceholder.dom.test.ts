/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTypewriterPlaceholder } from '@/renderer/pages/guid/hooks/useTypewriterPlaceholder';

describe('useTypewriterPlaceholder', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('types the provided text and keeps the final value when there is only one phrase', () => {
    const { result } = renderHook(() => useTypewriterPlaceholder('Launch the workbench'));

    expect(result.current).toBe('');

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe('L|');

    act(() => {
      vi.advanceTimersByTime(80 * 'aunch the workbench'.length);
    });
    expect(result.current).toBe('Launch the workbench');

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(result.current).toBe('Launch the workbench');
  });

  it('rotates to the next phrase after finishing the current one', () => {
    const { result } = renderHook(() => useTypewriterPlaceholder(['First phrase', 'Second phrase']));

    act(() => {
      vi.advanceTimersByTime(300 + 80 * ('First phrase'.length - 1));
    });
    expect(result.current).toBe('First phrase');

    act(() => {
      vi.advanceTimersByTime(1800 + 260);
    });
    expect(result.current).toBe('S|');

    act(() => {
      vi.advanceTimersByTime(80 * 'econd phrase'.length);
    });
    expect(result.current).toBe('Second phrase');
  });

  it('supports a fixed cycle duration for rotating phrases', () => {
    const firstPhrase = 'First phrase';
    const secondPhrase = 'Second phrase';
    const firstPhraseTypingMs = 80 * (firstPhrase.length - 1);
    const fixedCycleHoldMs = 10_000 - firstPhraseTypingMs - 260;

    const { result } = renderHook(() =>
      useTypewriterPlaceholder([firstPhrase, secondPhrase], {
        cycleDurationMs: 10_000,
      })
    );

    act(() => {
      vi.advanceTimersByTime(300 + firstPhraseTypingMs);
    });
    expect(result.current).toBe(firstPhrase);

    act(() => {
      vi.advanceTimersByTime(fixedCycleHoldMs - 1);
    });
    expect(result.current).toBe(firstPhrase);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('');

    act(() => {
      vi.advanceTimersByTime(260);
    });
    expect(result.current).toBe('S|');
  });

  it('ignores blank phrases when building the rotation list', () => {
    const { result } = renderHook(() => useTypewriterPlaceholder(['  ', 'Keep going', '']));

    act(() => {
      vi.advanceTimersByTime(300 + 80 * 'Keep going'.length);
    });
    expect(result.current).toBe('Keep going');
  });
});
