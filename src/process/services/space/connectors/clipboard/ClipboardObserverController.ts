/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ChildProcess } from 'node:child_process';
import { execFile as execFileCallback, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import type { ClipboardConnectorConfig } from '@/common/types/connectors/clipboard';
import { isProcessAlive, killChild } from '@process/agent/acp/utils';

const execFile = promisify(execFileCallback);

export type ClipboardObserverRuntimeDetails = {
  running: boolean;
  pid?: number;
  repoDir?: string;
  command?: string;
  note?: string;
  lastError?: string;
};

export type ClipboardObserverStartResult = {
  pid?: number;
  note: string;
  repoDir?: string;
  command?: string;
};

export interface ClipboardObserverController {
  start(config: ClipboardConnectorConfig): Promise<ClipboardObserverStartResult>;
  stop(): Promise<void>;
  getRuntimeDetails(): ClipboardObserverRuntimeDetails;
}

const CONNECTOR_REPO_ENV_KEY = 'CONTEXTGO_CONNECTOR_REPO_DIR';
const PYTHON_COMMAND_ENV_KEY = 'CONTEXTGO_CONNECTOR_PYTHON';
const OBSERVER_MODULE = 'infohub.activity_clipboard_observer';

const resolveConnectorRepoCandidates = (): string[] => {
  const cwd = process.cwd();
  const envPath = process.env[CONNECTOR_REPO_ENV_KEY]?.trim();

  return [
    envPath,
    path.resolve(cwd, '../connector'),
    path.resolve(cwd, 'connector'),
    path.resolve(cwd, '../../connector'),
  ].filter((value): value is string => Boolean(value));
};

export const resolveConnectorRepoDir = (): string | null => {
  for (const candidate of resolveConnectorRepoCandidates()) {
    if (existsSync(path.join(candidate, 'infohub', 'activity_clipboard_observer.py'))) {
      return candidate;
    }
  }

  return null;
};

const resolvePythonCandidates = (): string[] => {
  const envCommand = process.env[PYTHON_COMMAND_ENV_KEY]?.trim();
  return [envCommand, 'python3', 'python'].filter((value): value is string => Boolean(value));
};

export const resolvePythonCommand = async (): Promise<string | null> => {
  for (const candidate of resolvePythonCandidates()) {
    try {
      await execFile(candidate, ['--version'], { windowsHide: true, timeout: 5_000 });
      return candidate;
    } catch {
      continue;
    }
  }

  return null;
};

export class NodeClipboardObserverController implements ClipboardObserverController {
  private child: ChildProcess | null = null;
  private repoDir?: string;
  private command?: string;
  private lastError?: string;

  private normalizeDeadChild(): void {
    const pid = this.child?.pid;
    if (pid && !isProcessAlive(pid)) {
      this.child = null;
    }
  }

  async start(config: ClipboardConnectorConfig): Promise<ClipboardObserverStartResult> {
    this.normalizeDeadChild();

    if (this.child?.pid && isProcessAlive(this.child.pid)) {
      return {
        pid: this.child.pid,
        repoDir: this.repoDir,
        command: this.command,
        note: 'Managed clipboard observer is already running.',
      };
    }

    const repoDir = resolveConnectorRepoDir();
    if (!repoDir) {
      const message =
        'Clipboard observer could not find the sibling connector repository. Set CONTEXTGO_CONNECTOR_REPO_DIR to continue.';
      this.lastError = message;
      throw new Error(message);
    }

    const command = await resolvePythonCommand();
    if (!command) {
      const message = 'Clipboard observer requires `python3` or `python` to be available.';
      this.lastError = message;
      throw new Error(message);
    }

    const args = ['-m', OBSERVER_MODULE, '--interval-ms', String(config.pollIntervalMs)];
    if (config.retainFullText) {
      args.push('--retain-full-text');
    }

    const child = spawn(command, args, {
      cwd: repoDir,
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
    this.repoDir = repoDir;
    this.command = command;
    this.lastError = undefined;

    return {
      pid: child.pid,
      repoDir,
      command,
      note: 'Managed clipboard observer process started from the sibling connector repository.',
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

  getRuntimeDetails(): ClipboardObserverRuntimeDetails {
    this.normalizeDeadChild();
    const pid = this.child?.pid;

    return {
      running: Boolean(pid && isProcessAlive(pid)),
      pid,
      repoDir: this.repoDir,
      command: this.command,
      note: pid ? 'Managed clipboard observer process is attached to ContextGo.' : undefined,
      lastError: this.lastError,
    };
  }
}
