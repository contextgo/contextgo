/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SlashCommandItem } from './types';

export const SLASH_COMMAND_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

export type BuiltinManagedSlashCommandId = 'plan' | 'tdd' | 'code-review' | 'security' | 'verify' | 'orchestrate';

export interface BuiltinManagedSlashCommandRecord {
  type: 'builtin';
  id: BuiltinManagedSlashCommandId;
  enabled: boolean;
  nameOverride?: string;
  descriptionOverride?: string;
  templateOverride?: string;
}

export interface CustomManagedSlashCommandRecord {
  type: 'custom';
  id: string;
  enabled: boolean;
  name: string;
  description: string;
  template: string;
}

export type ManagedSlashCommandRecord = BuiltinManagedSlashCommandRecord | CustomManagedSlashCommandRecord;

export interface ResolvedManagedSlashCommand {
  id: string;
  type: 'builtin' | 'custom';
  builtinId?: BuiltinManagedSlashCommandId;
  enabled: boolean;
  name: string;
  description: string;
  template: string;
}

interface BuiltinManagedSlashCommandDefinition {
  id: BuiltinManagedSlashCommandId;
  name: string;
  descriptionKey: string;
  descriptionDefaultValue: string;
  templateKey: string;
  templateDefaultValue: string;
}

export interface SlashCommandTranslationResolver {
  (key: string, defaultValue: string): string;
}

export const BUILTIN_MANAGED_SLASH_COMMANDS: BuiltinManagedSlashCommandDefinition[] = [
  {
    id: 'plan',
    name: 'plan',
    descriptionKey: 'settings.commands.presets.plan.description',
    descriptionDefaultValue: 'Restate the task, identify risks, and produce a step-by-step plan before coding.',
    templateKey: 'settings.commands.presets.plan.template',
    templateDefaultValue:
      'Restate the task, identify the main constraints and risks, then propose a clear step-by-step implementation plan. Do not modify files yet. Wait for confirmation before executing.',
  },
  {
    id: 'tdd',
    name: 'tdd',
    descriptionKey: 'settings.commands.presets.tdd.description',
    descriptionDefaultValue: 'Drive the task with failing tests first, then make the minimum code changes to pass.',
    templateKey: 'settings.commands.presets.tdd.template',
    templateDefaultValue:
      'Implement this task with test-driven development. Start by listing the risky behaviors, write or update failing tests first, then make the minimum code changes to pass. Finish by summarizing coverage and remaining risks.',
  },
  {
    id: 'code-review',
    name: 'code-review',
    descriptionKey: 'settings.commands.presets.codeReview.description',
    descriptionDefaultValue: 'Review the current changes for bugs, regressions, risky assumptions, and missing tests.',
    templateKey: 'settings.commands.presets.codeReview.template',
    templateDefaultValue:
      'Review the current changes like a strict code reviewer. Prioritize bugs, regressions, missing tests, and risky assumptions. Cite concrete files and line-level evidence when possible.',
  },
  {
    id: 'security',
    name: 'security',
    descriptionKey: 'settings.commands.presets.security.description',
    descriptionDefaultValue: 'Audit auth, permissions, secrets, injection risks, and unsafe data or shell handling.',
    templateKey: 'settings.commands.presets.security.template',
    templateDefaultValue:
      'Perform a security review for this task or patch. Look for auth, permission, secret handling, injection, data exposure, and unsafe shell or file operations. Report concrete risks and mitigations first.',
  },
  {
    id: 'verify',
    name: 'verify',
    descriptionKey: 'settings.commands.presets.verify.description',
    descriptionDefaultValue: 'Verify behavior, edge cases, typing, linting, tests, and release readiness end to end.',
    templateKey: 'settings.commands.presets.verify.template',
    templateDefaultValue:
      'Verify the current implementation end to end. Check behavior, edge cases, typing, linting, tests, and release risks. Summarize what passed, what failed, and what remains unverified.',
  },
  {
    id: 'orchestrate',
    name: 'orchestrate',
    descriptionKey: 'settings.commands.presets.orchestrate.description',
    descriptionDefaultValue: 'Break the task into coordinated workstreams, roles, dependencies, and checkpoints.',
    templateKey: 'settings.commands.presets.orchestrate.template',
    templateDefaultValue:
      'Break this task into coordinated workstreams. Propose the best roles or agents for each stream, dependencies between them, and the integration order. Then execute in a controlled sequence with checkpoints.',
  },
];

const BUILTIN_MANAGED_SLASH_COMMAND_ID_SET = new Set<BuiltinManagedSlashCommandId>(
  BUILTIN_MANAGED_SLASH_COMMANDS.map((command) => command.id)
);

function sanitizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.replace(/\r\n/g, '\n').trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeSlashCommandName(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().replace(/^\/+/, '');
  if (!normalized || !SLASH_COMMAND_NAME_PATTERN.test(normalized)) {
    return null;
  }

  return normalized;
}

