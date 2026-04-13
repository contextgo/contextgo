import { describe, expect, it } from 'vitest';
import {
  createManagedSlashCommandFromBuiltin,
  normalizeManagedSlashCommandLibrary,
  resolveManagedSlashCommands,
  toSlashCommandItems,
} from '@/common/chat/slash/library';

describe('managed slash command library', () => {
  it('returns an empty project command list when storage is empty', () => {
    const library = normalizeManagedSlashCommandLibrary(undefined);

    expect(library).toEqual([]);
  });

  it('keeps only valid project command records and removes duplicate names', () => {
    const library = normalizeManagedSlashCommandLibrary([
      {
        id: 'project-plan',
        enabled: false,
        name: '/plan',
        description: 'Write the implementation plan first',
        template: 'Plan the work before coding.',
      },
      {
        id: 'project-triage',
        enabled: true,
        name: '/triage',
        description: 'Review the issue first',
        template: 'Triage this issue before coding.',
      },
      {
        id: 'duplicate-triage',
        enabled: true,
        name: 'triage',
        description: 'duplicate name',
        template: 'duplicate',
      },
      {
        id: 'invalid-name',
        enabled: true,
        name: 'bad name!',
        description: 'invalid',
        template: 'invalid',
      },
      {
        id: 'missing-template',
        enabled: true,
        name: 'ship',
        description: 'missing template',
        template: '   ',
      },
    ]);

    expect(library).toEqual([
      {
        id: 'project-plan',
        enabled: false,
        name: 'plan',
        description: 'Write the implementation plan first',
        template: 'Plan the work before coding.',
      },
      {
        id: 'project-triage',
        enabled: true,
        name: 'triage',
        description: 'Review the issue first',
        template: 'Triage this issue before coding.',
      },
    ]);
  });

  it('resolves project commands directly and converts only enabled ones into slash menu items', () => {
    const library = normalizeManagedSlashCommandLibrary([
      {
        id: 'project-verify',
        enabled: true,
        name: 'verify',
        description: 'Check release readiness',
        template: 'Verify release readiness.',
      },
      {
        id: 'project-debug',
        enabled: false,
        name: 'debug-root-cause',
        description: 'Investigate the root cause first',
        template: 'Find the root cause before changing code.',
      },
    ]);

    const resolved = resolveManagedSlashCommands(library, (key, defaultValue) => `${key}:${defaultValue}`);
    const items = toSlashCommandItems(resolved);

    expect(resolved).toEqual([
      {
        id: 'project-verify',
        enabled: true,
        name: 'verify',
        description: 'Check release readiness',
        template: 'Verify release readiness.',
      },
      {
        id: 'project-debug',
        enabled: false,
        name: 'debug-root-cause',
        description: 'Investigate the root cause first',
        template: 'Find the root cause before changing code.',
      },
    ]);
    expect(items).toEqual([
      {
        name: 'verify',
        description: 'Check release readiness',
        kind: 'template',
        source: 'custom',
        template: 'Verify release readiness.',
      },
    ]);
  });

  it('materializes builtin command templates into plain project commands', () => {
    const command = createManagedSlashCommandFromBuiltin(
      {
        builtinId: 'plan',
        name: 'release-plan',
      },
      (key, defaultValue) => `${key}:${defaultValue}`
    );

    expect(command).toEqual({
      id: 'plan',
      enabled: true,
      name: 'release-plan',
      description:
        'settings.commands.presets.plan.description:Restate the task, identify risks, and produce a step-by-step plan before coding.',
      template:
        'settings.commands.presets.plan.template:Restate the task, identify the main constraints and risks, then propose a clear step-by-step implementation plan. Do not modify files yet. Wait for confirmation before executing.',
    });
  });
});
