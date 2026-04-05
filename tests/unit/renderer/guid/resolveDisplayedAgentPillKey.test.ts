/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { resolveDisplayedAgentPillKey } from '@/renderer/pages/guid/utils/resolveDisplayedAgentPillKey';

describe('resolveDisplayedAgentPillKey', () => {
  it('returns the selected runtime key for standard runtimes', () => {
    expect(resolveDisplayedAgentPillKey({ selectedAgentKey: 'codex' })).toBe('codex');
  });

  it('keeps compound runtime keys unchanged', () => {
    expect(resolveDisplayedAgentPillKey({ selectedAgentKey: 'openclaw-gateway:reviewer' })).toBe(
      'openclaw-gateway:reviewer'
    );
  });
});
