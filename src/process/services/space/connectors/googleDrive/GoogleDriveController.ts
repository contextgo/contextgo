/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ChildProcess } from 'node:child_process';
import { execFile as execFileCallback, spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import type { GoogleDriveConnectorConfig } from '@/common/types/connectors/googleDrive';
import { isProcessAlive, killChild } from '@process/agent/acp/utils';

const execFile = promisify(execFileCallback);

const CLASH_CONFIG_PATH = path.join(
  process.env.HOME || '',
  'Library',
  'Application Support',
  'io.github.clash-verge-rev.clash-verge-rev',
  'clash-verge.yaml'
);

export const resolveDefaultLocalProxyEnv = (): NodeJS.ProcessEnv => {
  const env = { ...process.env };
  if (env.HTTP_PROXY || env.HTTPS_PROXY || env.ALL_PROXY) {
    return env;
  }

  try {
    const content = readFileSync(CLASH_CONFIG_PATH, 'utf-8');
    const match = content.match(/^mixed-port:\s*(\d+)$/m);
    if (!match?.[1]) {
      return env;
    }
    const proxyUrl = `http://127.0.0.1:${match[1]}`;
    return {
      ...env,
      HTTP_PROXY: proxyUrl,
      HTTPS_PROXY: proxyUrl,
      ALL_PROXY: proxyUrl,
      http_proxy: proxyUrl,
      https_proxy: proxyUrl,
      all_proxy: proxyUrl,
    };
  } catch {
    return env;
  }
};

export type GoogleDriveRuntimeDetails = {
  running: boolean;
  pid?: number;
  command?: string;
  args?: string[];
  lastError?: string;
};

export type GoogleDriveStartResult = {
  pid?: number;
  command: string;
  args: string[];
  note: string;
};

export interface GoogleDriveController {
  start(config: GoogleDriveConnectorConfig): Promise<GoogleDriveStartResult>;
  stop(): Promise<void>;
  getRuntimeDetails(): GoogleDriveRuntimeDetails;
}


const resolveRepoRootCandidates = (): string[] => {
  const cwd = process.cwd();
  return [cwd, path.resolve(cwd, '..'), path.resolve(cwd, '../..')];
};

const resolveGoogleDriveStubDir = (): string | null => {
  for (const candidate of resolveRepoRootCandidates()) {
    const stubDir = path.join(candidate, 'resources', 'native', 'google-drive-sidecar-go');
    if (existsSync(path.join(stubDir, 'main.go'))) {
      return stubDir;
    }
  }

  return null;
};

const resolveGoCommand = async (): Promise<string | null> => {
  for (const candidate of ['go']) {
    try {
      await execFile(candidate, ['version'], { windowsHide: true, timeout: 5_000 });
      return candidate;
    } catch {
      continue;
    }
  }

  return null;
};

const buildRuntimeCommand = (config: GoogleDriveConnectorConfig, goCommand: string): { command: string; args: string[]; cwd?: string } => {
  const trimmedCommand = config.command.trim();
  if (!trimmedCommand || trimmedCommand === 'go') {
    return {
      command: goCommand,
      cwd: resolveGoogleDriveStubDir() || undefined,
      args: [
        ...config.args,
        '--client-id',
        config.clientId,
        '--client-secret',
        config.clientSecret,
        '--scopes',
        config.scopes.join(','),
      ],
    };
  }

  return {
    command: trimmedCommand,
    args: [
      ...config.args,
      '--client-id',
      config.clientId,
      '--client-secret',
      config.clientSecret,
      '--scopes',
      config.scopes.join(','),
    ],
  };
};

export class NodeGoogleDriveController implements GoogleDriveController {
  private child: ChildProcess | null = null;
  private command?: string;
  private args?: string[];
  private lastError?: string;

  private normalizeDeadChild(): void {
    const pid = this.child?.pid;
    if (pid && !isProcessAlive(pid)) {
      this.child = null;
    }
  }

  async start(config: GoogleDriveConnectorConfig): Promise<GoogleDriveStartResult> {
    this.normalizeDeadChild();

    if (this.child?.pid && isProcessAlive(this.child.pid)) {
      return {
        pid: this.child.pid,
        command: this.command || 'go',
        args: this.args || [],
        note: 'Managed Google Drive sidecar is already running.',
      };
    }

    const goCommand = await resolveGoCommand();
    if (!goCommand && (!config.command.trim() || config.command.trim() === 'go')) {
      this.lastError = 'Google Drive connector requires the Go toolchain, or an explicit sidecar command override.';
      throw new Error(this.lastError);
    }

    const { command, args, cwd } = buildRuntimeCommand(config, goCommand || 'go');
    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'ignore', 'ignore'],
      windowsHide: true,
      env: resolveDefaultLocalProxyEnv(),
      detached: false,
    });

    child.once('error', (error) => {
      this.lastError = error instanceof Error ? error.message : String(error);
      if (this.child === child) {
        this.child = null;
      }
    });

    child.once('exit', () => {
      if (this.child === child) {
        this.child = null;
      }
    });

    this.child = child;
    this.command = command;
    this.args = args;
    this.lastError = undefined;

    return {
      pid: child.pid,
      command,
      args,
      note: 'Managed Google Drive sidecar started with a Go-based runtime contract.',
    };
  }

  async stop(): Promise<void> {
    this.normalizeDeadChild();
    if (!this.child) {
      return;
    }

    const child = this.child;
    this.child = null;
    await killChild(child, false);
  }

  getRuntimeDetails(): GoogleDriveRuntimeDetails {
    this.normalizeDeadChild();
    const pid = this.child?.pid;

    return {
      running: Boolean(pid && isProcessAlive(pid)),
      pid,
      command: this.command,
      args: this.args,
      lastError: this.lastError,
    };
  }
}
