import { describe, expect, it } from 'vitest';
import { BUNDLED_AGENT_PACKAGE_DESCRIPTORS } from '@/common/config/presets/bundledAgentPackageRegistry';
import type {
  AssistantListItem,
  HookInfo,
  SkillInfo,
} from '@/renderer/pages/settings/AgentSettings/AssistantManagement/types';
import {
  buildAssistantWorkspaceModel,
  toProjectRelativeAssistantMarkdownPath,
} from '@/renderer/pages/settings/AgentSettings/Workspace/viewModel';

const createSkill = (name: string, description: string): SkillInfo => ({
  name,
  description,
  location: `/tmp/skills/${name}`,
  isCustom: false,
});

const createHook = (name: string, description: string): HookInfo => ({
  name,
  description,
  location: `/tmp/hooks/${name}.json`,
  isCustom: false,
  executionType: 'native-projection',
  events: ['after_response'],
});

describe('buildAssistantWorkspaceModel', () => {
  it('normalizes assistant markdown lookup paths from both absolute and relative glob keys', () => {
    expect(
      toProjectRelativeAssistantMarkdownPath('/src/process/resources/assistant/engineering/superpowers/AGENTS.md')
    ).toBe('src/process/resources/assistant/engineering/superpowers/AGENTS.md');

    expect(
      toProjectRelativeAssistantMarkdownPath('../../../../../process/resources/assistant/morph-ppt/docs/README.md')
    ).toBe('src/process/resources/assistant/morph-ppt/docs/README.md');
  });

  it('projects bundled package AGENTS.md entry, docs, and automation tabs for builtin packages', () => {
    const assistant = {
      id: 'builtin-superpowers',
      name: 'Superpowers Harness',
      enabled: true,
      isPreset: true,
      isBuiltin: true,
      presetAgentType: 'codex',
    } as AssistantListItem;

    const model = buildAssistantWorkspaceModel({
      assistant,
      availableSkills: [createSkill('using-superpowers', 'Bootstraps mandatory skill usage.')],
      availableHooks: [createHook('repo-context-bootstrap', 'Loads repo context before execution.')],
      pendingSkills: [],
      selectedSkills: [],
      selectedHooks: ['repo-context-bootstrap'],
    });

    expect(model.availableTabs).toEqual(['skills', 'hooks', 'commands', 'agents', 'docs']);
    expect(model.defaultTab).toBe('skills');
    expect(model.packageManifest?.entryDocument.file).toBe('AGENTS.md');
    expect(model.agentsDocument).toBeNull();
    expect(model.docs).toEqual([]);
    expect(model.docsTree).toEqual([]);
    expect(model.relevantSkills.map((skill) => skill.name)).toContain('using-superpowers');
    expect(model.relevantSkills.find((skill) => skill.name === 'using-superpowers')?.description).toBe(
      'Bootstraps mandatory skill usage.'
    );
    expect(model.commands[0]?.profile).toBe('contextgo-harness');
    expect(model.commands.some((command) => command.label === 'brainstorm')).toBe(true);
    expect(
      model.commands.find((command) => command.label === 'brainstorm')?.template.includes('`brainstorming` skill')
    ).toBe(true);
    expect(model.schedules).toEqual([]);
    expect(model.isEditable).toBe(false);
  });

  it('falls back to editable operational tabs for custom assistants without package payloads', () => {
    const assistant = {
      id: 'custom-123',
      name: 'Workspace Agent',
      enabled: true,
      isPreset: true,
      isBuiltin: false,
      presetAgentType: 'codex',
    } as AssistantListItem;

    const model = buildAssistantWorkspaceModel({
      assistant,
      availableSkills: [],
      availableHooks: [],
      pendingSkills: [],
      selectedSkills: [],
      selectedHooks: [],
    });

    expect(model.availableTabs).toEqual(['skills', 'hooks', 'schedules', 'commands']);
    expect(model.defaultTab).toBe('skills');
    expect(model.agentsDocument).toBeNull();
    expect(model.docs).toEqual([]);
    expect(model.isEditable).toBe(true);
  });

  it('exposes AGENTS.md and Docs tabs for Morph PPT builtins through AGENTS entry metadata', () => {
    const assistant = {
      id: 'builtin-morph-ppt',
      name: 'Morph PPT',
      enabled: true,
      isPreset: true,
      isBuiltin: true,
      presetAgentType: 'codex',
    } as AssistantListItem;

    const model = buildAssistantWorkspaceModel({
      assistant,
      availableSkills: [createSkill('morph-ppt', 'Build Morph-based presentation decks.')],
      availableHooks: [],
      pendingSkills: [],
      selectedSkills: [],
      selectedHooks: [],
    });

    expect(model.availableTabs).toEqual(['skills', 'agents', 'docs']);
    expect(model.packageManifest?.entryDocument.file).toBe('AGENTS.md');
    expect(model.agentsDocument).toBeNull();
    expect(model.docs).toEqual([]);
  });

  it('keeps AGENTS.md and docs visible for every bundled assistant package with package docs', () => {
    const bundledAssistants = BUNDLED_AGENT_PACKAGE_DESCRIPTORS.map((descriptor) => ({
      id: descriptor.manifest.assistantPresetId,
      name: descriptor.manifest.displayName,
      enabled: true,
      isPreset: true,
      isBuiltin: true,
      presetAgentType: 'codex',
    })) as AssistantListItem[];

    bundledAssistants.forEach((assistant) => {
      const model = buildAssistantWorkspaceModel({
        assistant,
        availableSkills: [],
        availableHooks: [],
        pendingSkills: [],
        selectedSkills: [],
        selectedHooks: [],
      });

      expect(model.packageManifest?.entryDocument.file, assistant.id).toBe('AGENTS.md');
      expect(model.agentsDocument, assistant.id).toBeNull();
      expect(model.docs.length, assistant.id).toBe(0);
      expect(model.availableTabs, assistant.id).toContain('agents');
      expect(model.availableTabs, assistant.id).toContain('docs');
    });
  });
});
