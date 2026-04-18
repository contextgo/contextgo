/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { ProjectRuntimeBackend, ProjectRuntimePolicy } from '@/common/types/projectRuntime';
import { getClaudeSettingsPath } from '@process/agent/acp/utils';
import { getCodexAuthPath, getCodexConfigPath } from '@process/agent/codex/connection/CodexConnection';
import { getEnhancedEnv } from '@process/utils/shellEnv';
import { getProjectRuntimeConfigDir, getProjectRuntimeRoot } from './ProjectRuntimePaths';

export type RuntimeImportResult = {
  imported: boolean;
  importedFrom: ProjectRuntimePolicy['importedFrom'];
  lastImportedAt: string | null;
  injectedEnv?: Record<string, string>;
};

type RuntimeImportFile = {
  sourcePath: string;
  relativeTargetPath: string;
};

const BACKEND_ENV_KEYS: Record<ProjectRuntimeBackend, readonly string[]> = {
  gemini: [],
  claude: ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL'],
  codex: ['CODEX_API_KEY', 'OPENAI_API_KEY'],
  opencode: [],
};

const toHomeRelativePath = (input: string): string => input.replace(os.homedir(), '~');

const pathExists = async (targetPath: string): Promise<boolean> => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const getGlobalOpencodeConfigPath = (): string => {
  const homeDir = os.homedir();

  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
    return path.join(appData, 'opencode', 'opencode.json');
  }

  const xdgConfigHome = process.env.XDG_CONFIG_HOME || path.join(homeDir, '.config');
  return path.join(xdgConfigHome, 'opencode', 'opencode.json');
};

const getGlobalOpencodeAuthPath = (): string => {
  const homeDir = os.homedir();

  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(homeDir, 'AppData', 'Local');
    return path.join(localAppData, 'opencode', 'auth.json');
  }

  const xdgDataHome = process.env.XDG_DATA_HOME || path.join(homeDir, '.local', 'share');
  return path.join(xdgDataHome, 'opencode', 'auth.json');
};

const getImportFiles = (backend: ProjectRuntimeBackend): RuntimeImportFile[] => {
  switch (backend) {
    case 'codex':
      return [
        {
          sourcePath: getCodexConfigPath(),
          relativeTargetPath: 'config.toml',
        },
        {
          sourcePath: getCodexAuthPath(),
          relativeTargetPath: 'auth.json',
        },
      ];
    case 'claude':
      return [
        {
          sourcePath: getClaudeSettingsPath(),
          relativeTargetPath: 'settings.json',
        },
      ];
    case 'opencode':
      return [
        {
          sourcePath: getGlobalOpencodeConfigPath(),
          relativeTargetPath: 'opencode.json',
        },
        {
          sourcePath: getGlobalOpencodeAuthPath(),
          relativeTargetPath: 'auth.json',
        },
      ];
    case 'gemini':
      return [];
  }
};

const selectInjectedEnv = (backend: ProjectRuntimeBackend): Record<string, string> | undefined => {
  const enhancedEnv = getEnhancedEnv();
  const selectedEntries = BACKEND_ENV_KEYS[backend]
    .map((key) => [key, enhancedEnv[key]] as const)
    .filter((entry): entry is readonly [string, string] => typeof entry[1] === 'string' && entry[1].length > 0);

  if (selectedEntries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(selectedEntries);
};

const selectImportedSourceLabel = (
  availableFiles: RuntimeImportFile[],
  injectedEnv: Record<string, string> | undefined
): string | undefined => {
  if (availableFiles.length > 0) {
    return toHomeRelativePath(availableFiles[0].sourcePath);
  }

  const firstEnvKey = Object.keys(injectedEnv ?? {})[0];
  if (firstEnvKey) {
    return `env:${firstEnvKey}`;
  }

  return undefined;
};

const copyFilesAtomically = async (
  workspace: string,
  backend: ProjectRuntimeBackend,
  files: RuntimeImportFile[]
): Promise<void> => {
  if (files.length === 0) {
    return;
  }

  const runtimeRoot = getProjectRuntimeRoot(workspace);
  const targetDir = getProjectRuntimeConfigDir(workspace, backend);
  const tempDir = path.join(runtimeRoot, `.runtime-import-${backend}-${randomUUID()}`);
  const backupDir = `${targetDir}.backup-${randomUUID()}`;

  await fs.mkdir(tempDir, {
    recursive: true,
  });

  try {
    await Promise.all(
      files.map(async (file) => {
        const tempTargetPath = path.join(tempDir, file.relativeTargetPath);
        await fs.mkdir(path.dirname(tempTargetPath), { recursive: true });
        await fs.copyFile(file.sourcePath, tempTargetPath);
      })
    );

    const targetExists = await pathExists(targetDir);
    if (targetExists) {
      await fs.rename(targetDir, backupDir);
    }

    await fs.rename(tempDir, targetDir);

    if (targetExists) {
      await fs.rm(backupDir, {
        recursive: true,
        force: true,
      });
    }
  } catch (error) {
    await fs.rm(tempDir, {
      recursive: true,
      force: true,
    });

    if (await pathExists(backupDir)) {
      await fs.rm(targetDir, {
        recursive: true,
        force: true,
      });
      await fs.rename(backupDir, targetDir);
    }

    throw error;
  }
};

export async function hasProjectRuntimeOverride(workspace: string, backend: ProjectRuntimeBackend): Promise<boolean> {
  const configDir = getProjectRuntimeConfigDir(workspace, backend);
  const existingFiles = await Promise.all(
    getImportFiles(backend).map((file) => pathExists(path.join(configDir, file.relativeTargetPath)))
  );
  return existingFiles.some(Boolean);
}

export async function importProjectLocalRuntimeForBackend(
  workspace: string,
  backend: ProjectRuntimeBackend
): Promise<RuntimeImportResult> {
  const availableFiles = (
    await Promise.all(getImportFiles(backend).map(async (file) => ((await pathExists(file.sourcePath)) ? file : null)))
  ).filter((file): file is RuntimeImportFile => file !== null);

  const injectedEnv = selectInjectedEnv(backend);
  if (availableFiles.length === 0 && !injectedEnv) {
    return {
      imported: false,
      importedFrom: null,
      lastImportedAt: null,
    };
  }

  await copyFilesAtomically(workspace, backend, availableFiles);

  const importedSource = selectImportedSourceLabel(availableFiles, injectedEnv);

  return {
    imported: true,
    importedFrom: importedSource
      ? {
          [backend]: importedSource,
        }
      : null,
    lastImportedAt: new Date().toISOString(),
    injectedEnv,
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
  policy: ProjectRuntimePolicy,
  backend?: ProjectRuntimeBackend
): Promise<RuntimeImportResult> {
  if (!backend || (policy.mode !== 'auto' && policy.mode !== 'import_local_runtime')) {
    return {
      imported: false,
      importedFrom: null,
      lastImportedAt: null,
    };
  }

  return importProjectLocalRuntimeForBackend(workspace, backend);
}
