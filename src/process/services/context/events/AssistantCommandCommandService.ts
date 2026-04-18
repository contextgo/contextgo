/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { CommandEventPayload, CommandEventScope } from '@/common/chat/command/events';
import {
  normalizeManagedSlashCommandLibrary,
  normalizeSlashCommandName,
  type ManagedSlashCommandRecord,
} from '@/common/chat/slash/library';
import { uuid } from '@/common/utils';
import { getWorkspaceCommandsFile, readWorkspaceCommandLibrary } from '@process/bridge/services/workspaceAutomation';
import { SqliteConversationRepository } from '@process/services/database/SqliteConversationRepository';
import { SqliteSpaceRepository } from '@process/services/database/space/SqliteSpaceRepository';
import { SpaceServiceImpl } from '@process/services/space/SpaceServiceImpl';

const COMMAND_LIST_PATTERN = /\[COMMAND_LIST:\s*scope=(project|space)\s*\]/gi;
const COMMAND_DELETE_PATTERN = /\[COMMAND_DELETE:\s*scope=(project|space)\s*;\s*name=([^\]]+?)\s*\]/gi;
const COMMAND_UPSERT_BLOCK_PATTERN = /\[COMMAND_UPSERT\]([\s\S]*?)\[\/COMMAND_UPSERT\]/gi;

type AssistantCommand =
  | {
      index: number;
      type: 'list';
      scope: CommandEventScope;
    }
  | {
      index: number;
      type: 'delete';
      scope: CommandEventScope;
      name: string;
    }
  | {
      index: number;
      type: 'upsert';
      scope: CommandEventScope | null;
      name: string | null;
      enabled?: boolean;
      description: string;
      template: string;
    };

type CommandExecutionContext = {
  conversationId: string;
  workspacePath?: string;
  spaceId?: string;
};

export type AssistantCommandCommandResult = {
  cleanedContent: string;
  hasCommands: boolean;
  systemResponses: string[];
  events: CommandEventPayload[];
};

const conversationRepo = new SqliteConversationRepository();
const spaceService = new SpaceServiceImpl(new SqliteSpaceRepository());

function normalizeCommandSpacing(content: string): string {
  return content.replace(/\n{3,}/g, '\n\n').trim();
}

function readBlockField(block: string, fieldName: string): string {
  const escapedFieldName = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const fieldPattern = new RegExp(`^${escapedFieldName}:\\s*([\\s\\S]*?)(?=^\\w[\\w_]*:\\s|$)`, 'im');
  const match = fieldPattern.exec(block);
  return match?.[1]?.trim() ?? '';
}

function parseScope(value: string): CommandEventScope | null {
  return value === 'project' || value === 'space' ? value : null;
}

