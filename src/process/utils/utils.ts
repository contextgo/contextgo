/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IDirOrFile } from '@/common/adapter/ipcBridge';
import { getPlatformServices } from '@/common/platform';
import { getEnvAwareName } from '@/common/config/appEnv';
import {
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
} from 'fs';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
export const hasElectronAppPath = (): boolean => {
  return typeof process.versions.electron === 'string';
};

const getElectronPathOrFallback = (name: 'temp' | 'home' | 'userData'): string => {
  const paths = getPlatformServices().paths;
  switch (name) {
    case 'temp':
      return paths.getTempDir();
    case 'home':
      return paths.getHomeDir();
    case 'userData':
      return paths.getDataDir();
  }
};

export const getTempPath = () => {
  const rootPath = getElectronPathOrFallback('temp');
  return path.join(rootPath, 'contextgo');
};

/**
 * Ensure CLI-safe symlink exists and return the symlink path.
 * On macOS, creates a symlink in home directory to avoid spaces in paths.
 * CLI tools like Qwen can't handle spaces in paths properly.
 *
 * 确保 CLI 安全符号链接存在并返回符号链接路径。
 * 在 macOS 上，在用户目录创建符号链接以避免路径中的空格。
 * CLI 工具如 Qwen 无法正确处理路径中的空格。
 */
const ensureCliSafeSymlink = (targetPath: string, symlinkName: string): string => {
  // Only needed when the platform explicitly requires CLI-safe symlinks
  // (Electron on macOS, where userData lives under "Application Support" which contains spaces)
  if (!getPlatformServices().paths.needsCliSafeSymlinks()) {
    return targetPath;
  }

  const homePath = getElectronPathOrFallback('home');
  const symlinkPath = path.join(homePath, symlinkName);

  // Ensure symlink exists
  try {
    const stats = lstatSync(symlinkPath);
    if (stats.isSymbolicLink()) {
      // Symlink exists, verify it points to the correct location
      const target = readlinkSync(symlinkPath);
      if (target === targetPath) {
        // Ensure the target directory still exists (broken symlink if deleted, #841)
        if (!existsSync(targetPath)) {
          mkdirSync(targetPath, { recursive: true });
        }
        return symlinkPath;
      }
      // Wrong target, remove and recreate
      unlinkSync(symlinkPath);
    } else if (stats.isDirectory()) {
      // Real directory exists, don't touch it
      return targetPath;
    } else {
      // Regular file blocking the symlink path (#841), remove it
      unlinkSync(symlinkPath);
    }
  } catch {
    // Symlink doesn't exist, create it
  }

  try {
    // Ensure the target directory exists first
    if (!existsSync(targetPath)) {
      mkdirSync(targetPath, { recursive: true });
    }
    symlinkSync(targetPath, symlinkPath);
    return symlinkPath;
  } catch (error) {
    return targetPath;
  }
};

/**
 * Get data path, using CLI-safe symlink on macOS.
 * Release builds use ~/.contextgo; dev builds use ~/.contextgo-dev.
 * 获取数据目录路径，macOS 上使用符号链接。
 * Release 使用 ~/.contextgo，Dev 模式使用 ~/.contextgo-dev。
 */
export const getDataPath = (): string => {
  const rootPath = getElectronPathOrFallback('userData');
  const dataPath = resolveBrandStoragePath({
    baseDir: rootPath,
    preferredName: 'contextgo',
    legacyNames: [],
    kind: 'directory',
  });
  return ensureCliSafeSymlink(dataPath, getEnvAwareName('.contextgo'));
};

/**
 * Get config path, using CLI-safe symlink on macOS.
 * Release builds use ~/.contextgo-config; dev builds use ~/.contextgo-config-dev.
 * 获取配置目录路径，macOS 上使用符号链接。
 * Release 使用 ~/.contextgo-config，Dev 模式使用 ~/.contextgo-config-dev。
 */
export const getConfigPath = (): string => {
  const rootPath = getElectronPathOrFallback('userData');
  const configPath = path.join(rootPath, 'config');
  return ensureCliSafeSymlink(configPath, getEnvAwareName('.contextgo-config'));
};

type StorageArtifactKind = 'file' | 'directory';