function normalizeBuiltinManagedSlashCommandRecord(value: unknown): BuiltinManagedSlashCommandRecord | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<BuiltinManagedSlashCommandRecord>;
  if (candidate.type !== 'builtin' || !candidate.id || !BUILTIN_MANAGED_SLASH_COMMAND_ID_SET.has(candidate.id)) {
    return null;
  }

  const nameOverride = normalizeSlashCommandName(candidate.nameOverride);

  return {
    type: 'builtin',
    id: candidate.id,
    enabled: candidate.enabled !== false,
    nameOverride: nameOverride ?? undefined,
    descriptionOverride: sanitizeOptionalText(candidate.descriptionOverride),
    templateOverride: sanitizeOptionalText(candidate.templateOverride),
  };
}

function normalizeCustomManagedSlashCommandRecord(value: unknown): CustomManagedSlashCommandRecord | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<CustomManagedSlashCommandRecord>;
  if (candidate.type !== 'custom') {
    return null;
  }

  const id = sanitizeOptionalText(candidate.id);
  const name = normalizeSlashCommandName(candidate.name);
  const description = sanitizeOptionalText(candidate.description);
  const template = sanitizeOptionalText(candidate.template);

  if (!id || !name || !description || !template) {
    return null;
  }

  return {
    type: 'custom',
    id,
    enabled: candidate.enabled !== false,
    name,
    description,
    template,
  };
}

export function createDefaultManagedSlashCommandLibrary(): ManagedSlashCommandRecord[] {
  return BUILTIN_MANAGED_SLASH_COMMANDS.map((command) => ({
    type: 'builtin',
    id: command.id,
    enabled: true,
  }));
}

export function normalizeManagedSlashCommandLibrary(value: unknown): ManagedSlashCommandRecord[] {
  const builtinRecords = new Map<BuiltinManagedSlashCommandId, BuiltinManagedSlashCommandRecord>(
    createDefaultManagedSlashCommandLibrary()
      .filter((record): record is BuiltinManagedSlashCommandRecord => record.type === 'builtin')
      .map((record) => [record.id, record])
  );
  const customRecords: CustomManagedSlashCommandRecord[] = [];

  if (!Array.isArray(value)) {
    return [...builtinRecords.values()];
  }

  const usedCustomIds = new Set<string>();
  const usedNames = new Set<string>();

  for (const item of value) {
    const builtinRecord = normalizeBuiltinManagedSlashCommandRecord(item);
    if (builtinRecord) {
      builtinRecords.set(builtinRecord.id, builtinRecord);
      const nameKey = (
        builtinRecord.nameOverride ?? getBuiltinManagedSlashCommandDefinition(builtinRecord.id).name
      ).toLowerCase();
      usedNames.add(nameKey);
      continue;
    }

    const customRecord = normalizeCustomManagedSlashCommandRecord(item);
    if (!customRecord) {
      continue;
    }

    const customNameKey = customRecord.name.toLowerCase();
    if (usedCustomIds.has(customRecord.id) || usedNames.has(customNameKey)) {
      continue;
    }

    usedCustomIds.add(customRecord.id);
    usedNames.add(customNameKey);
    customRecords.push(customRecord);
  }

  const builtinValues: BuiltinManagedSlashCommandRecord[] = BUILTIN_MANAGED_SLASH_COMMANDS.map(
    (command) =>
      builtinRecords.get(command.id) ?? {
        type: 'builtin',
        id: command.id,
        enabled: true,
      }
  );

  return [...builtinValues, ...customRecords];
}

export function getBuiltinManagedSlashCommandDefinition(
  id: BuiltinManagedSlashCommandId
): BuiltinManagedSlashCommandDefinition {
  const definition = BUILTIN_MANAGED_SLASH_COMMANDS.find((command) => command.id === id);
  if (!definition) {
    throw new Error(`Unknown builtin managed slash command: ${id}`);
  }

  return definition;
}

export function resolveManagedSlashCommands(
  library: ManagedSlashCommandRecord[],
  resolveText: SlashCommandTranslationResolver
): ResolvedManagedSlashCommand[] {
  return library.map((record) => {
    if (record.type === 'builtin') {
      const definition = getBuiltinManagedSlashCommandDefinition(record.id);
      return {
        id: record.id,
        type: 'builtin',
        builtinId: record.id,
        enabled: record.enabled,
        name: record.nameOverride ?? definition.name,
        description:
          record.descriptionOverride ?? resolveText(definition.descriptionKey, definition.descriptionDefaultValue),
        template: record.templateOverride ?? resolveText(definition.templateKey, definition.templateDefaultValue),
      };
    }

    return {
      id: record.id,
      type: 'custom',
      enabled: record.enabled,
      name: record.name,
      description: record.description,
      template: record.template,
    };
  });
}

export function toSlashCommandItems(commands: ResolvedManagedSlashCommand[]): SlashCommandItem[] {
  return commands
    .filter((command) => command.enabled)
    .map((command) => ({
      name: command.name,
      description: command.description,
      kind: 'template',
      source: 'custom',
      template: command.template,
    }));
}
