/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type {
  IGitRepositoryInfo,
  IWorkspaceFileItem,
  IWorkspaceGitChange,
  IWorkspaceRecentFile,
} from '@/common/adapter/ipcBridge';

const execFileAsync = promisify(execFile);
const WORKSPACE_FILE_SCAN_LIMIT = 10000;
const RECENT_WORKSPACE_FILES_LIMIT = 50;
const RECENT_WORKSPACE_FILES_SCAN_LIMIT = 5000;
const IGNORED_WORKSPACE_DIRS = new Set([
  '.git',
  '.contextgo',
  'node_modules',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '.turbo',
  'coverage',
  'out',
]);

const normalizeRelativePath = (basePath: string, absolutePath: string): string => {
  return path.relative(basePath, absolutePath).replaceAll(path.sep, '/');
};

const resolveWorkspaceRoot = async (targetPath: string): Promise<string | null> => {
  const resolvedPath = path.resolve(targetPath);

  try {
    const stat = await fs.stat(resolvedPath);
    return stat.isDirectory() ? resolvedPath : path.dirname(resolvedPath);
  } catch {
    return null;
  }
};

export async function getGitRepositoryInfo(targetPath: string): Promise<IGitRepositoryInfo> {
  const resolvedPath = path.resolve(targetPath);
  let workingDir = resolvedPath;

  try {
    const stat = await fs.stat(resolvedPath);
    if (!stat.isDirectory()) {
      workingDir = path.dirname(resolvedPath);
    }
  } catch {
    return { isRepository: false };
  }

  try {
    const { stdout: rootStdout } = await execFileAsync('git', ['rev-parse', '--show-toplevel'], {
      cwd: workingDir,
    });
    const repositoryRoot = rootStdout.trim();
    if (!repositoryRoot) {
      return { isRepository: false };
    }

    const [{ stdout: branchStdout }, { stdout: gitDirStdout }, remoteResult] = await Promise.all([
      execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: repositoryRoot }),
      execFileAsync('git', ['rev-parse', '--git-dir'], { cwd: repositoryRoot }),
      execFileAsync('git', ['config', '--get', 'remote.origin.url'], { cwd: repositoryRoot }).catch(() => ({
        stdout: '',
      })),
    ]);

    return {
      isRepository: true,
      repositoryRoot,
      branch: branchStdout.trim() || null,
      gitDir: gitDirStdout.trim() || null,
      remoteUrl: remoteResult.stdout.trim() || null,
    };
  } catch {
    return { isRepository: false };
  }
}

const parseWorkspaceGitStatus = (stdout: string, workingDir: string): IWorkspaceGitChange[] => {
  return stdout
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => {
      const status = line.slice(0, 2).trim() || '??';
      const rawPath = line.slice(3).trim();
      const pathParts = rawPath.split(' -> ');
      const displayPath = pathParts.at(-1) ?? rawPath;
      const previousPath = pathParts.length > 1 ? pathParts[0] : undefined;

      return {
        path: displayPath,
        absolutePath: path.resolve(workingDir, displayPath),
        status,
        previousPath,
      };
    });
};

export async function listWorkspaceGitChanges(
  targetPath: string
): Promise<{ repository: IGitRepositoryInfo | null; changes: IWorkspaceGitChange[] }> {
  const repository = await getGitRepositoryInfo(targetPath);
  if (!repository.isRepository) {
    return {
      repository: null,
      changes: [],
    };
  }

  const workingDir = await resolveWorkspaceRoot(targetPath);
  if (!workingDir) {
    return {
      repository,
      changes: [],
    };
  }

  const { stdout } = await execFileAsync('git', ['status', '--short', '--untracked-files=all', '--', '.'], {
    cwd: workingDir,
  });

  return {
    repository,
    changes: parseWorkspaceGitStatus(stdout, workingDir),
  };
}

export async function listWorkspaceRecentFiles(
  targetPath: string,
  limit = RECENT_WORKSPACE_FILES_LIMIT
): Promise<IWorkspaceRecentFile[]> {
  const workingDir = await resolveWorkspaceRoot(targetPath);
  if (!workingDir) {
    return [];
  }

  const recentFiles: IWorkspaceRecentFile[] = [];
  let scannedFiles = 0;
  let shouldStop = false;

  const pushRecentFile = (file: IWorkspaceRecentFile) => {
    recentFiles.push(file);
    recentFiles.sort((left, right) => right.lastModified - left.lastModified || left.path.localeCompare(right.path));

    if (recentFiles.length > limit) {
      recentFiles.length = limit;
    }
  };

  const walkDirectory = async (dirPath: string): Promise<void> => {
    if (shouldStop) {
      return;
    }

    const entries = await fs.readdir(dirPath, { withFileTypes: true }).catch((): null => null);
    if (!entries) {
      return;
    }

    for (const entry of entries) {
      if (shouldStop) {
        return;
      }

      if (entry.isDirectory() && IGNORED_WORKSPACE_DIRS.has(entry.name)) {
        continue;
      }

      const absolutePath = path.join(dirPath, entry.name);

      let entryStat: Awaited<ReturnType<typeof fs.lstat>>;
      try {
        // Sequential traversal keeps the bounded recent-file scan deterministic.
        // eslint-disable-next-line no-await-in-loop
        entryStat = await fs.lstat(absolutePath);
      } catch {
        continue;
      }

      if (entryStat.isSymbolicLink()) {
        continue;
      }

      if (entryStat.isDirectory()) {
        // Sequential traversal keeps the bounded recent-file scan deterministic.
        // eslint-disable-next-line no-await-in-loop
        await walkDirectory(absolutePath);
        continue;
      }

      if (!entryStat.isFile()) {
        continue;
      }

      scannedFiles += 1;
      pushRecentFile({
        path: normalizeRelativePath(workingDir, absolutePath),
        absolutePath,
        lastModified: entryStat.mtimeMs,
        size: entryStat.size,
      });

      if (scannedFiles >= RECENT_WORKSPACE_FILES_SCAN_LIMIT) {
        shouldStop = true;
        return;
      }
    }
  };

  await walkDirectory(workingDir);
  return recentFiles;
}