type ResolveBrandStoragePathOptions = {
  baseDir: string;
  preferredName: string;
  legacyNames: string[];
  kind: StorageArtifactKind;
  sidecarSuffixes?: string[];
};

const STORAGE_MIGRATION_BACKUP_STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const STORAGE_MIGRATION_BACKUP_SCOPE = path.join('migration-backups', 'storage-brand-rewrite');

const buildArtifactPath = (baseDir: string, name: string) => path.join(baseDir, name);

const isMeaningfulArtifactSync = (artifactPath: string, kind: StorageArtifactKind): boolean => {
  try {
    const stats = statSync(artifactPath);
    if (kind === 'directory') {
      return stats.isDirectory() && readdirSync(artifactPath).length > 0;
    }
    return stats.isFile() && stats.size > 0;
  } catch {
    return false;
  }
};

const filesAreEquivalentSync = (fileA: string, fileB: string): boolean => {
  try {
    const statA = statSync(fileA);
    const statB = statSync(fileB);
    if (!statA.isFile() || !statB.isFile() || statA.size !== statB.size) {
      return false;
    }
    if (statA.size === 0) {
      return true;
    }
    if (statA.size > 5 * 1024 * 1024) {
      return false;
    }
    return readFileSync(fileA).equals(readFileSync(fileB));
  } catch {
    return false;
  }
};

const ensureParentDirectorySync = (targetPath: string) => {
  mkdirSync(path.dirname(targetPath), { recursive: true });
};

const listArtifactPaths = (
  artifactPath: string,
  kind: StorageArtifactKind,
  sidecarSuffixes: string[] = []
): string[] => {
  if (kind === 'directory') {
    return [artifactPath];
  }
  return [artifactPath, ...sidecarSuffixes.map((suffix) => `${artifactPath}${suffix}`)];
};

const backupArtifactSync = (
  baseDir: string,
  artifactPath: string,
  kind: StorageArtifactKind,
  sidecarSuffixes: string[] = []
): void => {
  const artifactPaths = listArtifactPaths(artifactPath, kind, sidecarSuffixes).filter((entry) => existsSync(entry));
  if (artifactPaths.length === 0) {
    return;
  }

  for (const sourcePath of artifactPaths) {
    const relativePath = path.relative(baseDir, sourcePath);
    const backupPath = path.join(baseDir, STORAGE_MIGRATION_BACKUP_SCOPE, STORAGE_MIGRATION_BACKUP_STAMP, relativePath);
    ensureParentDirectorySync(backupPath);

    const stats = lstatSync(sourcePath);
    if (stats.isDirectory()) {
      cpSync(sourcePath, backupPath, {
        recursive: true,
      });
      continue;
    }

    copyFileSync(sourcePath, backupPath);
  }
};

const removeArtifactSync = (artifactPath: string, kind: StorageArtifactKind, sidecarSuffixes: string[] = []): void => {
  for (const entry of listArtifactPaths(artifactPath, kind, sidecarSuffixes)) {
    if (!existsSync(entry)) {
      continue;
    }
    if (kind === 'directory') {
      rmSync(entry, { recursive: true, force: true });
      continue;
    }
    rmSync(entry, { force: true });
  }
};

const mergeDirectoryIntoPreferredSync = (legacyPath: string, preferredPath: string): void => {
  cpSync(legacyPath, preferredPath, {
    recursive: true,
    force: false,
    errorOnExist: false,
  });
};

const moveArtifactSync = (
  sourcePath: string,
  targetPath: string,
  kind: StorageArtifactKind,
  sidecarSuffixes: string[] = []
): void => {
  ensureParentDirectorySync(targetPath);
  renameSync(sourcePath, targetPath);

  if (kind === 'file') {
    for (const suffix of sidecarSuffixes) {
      const sidecarSource = `${sourcePath}${suffix}`;
      const sidecarTarget = `${targetPath}${suffix}`;
      if (!existsSync(sidecarSource)) {
        continue;
      }
      renameSync(sidecarSource, sidecarTarget);
    }
  }
};

/**
 * Resolve a storage artifact path after applying brand rename migration rules.
 * Prefers the new artifact name, automatically adopts safe legacy artifacts,
 * and backs up conflicting legacy data before removing it.
 */
