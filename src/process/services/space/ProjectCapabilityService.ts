/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { normalizeManagedSlashCommandLibrary, resolveManagedSlashCommands } from '@/common/chat/slash/library';
import type {
  HookCategory,
  HookEventType,
  HookExecutionType,
  HookManifest,
  HookOutputBaseDir,
  HookOutputTarget,
} from '@/common/types/hookTypes';
import { getHookOutputTargets, getRunnableHookEvents } from '@/common/types/hookTypes';
import {
  getWorkspaceCommandsFile,
  getWorkspaceHooksDir,
  getWorkspaceHooksFile,
  getWorkspaceSchedulesFile,
  resolveWorkspacePath,
  WORKSPACE_AUTOMATION_DIR,
} from '@process/bridge/services/workspaceAutomation';
import {
  JsonWorkspaceScheduleConfigStore,
  type WorkspaceConversationScheduleRecord,
} from '@process/services/context/events/schedule/WorkspaceScheduleConfigStore';
import {
  buildSkillDependencyHints,
  discoverSkillDirectories,
  readSkillOpenAIConfig,
  type SkillDependencyHint,
  type SkillDirectoryInfo,
} from '@process/utils/skillDiscovery';
import type { Dirent } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

export type ProjectCapabilityKind = 'skill' | 'hook' | 'command' | 'schedule';

export type ProjectSkillCapability = {
  kind: 'skill';
  id: string;
  name: string;
  description: string;
  docKey: string;
  workspaceRelativePath: string;
  skillDocumentRelativePath?: string;
  skillDocumentBody?: string;
  compatibility: readonly string[];
  dependencyHints: readonly SkillDependencyHint[];
  implicitInvocation: boolean;
  openAIDisplayName?: string;
  openAIShortDescription?: string;
};

export type ProjectHookCapability = {
  kind: 'hook';
  id: string;
  name: string;
  description: string;
  docKey: string;
  workspaceRelativePath: string;
  manifestRelativePath: string;
  category?: HookCategory;
  executionType?: HookExecutionType;
  events: readonly HookEventType[];
  runnableEvents: readonly HookEventType[];
  outputTargets: readonly HookOutputTarget[];
  selected: boolean;
};

export type ProjectCommandCapability = {
  kind: 'command';
  id: string;
  name: string;
  description: string;
  docKey: string;
  commandType: 'project';
  enabled: boolean;
  template: string;
};

export type ProjectScheduleCapability = {
  kind: 'schedule';
  id: string;
  name: string;
  description: string;
  docKey: string;
  enabled: boolean;
  scheduleKind: WorkspaceConversationScheduleRecord['schedule']['kind'];
  scheduleLabel: string;
  message: string;
  conversationId: string;
  conversationTitle?: string;
  agentType: WorkspaceConversationScheduleRecord['agentType'];
  createdBy: WorkspaceConversationScheduleRecord['createdBy'];
  spaceId?: string;
};

export type ProjectCapabilityRecord =
  | ProjectSkillCapability
  | ProjectHookCapability
  | ProjectCommandCapability
  | ProjectScheduleCapability;

export type ProjectCapabilitySnapshot = {
  workspacePath: string;
  automationRootRelativePath: string;
  counts: Readonly<Record<ProjectCapabilityKind, number>>;
  skills: readonly ProjectSkillCapability[];
  hooks: readonly ProjectHookCapability[];
  commands: readonly ProjectCommandCapability[];
  schedules: readonly ProjectScheduleCapability[];
};

type HookSelectionFile = {
  hooks?: unknown;
  enabledHooks?: unknown;
};

const EMPTY_COUNTS: Readonly<Record<ProjectCapabilityKind, number>> = {
  skill: 0,
  hook: 0,
  command: 0,
  schedule: 0,
};

const HOOK_MANIFEST_FILE_NAME = 'manifest.json';
const SKILLS_DIR_NAME = 'skills';
const SKILL_DOCUMENT_FILE_NAME = 'SKILL.md';
const FRONTMATTER_BLOCK_PATTERN = /^---\s*\n[\s\S]*?\n---(?:\n|$)/;

const safeRelativePath = (workspacePath: string, targetPath: string): string => {
  return path.relative(workspacePath, targetPath).split(path.sep).join(path.posix.sep);
};

const createDocKey = (parts: readonly string[]): string => parts.join(':').trim().toLowerCase();

const stripSkillFrontmatter = (content: string): string => {
  return content.replace(/\r\n/g, '\n').replace(FRONTMATTER_BLOCK_PATTERN, '').replace(/^\n+/, '');
};

const stripMatchingLeadingHeading = (content: string, title: string): string => {
  const normalized = content.replace(/\r\n/g, '\n');
  const match = normalized.match(/^#\s+(.+)\n+/);
  if (!match) {
    return normalized.trim();
  }

  const heading = match[1]?.trim().replace(/\s+/g, ' ');
  const normalizedTitle = title.trim().replace(/\s+/g, ' ');
  if (!heading || heading !== normalizedTitle) {
    return normalized.trim();
  }

  return normalized.slice(match[0].length).replace(/^\n+/, '').trim();
};

const extractSkillDocumentBody = (content: string, title: string): string => {
  return stripMatchingLeadingHeading(stripSkillFrontmatter(content), title);
};

const trimOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized || undefined;
};

const normalizeUnknownStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const deduped = new Set<string>();
  for (const item of value) {
    const normalized = trimOptionalString(item);
    if (normalized) {
      deduped.add(normalized);
    }
  }

  return Array.from(deduped).toSorted((left, right) => left.localeCompare(right));
};

const normalizeHookNameList = (value: unknown): string[] => {
  const rawValues: unknown[] = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? Array.isArray((value as HookSelectionFile).hooks)
        ? ((value as HookSelectionFile).hooks as unknown[])
        : Array.isArray((value as HookSelectionFile).enabledHooks)
          ? ((value as HookSelectionFile).enabledHooks as unknown[])
          : []
      : [];

  return normalizeUnknownStringList(rawValues);
};

const parseHookManifest = (value: unknown): HookManifest | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<HookManifest>;
  const name = trimOptionalString(candidate.name);
  if (!name) {
    return null;
  }

  const outputFile =
    candidate.outputFile && typeof candidate.outputFile === 'object'
      ? {
          baseDir: trimOptionalString(candidate.outputFile.baseDir) as HookOutputBaseDir | undefined,
          relativeDir: trimOptionalString(candidate.outputFile.relativeDir),
          fileBaseName: trimOptionalString(candidate.outputFile.fileBaseName),
        }
      : undefined;

  return {
    name,
    description: trimOptionalString(candidate.description),
    version: trimOptionalString(candidate.version),
    executionType: trimOptionalString(candidate.executionType) as HookExecutionType | undefined,
    events: Array.isArray(candidate.events)
      ? candidate.events.filter((eventName): eventName is HookEventType => typeof eventName === 'string')
      : undefined,
    category: trimOptionalString(candidate.category) as HookCategory | undefined,
    tags: normalizeUnknownStringList(candidate.tags),
    supportedBackends: normalizeUnknownStringList(candidate.supportedBackends),
    outputTargets: Array.isArray(candidate.outputTargets)
      ? candidate.outputTargets.filter((target): target is HookOutputTarget => typeof target === 'string')
      : undefined,
    notification:
      candidate.notification && typeof candidate.notification === 'object'
        ? {
            title: trimOptionalString(candidate.notification.title),
            body: trimOptionalString(candidate.notification.body),
          }
        : undefined,
    outputFile,
  };
};

const buildSkillCapability = async (
  workspacePath: string,
  skill: SkillDirectoryInfo
): Promise<ProjectSkillCapability> => {
  const skillDocumentPath = path.join(skill.dirPath, SKILL_DOCUMENT_FILE_NAME);
  const skillDocumentContent = await fs.readFile(skillDocumentPath, 'utf8').catch((): string => '');
  const openAIConfig = await readSkillOpenAIConfig(skill.dirPath);
  const dependencyHints = await buildSkillDependencyHints({
    compatibility: skill.compatibility,
    openAIConfig,
  });
  return {
    kind: 'skill',
    id: skill.dirName,
    name: skill.name,
    description: skill.description,
    docKey: createDocKey(['skill', safeRelativePath(workspacePath, skill.dirPath)]),
    workspaceRelativePath: safeRelativePath(workspacePath, skill.dirPath),
    skillDocumentRelativePath: safeRelativePath(workspacePath, skillDocumentPath),
    skillDocumentBody: extractSkillDocumentBody(skillDocumentContent, skill.name),
    compatibility: skill.compatibility,
    dependencyHints,
    implicitInvocation: openAIConfig?.policy?.allowImplicitInvocation === true,
    openAIDisplayName: trimOptionalString(openAIConfig?.interface?.displayName),
    openAIShortDescription: trimOptionalString(openAIConfig?.interface?.shortDescription),
  };
};

export class ProjectCapabilityService {
  constructor(
    private readonly scheduleStore: JsonWorkspaceScheduleConfigStore = new JsonWorkspaceScheduleConfigStore()
  ) {}

  async readSnapshot(workspace: string): Promise<ProjectCapabilitySnapshot | undefined> {
    const workspacePath = resolveWorkspacePath(workspace);
    if (!workspacePath) {
      return undefined;
    }

    try {
      const stat = await fs.stat(workspacePath);
      if (!stat.isDirectory()) {
        return undefined;
      }
    } catch {
      return undefined;
    }

    const [skills, hooks, commands, schedules] = await Promise.all([
      this.readSkillCapabilities(workspacePath),
      this.readHookCapabilities(workspacePath),
      this.readCommandCapabilities(workspacePath),
      this.readScheduleCapabilities(workspacePath),
    ]);

    return {
      workspacePath,
      automationRootRelativePath: WORKSPACE_AUTOMATION_DIR,
      counts: {
        skill: skills.length,
        hook: hooks.length,
        command: commands.length,
        schedule: schedules.length,
      },
      skills,
      hooks,
      commands,
      schedules,
    };
  }

