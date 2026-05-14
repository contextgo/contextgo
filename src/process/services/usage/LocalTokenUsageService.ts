/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  LocalTokenUsageDailyReport,
  LocalTokenUsageReport,
  LocalTokenUsageRuntime,
  LocalTokenUsageRuntimeReport,
  LocalTokenUsageTotals,
} from '@/common/types/acpTypes';
import { safeExecFile } from '@process/utils/safeExec';
import { getEnhancedEnv } from '@process/utils/shellEnv';
import { getDataPath } from '@process/utils/utils';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

type CommandResult = {
  stdout: string;
  stderr: string;
};

type CommandRunner = (command: string, args: string[], timeoutMs: number) => Promise<CommandResult>;

type LocalTokenUsageServiceOptions = {
  refreshIntervalMs?: number;
  initialRefreshDelayMs?: number;
  cacheRoot?: string;
};

type RuntimeUsageConfig = {
  backend: LocalTokenUsageRuntime;
  label: string;
  source: LocalTokenUsageRuntimeReport['source'];
  packageSpec?: string;
  commandName?: string;
  args: string[];
  sourcePath?: string;
  unsupportedReason?: string;
};

const CCUSAGE_VERSION = '18.0.11';
const COMMAND_TIMEOUT_MS = 45_000;
const RECENT_DAY_LIMIT = 14;
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;
const INITIAL_REFRESH_DELAY_MS = 30_000;
const CACHE_FILE_NAME = 'local-token-usage-latest.json';

const EMPTY_TOTALS: LocalTokenUsageTotals = {
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationTokens: 0,
  cacheReadTokens: 0,
  cachedInputTokens: 0,
  reasoningOutputTokens: 0,
  totalTokens: 0,
  totalCostUsd: 0,
};

const cloneTotals = (totals: LocalTokenUsageTotals = EMPTY_TOTALS): LocalTokenUsageTotals => ({ ...totals });

const addTotals = (left: LocalTokenUsageTotals, right: LocalTokenUsageTotals): LocalTokenUsageTotals => ({
  inputTokens: left.inputTokens + right.inputTokens,
  outputTokens: left.outputTokens + right.outputTokens,
  cacheCreationTokens: left.cacheCreationTokens + right.cacheCreationTokens,
  cacheReadTokens: left.cacheReadTokens + right.cacheReadTokens,
  cachedInputTokens: left.cachedInputTokens + right.cachedInputTokens,
  reasoningOutputTokens: left.reasoningOutputTokens + right.reasoningOutputTokens,
  totalTokens: left.totalTokens + right.totalTokens,
  totalCostUsd: left.totalCostUsd + right.totalCostUsd,
});

const defaultCommandRunner: CommandRunner = async (command, args, timeoutMs) =>
  safeExecFile(command, args, {
    timeout: timeoutMs,
    env: {
      ...getEnhancedEnv(),
      NO_COLOR: '1',
      CI: '1',
    },
  });

const getNpxCommand = (): string => (process.platform === 'win32' ? 'npx.cmd' : 'npx');

const getRuntimeUsageConfigs = (): RuntimeUsageConfig[] => {
  const homeDir = os.homedir();
  return [
    {
      backend: 'claude',
      label: 'Claude Code',
      source: 'ccusage',
      packageSpec: `ccusage@${CCUSAGE_VERSION}`,
      commandName: 'ccusage',
      args: ['daily', '--json', '--offline'],
      sourcePath: path.join(homeDir, '.claude', 'projects'),
    },
    {
      backend: 'codex',
      label: 'Codex',
      source: 'ccusage-codex',
      packageSpec: `@ccusage/codex@${CCUSAGE_VERSION}`,
      commandName: 'ccusage-codex',
      args: ['daily', '--json', '--offline'],
      sourcePath: path.join(homeDir, '.codex'),
    },
    {
      backend: 'opencode',
      label: 'OpenCode',
      source: 'ccusage-opencode',
      packageSpec: `@ccusage/opencode@${CCUSAGE_VERSION}`,
      commandName: 'ccusage-opencode',
      args: ['daily', '--json'],
      sourcePath: path.join(homeDir, '.local', 'share', 'opencode'),
    },
    {
      backend: 'gemini',
      label: 'Gemini',
      source: 'unsupported',
      args: [],
      sourcePath: path.join(homeDir, '.gemini'),
      unsupportedReason: 'ccusage does not currently provide an official Gemini CLI local usage adapter.',
    },
  ];
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const numberValue = (record: Record<string, unknown>, key: string): number => {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
};

const stringValue = (record: Record<string, unknown>, key: string): string | undefined => {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
};

const normalizeDate = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return trimmed;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getLocalDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isReport = (value: unknown): value is LocalTokenUsageReport => {
  const record = asRecord(value);
  return Boolean(record?.generatedAt && asRecord(record.totals) && Array.isArray(record.runtimes));
};

const parseTotals = (value: unknown): LocalTokenUsageTotals => {
  const record = asRecord(value);
  if (!record) {
    return cloneTotals();
  }

  return {
    inputTokens: numberValue(record, 'inputTokens'),
    outputTokens: numberValue(record, 'outputTokens'),
    cacheCreationTokens: numberValue(record, 'cacheCreationTokens'),
    cacheReadTokens: numberValue(record, 'cacheReadTokens'),
    cachedInputTokens: numberValue(record, 'cachedInputTokens'),
    reasoningOutputTokens: numberValue(record, 'reasoningOutputTokens'),
    totalTokens: numberValue(record, 'totalTokens'),
    totalCostUsd: numberValue(record, 'totalCost') || numberValue(record, 'costUSD'),
  };
};

const extractJsonPayload = (stdout: string): unknown => {
  const firstBrace = stdout.indexOf('{');
  const lastBrace = stdout.lastIndexOf('}');
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    throw new Error('Usage command did not return a JSON object.');
  }

  return JSON.parse(stdout.slice(firstBrace, lastBrace + 1));
};

