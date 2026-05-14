/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  resolveBuiltinAssistantEnabledHooks,
  resolveBuiltinAssistantEnabledSkills,
} from '@/common/config/presets/builtinAssistantDefaults';
import type { ExternalSessionProvider } from '@/common/types/externalSessions';
import {
  ProjectCapabilityService,
  type ProjectCapabilitySnapshot,
} from '@process/services/space/ProjectCapabilityService';
import fs from 'fs/promises';
import path from 'path';

const WORKSPACE_AUTOMATION_DIR = '.contextgo';
const AGENTS_MD_FILE_NAME = 'AGENTS.md';

const EMPTY_CAPABILITY_COUNTS: ProjectCapabilitySnapshot['counts'] = {
  skill: 0,
  hook: 0,
  command: 0,
  schedule: 0,
};

const RECOMMENDED_IMPORTED_PRESET_BY_PROVIDER: Record<ExternalSessionProvider, string | null> = {
  claude: 'builtin-everything-in-claude-code',
  codex: 'builtin-superpowers',
  gemini: 'builtin-superpowers',
  opencode: 'builtin-superpowers',
};

export type ExternalSessionWorkspaceInspection = {
  workspace: string;
  hasContextgoDir: boolean;
  hasAgentsMd: boolean;
  capabilityCounts: ProjectCapabilitySnapshot['counts'];
  hasProjectCapabilitySurface: boolean;
  hasProjectContextSurface: boolean;
};

export type ExternalSessionWorkspaceBootstrapPlan = {
  nativeWorkspaceBootstrap: boolean;
  presetAssistantId?: string;
  enabledSkills?: string[];
  enabledHooks?: string[];
  inspection: ExternalSessionWorkspaceInspection;
};

const pathExists = async (targetPath: string): Promise<boolean> => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const hasAnyProjectCapability = (counts: ProjectCapabilitySnapshot['counts']): boolean => {
  return Object.values(counts).some((count) => count > 0);
};

export const inspectExternalSessionWorkspace = async (
  workspace: string,
  capabilityService: Pick<ProjectCapabilityService, 'readSnapshot'> = new ProjectCapabilityService()
): Promise<ExternalSessionWorkspaceInspection> => {
  const resolvedWorkspace = path.resolve(workspace);
  const automationRoot = path.join(resolvedWorkspace, WORKSPACE_AUTOMATION_DIR);
  const agentsMdPath = path.join(resolvedWorkspace, AGENTS_MD_FILE_NAME);

  const [snapshot, hasContextgoDir, hasAgentsMd] = await Promise.all([
    capabilityService.readSnapshot(resolvedWorkspace),
    pathExists(automationRoot),
    pathExists(agentsMdPath),
  ]);

  const capabilityCounts = snapshot?.counts ?? EMPTY_CAPABILITY_COUNTS;
  const hasProjectCapabilitySurface = hasAnyProjectCapability(capabilityCounts);

  return {
    workspace: resolvedWorkspace,
    hasContextgoDir,
    hasAgentsMd,
    capabilityCounts,
    hasProjectCapabilitySurface,
    hasProjectContextSurface: hasProjectCapabilitySurface || hasAgentsMd,
  };
};

export const planExternalSessionWorkspaceBootstrap = async (
  provider: ExternalSessionProvider,
  workspace: string,
  capabilityService: Pick<ProjectCapabilityService, 'readSnapshot'> = new ProjectCapabilityService()
): Promise<ExternalSessionWorkspaceBootstrapPlan> => {
  const inspection = await inspectExternalSessionWorkspace(workspace, capabilityService);

  const recommendedPresetAssistantId = inspection.hasProjectContextSurface
    ? undefined
    : (RECOMMENDED_IMPORTED_PRESET_BY_PROVIDER[provider] ?? undefined);

  return {
    nativeWorkspaceBootstrap: true,
    presetAssistantId: recommendedPresetAssistantId,
    enabledSkills: recommendedPresetAssistantId
      ? resolveBuiltinAssistantEnabledSkills(recommendedPresetAssistantId, undefined)
      : undefined,
    enabledHooks: recommendedPresetAssistantId
      ? resolveBuiltinAssistantEnabledHooks(recommendedPresetAssistantId, undefined)
      : undefined,
    inspection,
  };
};