function parseOptionalBoolean(value: string): boolean | undefined {
  if (!value) {
    return undefined;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return undefined;
}

function collectCommandCommands(content: string): AssistantCommand[] {
  const commands: AssistantCommand[] = [];

  for (const match of content.matchAll(COMMAND_LIST_PATTERN)) {
    commands.push({
      index: match.index ?? 0,
      type: 'list',
      scope: match[1] as CommandEventScope,
    });
  }

  for (const match of content.matchAll(COMMAND_DELETE_PATTERN)) {
    commands.push({
      index: match.index ?? 0,
      type: 'delete',
      scope: match[1] as CommandEventScope,
      name: normalizeSlashCommandName(match[2] ?? '') ?? '',
    });
  }

  for (const match of content.matchAll(COMMAND_UPSERT_BLOCK_PATTERN)) {
    const block = match[1] ?? '';
    commands.push({
      index: match.index ?? 0,
      type: 'upsert',
      scope: parseScope(readBlockField(block, 'scope')),
      name: normalizeSlashCommandName(readBlockField(block, 'name')),
      enabled: parseOptionalBoolean(readBlockField(block, 'enabled')),
      description: readBlockField(block, 'description'),
      template: readBlockField(block, 'template'),
    });
  }

  return commands.toSorted((left, right) => left.index - right.index);
}

async function resolveConversationContext(params: CommandExecutionContext): Promise<{
  workspacePath?: string;
  spaceId?: string;
}> {
  if (params.workspacePath || params.spaceId) {
    return {
      workspacePath: params.workspacePath,
      spaceId: params.spaceId,
    };
  }

  const conversation = await conversationRepo.getConversation(params.conversationId);
  const extra = (conversation?.extra as Record<string, unknown> | undefined) ?? {};

  return {
    workspacePath:
      typeof extra.workingDirectory === 'string'
        ? extra.workingDirectory
        : typeof extra.workspace === 'string'
          ? extra.workspace
          : undefined,
    spaceId: typeof extra.spaceId === 'string' ? extra.spaceId : undefined,
  };
}

async function readLibraryForScope(scope: CommandEventScope, context: { workspacePath?: string; spaceId?: string }) {
  if (scope === 'project') {
    return (await readWorkspaceCommandLibrary(context.workspacePath)) ?? [];
  }

  if (!context.spaceId) {
    throw new Error('Space scope is unavailable for this conversation');
  }

  return spaceService.getSpaceCommandLibrary(context.spaceId);
}

async function writeProjectLibrary(
  workspacePath: string | undefined,
  library: ManagedSlashCommandRecord[]
): Promise<void> {
  const commandsFile = getWorkspaceCommandsFile(workspacePath);
  if (!commandsFile) {
    throw new Error('Project workspace is unavailable for this conversation');
  }

  await fs.mkdir(path.dirname(commandsFile), { recursive: true });
  await fs.writeFile(commandsFile, `${JSON.stringify(library, null, 2)}\n`, 'utf-8');
}

async function writeLibraryForScope(
  scope: CommandEventScope,
  context: { workspacePath?: string; spaceId?: string },
  library: ManagedSlashCommandRecord[]
): Promise<void> {
  if (scope === 'project') {
    await writeProjectLibrary(context.workspacePath, library);
    return;
  }

  if (!context.spaceId) {
    throw new Error('Space scope is unavailable for this conversation');
  }

  await spaceService.saveSpaceCommandLibrary(context.spaceId, library);
}

function formatCommandListResult(scope: CommandEventScope, commands: ManagedSlashCommandRecord[]): string {
  if (commands.length === 0) {
    return `[Command Result]\nNo ${scope} commands exist.`;
  }

  const lines = commands.map((command, index) =>
    [
      `${index + 1}. name=/${command.name}`,
      `   enabled=${command.enabled ? 'true' : 'false'}`,
      `   description=${command.description}`,
    ].join('\n')
  );

  return `[Command Result]\nFound ${commands.length} ${scope} command(s):\n${lines.join('\n')}`;
}

function formatCommandUpsertResult(
  action: 'create' | 'update',
  scope: CommandEventScope,
  command: ManagedSlashCommandRecord
): string {
  const actionLabel = action === 'create' ? 'Created' : 'Updated';
  return `[Command Result]\n${actionLabel} ${scope} command /${command.name}.\nscope=${scope}\nname=${command.name}\nenabled=${command.enabled ? 'true' : 'false'}`;
}

function formatCommandDeleteResult(scope: CommandEventScope, name: string): string {
  return `[Command Result]\nDeleted ${scope} command /${name}.\nscope=${scope}\nname=${name}`;
}

function formatCommandError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `[Command Result]\nError: ${message}`;
}

function upsertCommand(
  library: ManagedSlashCommandRecord[],
  input: {
    name: string;
    enabled?: boolean;
    description: string;
    template: string;
  }
): { action: 'create' | 'update'; command: ManagedSlashCommandRecord; library: ManagedSlashCommandRecord[] } {
  const existing = library.find((command) => command.name.toLowerCase() === input.name.toLowerCase());

  if (!existing) {
    const command: ManagedSlashCommandRecord = {
      id: uuid(),
      enabled: input.enabled ?? true,
      name: input.name,
      description: input.description,
      template: input.template,
    };

    return {
      action: 'create',
      command,
      library: normalizeManagedSlashCommandLibrary([...library, command]),
    };
  }

  const command: ManagedSlashCommandRecord = {
    ...existing,
    enabled: input.enabled ?? existing.enabled,
    name: input.name,
    description: input.description,
    template: input.template,
  };

  return {
    action: 'update',
    command,
    library: normalizeManagedSlashCommandLibrary(
      library.map((record) => (record.id === existing.id ? command : record))
    ),
  };
}