const extractModelsUsed = (record: Record<string, unknown>): string[] => {
  const modelsUsed = record.modelsUsed;
  if (Array.isArray(modelsUsed)) {
    return modelsUsed.filter((model): model is string => typeof model === 'string' && model.trim().length > 0);
  }

  const modelMap = asRecord(record.models);
  if (modelMap) {
    return Object.keys(modelMap).filter(Boolean);
  }

  const modelBreakdowns = record.modelBreakdowns;
  if (Array.isArray(modelBreakdowns)) {
    return modelBreakdowns
      .map((entry) => {
        const modelRecord = asRecord(entry);
        return modelRecord ? stringValue(modelRecord, 'modelName') : undefined;
      })
      .filter((model): model is string => Boolean(model));
  }

  return [];
};

const parseDailyReports = (payload: unknown): LocalTokenUsageDailyReport[] => {
  const root = asRecord(payload);
  const daily = root?.daily;
  if (!Array.isArray(daily)) {
    return [];
  }

  return daily
    .map((entry): LocalTokenUsageDailyReport | null => {
      const record = asRecord(entry);
      if (!record) {
        return null;
      }

      const date = normalizeDate(record.date);
      if (!date) {
        return null;
      }

      return {
        date,
        totals: parseTotals(record),
        modelsUsed: extractModelsUsed(record),
      };
    })
    .filter((entry): entry is LocalTokenUsageDailyReport => Boolean(entry))
    .toSorted((left, right) => left.date.localeCompare(right.date));
};

const parseUsageCommandPayload = (
  payload: unknown
): { totals: LocalTokenUsageTotals; days: LocalTokenUsageDailyReport[] } => {
  const root = asRecord(payload);
  const days = parseDailyReports(payload);
  const rootTotals = parseTotals(root?.totals);
  const totals =
    rootTotals.totalTokens > 0 || rootTotals.inputTokens > 0 || rootTotals.outputTokens > 0
      ? rootTotals
      : days.reduce((current, day) => addTotals(current, day.totals), cloneTotals());

  return {
    totals,
    days,
  };
};

const buildCommand = (config: RuntimeUsageConfig): { command: string; args: string[]; display: string } => {
  if (!config.packageSpec) {
    return { command: '', args: [], display: '' };
  }

  const args = ['--yes', config.packageSpec, ...config.args];
  const command = getNpxCommand();
  return {
    command,
    args,
    display: `${config.commandName ?? config.packageSpec} ${config.args.join(' ')}`.trim(),
  };
};

const buildUnavailableReport = (
  config: RuntimeUsageConfig,
  status: LocalTokenUsageRuntimeReport['status'],
  now: Date,
  error?: string
): LocalTokenUsageRuntimeReport => ({
  backend: config.backend,
  label: config.label,
  status,
  source: config.source,
  sourcePath: config.sourcePath,
  command: config.commandName,
  error,
  updatedAt: now.toISOString(),
  totals: cloneTotals(),
  today: cloneTotals(),
  days: [],
});

export class LocalTokenUsageService {
  private readonly refreshIntervalMs: number;
  private readonly initialRefreshDelayMs: number;
  private readonly cacheRoot: string;
  private refreshTimer: NodeJS.Timeout | null = null;
  private initialRefreshTimer: NodeJS.Timeout | null = null;
  private refreshPromise: Promise<LocalTokenUsageReport> | null = null;

  constructor(
    private readonly runCommand: CommandRunner = defaultCommandRunner,
    private readonly now: () => Date = () => new Date(),
    options: LocalTokenUsageServiceOptions = {}
  ) {
    this.refreshIntervalMs = options.refreshIntervalMs ?? REFRESH_INTERVAL_MS;
    this.initialRefreshDelayMs = options.initialRefreshDelayMs ?? INITIAL_REFRESH_DELAY_MS;
    this.cacheRoot = options.cacheRoot ?? path.join(getDataPath(), 'usage');
  }