export const resolveBrandStoragePath = ({
  baseDir,
  preferredName,
  legacyNames,
  kind,
  sidecarSuffixes = [],
}: ResolveBrandStoragePathOptions): string => {
  const preferredPath = buildArtifactPath(baseDir, preferredName);
  const legacyPaths = legacyNames.map((name) => buildArtifactPath(baseDir, name));

  for (const legacyPath of legacyPaths) {
    if (!existsSync(legacyPath)) {
      continue;
    }

    if (!existsSync(preferredPath)) {
      moveArtifactSync(legacyPath, preferredPath, kind, sidecarSuffixes);
      console.log(`[ContextGo] Migrated storage artifact to new brand name: ${legacyPath} -> ${preferredPath}`);
      continue;
    }

    if (kind === 'file' && filesAreEquivalentSync(preferredPath, legacyPath)) {
      removeArtifactSync(legacyPath, kind, sidecarSuffixes);
      continue;
    }

    const preferredMeaningful = isMeaningfulArtifactSync(preferredPath, kind);
    const legacyMeaningful = isMeaningfulArtifactSync(legacyPath, kind);

    if (!preferredMeaningful && legacyMeaningful) {
      backupArtifactSync(baseDir, preferredPath, kind, sidecarSuffixes);
      removeArtifactSync(preferredPath, kind, sidecarSuffixes);
      moveArtifactSync(legacyPath, preferredPath, kind, sidecarSuffixes);
      console.log(`[ContextGo] Replaced empty preferred storage artifact with legacy data: ${legacyPath}`);
      continue;
    }

    if (!legacyMeaningful) {
      removeArtifactSync(legacyPath, kind, sidecarSuffixes);
      continue;
    }

    if (kind === 'directory') {
      backupArtifactSync(baseDir, legacyPath, kind, sidecarSuffixes);
      mergeDirectoryIntoPreferredSync(legacyPath, preferredPath);
      removeArtifactSync(legacyPath, kind, sidecarSuffixes);
      console.log(`[ContextGo] Merged legacy storage directory into preferred path: ${legacyPath} -> ${preferredPath}`);
      continue;
    }

    backupArtifactSync(baseDir, legacyPath, kind, sidecarSuffixes);
    removeArtifactSync(legacyPath, kind, sidecarSuffixes);
    console.warn(`[ContextGo] Backed up conflicting legacy storage artifact and kept preferred path: ${legacyPath}`);
  }

  return preferredPath;
};

