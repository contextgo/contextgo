import { describe, expect, it } from 'vitest';
import {
  filterHooksByCategory,
  filterHooksByQuery,
  getAvailableHookCategories,
  summarizeHookLibrary,
} from '../../../src/renderer/pages/settings/AgentSettings/hookLibraryUtils';
import type { HookInfo } from '../../../src/renderer/pages/settings/AgentSettings/AssistantManagement/types';

const HOOKS: HookInfo[] = [
  {
    name: 'prompt-guard',
    description: 'Protects prompts before send',
    category: 'safety',
    tags: ['security', 'pre-tool-use'],
    location: '/hooks/prompt-guard',
    isCustom: true,
    runnableEvents: ['before_user_prompt'],
  },
  {
    name: 'builtin-audit',
    description: 'Builtin audit trail',
    category: 'operations',
    tags: ['handoff'],
    location: '/builtin/hooks/audit',
    isCustom: false,
    outputTargets: ['system-notification'],
  },
];

describe('filterHooksByQuery', () => {
  it('returns all hooks when query is empty', () => {
    expect(filterHooksByQuery(HOOKS, '')).toEqual(HOOKS);
  });

  it('matches hook name, description, and location case-insensitively', () => {
    expect(filterHooksByQuery(HOOKS, 'guard')).toEqual([HOOKS[0]]);
    expect(filterHooksByQuery(HOOKS, 'AUDIT')).toEqual([HOOKS[1]]);
    expect(filterHooksByQuery(HOOKS, '/hooks/prompt')).toEqual([HOOKS[0]]);
  });

  it('matches hook category, tags, output targets, and runnable events', () => {
    expect(filterHooksByQuery(HOOKS, 'security')).toEqual([HOOKS[0]]);
    expect(filterHooksByQuery(HOOKS, 'operations')).toEqual([HOOKS[1]]);
    expect(filterHooksByQuery(HOOKS, 'notification')).toEqual([HOOKS[1]]);
    expect(filterHooksByQuery(HOOKS, 'before_user_prompt')).toEqual([HOOKS[0]]);
  });

  it('returns an empty list when nothing matches', () => {
    expect(filterHooksByQuery(HOOKS, 'missing')).toEqual([]);
  });
});

describe('hook category helpers', () => {
  it('returns available categories in canonical order', () => {
    expect(getAvailableHookCategories(HOOKS)).toEqual(['safety', 'operations']);
  });

  it('filters hooks by category and supports all', () => {
    expect(filterHooksByCategory(HOOKS, 'all')).toEqual(HOOKS);
    expect(filterHooksByCategory(HOOKS, 'operations')).toEqual([HOOKS[1]]);
  });
});

describe('summarizeHookLibrary', () => {
  it('counts total, custom, builtin, and ready-now hooks', () => {
    expect(summarizeHookLibrary(HOOKS)).toEqual({
      total: 2,
      custom: 1,
      builtin: 1,
      readyNow: 1,
    });
  });

  it('returns zero counts for an empty library', () => {
    expect(summarizeHookLibrary([])).toEqual({
      total: 0,
      custom: 0,
      builtin: 0,
      readyNow: 0,
    });
  });
});
