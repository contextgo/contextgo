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
import { getClaudeSettingsPath, getOpencodeAuthPath, getOpencodeConfigPath } from '@process/agent/acp/utils';
import { getCodexAuthPath, getCodexConfigPath } from '@process/agent/codex/connection/CodexConnection';
import { getEnhancedEnv } from '@process/utils/shellEnv';
import { getProjectRuntimeCompatibilityDir, getProjectRuntimeConfigDir, getProjectRuntimeRoot } from './ProjectRuntimePaths';

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

const RUNTIME_HOME_PROJECTION_FILES = {
  claude: ['settings.json'],
  codex: ['config.toml', 'auth.json'],
  opencode: ['opencode.json', 'auth.json'],
} as const satisfies Partial<Record<ProjectRuntimeBackend, readonly string[]>>;

type BackendWithRuntimeProjection = keyof typeof RUNTIME_HOME_PROJECTION_FILES;

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
          sourcePath: getOpencodeConfigPath(),
          relativeTargetPath: 'opencode.json',
        },
        {
          sourcePath: getOpencodeAuthPath(),
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

function hasRuntimeHomeProjection(backend: ProjectRuntimeBackend): backend is BackendWithRuntimeProjection {
  return backend in RUNTIME_HOME_PROJECTION_FILES;
}

const syncRuntimeHomeProjection = async (
  workspace: string,
  backend: BackendWithRuntimeProjection,
  relativeTargetPaths: readonly string[]
): Promise<void> => {
  const projectionDir = getProjectRuntimeCompatibilityDir(workspace, backend);
  const sourceDir = getProjectRuntimeConfigDir(workspace, backend);
  const projectedFiles = new Set(relativeTargetPaths);
  const projectionFiles = RUNTIME_HOME_PROJECTION_FILES[backend];

  await fs.mkdir(projectionDir, { recursive: true });

  await Promise.all(
    projectionFiles.map(async (fileName) => {
      const projectionPath = path.join(projectionDir, fileName);
      if (!projectedFiles.has(fileName)) {
        await fs.rm(projectionPath, {
          force: true,
          recursive: true,
        });
        return;
      }

      const sourcePath = path.join(sourceDir, fileName);
      const relativeSourcePath = path.relative(path.dirname(projectionPath), sourcePath);

      try {
        const existing = await fs.lstat(projectionPath);
        if (existing.isSymbolicLink()) {
          const currentTarget = await fs.readlink(projectionPath);
          if (currentTarget === relativeSourcePath) {
            return;
          }
        }

        await fs.rm(projectionPath, {
          force: true,
          recursive: true,
        });
      } catch {
        // Projection does not exist yet.
      }

      await fs.symlink(relativeSourcePath, projectionPath);
    })
  );
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

    if (hasRuntimeHomeProjection(backend)) {
      await syncRuntimeHomeProjection(
        workspace,
        backend,
        files.map((file) => file.relativeTargetPath)
      );
    }

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

export async function ensureProjectRuntimeProjectionForBackend(
  workspace: string,
  backend: ProjectRuntimeBackend
): Promise<void> {
  if (!hasRuntimeHomeProjection(backend)) {
    return;
  }

  const configDir = getProjectRuntimeConfigDir(workspace, backend);
  const projectionFiles = RUNTIME_HOME_PROJECTION_FILES[backend];
  const existingFiles = await Promise.all(
    projectionFiles.map(async (fileName) =>
      (await pathExists(path.join(configDir, fileName))) ? fileName : null
    )
  );

  await syncRuntimeHomeProjection(
    workspace,
    backend,
    existingFiles.filter((fileName): fileName is (typeof projectionFiles)[number] => fileName !== null)
  );
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

  if (hasRuntimeHomeProjection(backend)) {
    await syncRuntimeHomeProjection(workspace, backend, []);
  }
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
