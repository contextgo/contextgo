/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ChildProcess } from 'node:child_process';
import { execFile as execFileCallback, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import type { FeishuConnectorConfig } from '@/common/types/connectors/feishu';
import { isProcessAlive, killChild } from '@process/agent/acp/utils';

const execFile = promisify(execFileCallback);
const FEISHU_PACKAGE_NAME = '@larksuiteoapi/lark-mcp';

export type FeishuOpenapiRuntimeDetails = {
  running: boolean;
  pid?: number;
  command?: string;
  args?: string[];
  lastError?: string;
};

export type FeishuOpenapiStartResult = {
  pid?: number;
  command: string;
  args: string[];
  note: string;
};

export interface FeishuOpenapiController {
  start(config: FeishuConnectorConfig): Promise<FeishuOpenapiStartResult>;
  stop(): Promise<void>;
  getRuntimeDetails(): FeishuOpenapiRuntimeDetails;
}

const resolveNpxCommand = async (): Promise<string | null> => {
  for (const candidate of ['npx', 'npm']) {
    try {
      const args = candidate === 'npx' ? ['--version'] : ['exec', '--yes', 'tsx', '--version'];
      await execFile(candidate, args, { windowsHide: true, timeout: 5_000 });
      return candidate;
    } catch {
      continue;
    }
  }

  return null;
};

const buildRuntimeCommand = (
  config: FeishuConnectorConfig,
  npxCommand: string
): { command: string; args: string[] } => {
  const packageArgs = config.command.trim() ? config.command.trim().split(/\s+/) : [FEISHU_PACKAGE_NAME];
  const extraArgs = config.args.filter((value) => value.trim());
  const runtimeArgs = [
    ...(npxCommand === 'npx' ? ['-y'] : ['exec', '--yes']),
    ...packageArgs,
    'mcp',
    '-a',
    config.appId,
    '-s',
    config.appSecret,
    '--domain',
    config.apiDomain,
    ...extraArgs,
  ];

  if (config.useOAuth) {
    runtimeArgs.push('--oauth');
  }

  return {
    command: npxCommand,
    args: runtimeArgs,
  };
};

export class NodeFeishuOpenapiController implements FeishuOpenapiController {
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

  async start(config: FeishuConnectorConfig): Promise<FeishuOpenapiStartResult> {
    this.normalizeDeadChild();

    if (this.child?.pid && isProcessAlive(this.child.pid)) {
      return {
        pid: this.child.pid,
        command: this.command || 'npx',
        args: this.args || [],
        note: 'Managed Feishu OpenAPI sidecar is already running.',
      };
    }

    const npxCommand = await resolveNpxCommand();
    if (!npxCommand) {
      this.lastError = 'Feishu connector requires `npx` (or npm exec) to launch the official runtime.';
      throw new Error(this.lastError);
    }

    const { command, args } = buildRuntimeCommand(config, npxCommand);
    const child = spawn(command, args, {
      stdio: ['ignore', 'ignore', 'ignore'],
      windowsHide: true,
      env: {
        ...process.env,
      },
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
      note: 'Managed Feishu OpenAPI sidecar started through the official lark-openapi-mcp package.',
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

  getRuntimeDetails(): FeishuOpenapiRuntimeDetails {
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
