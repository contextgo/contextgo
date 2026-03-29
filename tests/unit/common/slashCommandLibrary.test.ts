import { describe, expect, it } from 'vitest';
import {
  createDefaultManagedSlashCommandLibrary,
  normalizeManagedSlashCommandLibrary,
  resolveManagedSlashCommands,
  toSlashCommandItems,
} from '@/common/chat/slash/library';

describe('managed slash command library', () => {
  it('returns the builtin command set when storage is empty', () => {
    const library = normalizeManagedSlashCommandLibrary(undefined);

    expect(library).toEqual(createDefaultManagedSlashCommandLibrary());
  });

  it('keeps builtin records, removes invalid entries, and preserves valid custom commands', () => {
    const library = normalizeManagedSlashCommandLibrary([
      {
        type: 'builtin',
        id: 'plan',
        enabled: false,
        nameOverride: '/strategy',
      },
      {
        type: 'custom',
        id: 'custom-1',
        enabled: true,
        name: '/triage',
        description: 'Review the issue first',
        template: 'Triage this issue before coding.',
      },
      {
        type: 'custom',
        id: 'custom-2',
        enabled: true,
        name: 'triage',
        description: 'duplicate name',
        template: 'duplicate',
      },
      {
        type: 'custom',
        id: 'custom-3',
        enabled: true,
        name: 'bad name!',
        description: 'invalid',
        template: 'invalid',
      },
    ]);

    expect(library).toEqual([
      {
        type: 'builtin',
        id: 'plan',
        enabled: false,
        nameOverride: 'strategy',
      },
      { type: 'builtin', id: 'tdd', enabled: true },
      { type: 'builtin', id: 'code-review', enabled: true },
      { type: 'builtin', id: 'security', enabled: true },
      { type: 'builtin', id: 'verify', enabled: true },
      { type: 'builtin', id: 'orchestrate', enabled: true },
      {
        type: 'custom',
        id: 'custom-1',
        enabled: true,
        name: 'triage',
        description: 'Review the issue first',
        template: 'Triage this issue before coding.',
      },
    ]);
  });

  it('resolves builtin translations, local overrides, and slash menu items', () => {
    const library = normalizeManagedSlashCommandLibrary([
      {
        type: 'builtin',
        id: 'plan',
        enabled: true,
        nameOverride: 'blueprint',
        descriptionOverride: 'Local plan description',
        templateOverride: 'Local plan template',
      },
      {
        type: 'custom',
        id: 'custom-verify',
        enabled: true,
        name: 'ship-check',
        description: 'Check ship readiness',
        template: 'Verify release readiness.',
      },
    ]);

    const resolved = resolveManagedSlashCommands(library, (key, defaultValue) => `${key}:${defaultValue}`);
    const items = toSlashCommandItems(resolved);

    expect(resolved[0]).toMatchObject({
      id: 'plan',
      type: 'builtin',
      name: 'blueprint',
      description: 'Local plan description',
      template: 'Local plan template',
    });
    expect(resolved.find((command) => command.id === 'tdd')).toMatchObject({
      type: 'builtin',
      name: 'tdd',
    });
    expect(items).toContainEqual({
      name: 'blueprint',
      description: 'Local plan description',
      kind: 'template',
      source: 'custom',
      template: 'Local plan template',
    });
    expect(items).toContainEqual({
      name: 'ship-check',
      description: 'Check ship readiness',
      kind: 'template',
      source: 'custom',
      template: 'Verify release readiness.',
    });
  });
});
