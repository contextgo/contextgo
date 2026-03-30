import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { copyDirectoryRecursively } from '../../../../src/process/utils/utils';

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

describe('copyDirectoryRecursively', () => {
  it('removes stale nested entries when removeStale is enabled', async () => {
    const sandbox = createTempDir('contextgo-copy-dir-');
    const srcDir = path.join(sandbox, 'src');
    const destDir = path.join(sandbox, 'dest');

    fs.mkdirSync(path.join(srcDir, '_builtin', 'contextgo-skills'), { recursive: true });
    fs.mkdirSync(path.join(destDir, '_builtin', 'aionui-skills'), { recursive: true });
    fs.mkdirSync(path.join(destDir, '_builtin', 'contextgo-skills'), { recursive: true });

    fs.writeFileSync(path.join(srcDir, '_builtin', 'contextgo-skills', 'SKILL.md'), 'new-skill', 'utf8');
    fs.writeFileSync(path.join(destDir, '_builtin', 'aionui-skills', 'SKILL.md'), 'legacy-skill', 'utf8');
    fs.writeFileSync(path.join(destDir, '_builtin', 'contextgo-skills', 'SKILL.md'), 'old-copy', 'utf8');

    await copyDirectoryRecursively(srcDir, destDir, {
      overwrite: true,
      removeStale: true,
    });

    expect(fs.existsSync(path.join(destDir, '_builtin', 'aionui-skills'))).toBe(false);
    expect(fs.readFileSync(path.join(destDir, '_builtin', 'contextgo-skills', 'SKILL.md'), 'utf8')).toBe('new-skill');
  });
});
