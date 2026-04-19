import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  listWorkspaceFileItems,
  listWorkspaceGitChanges,
  listWorkspaceRecentFiles,
  readWorkspaceGitDiff,
} from '@/process/bridge/services/workspaceFiles';

const tempDirs: string[] = [];
const hasGit = spawnSync('git', ['--version']).status === 0;
const gitIt = hasGit ? it : it.skip;

async function createTempWorkspace(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'contextgo-workspace-files-'));
  tempDirs.push(dir);
  return dir;
}

function runGit(cwd: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf-8',
  });
}

describe('workspaceFiles', () => {
  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0, tempDirs.length).map((dir) =>
        fs.rm(dir, {
          recursive: true,
          force: true,
        })
      )
    );
  });

  it('lists nested workspace files for mention matching and preserves relative paths', async () => {
    const workspace = await createTempWorkspace();
    await fs.mkdir(path.join(workspace, 'src', 'nested'), { recursive: true });
    await fs.writeFile(path.join(workspace, 'src', 'nested', 'readme.md'), '# nested');

    const items = await listWorkspaceFileItems(workspace);

    expect(items).toContainEqual(
      expect.objectContaining({
        name: 'readme.md',
        relativePath: 'src/nested/readme.md',
        path: path.join(workspace, 'src', 'nested', 'readme.md'),
        isFile: true,
      })
    );
  });

  it('ignores repository and dependency directories while building mention candidates', async () => {
    const workspace = await createTempWorkspace();
    await fs.mkdir(path.join(workspace, '.git'), { recursive: true });
    await fs.mkdir(path.join(workspace, 'node_modules', 'pkg'), { recursive: true });
    await fs.mkdir(path.join(workspace, 'docs'), { recursive: true });
    await fs.writeFile(path.join(workspace, '.git', 'config'), 'ignored');
    await fs.writeFile(path.join(workspace, 'node_modules', 'pkg', 'index.js'), 'ignored');
    await fs.writeFile(path.join(workspace, 'docs', 'guide.md'), '# guide');

    const items = await listWorkspaceFileItems(workspace);

    expect(items.map((item) => item.relativePath)).toEqual(['docs/guide.md']);
  });

  it('sorts recent workspace files by last modified time for non-git fallback', async () => {
    const workspace = await createTempWorkspace();
    const olderFilePath = path.join(workspace, 'docs', 'older.md');
    const newerFilePath = path.join(workspace, 'notes.md');

    await fs.mkdir(path.dirname(olderFilePath), { recursive: true });
    await fs.writeFile(olderFilePath, '# older');
    await fs.writeFile(newerFilePath, '# newer');
    await fs.utimes(olderFilePath, new Date('2024-01-01T00:00:00.000Z'), new Date('2024-01-01T00:00:00.000Z'));
    await fs.utimes(newerFilePath, new Date('2024-06-01T00:00:00.000Z'), new Date('2024-06-01T00:00:00.000Z'));

    const files = await listWorkspaceRecentFiles(workspace, 2);

    expect(files.map((file) => file.path)).toEqual(['notes.md', 'docs/older.md']);
  });

  gitIt('lists git workspace changes and reads diffs for tracked and new files', async () => {
    const workspace = await createTempWorkspace();

    runGit(workspace, ['init']);
    runGit(workspace, ['config', 'user.email', 'contextgo@example.com']);
    runGit(workspace, ['config', 'user.name', 'ContextGo']);

    const trackedFilePath = path.join(workspace, 'tracked.txt');
    const newFilePath = path.join(workspace, 'new.txt');

    await fs.writeFile(trackedFilePath, 'before\n');
    runGit(workspace, ['add', 'tracked.txt']);
    runGit(workspace, ['commit', '-m', 'initial']);

    await fs.writeFile(trackedFilePath, 'after\n');
    await fs.writeFile(newFilePath, 'brand new\n');

    const workspaceRealPath = await fs.realpath(workspace);
    const { repository, changes } = await listWorkspaceGitChanges(workspace);

    expect(repository).toEqual(
      expect.objectContaining({
        isRepository: true,
        repositoryRoot: workspaceRealPath,
      })
    );
    expect(changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'tracked.txt',
          absolutePath: trackedFilePath,
          status: 'M',
        }),
        expect.objectContaining({
          path: 'new.txt',
          absolutePath: newFilePath,
          status: '??',
        }),
      ])
    );

    const trackedDiff = await readWorkspaceGitDiff(workspace, trackedFilePath);
    const newFileDiff = await readWorkspaceGitDiff(workspace, newFilePath);

    expect(trackedDiff).toContain('diff --git a/tracked.txt b/tracked.txt');
    expect(trackedDiff).toContain('-before');
    expect(trackedDiff).toContain('+after');
    expect(newFileDiff).toContain('diff --git');
    expect(newFileDiff).toContain('new.txt');
    expect(newFileDiff).toContain('brand new');
  });
});
