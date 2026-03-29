import { describe, expect, it } from 'vitest';
import {
  buildHookOutputRoutingConfig,
  canConfigureHookOutputRouting,
  createHookOutputRoutingDraft,
  filterHooksByCategory,
  filterHooksByQuery,
  getAvailableHookCategories,
  summarizeHookLibrary,
} from '../../src/renderer/pages/settings/AgentSettings/hookLibraryUtils';

describe('hookLibraryUtils', () => {
  const hooks = [
    {
      name: 'quality-gate',
      description: 'Run validation expectations',
      category: 'quality',
      tags: ['tests', 'lint'],
      location: '/tmp/builtin/quality-gate',
      isCustom: false,
      runnableEvents: ['before_user_prompt'],
    },
    {
      name: 'custom-guard',
      description: 'Custom tool safety guard',
      category: 'safety',
      tags: ['security'],
      location: '/tmp/custom/custom-guard',
      isCustom: true,
      outputTargets: ['sidecar-file'],
    },
  ];

  it('filters hooks by name, description, and location', () => {
    expect(filterHooksByQuery(hooks, 'quality')).toEqual([hooks[0]]);
    expect(filterHooksByQuery(hooks, 'safety')).toEqual([hooks[1]]);
    expect(filterHooksByQuery(hooks, '/tmp/custom')).toEqual([hooks[1]]);
    expect(filterHooksByQuery(hooks, 'tests')).toEqual([hooks[0]]);
    expect(filterHooksByQuery(hooks, 'before_user_prompt')).toEqual([hooks[0]]);
    expect(filterHooksByQuery(hooks, 'sidecar')).toEqual([hooks[1]]);
    expect(filterHooksByQuery(hooks, '')).toEqual(hooks);
  });

  it('summarizes builtin and custom hook counts', () => {
    expect(summarizeHookLibrary(hooks)).toEqual({
      total: 2,
      custom: 1,
      builtin: 1,
      readyNow: 1,
    });
  });

  it('returns ordered hook categories and filters by category', () => {
    expect(getAvailableHookCategories(hooks)).toEqual(['quality', 'safety']);
    expect(filterHooksByCategory(hooks, 'quality')).toEqual([hooks[0]]);
    expect(filterHooksByCategory(hooks, 'all')).toEqual(hooks);
  });

  it('detects whether a hook supports editable output routing', () => {
    expect(
      canConfigureHookOutputRouting({
        isCustom: true,
        executionType: 'native-projection',
      })
    ).toBe(true);
    expect(
      canConfigureHookOutputRouting({
        isCustom: false,
        executionType: 'native-projection',
      })
    ).toBe(false);
    expect(
      canConfigureHookOutputRouting({
        isCustom: true,
        executionType: 'prompt-transform',
      })
    ).toBe(false);
  });

  it('builds a normalized routing config from a hook draft', () => {
    const draft = createHookOutputRoutingDraft({
      outputTargets: ['system-notification', 'sidecar-file'],
      notification: {
        title: ' {{conversationName}} complete ',
        body: ' {{finalResponseExcerpt}} ',
      },
      outputFile: {
        baseDir: 'conversation-workspace',
        relativeDir: ' handoff/{{conversationId}} ',
        fileBaseName: ' latest ',
      },
    });

    expect(buildHookOutputRoutingConfig(draft)).toEqual({
      outputTargets: ['system-notification', 'sidecar-file'],
      notification: {
        title: '{{conversationName}} complete',
        body: '{{finalResponseExcerpt}}',
      },
      outputFile: {
        baseDir: 'conversation-workspace',
        relativeDir: 'handoff/{{conversationId}}',
        fileBaseName: 'latest',
      },
    });
  });
});