export const generateHashWithFullName = (fullName: string): string => {
  let hash = 0;
  for (let i = 0; i < fullName.length; i++) {
    const char = fullName.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // 取绝对值并转换为16进制，然后取前8位
  return Math.abs(hash).toString(16).padStart(8, '0'); //.slice(0, 8);
};

// 递归读取目录内容，返回树状结构
export async function readDirectoryRecursive(
  dirPath: string,
  options?: {
    root?: string;
    abortController?: AbortController;
    fileService?: { shouldIgnoreFile(path: string): boolean };
    maxDepth?: number;
    search?: {
      text: string;
      onProcess?(result: { file: number; dir: number; match?: IDirOrFile }): void;
      process?: { file: number; dir: number };
    };
  }
): Promise<IDirOrFile> {
  const { root = dirPath, maxDepth = 1, fileService, search, abortController } = options || {};
  const { text: searchText, onProcess: onSearchProcess = () => {}, process = { file: 0, dir: 1 } } = search || {};

  const matchSearch = searchText ? (fullPath: string) => fullPath.includes(searchText) : (_: string) => false;

  const checkStatus = () => {
    if (abortController.signal.aborted) throw new Error('readDirectoryRecursive aborted!');
  };

  try {
    const stats = await fs.stat(dirPath);
    if (!stats.isDirectory()) {
      return null;
    }
  } catch {
    // Directory may have been deleted (e.g. cleaned-up temp workspace)
    return null;
  }
  const result: IDirOrFile = {
    name: path.basename(dirPath),
    fullPath: dirPath,
    relativePath: path.relative(root, dirPath),
    isDir: true,
    isFile: false,
    children: [],
  };
  let searchResult = matchSearch(result.name);
  onSearchProcess({
    ...process,
    match: searchResult ? result : undefined,
  });
  if (maxDepth === 0 || searchResult) return result;
  checkStatus();
  let items: string[];
  try {
    items = await fs.readdir(dirPath);
  } catch {
    // Permission denied (EPERM/EACCES) or other fs errors — skip this directory
    return result;
  }
  checkStatus();

  for (const item of items) {
    checkStatus();
    if (item === 'node_modules') continue;
    const itemPath = path.join(dirPath, item);
    if (fileService && fileService.shouldIgnoreFile(itemPath)) continue;

    let itemStats: Awaited<ReturnType<typeof fs.stat>>;
    try {
      itemStats = await fs.stat(itemPath);
    } catch {
      // File may have been deleted between readdir and stat (race condition)
      continue;
    }
    if (itemStats.isDirectory()) {
      process.dir += 1;
      const child = await readDirectoryRecursive(itemPath, {
        ...options,
        maxDepth: searchText ? maxDepth : maxDepth - 1,
        root,
        search: {
          ...search,
          process,
          onProcess(searchResult) {
            if (searchResult.match) {
              if (!result.children.find((v) => v.fullPath === searchResult.match.fullPath)) {
                result.children.push(searchResult.match);
              }
              onSearchProcess({ ...process, match: result });
            }
          },
        },
      });
      if (child && !searchText) {
        result.children.push(child);
      }
    } else {
      const children = {
        name: item,
        relativePath: path.relative(root, itemPath),
        fullPath: itemPath,
        isDir: false,
        isFile: true,
      };
      if (!searchText) {
        result.children.push(children);
        continue;
      }
      searchResult = matchSearch(children.name);
      if (searchResult) {
        result.children.push(children);
      }
      process.file += 1;
      onSearchProcess({
        ...process,
        match: searchResult ? result : undefined,
      });
    }
  }
  result.children.sort((a, b) => {
    if (a.isDir && !b.isDir) return -1;
    if (!a.isDir && b.isDir) return 1;
    return a.name.localeCompare(b.name);
  });
  return result;
}

/**
 * 递归复制目录
 * 注意：包含路径验证，防止复制到自身或子目录导致无限递归（修复 Windows 下 cache 目录循环创建的 bug）
 */
interface CopyOptions {
  overwrite?: boolean;
  removeStale?: boolean;
}

export async function copyDirectoryRecursively(src: string, dest: string, options: CopyOptions = {}) {
  const { overwrite = true, removeStale = false } = options;

  // 标准化路径：Windows 转小写（不区分大小写），Unix/macOS 保持原样（区分大小写）
  const isWindows = process.platform === 'win32';
  const normalizedSrc = isWindows ? path.resolve(src).toLowerCase() : path.resolve(src);
  const normalizedDest = isWindows ? path.resolve(dest).toLowerCase() : path.resolve(dest);

  // 防止复制到自身 (F:\code -> F:\code)
  if (normalizedSrc === normalizedDest) {
    throw new Error(`Cannot copy directory into itself: ${src}`);
  }

  // 防止复制到子目录 (F:\code -> F:\code\cache) - 会导致无限递归
  if (normalizedDest.startsWith(normalizedSrc + path.sep)) {
    throw new Error(`Cannot copy directory into its subdirectory: ${src} -> ${dest}`);
  }

  // 防止复制到父目录 (F:\code\cache -> F:\code)
  if (normalizedSrc.startsWith(normalizedDest + path.sep)) {
    throw new Error(`Cannot copy parent directory into child directory: ${src} -> ${dest}`);
  }

  if (!existsSync(dest)) {
    await fs.mkdir(dest, { recursive: true });
  }

  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      if (!existsSync(destPath)) {
        await fs.mkdir(destPath, { recursive: true });
      }
      await copyDirectoryRecursively(srcPath, destPath, options);
    } else {
      // 如果不覆盖且目标文件已存在，跳过
      if (!overwrite && existsSync(destPath)) {
        continue;
      }
      await fs.copyFile(srcPath, destPath);
    }
  }

  if (!removeStale || !existsSync(dest)) {
    return;
  }

  const sourceNames = new Set(entries.map((entry) => entry.name));
  const destEntries = await fs.readdir(dest, { withFileTypes: true });

  for (const entry of destEntries) {
    if (sourceNames.has(entry.name)) {
      continue;
    }

    await fs.rm(path.join(dest, entry.name), { recursive: true, force: true });
  }
}

