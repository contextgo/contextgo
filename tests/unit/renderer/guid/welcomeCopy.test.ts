/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { selectGuidCopyVariant } from '@/renderer/pages/guid/utils/welcomeCopy';

describe('selectGuidCopyVariant', () => {
  it('selects a deterministic variant from the provided random value', () => {
    const variants = ['Plan the next move', 'Start the real work', 'Bring the task here'];

    expect(selectGuidCopyVariant(variants, 0)).toBe('Plan the next move');
    expect(selectGuidCopyVariant(variants, 0.34)).toBe('Start the real work');
    expect(selectGuidCopyVariant(variants, 0.9)).toBe('Bring the task here');
  });

  it('falls back safely when variants are blank or the random value is invalid', () => {
    expect(selectGuidCopyVariant(['', '  ', 'Keep going'], Number.NaN)).toBe('Keep going');
    expect(selectGuidCopyVariant([], 0.5)).toBe('');
  });
});