  private async readSkillCapabilities(workspacePath: string): Promise<ProjectSkillCapability[]> {
    const skillsRoot = path.join(workspacePath, WORKSPACE_AUTOMATION_DIR, SKILLS_DIR_NAME);
    const skills = await discoverSkillDirectories(skillsRoot);
    const records = await Promise.all(skills.map((skill) => buildSkillCapability(workspacePath, skill)));
    return records.toSorted((left, right) => left.name.localeCompare(right.name));
  }

  private async readHookCapabilities(workspacePath: string): Promise<ProjectHookCapability[]> {
    const hooksDir = getWorkspaceHooksDir(workspacePath);
    if (!hooksDir) {
      return [];
    }

    const selectedHookNames = new Set(await this.readSelectedHookNames(workspacePath));
    let entries: Dirent[] = [];
    try {
      entries = await fs.readdir(hooksDir, { withFileTypes: true });
    } catch {
      return [];
    }

    const hooks = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
        .map(async (entry): Promise<ProjectHookCapability | undefined> => {
          const hookDir = path.join(hooksDir, entry.name);
          const manifestPath = path.join(hookDir, HOOK_MANIFEST_FILE_NAME);
          const raw = await fs.readFile(manifestPath, 'utf8').catch((): undefined => undefined);
          if (!raw) {
            return undefined;
          }

          let parsed: unknown;
          try {
            parsed = JSON.parse(raw);
          } catch {
            return undefined;
          }

          const manifest = parseHookManifest(parsed);
          if (!manifest) {
            return undefined;
          }

          return {
            kind: 'hook',
            id: manifest.name,
            name: manifest.name,
            description: manifest.description || '',
            docKey: createDocKey(['hook', manifest.name]),
            workspaceRelativePath: safeRelativePath(workspacePath, hookDir),
            manifestRelativePath: safeRelativePath(workspacePath, manifestPath),
            category: manifest.category,
            executionType: manifest.executionType,
            events: manifest.events || [],
            runnableEvents: getRunnableHookEvents(manifest),
            outputTargets: getHookOutputTargets(manifest),
            selected: selectedHookNames.has(manifest.name),
          };
        })
    );

    return hooks
      .filter((hook): hook is ProjectHookCapability => hook !== undefined)
      .toSorted((left, right) => left.name.localeCompare(right.name));
  }

  private async readSelectedHookNames(workspacePath: string): Promise<string[]> {
    const hooksFile = getWorkspaceHooksFile(workspacePath);
    if (!hooksFile) {
      return [];
    }

    const raw = await fs.readFile(hooksFile, 'utf8').catch((): undefined => undefined);
    if (!raw) {
      return [];
    }

    try {
      return normalizeHookNameList(JSON.parse(raw) as unknown);
    } catch {
      return [];
    }
  }

  private async readCommandCapabilities(workspacePath: string): Promise<ProjectCommandCapability[]> {
    const commandsFile = getWorkspaceCommandsFile(workspacePath);
    if (!commandsFile) {
      return [];
    }

    const raw = await fs.readFile(commandsFile, 'utf8').catch((): undefined => undefined);
    if (!raw) {
      return [];
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }

    return resolveManagedSlashCommands(normalizeManagedSlashCommandLibrary(parsed))
      .map(
        (command): ProjectCommandCapability => ({
          kind: 'command',
          id: command.id,
          name: command.name,
          description: command.description,
          docKey: createDocKey(['command', command.id]),
          commandType: 'project',
          enabled: command.enabled !== false,
          template: command.template,
        })
      )
      .toSorted((left, right) => left.name.localeCompare(right.name));
  }

  private async readScheduleCapabilities(workspacePath: string): Promise<ProjectScheduleCapability[]> {
    const schedulesFile = getWorkspaceSchedulesFile(workspacePath);
    if (!schedulesFile) {
      return [];
    }

    const records = await this.scheduleStore.readConversationSchedules(workspacePath);
    if (!records) {
      return [];
    }

    return records
      .map(
        (record): ProjectScheduleCapability => ({
          kind: 'schedule',
          id: record.id,
          name: record.name,
          description: record.schedule.description,
          docKey: createDocKey(['schedule', record.id]),
          enabled: record.enabled,
          scheduleKind: record.schedule.kind,
          scheduleLabel:
            record.schedule.kind === 'cron'
              ? record.schedule.expr
              : record.schedule.kind === 'every'
                ? String(record.schedule.everyMs)
                : String(record.schedule.atMs),
          message: record.message,
          conversationId: record.conversationId,
          conversationTitle: record.conversationTitle,
          agentType: record.agentType,
          createdBy: record.createdBy,
          spaceId: record.spaceId,
        })
      )
      .toSorted((left, right) => left.name.localeCompare(right.name));
  }
}

export const EMPTY_PROJECT_CAPABILITY_SNAPSHOT: ProjectCapabilitySnapshot = {
  workspacePath: '',
  automationRootRelativePath: WORKSPACE_AUTOMATION_DIR,
  counts: EMPTY_COUNTS,
  skills: [],
  hooks: [],
  commands: [],
  schedules: [],
};