// 验证两个目录的文件名结构是否相同
export async function verifyDirectoryFiles(dir1: string, dir2: string): Promise<boolean> {
  try {
    if (!existsSync(dir1) || !existsSync(dir2)) {
      return false;
    }

    const entries1 = await fs.readdir(dir1, { withFileTypes: true });
    const entries2 = await fs.readdir(dir2, { withFileTypes: true });

    if (entries1.length !== entries2.length) {
      return false;
    }

    entries1.sort((a, b) => a.name.localeCompare(b.name));
    entries2.sort((a, b) => a.name.localeCompare(b.name));

    for (let i = 0; i < entries1.length; i++) {
      const entry1 = entries1[i];
      const entry2 = entries2[i];

      if (entry1.name !== entry2.name || entry1.isDirectory() !== entry2.isDirectory()) {
        return false;
      }

      if (entry1.isDirectory()) {
        const path1 = path.join(dir1, entry1.name);
        const path2 = path.join(dir2, entry2.name);
        if (!(await verifyDirectoryFiles(path1, path2))) {
          return false;
        }
      }
    }

    return true;
  } catch (error) {
    console.warn('[ContextGo] Error verifying directory files:', error);
    return false;
  }
}

export const copyFilesToDirectory = async (
  dir: string,
  files?: string[],
  skipCleanup = false,
  cacheDir?: string
): Promise<string[]> => {
  if (!files) return [];

  const tempDir = cacheDir ? path.join(cacheDir, 'temp') : null;
  const copiedFiles: string[] = [];
  const resolvedDir = path.resolve(dir);

  for (const file of files) {
    // 确保文件路径是绝对路径
    const absoluteFilePath = path.isAbsolute(file) ? file : path.resolve(file);

    // 检查源文件是否存在
    try {
      await fs.access(absoluteFilePath);
    } catch (error) {
      console.warn(`[ContextGo] Source file does not exist, skipping: ${absoluteFilePath}`);
      console.warn(`[ContextGo] Original path: ${file}`);
      // 跳过不存在的文件，而不是抛出错误
      continue;
    }

    // Skip files that are already inside the target directory to avoid duplicates
    // 跳过已在目标目录中的文件，避免创建重复副本
    const resolvedFile = path.resolve(absoluteFilePath);
    if (resolvedFile.startsWith(resolvedDir + path.sep)) {
      copiedFiles.push(absoluteFilePath);
      continue;
    }

    // 使用原始文件名，只在目标文件已存在时才添加唯一后缀
    // Use original filename, only add unique suffix when destination exists
    let fileName = path.basename(absoluteFilePath);
    let destPath = path.join(dir, fileName);

    // 如果目标文件已存在，添加时间戳后缀避免覆盖
    // If destination exists, add timestamp suffix to avoid overwriting
    if (existsSync(destPath)) {
      const ext = path.extname(fileName);
      const baseName = path.basename(fileName, ext);
      fileName = `${baseName}_${Date.now()}${ext}`;
      destPath = path.join(dir, fileName);
    }

    try {
      await fs.copyFile(absoluteFilePath, destPath);
      copiedFiles.push(destPath);
    } catch (error) {
      console.error(`[ContextGo] Failed to copy file from ${absoluteFilePath} to ${destPath}:`, error);
      // 继续处理其他文件，而不是完全失败
    }

    // 如果是临时文件，复制完成后删除
    if (tempDir && absoluteFilePath.startsWith(tempDir) && !skipCleanup) {
      try {
        await fs.unlink(absoluteFilePath);
      } catch (error) {
        console.warn(`Failed to cleanup temp file ${absoluteFilePath}:`, error);
      }
    }
  }

  return copiedFiles;
};

export function ensureDirectory(dirPath: string): void {
  try {
    const stats = lstatSync(dirPath);
    if (stats.isDirectory()) {
      return;
    }
    if (stats.isSymbolicLink()) {
      // Verify symlink target actually exists (#841 - broken symlink)
      if (existsSync(dirPath)) {
        return;
      }
      // Broken symlink, remove so mkdirSync can work on the real path
      unlinkSync(dirPath);
    } else {
      // Regular file blocking the directory path (#841), remove it
      unlinkSync(dirPath);
    }
  } catch {
    // Path doesn't exist, create it
  }
  mkdirSync(dirPath, { recursive: true });
}