export async function initializeWorkspaceGitRepository(targetPath: string): Promise<IGitRepositoryInfo> {
  const workingDir = await resolveWorkspaceRoot(targetPath);
  if (!workingDir) {
    throw new Error('Workspace path is unavailable.');
  }

  await execFileAsync('git', ['init'], {
    cwd: workingDir,
  });

  return getGitRepositoryInfo(workingDir);
}

const buildUntrackedFileDiff = async (filePath: string, relativePath: string): Promise<string> => {
  const content = await fs.readFile(filePath, 'utf-8').catch(() => '[binary file]');
  const lines = content.split(/\r?\n/);
  const addedLines = lines.map((line) => `+${line}`).join('\n');
  const lineCount = Math.max(lines.length, 1);

  return [
    `diff --git a/${relativePath} b/${relativePath}`,
    'new file mode 100644',
    '--- /dev/null',
    `+++ b/${relativePath}`,
    `@@ -0,0 +1,${lineCount} @@`,
    addedLines,
  ].join('\n');
};

export async function readWorkspaceGitDiff(workspacePath: string, filePath: string): Promise<string> {
  const workingDir = await resolveWorkspaceRoot(workspacePath);
  if (!workingDir) {
    return '';
  }

  const relativePath = normalizeRelativePath(workingDir, filePath);
  if (!relativePath || relativePath.startsWith('../')) {
    return '';
  }

  const runGitDiff = async (args: string[]): Promise<string> => {
    try {
      const { stdout } = await execFileAsync('git', args, { cwd: workingDir });
      return stdout;
    } catch (error) {
      if (error && typeof error === 'object' && 'stdout' in error && typeof error.stdout === 'string') {
        return error.stdout;
      }
      return '';
    }
  };

  const unstagedDiff = await runGitDiff(['diff', '--no-ext-diff', '--relative', '--', relativePath]);
  if (unstagedDiff.trim()) {
    return unstagedDiff;
  }

  const stagedDiff = await runGitDiff(['diff', '--no-ext-diff', '--cached', '--relative', '--', relativePath]);
  if (stagedDiff.trim()) {
    return stagedDiff;
  }

  return buildUntrackedFileDiff(filePath, relativePath);
}

export async function listWorkspaceFileItems(workspacePath: string): Promise<IWorkspaceFileItem[]> {
  const root = await resolveWorkspaceRoot(workspacePath);
  if (!root) {
    return [];
  }

  const items: IWorkspaceFileItem[] = [];
  let scannedFiles = 0;

  const walkDirectory = async (dirPath: string): Promise<void> => {
    if (scannedFiles >= WORKSPACE_FILE_SCAN_LIMIT) {
      return;
    }

    const entries = await fs.readdir(dirPath, { withFileTypes: true }).catch((): null => null);
    if (!entries) {
      return;
    }

    for (const entry of entries) {
      if (scannedFiles >= WORKSPACE_FILE_SCAN_LIMIT) {
        return;
      }

      if (entry.isDirectory() && IGNORED_WORKSPACE_DIRS.has(entry.name)) {
        continue;
      }

      const absolutePath = path.join(dirPath, entry.name);

      let entryStat: Awaited<ReturnType<typeof fs.lstat>>;
      try {
        // Sequential traversal keeps the bounded file scan deterministic.
        // eslint-disable-next-line no-await-in-loop
        entryStat = await fs.lstat(absolutePath);
      } catch {
        continue;
      }

      if (entryStat.isSymbolicLink()) {
        continue;
      }

      if (entryStat.isDirectory()) {
        // Sequential traversal keeps the bounded file scan deterministic.
        // eslint-disable-next-line no-await-in-loop
        await walkDirectory(absolutePath);
        continue;
      }

      if (!entryStat.isFile()) {
        continue;
      }

      scannedFiles += 1;
      items.push({
        path: absolutePath,
        name: path.basename(absolutePath),
        isFile: true,
        relativePath: normalizeRelativePath(root, absolutePath),
      });
    }
  };

  await walkDirectory(root);

  return items.toSorted((left, right) => left.relativePath.localeCompare(right.relativePath));
}