async function executeCommand(
  command: AssistantCommand,
  context: CommandExecutionContext
): Promise<{ systemResponse: string; event: CommandEventPayload }> {
  const resolvedContext = await resolveConversationContext(context);

  switch (command.type) {
    case 'list': {
      const commands = await readLibraryForScope(command.scope, resolvedContext);
      return {
        systemResponse: formatCommandListResult(command.scope, commands),
        event: {
          source: 'assistant-skill',
          action: 'list',
          scope: command.scope,
          commands,
        },
      };
    }
    case 'delete': {
      if (!command.name) {
        throw new Error('COMMAND_DELETE requires a valid slash command name');
      }

      const library = await readLibraryForScope(command.scope, resolvedContext);
      const existing = library.find((record) => record.name.toLowerCase() === command.name.toLowerCase());
      if (!existing) {
        throw new Error(`${command.scope} command not found: /${command.name}`);
      }

      const nextLibrary = normalizeManagedSlashCommandLibrary(library.filter((record) => record.id !== existing.id));
      await writeLibraryForScope(command.scope, resolvedContext, nextLibrary);

      return {
        systemResponse: formatCommandDeleteResult(command.scope, existing.name),
        event: {
          source: 'assistant-skill',
          action: 'delete',
          scope: command.scope,
          commandName: existing.name,
        },
      };
    }
    case 'upsert': {
      if (!command.scope || !command.name || !command.description || !command.template) {
        throw new Error('COMMAND_UPSERT requires scope, name, description, and template');
      }

      const library = await readLibraryForScope(command.scope, resolvedContext);
      const result = upsertCommand(library, {
        name: command.name,
        enabled: command.enabled,
        description: command.description,
        template: command.template,
      });
      await writeLibraryForScope(command.scope, resolvedContext, result.library);

      return {
        systemResponse: formatCommandUpsertResult(result.action, command.scope, result.command),
        event: {
          source: 'assistant-skill',
          action: result.action,
          scope: command.scope,
          command: result.command,
        },
      };
    }
  }
}

export function stripAssistantCommandCommands(content: string): string {
  if (!content.trim()) {
    return '';
  }

  return normalizeCommandSpacing(
    content
      .replace(COMMAND_UPSERT_BLOCK_PATTERN, '')
      .replace(COMMAND_DELETE_PATTERN, '')
      .replace(COMMAND_LIST_PATTERN, '')
  );
}

export async function executeAssistantCommandCommands(
  params: CommandExecutionContext & { content: string }
): Promise<AssistantCommandCommandResult> {
  const commands = collectCommandCommands(params.content);

  if (commands.length === 0) {
    return {
      cleanedContent: stripAssistantCommandCommands(params.content),
      hasCommands: false,
      systemResponses: [],
      events: [],
    };
  }

  const systemResponses: string[] = [];
  const events: CommandEventPayload[] = [];

  for (const command of commands) {
    try {
      // Preserve assistant-declared command order within the turn.
      // eslint-disable-next-line no-await-in-loop
      const result = await executeCommand(command, params);
      systemResponses.push(result.systemResponse);
      events.push(result.event);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      systemResponses.push(formatCommandError(error));
      events.push({
        source: 'assistant-skill',
        action: 'error',
        scope: command.scope,
        commandName:
          command.type === 'list' ? undefined : command.type === 'delete' ? command.name : (command.name ?? undefined),
        error: message,
      });
    }
  }

  return {
    cleanedContent: stripAssistantCommandCommands(params.content),
    hasCommands: true,
    systemResponses,
    events,
  };
}
