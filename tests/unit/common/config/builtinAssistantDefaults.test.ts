/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AcpBackendConfig } from '@/common/types/acpTypes';
import {
  buildBuiltinAssistants,
  resolveBuiltinAssistantEnabledHooks,
  resolveBuiltinAssistantEnabledSkills,
} from '@/common/config/presets/builtinAssistantDefaults';
import { describe, expect, it } from 'vitest';

describe('builtinAssistantDefaults', () => {
  it('builds builtin assistants with first-batch default hooks', () => {
    const assistants = buildBuiltinAssistants();

    expect(assistants.find((assistant) => assistant.id === 'builtin-cowork')?.enabledHooks).toEqual([
      'repo-context-bootstrap',
      'plan-before-coding',
      'secret-guard',
      'tool-safety-guard',
      'quality-gate',
      'continuity-handoff',
    ]);
    expect(assistants.find((assistant) => assistant.id === 'builtin-planning-with-files')?.enabledHooks).toEqual([
      'repo-context-bootstrap',
      'plan-before-coding',
      'secret-guard',
      'tool-safety-guard',
      'quality-gate',
      'continuity-handoff',
    ]);
    expect(assistants.find((assistant) => assistant.id === 'builtin-morph-ppt')?.enabledHooks).toEqual([
      'prompt-clarifier',
      'secret-guard',
    ]);
    expect(assistants.find((assistant) => assistant.id === 'builtin-moltbook')?.enabledHooks).toBeUndefined();
  });

  it('falls back to preset defaults only when enabled hooks are missing', () => {
    expect(resolveBuiltinAssistantEnabledHooks('builtin-cowork', undefined)).toEqual([
      'repo-context-bootstrap',
      'plan-before-coding',
      'secret-guard',
      'tool-safety-guard',
      'quality-gate',
      'continuity-handoff',
    ]);
    expect(resolveBuiltinAssistantEnabledHooks('builtin-cowork', [])).toEqual([]);
    expect(resolveBuiltinAssistantEnabledHooks('custom-agent', undefined)).toBeUndefined();
  });

  it('falls back to preset defaults only when enabled skills are missing', () => {
    expect(resolveBuiltinAssistantEnabledSkills('builtin-cowork', undefined)).toEqual([
      'skill-creator',
      'pptx',
      'docx',
      'pdf',
      'xlsx',
    ]);
    expect(resolveBuiltinAssistantEnabledSkills('builtin-cowork', [])).toEqual([]);
    expect(resolveBuiltinAssistantEnabledSkills('custom-agent', undefined)).toBeUndefined();
  });

  it('preserves explicit hook and skill overrides on builtin assistants', () => {
    const assistant = {
      id: 'builtin-cowork',
      name: 'Cowork',
      enabledHooks: [],
      enabledSkills: [],
    } as AcpBackendConfig;

    expect(resolveBuiltinAssistantEnabledHooks(assistant.id, assistant.enabledHooks)).toEqual([]);
    expect(resolveBuiltinAssistantEnabledSkills(assistant.id, assistant.enabledSkills)).toEqual([]);
  });
});
