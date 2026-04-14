/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  inspectExternalSessionWorkspace,
  planExternalSessionWorkspaceBootstrap,
} from '../../../../src/process/bridge/services/externalSessionBootstrap';
import type { ProjectCapabilitySnapshot } from '../../../../src/process/services/space/ProjectCapabilityService';

const tempRoots: string[] = [];
const readSnapshotMock = vi.fn();

const createWorkspace = async (): Promise<string> => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'contextgo-external-bootstrap-'));
  tempRoots.push(workspace);
  return workspace;
};

const createSnapshot = (counts: Partial<ProjectCapabilitySnapshot['counts']> = {}): ProjectCapabilitySnapshot => ({
  workspacePath: '/workspace',
  automationRootRelativePath: '.contextgo',
  counts: {
    skill: counts.skill ?? 0,
    hook: counts.hook ?? 0,
    command: counts.command ?? 0,
    schedule: counts.schedule ?? 0,
  },
  skills: [],
  hooks: [],
  commands: [],
  schedules: [],
});

beforeEach(() => {
  vi.clearAllMocks();
  readSnapshotMock.mockResolvedValue(createSnapshot());
});

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map(async (targetPath) => {
      await fs.rm(targetPath, { recursive: true, force: true });
    })
  );
});

describe('inspectExternalSessionWorkspace', () => {
  it('should report an empty workspace when neither .contextgo nor AGENTS.md exists', async () => {
    const workspace = await createWorkspace();

    const inspection = await inspectExternalSessionWorkspace(workspace, {
      readSnapshot: readSnapshotMock,
    });

    expect(inspection.hasContextgoDir).toBe(false);
    expect(inspection.hasAgentsMd).toBe(false);
    expect(inspection.capabilityCounts).toEqual({ skill: 0, hook: 0, command: 0, schedule: 0 });
    expect(inspection.hasProjectCapabilitySurface).toBe(false);
    expect(inspection.hasProjectContextSurface).toBe(false);
  });

  it('should treat discovered capabilities as existing project context', async () => {
    const workspace = await createWorkspace();
    await fs.mkdir(path.join(workspace, '.contextgo'), { recursive: true });
    readSnapshotMock.mockResolvedValue(createSnapshot({ skill: 1, hook: 1 }));

    const inspection = await inspectExternalSessionWorkspace(workspace, {
      readSnapshot: readSnapshotMock,
    });

    expect(inspection.hasContextgoDir).toBe(true);
    expect(inspection.capabilityCounts).toEqual({ skill: 1, hook: 1, command: 0, schedule: 0 });
    expect(inspection.hasProjectCapabilitySurface).toBe(true);
    expect(inspection.hasProjectContextSurface).toBe(true);
  });

  it('should treat AGENTS.md as project context even without .contextgo capabilities', async () => {
    const workspace = await createWorkspace();
    await fs.writeFile(path.join(workspace, 'AGENTS.md'), '# Project Instructions\n', 'utf-8');

    const inspection = await inspectExternalSessionWorkspace(workspace, {
      readSnapshot: readSnapshotMock,
    });

    expect(inspection.hasAgentsMd).toBe(true);
    expect(inspection.hasProjectCapabilitySurface).toBe(false);
    expect(inspection.hasProjectContextSurface).toBe(true);
  });

  it('should ignore runtime-native instruction projections when AGENTS.md is missing', async () => {
    const workspace = await createWorkspace();
    await fs.writeFile(path.join(workspace, 'CLAUDE.md'), '# Generated Claude Projection\n', 'utf-8');
    await fs.writeFile(path.join(workspace, 'GEMINI.md'), '# Generated Gemini Projection\n', 'utf-8');

    const inspection = await inspectExternalSessionWorkspace(workspace, {
      readSnapshot: readSnapshotMock,
    });

    expect(inspection.hasAgentsMd).toBe(false);
    expect(inspection.hasProjectCapabilitySurface).toBe(false);
    expect(inspection.hasProjectContextSurface).toBe(false);
  });
});

describe('planExternalSessionWorkspaceBootstrap', () => {
  it('should recommend a default harness preset when the project has no context surface yet', async () => {
    const workspace = await createWorkspace();

    const plan = await planExternalSessionWorkspaceBootstrap('codex', workspace, {
      readSnapshot: readSnapshotMock,
    });

    expect(plan.nativeWorkspaceBootstrap).toBe(true);
    expect(plan.presetAssistantId).toBe('builtin-superpowers');
    expect(plan.enabledSkills?.length).toBeGreaterThan(0);
    expect(plan.enabledHooks?.length).toBeGreaterThan(0);
  });

  it('should preserve existing project capability surface without forcing a default preset', async () => {
    const workspace = await createWorkspace();
    await fs.mkdir(path.join(workspace, '.contextgo'), { recursive: true });
    readSnapshotMock.mockResolvedValue(createSnapshot({ command: 1 }));

    const plan = await planExternalSessionWorkspaceBootstrap('claude', workspace, {
      readSnapshot: readSnapshotMock,
    });

    expect(plan.nativeWorkspaceBootstrap).toBe(true);
    expect(plan.inspection.hasProjectCapabilitySurface).toBe(true);
    expect(plan.inspection.hasProjectContextSurface).toBe(true);
    expect(plan.presetAssistantId).toBeUndefined();
    expect(plan.enabledSkills).toBeUndefined();
    expect(plan.enabledHooks).toBeUndefined();
  });

  it('should preserve AGENTS.md based context without forcing a default preset', async () => {
    const workspace = await createWorkspace();
    await fs.writeFile(path.join(workspace, 'AGENTS.md'), '# Project Instructions\n', 'utf-8');

    const plan = await planExternalSessionWorkspaceBootstrap('claude', workspace, {
      readSnapshot: readSnapshotMock,
    });

    expect(plan.inspection.hasAgentsMd).toBe(true);
    expect(plan.inspection.hasProjectContextSurface).toBe(true);
    expect(plan.presetAssistantId).toBeUndefined();
  });
});
