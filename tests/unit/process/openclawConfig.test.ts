import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('listConfiguredOpenClawModels', () => {
  const originalEnv = { ...process.env };
  let tempDir: string | null = null;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-config-'));
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it('returns models from openclaw.json provider catalog and agent aliases', async () => {
    const configPath = path.join(tempDir!, 'openclaw.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        agents: {
          defaults: {
            model: {
              primary: 'infermesh/MiniMax-M2.7-highspeed',
            },
            models: {
              'infermesh/MiniMax-M2.7': {
                alias: 'minimax',
              },
              'fallback/providerless-model': {
                alias: 'fallback-model',
              },
            },
          },
          list: [
            { id: 'main' },
            {
              id: 'dev',
              models: {
                'infermesh/MiniMax-M2.7-highspeed': {
                  alias: 'dev-fast',
                },
              },
            },
          ],
        },
        models: {
          providers: {
            infermesh: {
              models: [
                { id: 'MiniMax-M2.7', name: 'MiniMax M2.7' },
                { id: 'MiniMax-M2.7-highspeed', name: 'MiniMax M2.7 Highspeed' },
              ],
            },
          },
        },
      })
    );
    process.env.OPENCLAW_CONFIG_PATH = configPath;

    const { listConfiguredOpenClawModels } = await import('../../../src/process/agent/openclaw/openclawConfig');

    expect(listConfiguredOpenClawModels('dev')).toEqual([
      {
        id: 'infermesh/MiniMax-M2.7',
        label: 'minimax',
        providerId: 'infermesh',
        alias: 'minimax',
      },
      {
        id: 'infermesh/MiniMax-M2.7-highspeed',
        label: 'dev-fast',
        providerId: 'infermesh',
        alias: 'dev-fast',
      },
      {
        id: 'fallback/providerless-model',
        label: 'fallback-model',
        providerId: 'fallback',
        alias: 'fallback-model',
      },
    ]);
  });

  it('returns an empty list when the OpenClaw config file does not exist', async () => {
    process.env.OPENCLAW_CONFIG_PATH = path.join(tempDir!, 'missing-openclaw.json');

    const { listConfiguredOpenClawModels } = await import('../../../src/process/agent/openclaw/openclawConfig');

    expect(listConfiguredOpenClawModels('main')).toEqual([]);
  });
});