  startBackgroundRefresh(): void {
    if (this.refreshTimer) {
      return;
    }

    this.initialRefreshTimer = setTimeout(() => {
      void this.refreshIfStale().catch((error) => {
        console.warn('[LocalTokenUsageService] Initial background refresh failed:', error);
      });
    }, this.initialRefreshDelayMs);
    this.initialRefreshTimer.unref?.();

    this.refreshTimer = setInterval(() => {
      void this.refreshAndStore().catch((error) => {
        console.warn('[LocalTokenUsageService] Scheduled background refresh failed:', error);
      });
    }, this.refreshIntervalMs);
    this.refreshTimer.unref?.();
  }

  stopBackgroundRefresh(): void {
    if (this.initialRefreshTimer) {
      clearTimeout(this.initialRefreshTimer);
      this.initialRefreshTimer = null;
    }
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  async getReport(options: { forceRefresh?: boolean } = {}): Promise<LocalTokenUsageReport> {
    if (options.forceRefresh) {
      return this.refreshAndStore();
    }

    const cached = await this.readCachedReport();
    if (cached) {
      return cached;
    }

    return this.refreshAndStore();
  }

  private async refreshIfStale(): Promise<LocalTokenUsageReport | null> {
    const cached = await this.readCachedReport();
    if (cached && this.now().getTime() - new Date(cached.generatedAt).getTime() < this.refreshIntervalMs) {
      return cached;
    }

    return this.refreshAndStore();
  }

  private async refreshAndStore(): Promise<LocalTokenUsageReport> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.buildReport()
      .then(async (report) => {
        await this.writeCachedReport(report);
        return report;
      })
      .finally(() => {
        this.refreshPromise = null;
      });

    return this.refreshPromise;
  }

  private async buildReport(): Promise<LocalTokenUsageReport> {
    const generatedAt = this.now();
    const reports = await Promise.all(getRuntimeUsageConfigs().map((config) => this.getRuntimeReport(config)));

    return {
      generatedAt: generatedAt.toISOString(),
      totals: reports.reduce((current, report) => addTotals(current, report.totals), cloneTotals()),
      today: reports.reduce((current, report) => addTotals(current, report.today), cloneTotals()),
      runtimes: reports,
    };
  }

  private getLatestCachePath(): string {
    return path.join(this.cacheRoot, CACHE_FILE_NAME);
  }

  private getArchiveCachePath(report: LocalTokenUsageReport): string {
    return path.join(this.cacheRoot, 'archive', `${normalizeDate(report.generatedAt)}.json`);
  }

  private async readCachedReport(): Promise<LocalTokenUsageReport | null> {
    try {
      const content = await fsp.readFile(this.getLatestCachePath(), 'utf8');
      const parsed: unknown = JSON.parse(content);
      return isReport(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  private async writeCachedReport(report: LocalTokenUsageReport): Promise<void> {
    await fsp.mkdir(path.join(this.cacheRoot, 'archive'), { recursive: true });
    const content = `${JSON.stringify(report, null, 2)}\n`;
    await Promise.all([
      fsp.writeFile(this.getLatestCachePath(), content),
      fsp.writeFile(this.getArchiveCachePath(report), content),
    ]);
  }

  private async getRuntimeReport(config: RuntimeUsageConfig): Promise<LocalTokenUsageRuntimeReport> {
    const now = this.now();
    if (config.source === 'unsupported') {
      return buildUnavailableReport(config, 'unsupported', now, config.unsupportedReason);
    }

    if (config.sourcePath && !fs.existsSync(config.sourcePath)) {
      return buildUnavailableReport(config, 'empty', now);
    }

    const command = buildCommand(config);

    try {
      const result = await this.runCommand(command.command, command.args, COMMAND_TIMEOUT_MS);
      const payload = extractJsonPayload(result.stdout);
      const parsed = parseUsageCommandPayload(payload);
      const todayKey = getLocalDateKey(now);
      const today = parsed.days.find((day) => day.date === todayKey)?.totals ?? cloneTotals();

      return {
        backend: config.backend,
        label: config.label,
        status: parsed.totals.totalTokens > 0 ? 'ok' : 'empty',
        source: config.source,
        sourcePath: config.sourcePath,
        command: command.display,
        updatedAt: now.toISOString(),
        totals: parsed.totals,
        today,
        days: parsed.days.slice(-RECENT_DAY_LIMIT),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return buildUnavailableReport(config, 'error', now, message);
    }
  }
}

let localTokenUsageService: LocalTokenUsageService | null = null;

export const getLocalTokenUsageService = (): LocalTokenUsageService => {
  localTokenUsageService ??= new LocalTokenUsageService();
  return localTokenUsageService;
};

export const parseLocalTokenUsagePayloadForTest = parseUsageCommandPayload;
