import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const tempDirs: string[] = [];

async function makeFixture(): Promise<{
  rootDir: string;
  scriptPath: string;
}> {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'contextgo-harmony-tools-'));
  tempDirs.push(rootDir);

  const sourceScriptPath = path.resolve('mobile-shell/scripts/resolve-harmony-tooling.sh');
  const scriptPath = path.join(rootDir, 'scripts', 'resolve-harmony-tooling.sh');

  await fs.mkdir(path.dirname(scriptPath), { recursive: true });
  await fs.copyFile(sourceScriptPath, scriptPath);
  await fs.chmod(scriptPath, 0o755);

  return { rootDir, scriptPath };
}

async function writeExecutable(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, '#!/usr/bin/env bash\nexit 0\n', 'utf8');
  await fs.chmod(filePath, 0o755);
}

function parseEnvAssignments(stdout: string): Record<string, string> {
  return Object.fromEntries(
    stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [key, ...valueParts] = line.split('=');
        return [key, valueParts.join('=')];
      })
  );
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('resolve-harmony-tooling.sh', () => {
  it('resolves tool binaries from a command-line-tools root bin layout', async () => {
    const { rootDir, scriptPath } = await makeFixture();
    const toolsRoot = path.join(rootDir, 'command-line-tools');

    await writeExecutable(path.join(toolsRoot, 'bin', 'ohpm'));
    await writeExecutable(path.join(toolsRoot, 'bin', 'hvigorw'));
    await fs.mkdir(path.join(toolsRoot, 'sdk'), { recursive: true });

    const { stdout } = await execFileAsync('bash', [scriptPath], {
      cwd: rootDir,
      env: {
        ...process.env,
        HOME: rootDir,
        CONTEXTGO_HARMONY_TOOLS_ROOT: toolsRoot,
      },
    });

    expect(parseEnvAssignments(stdout)).toEqual({
      CONTEXTGO_HARMONY_HVIGORW: path.join(toolsRoot, 'bin', 'hvigorw'),
      CONTEXTGO_HARMONY_OHPM: path.join(toolsRoot, 'bin', 'ohpm'),
      DEVECO_SDK_HOME: path.join(toolsRoot, 'sdk'),
      HARMONY_TOOLS_ROOT: toolsRoot,
    });
  });

  it('resolves nested ohpm and hvigor directories when bin tools are absent', async () => {
    const { rootDir, scriptPath } = await makeFixture();
    const toolsRoot = path.join(rootDir, 'command-line-tools');

    await writeExecutable(path.join(toolsRoot, 'ohpm', 'bin', 'ohpm'));
    await writeExecutable(path.join(toolsRoot, 'hvigor', 'bin', 'hvigorw'));
    await fs.mkdir(path.join(toolsRoot, 'sdk'), { recursive: true });

    const { stdout } = await execFileAsync('bash', [scriptPath], {
      cwd: rootDir,
      env: {
        ...process.env,
        HOME: rootDir,
        CONTEXTGO_HARMONY_TOOLS_ROOT: toolsRoot,
      },
    });

    expect(parseEnvAssignments(stdout)).toEqual({
      CONTEXTGO_HARMONY_HVIGORW: path.join(toolsRoot, 'hvigor', 'bin', 'hvigorw'),
      CONTEXTGO_HARMONY_OHPM: path.join(toolsRoot, 'ohpm', 'bin', 'ohpm'),
      DEVECO_SDK_HOME: path.join(toolsRoot, 'sdk'),
      HARMONY_TOOLS_ROOT: toolsRoot,
    });
  });

  it('derives the tools root from DEVECO_SDK_HOME when no explicit root is passed', async () => {
    const { rootDir, scriptPath } = await makeFixture();
    const toolsRoot = path.join(rootDir, 'Huawei', 'command-line-tools');
    const sdkHome = path.join(toolsRoot, 'sdk');

    await writeExecutable(path.join(toolsRoot, 'bin', 'ohpm'));
    await writeExecutable(path.join(toolsRoot, 'hvigor', 'bin', 'hvigorw'));
    await fs.mkdir(sdkHome, { recursive: true });

    const { stdout } = await execFileAsync('bash', [scriptPath], {
      cwd: rootDir,
      env: {
        ...process.env,
        HOME: rootDir,
        DEVECO_SDK_HOME: sdkHome,
      },
    });

    expect(parseEnvAssignments(stdout)).toEqual({
      CONTEXTGO_HARMONY_HVIGORW: path.join(toolsRoot, 'hvigor', 'bin', 'hvigorw'),
      CONTEXTGO_HARMONY_OHPM: path.join(toolsRoot, 'bin', 'ohpm'),
      DEVECO_SDK_HOME: sdkHome,
      HARMONY_TOOLS_ROOT: toolsRoot,
    });
  });

  it('does not scan non-standard HOME paths unless global search is enabled', async () => {
    const { rootDir, scriptPath } = await makeFixture();
    const toolsRoot = path.join(rootDir, 'vendor', 'deveco', 'command-line-tools');

    await writeExecutable(path.join(toolsRoot, 'bin', 'ohpm'));
    await writeExecutable(path.join(toolsRoot, 'hvigor', 'bin', 'hvigorw'));
    await fs.mkdir(path.join(toolsRoot, 'sdk'), { recursive: true });

    await expect(
      execFileAsync('bash', [scriptPath], {
        cwd: rootDir,
        env: {
          ...process.env,
          HOME: rootDir,
        },
      })
    ).rejects.toMatchObject({
      stderr: expect.stringContaining('Unable to resolve HarmonyOS command-line tools'),
    });
  });

  it('discovers a non-standard command-line-tools root under HOME when global search is enabled', async () => {
    const { rootDir, scriptPath } = await makeFixture();
    const toolsRoot = path.join(rootDir, 'vendor', 'deveco', 'command-line-tools');

    await writeExecutable(path.join(toolsRoot, 'bin', 'ohpm'));
    await writeExecutable(path.join(toolsRoot, 'hvigor', 'bin', 'hvigorw'));
    await fs.mkdir(path.join(toolsRoot, 'sdk'), { recursive: true });

    const { stdout } = await execFileAsync('bash', [scriptPath], {
      cwd: rootDir,
      env: {
        ...process.env,
        HOME: rootDir,
        CONTEXTGO_HARMONY_ENABLE_GLOBAL_SEARCH: 'true',
      },
    });

    expect(parseEnvAssignments(stdout)).toEqual({
      CONTEXTGO_HARMONY_HVIGORW: path.join(toolsRoot, 'hvigor', 'bin', 'hvigorw'),
      CONTEXTGO_HARMONY_OHPM: path.join(toolsRoot, 'bin', 'ohpm'),
      DEVECO_SDK_HOME: path.join(toolsRoot, 'sdk'),
      HARMONY_TOOLS_ROOT: toolsRoot,
    });
  });

  it('fails with a clear error when no compatible tooling layout is available', async () => {
    const { rootDir, scriptPath } = await makeFixture();
    const toolsRoot = path.join(rootDir, 'command-line-tools');

    await fs.mkdir(path.join(toolsRoot, 'sdk'), { recursive: true });

    await expect(
      execFileAsync('bash', [scriptPath], {
        cwd: rootDir,
        env: {
          ...process.env,
          HOME: rootDir,
          CONTEXTGO_HARMONY_TOOLS_ROOT: toolsRoot,
        },
      })
    ).rejects.toMatchObject({
      stderr: expect.stringContaining('Unable to resolve HarmonyOS command-line tools'),
    });
  });
});
