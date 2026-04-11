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
import { describe, expect, it } from 'vitest';

describe('builtinAssistantDefaults', () => {
  it('builds builtin assistants with first-batch default hooks', () => {
    const assistants = buildBuiltinAssistants();

    expect(assistants.find((assistant) => assistant.id === 'builtin-workflow-planner')?.enabledHooks).toEqual([
      'repo-context-bootstrap',
      'plan-before-coding',
      'secret-guard',
      'tool-safety-guard',
      'continuity-handoff',
    ]);
    expect(assistants.find((assistant) => assistant.id === 'builtin-workflow-writer')?.enabledHooks).toEqual([
      'repo-context-bootstrap',
      'plan-before-coding',
      'secret-guard',
      'tool-safety-guard',
      'quality-gate',
      'tdd-guard',
      'continuity-handoff',
    ]);
    expect(assistants.find((assistant) => assistant.id === 'builtin-workflow-evaluator')?.enabledHooks).toEqual([
      'repo-context-bootstrap',
      'secret-guard',
      'tool-safety-guard',
      'quality-gate',
      'continuity-handoff',
    ]);
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
    expect(assistants.find((assistant) => assistant.id === 'builtin-pptx-generator')?.enabledHooks).toEqual([
      'prompt-clarifier',
      'secret-guard',
    ]);
    expect(assistants.find((assistant) => assistant.id === 'builtin-engineering-workbench')?.enabledHooks).toEqual([
      'repo-context-bootstrap',
      'plan-before-coding',
      'secret-guard',
      'tool-safety-guard',
      'quality-gate',
      'tdd-guard',
      'continuity-handoff',
    ]);
    expect(assistants.find((assistant) => assistant.id === 'builtin-moltbook')?.enabledHooks).toBeUndefined();
    expect(assistants.find((assistant) => assistant.id === 'builtin-superpowers')?.harnessTagI18n).toEqual({
      'en-US': 'Superpowers',
      'zh-CN': 'Superpowers',
    });
    expect(
      assistants.find((assistant) => assistant.id === 'builtin-everything-in-claude-code')?.recommendedDomainI18n
    ).toEqual({
      'en-US': 'Engineering',
      'zh-CN': '研发',
    });
  });

  it('marks product and system builtin assistants with explicit tiers', () => {
    const assistants = buildBuiltinAssistants();
    const workflowPlanner = assistants.find((assistant) => assistant.id === 'builtin-workflow-planner');
    const pdfToPpt = assistants.find((assistant) => assistant.id === 'builtin-pdf-to-ppt');
    const systemAssistants = buildContextEngineSystemAssistants();
    const sessionCompactor = systemAssistants.find(
      (assistant) => assistant.id === 'system-context-engine-session-compactor'
    );
    const projectPromoter = systemAssistants.find(
      (assistant) => assistant.id === 'system-context-engine-project-promoter'
    );

    expect(workflowPlanner).toEqual(
      expect.objectContaining({
        builtinTier: 'product',
        builtinVisibility: 'featured',
      })
    );
    expect(pdfToPpt).toEqual(
      expect.objectContaining({
        builtinTier: 'product',
        builtinVisibility: 'settings',
      })
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
        toolPolicy: expect.objectContaining({
          allowVaultRead: true,
          allowVaultWrite: true,
        }),
        memoryPolicy: expect.objectContaining({
          mode: 'context-engine-managed',
        }),
        delegationPolicy: expect.objectContaining({
          mode: 'system-builtin',
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
        promptProfile: expect.objectContaining({
          jobType: 'project_promotion',
        }),
      })
    );
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
    expect(resolveBuiltinAssistantEnabledSkills('builtin-workflow-planner', undefined)).toEqual([
      'engineering-planning',
      'verification-loop',
    ]);
    expect(resolveBuiltinAssistantEnabledSkills('builtin-workflow-writer', undefined)).toEqual([
      'tdd-workflow',
      'verification-loop',
    ]);
    expect(resolveBuiltinAssistantEnabledSkills('builtin-workflow-evaluator', undefined)).toEqual([
      'code-review-workflow',
      'security-review',
      'verification-loop',
    ]);
    expect(resolveBuiltinAssistantEnabledSkills('builtin-cowork', undefined)).toEqual([
      'skill-creator',
      'pptx',
      'docx',
      'pdf',
      'xlsx',
    ]);
    expect(resolveBuiltinAssistantEnabledSkills('builtin-engineering-reviewer', undefined)).toEqual([
      'code-review-workflow',
      'security-review',
      'verification-loop',
      'tooling-mcp-playbook',
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
