import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const tempDirs: string[] = [];

async function makeScriptFixture(): Promise<{
  outputDir: string;
  rootDir: string;
  scriptPath: string;
}> {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'contextgo-harmony-build-'));
  tempDirs.push(rootDir);

  const sourceScriptPath = path.resolve('mobile-shell/scripts/build-harmony-release.sh');
  const scriptPath = path.join(rootDir, 'scripts', 'build-harmony-release.sh');
  const outputDir = path.join(rootDir, 'build-output');

  await fs.mkdir(path.dirname(scriptPath), { recursive: true });
  await fs.mkdir(path.join(rootDir, 'harmony'), { recursive: true });
  await fs.copyFile(sourceScriptPath, scriptPath);
  await fs.chmod(scriptPath, 0o755);

  return { outputDir, rootDir, scriptPath };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('build-harmony-release.sh', () => {
  it('prefers signed Harmony artifacts when they exist', async () => {
    const { outputDir, rootDir, scriptPath } = await makeScriptFixture();
    const harmonyDir = path.join(rootDir, 'harmony');

    await fs.mkdir(path.join(harmonyDir, 'build', 'outputs', 'default'), {
      recursive: true,
    });
    await fs.mkdir(path.join(harmonyDir, 'entry', 'build', 'default', 'outputs', 'default'), {
      recursive: true,
    });

    await fs.writeFile(
      path.join(harmonyDir, 'build', 'outputs', 'default', 'harmony-default.app'),
      'signed-app',
      'utf8'
    );
    await fs.writeFile(
      path.join(harmonyDir, 'entry', 'build', 'default', 'outputs', 'default', 'entry-default.hap'),
      'signed-hap',
      'utf8'
    );
    await fs.writeFile(
      path.join(harmonyDir, 'build', 'outputs', 'default', 'harmony-default-unsigned.app'),
      'unsigned-app',
      'utf8'
    );
    await fs.writeFile(
      path.join(harmonyDir, 'entry', 'build', 'default', 'outputs', 'default', 'entry-default-unsigned.hap'),
      'unsigned-hap',
      'utf8'
    );

    await execFileAsync('bash', [scriptPath, '1.0.0', outputDir], {
      cwd: rootDir,
    });

    expect(await fs.readFile(path.join(outputDir, 'ContextGo-1.0.0-harmony-arm64.app'), 'utf8')).toBe('signed-app');
    expect(await fs.readFile(path.join(outputDir, 'ContextGo-1.0.0-harmony-arm64.hap'), 'utf8')).toBe('signed-hap');
  });

  it('falls back to unsigned Harmony artifacts when signed ones are unavailable', async () => {
    const { outputDir, rootDir, scriptPath } = await makeScriptFixture();
    const harmonyDir = path.join(rootDir, 'harmony');

    await fs.mkdir(path.join(harmonyDir, 'build', 'outputs', 'default'), {
      recursive: true,
    });
    await fs.mkdir(path.join(harmonyDir, 'entry', 'build', 'default', 'outputs', 'default'), {
      recursive: true,
    });

    await fs.writeFile(
      path.join(harmonyDir, 'build', 'outputs', 'default', 'harmony-default-unsigned.app'),
      'unsigned-app',
      'utf8'
    );
    await fs.writeFile(
      path.join(harmonyDir, 'entry', 'build', 'default', 'outputs', 'default', 'entry-default-unsigned.hap'),
      'unsigned-hap',
      'utf8'
    );

    await execFileAsync('bash', [scriptPath, '1.0.0', outputDir], {
      cwd: rootDir,
    });

    expect(await fs.readFile(path.join(outputDir, 'ContextGo-1.0.0-harmony-arm64-unsigned.app'), 'utf8')).toBe(
      'unsigned-app'
    );
    expect(await fs.readFile(path.join(outputDir, 'ContextGo-1.0.0-harmony-arm64-unsigned.hap'), 'utf8')).toBe(
      'unsigned-hap'
    );
  });
});
