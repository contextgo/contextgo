/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { ProjectRuntimeBackend, ProjectRuntimePolicy } from '@/common/types/projectRuntime';
import { getProjectRuntimeConfigDir } from './ProjectRuntimePaths';

export type RuntimeImportResult = {
  imported: boolean;
  importedFrom: ProjectRuntimePolicy['importedFrom'];
  lastImportedAt: string | null;
};

type RuntimeImportFile = {
  sourcePath: string;
  targetPath: string;
  importKey: ProjectRuntimeBackend;
};

const toHomeRelativePath = (input: string): string => input.replace(os.homedir(), '~');

const getImportFiles = (workspace: string, backend: ProjectRuntimeBackend): RuntimeImportFile[] => {
  switch (backend) {
    case 'codex':
      return [
        {
          sourcePath: path.join(os.homedir(), '.codex', 'config.toml'),
          targetPath: path.join(getProjectRuntimeConfigDir(workspace, 'codex'), 'config.toml'),
          importKey: 'codex',
        },
        {
          sourcePath: path.join(os.homedir(), '.codex', 'auth.json'),
          targetPath: path.join(getProjectRuntimeConfigDir(workspace, 'codex'), 'auth.json'),
          importKey: 'codex',
        },
      ];
    case 'claude':
      return [
        {
          sourcePath: path.join(os.homedir(), '.claude', 'settings.json'),
          targetPath: path.join(getProjectRuntimeConfigDir(workspace, 'claude'), 'settings.json'),
          importKey: 'claude',
        },
      ];
    case 'opencode':
      return [
        {
          sourcePath: path.join(os.homedir(), '.config', 'opencode', 'opencode.json'),
          targetPath: path.join(getProjectRuntimeConfigDir(workspace, 'opencode'), 'opencode.json'),
          importKey: 'opencode',
        },
        {
          sourcePath: path.join(os.homedir(), '.local', 'share', 'opencode', 'auth.json'),
          targetPath: path.join(getProjectRuntimeConfigDir(workspace, 'opencode'), 'auth.json'),
          importKey: 'opencode',
        },
      ];
    case 'gemini':
      return [];
  }
};

export async function importProjectLocalRuntimeForBackend(
  workspace: string,
  backend: ProjectRuntimeBackend
): Promise<RuntimeImportResult> {
  const files = getImportFiles(workspace, backend);
  if (files.length === 0) {
    return {
      imported: false,
      importedFrom: null,
      lastImportedAt: null,
    };
  }

  const importedFrom: Partial<Record<ProjectRuntimeBackend, string>> = {};
  for (const file of files) {
    await fs.access(file.sourcePath);
    await fs.mkdir(path.dirname(file.targetPath), { recursive: true });
    await fs.copyFile(file.sourcePath, file.targetPath);
    importedFrom[file.importKey] = toHomeRelativePath(file.sourcePath);
  }

  return {
    imported: true,
    importedFrom,
    lastImportedAt: new Date().toISOString(),
  };
}

export async function clearProjectRuntimeOverride(workspace: string, backend: ProjectRuntimeBackend): Promise<void> {
  await fs.rm(getProjectRuntimeConfigDir(workspace, backend), {
    recursive: true,
    force: true,
  });
}

export async function importProjectLocalRuntime(
  workspace: string,
  policy: ProjectRuntimePolicy
): Promise<RuntimeImportResult> {
  void workspace;
  void policy;

  return {
    imported: false,
    importedFrom: null,
    lastImportedAt: null,
  };
}
