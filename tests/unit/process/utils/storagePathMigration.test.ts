import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveBrandStoragePath } from '../../../../src/process/utils/utils';

const tempRoots: string[] = [];

function createTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempRoots.push(dir);
  return dir;
}

afterEach(() => {
  for (const root of tempRoots.splice(0, tempRoots.length)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('resolveBrandStoragePath', () => {
  it('migrates a legacy file to the preferred brand name when the new file is missing', () => {
    const sandbox = createTempDir('contextgo-storage-file-');
    const legacyPath = path.join(sandbox, 'aionui-config.txt');
    fs.writeFileSync(legacyPath, 'legacy-config', 'utf8');

    const resolved = resolveBrandStoragePath({
      baseDir: sandbox,
      preferredName: 'contextgo-config.txt',
      legacyNames: ['aionui-config.txt'],
      kind: 'file',
    });

    expect(resolved).toBe(path.join(sandbox, 'contextgo-config.txt'));
    expect(fs.readFileSync(resolved, 'utf8')).toBe('legacy-config');
    expect(fs.existsSync(legacyPath)).toBe(false);
  });

  it('replaces an empty preferred file with a meaningful legacy file', () => {
    const sandbox = createTempDir('contextgo-storage-replace-');
    const preferredPath = path.join(sandbox, 'contextgo-config.txt');
    const legacyPath = path.join(sandbox, 'aionui-config.txt');

    fs.writeFileSync(preferredPath, '', 'utf8');
    fs.writeFileSync(legacyPath, 'legacy-config', 'utf8');

    const resolved = resolveBrandStoragePath({
      baseDir: sandbox,
      preferredName: 'contextgo-config.txt',
      legacyNames: ['aionui-config.txt'],
      kind: 'file',
    });

    expect(fs.readFileSync(resolved, 'utf8')).toBe('legacy-config');
    expect(fs.existsSync(legacyPath)).toBe(false);
    expect(fs.existsSync(path.join(sandbox, 'migration-backups'))).toBe(true);
  });

  it('backs up a conflicting legacy file when the preferred file already has data', () => {
    const sandbox = createTempDir('contextgo-storage-conflict-');
    const preferredPath = path.join(sandbox, 'contextgo-config.txt');
    const legacyPath = path.join(sandbox, 'aionui-config.txt');

    fs.writeFileSync(preferredPath, 'preferred-config', 'utf8');
    fs.writeFileSync(legacyPath, 'legacy-config', 'utf8');

    const resolved = resolveBrandStoragePath({
      baseDir: sandbox,
      preferredName: 'contextgo-config.txt',
      legacyNames: ['aionui-config.txt'],
      kind: 'file',
    });

    expect(fs.readFileSync(resolved, 'utf8')).toBe('preferred-config');
    expect(fs.existsSync(legacyPath)).toBe(false);

    const backupRoot = path.join(sandbox, 'migration-backups', 'storage-brand-rewrite');
    const backupEntries = fs.readdirSync(backupRoot);
    const backupFile = path.join(backupRoot, backupEntries[0], 'aionui-config.txt');
    expect(fs.readFileSync(backupFile, 'utf8')).toBe('legacy-config');
  });

  it('migrates sqlite sidecar files together with the renamed database', () => {
    const sandbox = createTempDir('contextgo-storage-db-');
    const legacyDb = path.join(sandbox, 'aionui.db');
    fs.writeFileSync(legacyDb, 'db');
    fs.writeFileSync(`${legacyDb}-wal`, 'wal');
    fs.writeFileSync(`${legacyDb}-shm`, 'shm');

    const resolved = resolveBrandStoragePath({
      baseDir: sandbox,
      preferredName: 'contextgo.db',
      legacyNames: ['aionui.db'],
      kind: 'file',
      sidecarSuffixes: ['-wal', '-shm'],
    });

    expect(resolved).toBe(path.join(sandbox, 'contextgo.db'));
    expect(fs.readFileSync(resolved, 'utf8')).toBe('db');
    expect(fs.readFileSync(`${resolved}-wal`, 'utf8')).toBe('wal');
    expect(fs.readFileSync(`${resolved}-shm`, 'utf8')).toBe('shm');
    expect(fs.existsSync(legacyDb)).toBe(false);
  });

  it('renames a legacy history directory to the preferred brand name', () => {
    const sandbox = createTempDir('contextgo-storage-dir-');
    const legacyDir = path.join(sandbox, 'aionui-chat-history');
    fs.mkdirSync(legacyDir, { recursive: true });
    fs.writeFileSync(path.join(legacyDir, 'conversation.txt'), 'history', 'utf8');

    const resolved = resolveBrandStoragePath({
      baseDir: sandbox,
      preferredName: 'contextgo-chat-history',
      legacyNames: ['aionui-chat-history'],
      kind: 'directory',
    });

    expect(resolved).toBe(path.join(sandbox, 'contextgo-chat-history'));
    expect(fs.existsSync(path.join(resolved, 'conversation.txt'))).toBe(true);
    expect(fs.existsSync(legacyDir)).toBe(false);
  });

  it('merges a legacy directory into an existing preferred directory without overwriting preferred files', () => {
    const sandbox = createTempDir('contextgo-storage-merge-');
    const legacyDir = path.join(sandbox, 'aionui');
    const preferredDir = path.join(sandbox, 'contextgo');

    fs.mkdirSync(path.join(legacyDir, 'nested'), { recursive: true });
    fs.mkdirSync(path.join(preferredDir, 'nested'), { recursive: true });
    fs.writeFileSync(path.join(legacyDir, 'legacy-only.txt'), 'legacy', 'utf8');
    fs.writeFileSync(path.join(legacyDir, 'nested', 'shared.txt'), 'legacy-shared', 'utf8');
    fs.writeFileSync(path.join(preferredDir, 'preferred-only.txt'), 'preferred', 'utf8');
    fs.writeFileSync(path.join(preferredDir, 'nested', 'shared.txt'), 'preferred-shared', 'utf8');

    const resolved = resolveBrandStoragePath({
      baseDir: sandbox,
      preferredName: 'contextgo',
      legacyNames: ['aionui'],
      kind: 'directory',
    });

    expect(resolved).toBe(preferredDir);
    expect(fs.existsSync(path.join(preferredDir, 'legacy-only.txt'))).toBe(true);
    expect(fs.readFileSync(path.join(preferredDir, 'preferred-only.txt'), 'utf8')).toBe('preferred');
    expect(fs.readFileSync(path.join(preferredDir, 'nested', 'shared.txt'), 'utf8')).toBe('preferred-shared');
    expect(fs.existsSync(legacyDir)).toBe(false);
  });
});
