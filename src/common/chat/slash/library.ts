/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SlashCommandItem } from './types';

export const SLASH_COMMAND_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

export type BuiltinManagedSlashCommandId = 'plan' | 'tdd' | 'code-review' | 'security' | 'verify' | 'orchestrate';

export type ManagedSlashCommandRecord = {
  id: string;
  enabled: boolean;
  name: string;
  description: string;
  template: string;
};

export type ResolvedManagedSlashCommand = ManagedSlashCommandRecord;

interface BuiltinManagedSlashCommandDefinition {
  id: BuiltinManagedSlashCommandId;
  name: string;
  descriptionKey: string;
  descriptionDefaultValue: string;
  templateKey: string;
  templateDefaultValue: string;
}

export interface BuiltinManagedSlashCommandSeed {
  builtinId: BuiltinManagedSlashCommandId;
  enabled?: boolean;
  name?: string;
  description?: string;
  template?: string;
}

export interface SlashCommandTranslationResolver {
  (key: string, defaultValue: string): string;
}

export const BUILTIN_MANAGED_SLASH_COMMANDS: readonly BuiltinManagedSlashCommandDefinition[] = [
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
] as const;

const BUILTIN_MANAGED_SLASH_COMMAND_MAP = new Map<BuiltinManagedSlashCommandId, BuiltinManagedSlashCommandDefinition>(
  BUILTIN_MANAGED_SLASH_COMMANDS.map((command) => [command.id, command])
);

function sanitizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.replace(/\r\n/g, '\n').trim();
  return normalized.length > 0 ? normalized : undefined;
}

function isBuiltinManagedSlashCommandId(value: unknown): value is BuiltinManagedSlashCommandId {
  return typeof value === 'string' && BUILTIN_MANAGED_SLASH_COMMAND_MAP.has(value as BuiltinManagedSlashCommandId);
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

function normalizeManagedSlashCommandRecord(value: unknown): ManagedSlashCommandRecord | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<ManagedSlashCommandRecord>;
  const id = sanitizeOptionalText(candidate.id);
  const name = normalizeSlashCommandName(candidate.name);
  const description = sanitizeOptionalText(candidate.description);
  const template = sanitizeOptionalText(candidate.template);

  if (!id || !name || !description || !template) {
    return null;
  }

  return {
    id,
    enabled: candidate.enabled !== false,
    name,
    description,
    template,
  };
}

export function getBuiltinManagedSlashCommandDefinition(
  id: BuiltinManagedSlashCommandId
): BuiltinManagedSlashCommandDefinition {
  const definition = BUILTIN_MANAGED_SLASH_COMMAND_MAP.get(id);
  if (!definition) {
    throw new Error(`Unknown builtin managed slash command: ${id}`);
  }

  return definition;
}

export function createManagedSlashCommandFromBuiltin(
  seed: BuiltinManagedSlashCommandSeed,
  resolveText?: SlashCommandTranslationResolver
): ManagedSlashCommandRecord {
  const definition = getBuiltinManagedSlashCommandDefinition(seed.builtinId);
  const name = normalizeSlashCommandName(seed.name ?? definition.name);

  if (!name) {
    throw new Error(`Invalid builtin managed slash command name: ${seed.name ?? definition.name}`);
  }

  return {
    id: definition.id,
    enabled: seed.enabled !== false,
    name,
    description:
      sanitizeOptionalText(seed.description) ??
      (resolveText
        ? resolveText(definition.descriptionKey, definition.descriptionDefaultValue)
        : definition.descriptionDefaultValue),
    template:
      sanitizeOptionalText(seed.template) ??
      (resolveText
        ? resolveText(definition.templateKey, definition.templateDefaultValue)
        : definition.templateDefaultValue),
  };
}

export function normalizeManagedSlashCommandLibrary(value: unknown): ManagedSlashCommandRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const records: ManagedSlashCommandRecord[] = [];
  const usedIds = new Set<string>();
  const usedNames = new Set<string>();

  for (const item of value) {
    const normalized = normalizeManagedSlashCommandRecord(item);
    if (!normalized) {
      continue;
    }

    const normalizedName = normalized.name.toLowerCase();
    if (usedIds.has(normalized.id) || usedNames.has(normalizedName)) {
      continue;
    }

    usedIds.add(normalized.id);
    usedNames.add(normalizedName);
    records.push(normalized);
  }

  return records;
}

export function createDefaultManagedSlashCommandLibrary(
  resolveText?: SlashCommandTranslationResolver
): ManagedSlashCommandRecord[] {
  return BUILTIN_MANAGED_SLASH_COMMANDS.map((command) =>
    createManagedSlashCommandFromBuiltin(
      {
        builtinId: command.id,
      },
      resolveText
    )
  );
}

export function resolveManagedSlashCommands(
  library: ManagedSlashCommandRecord[],
  _resolveText?: SlashCommandTranslationResolver
): ResolvedManagedSlashCommand[] {
  return library.map((record) => ({
    ...record,
  }));
}

export function mergeManagedSlashCommandLibraries(
  baseLibrary: ManagedSlashCommandRecord[],
  overrideLibrary: ManagedSlashCommandRecord[]
): ManagedSlashCommandRecord[] {
  const normalizedBaseLibrary = normalizeManagedSlashCommandLibrary(baseLibrary);
  const normalizedOverrideLibrary = normalizeManagedSlashCommandLibrary(overrideLibrary);
  const overriddenIds = new Set(normalizedOverrideLibrary.map((record) => record.id));
  const overriddenNames = new Set(normalizedOverrideLibrary.map((record) => record.name.toLowerCase()));

  return [
    ...normalizedBaseLibrary.filter(
      (record) => !overriddenIds.has(record.id) && !overriddenNames.has(record.name.toLowerCase())
    ),
    ...normalizedOverrideLibrary,
  ];
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
