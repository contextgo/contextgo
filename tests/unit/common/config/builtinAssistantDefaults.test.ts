/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AcpBackendConfig } from '@/common/types/acpTypes';
import {
  buildBuiltinAssistants,
  buildContextEngineSystemAssistants,
  resolveBuiltinAssistantEnabledHooks,
  resolveBuiltinAssistantEnabledSkills,
} from '@/common/config/presets/builtinAssistantDefaults';
import { ENGINEERING_DEFAULT_HOOKS, ENGINEERING_WORKBENCH_SKILLS } from '@/common/config/presets/assistantPresets';
import { describe, expect, it } from 'vitest';

describe('builtinAssistantDefaults', () => {
  it('builds product builtin assistants with featured defaults', () => {
    const assistants = buildBuiltinAssistants();

    expect(assistants).toHaveLength(3);
    expect(assistants.map((assistant) => assistant.id)).toEqual([
      'builtin-morph-ppt',
      'builtin-superpowers',
      'builtin-everything-in-claude-code',
    ]);
    expect(assistants.find((assistant) => assistant.id === 'builtin-morph-ppt')).toEqual(
      expect.objectContaining({
        enabled: true,
        builtinTier: 'product',
        builtinVisibility: 'featured',
        presetAgentType: 'codex',
        enabledHooks: undefined,
        enabledSkills: ['morph-ppt'],
        recommendedDomainI18n: {
          'en-US': 'Presentations',
          'zh-CN': '演示文稿',
        },
      })
    );
    expect(assistants.find((assistant) => assistant.id === 'builtin-superpowers')).toEqual(
      expect.objectContaining({
        enabled: true,
        builtinTier: 'product',
        builtinVisibility: 'featured',
        presetAgentType: 'codex',
        enabledHooks: [...ENGINEERING_DEFAULT_HOOKS],
        enabledSkills: [...ENGINEERING_WORKBENCH_SKILLS],
        harnessTagI18n: {
          'en-US': 'Superpowers',
          'zh-CN': 'Superpowers',
        },
      })
    );
    expect(assistants.find((assistant) => assistant.id === 'builtin-everything-in-claude-code')).toEqual(
      expect.objectContaining({
        enabled: true,
        builtinTier: 'product',
        builtinVisibility: 'featured',
        presetAgentType: 'claude',
        recommendedDomainI18n: {
          'en-US': 'Engineering',
          'zh-CN': '研发',
        },
      })
    );
  });

  it('marks system assistants with explicit system metadata', () => {
    const systemAssistants = buildContextEngineSystemAssistants();
    const sessionCompactor = systemAssistants.find(
      (assistant) => assistant.id === 'system-context-engine-session-compactor'
    );
    const projectPromoter = systemAssistants.find(
      (assistant) => assistant.id === 'system-context-engine-project-promoter'
    );

    expect(systemAssistants).toHaveLength(5);
    expect(sessionCompactor).toEqual(
      expect.objectContaining({
        builtinTier: 'system',
        builtinVisibility: 'featured',
        systemOwner: 'context-engine',
        systemRole: 'context-engine-session-compactor',
        executionBoundary: 'space-vault-root',
        triggerKinds: ['hook', 'lifecycle', 'manual'],
        promptProfile: expect.objectContaining({
          role: 'system-maintenance',
          jobType: 'session_compaction',
        }),
      })
    );
    expect(projectPromoter).toEqual(
      expect.objectContaining({
        builtinTier: 'system',
        builtinVisibility: 'featured',
        systemOwner: 'context-engine',
        systemRole: 'context-engine-project-promoter',
        executionBoundary: 'space-vault-root',
        triggerKinds: ['derived', 'manual'],
      })
    );
  });

  it('falls back to preset defaults only when enabled hooks are missing', () => {
    expect(resolveBuiltinAssistantEnabledHooks('builtin-superpowers', undefined)).toEqual([
      ...ENGINEERING_DEFAULT_HOOKS,
    ]);
    expect(resolveBuiltinAssistantEnabledHooks('builtin-superpowers', [])).toEqual([]);
    expect(resolveBuiltinAssistantEnabledHooks('custom-agent', undefined)).toBeUndefined();
  });

  it('falls back to preset defaults only when enabled skills are missing', () => {
    expect(resolveBuiltinAssistantEnabledSkills('builtin-morph-ppt', undefined)).toEqual(['morph-ppt']);
    expect(resolveBuiltinAssistantEnabledSkills('builtin-superpowers', undefined)).toEqual([
      ...ENGINEERING_WORKBENCH_SKILLS,
    ]);
    expect(resolveBuiltinAssistantEnabledSkills('builtin-everything-in-claude-code', undefined)).toBeUndefined();
    expect(resolveBuiltinAssistantEnabledSkills('builtin-superpowers', [])).toEqual([]);
    expect(resolveBuiltinAssistantEnabledSkills('custom-agent', undefined)).toBeUndefined();
  });

  it('preserves explicit hook and skill overrides on builtin assistants', () => {
    const assistant = {
      id: 'builtin-superpowers',
      name: 'Superpowers Harness',
      enabledHooks: [],
      enabledSkills: [],
    } as AcpBackendConfig;

    expect(resolveBuiltinAssistantEnabledHooks(assistant.id, assistant.enabledHooks)).toEqual([]);
    expect(resolveBuiltinAssistantEnabledSkills(assistant.id, assistant.enabledSkills)).toEqual([]);
  });
});
