import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getSpaceCommandLibraryMock = vi.fn();
const saveSpaceCommandLibraryMock = vi.fn();

vi.mock('@/common/utils', () => ({
  uuid: vi.fn(() => 'generated-command-id'),
}));

vi.mock('@process/services/space/SpaceServiceImpl', () => ({
  SpaceServiceImpl: class {
    getSpaceCommandLibrary(...args: unknown[]) {
      return getSpaceCommandLibraryMock(...args);
    }

    saveSpaceCommandLibrary(...args: unknown[]) {
      return saveSpaceCommandLibraryMock(...args);
    }
  },
}));

import { executeAssistantCommandCommands } from '@/process/services/context/events/AssistantCommandCommandService';

describe('AssistantCommandCommandService', () => {
  let workspacePath: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), 'contextgo-command-skill-'));
  });

  afterEach(async () => {
    await fs.rm(workspacePath, { recursive: true, force: true });
  });

  it('creates a project-local command in .contextgo/commands.json and emits a create event', async () => {
    const result = await executeAssistantCommandCommands({
      content:
        '[COMMAND_UPSERT]\nscope: project\nname: review\ndescription: Review the current diff.\ntemplate: Review the current changes like a strict reviewer.\n[/COMMAND_UPSERT]',
      conversationId: 'conv-1',
      workspacePath,
    });

    const commandsFile = path.join(workspacePath, '.contextgo', 'commands.json');
    const savedLibrary = JSON.parse(await fs.readFile(commandsFile, 'utf-8'));

    expect(savedLibrary).toEqual([
      {
        id: 'generated-command-id',
        enabled: true,
        name: 'review',
        description: 'Review the current diff.',
        template: 'Review the current changes like a strict reviewer.',
      },
    ]);
    expect(result.systemResponses).toEqual([
      '[Command Result]\nCreated project command /review.\nscope=project\nname=review\nenabled=true',
    ]);
    expect(result.events).toEqual([
      {
        source: 'assistant-skill',
        action: 'create',
        scope: 'project',
        command: {
          id: 'generated-command-id',
          enabled: true,
          name: 'review',
          description: 'Review the current diff.',
          template: 'Review the current changes like a strict reviewer.',
        },
      },
    ]);
  });

  it('updates an existing project-local command by slash name case-insensitively', async () => {
    const commandsFile = path.join(workspacePath, '.contextgo', 'commands.json');
    await fs.mkdir(path.dirname(commandsFile), { recursive: true });
    await fs.writeFile(
      commandsFile,
      `${JSON.stringify(
        [
          {
            id: 'project-review',
            enabled: false,
            name: 'Review',
            description: 'Old description',
            template: 'Old template',
          },
        ],
        null,
        2
      )}\n`,
      'utf-8'
    );

    const result = await executeAssistantCommandCommands({
      content:
        '[COMMAND_UPSERT]\nscope: project\nname: review\nenabled: true\ndescription: Security-focused review.\ntemplate: Review the current patch for security risks first.\n[/COMMAND_UPSERT]',
      conversationId: 'conv-1',
      workspacePath,
    });

    const savedLibrary = JSON.parse(await fs.readFile(commandsFile, 'utf-8'));

    expect(savedLibrary).toEqual([
      {
        id: 'project-review',
        enabled: true,
        name: 'review',
        description: 'Security-focused review.',
        template: 'Review the current patch for security risks first.',
      },
    ]);
    expect(result.systemResponses).toEqual([
      '[Command Result]\nUpdated project command /review.\nscope=project\nname=review\nenabled=true',
    ]);
    expect(result.events).toEqual([
      {
        source: 'assistant-skill',
        action: 'update',
        scope: 'project',
        command: {
          id: 'project-review',
          enabled: true,
          name: 'review',
          description: 'Security-focused review.',
          template: 'Review the current patch for security risks first.',
        },
      },
    ]);
  });

  it('lists project-local commands for the selected scope', async () => {
    const commandsFile = path.join(workspacePath, '.contextgo', 'commands.json');
    await fs.mkdir(path.dirname(commandsFile), { recursive: true });
    await fs.writeFile(
      commandsFile,
      `${JSON.stringify(
        [
          {
            id: 'project-plan',
            enabled: true,
            name: 'plan',
            description: 'Plan first',
            template: 'Write the plan first.',
          },
        ],
        null,
        2
      )}\n`,
      'utf-8'
    );

    const result = await executeAssistantCommandCommands({
      content: '[COMMAND_LIST: scope=project]',
      conversationId: 'conv-1',
      workspacePath,
    });

    expect(result.systemResponses).toEqual([
      '[Command Result]\nFound 1 project command(s):\n1. name=/plan\n   enabled=true\n   description=Plan first',
    ]);
    expect(result.events).toEqual([
      {
        source: 'assistant-skill',
        action: 'list',
        scope: 'project',
        commands: [
          {
            id: 'project-plan',
            enabled: true,
            name: 'plan',
            description: 'Plan first',
            template: 'Write the plan first.',
          },
        ],
      },
    ]);
  });

  it('deletes a Space command by slash name and saves the remaining library', async () => {
    getSpaceCommandLibraryMock.mockResolvedValue([
      {
        id: 'space-review',
        enabled: true,
        name: 'review',
        description: 'Shared review command',
        template: 'Shared review template',
      },
      {
        id: 'space-plan',
        enabled: true,
        name: 'plan',
        description: 'Shared plan command',
        template: 'Shared plan template',
      },
    ]);
    saveSpaceCommandLibraryMock.mockImplementation(async (_spaceId: string, library: unknown[]) => library);

    const result = await executeAssistantCommandCommands({
      content: '[COMMAND_DELETE: scope=space; name=review]',
      conversationId: 'conv-1',
      spaceId: 'space-1',
    });

    expect(getSpaceCommandLibraryMock).toHaveBeenCalledWith('space-1');
    expect(saveSpaceCommandLibraryMock).toHaveBeenCalledWith('space-1', [
      {
        id: 'space-plan',
        enabled: true,
        name: 'plan',
        description: 'Shared plan command',
        template: 'Shared plan template',
      },
    ]);
    expect(result.systemResponses).toEqual([
      '[Command Result]\nDeleted space command /review.\nscope=space\nname=review',
    ]);
    expect(result.events).toEqual([
      {
        source: 'assistant-skill',
        action: 'delete',
        scope: 'space',
        commandName: 'review',
      },
    ]);
  });
});
