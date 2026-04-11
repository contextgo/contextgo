import { describe, expect, it } from 'vitest';

import { extractCodexRuntimePlanEntries, isCodexRuntimePlanTool } from '@/process/agent/codex/handlers/runtimePlan';

describe('codex runtime plan extraction', () => {
  it('recognizes update_plan style tools and extracts normalized entries', () => {
    expect(isCodexRuntimePlanTool('update_plan')).toBe(true);
    expect(isCodexRuntimePlanTool('TodoWrite')).toBe(true);
    expect(isCodexRuntimePlanTool('shell_exec')).toBe(false);

    expect(
      extractCodexRuntimePlanEntries({
        arguments: {
          entries: [
            { content: 'Inspect current vault layout', status: 'completed' },
            { content: 'Reconnect runtime plan card', status: 'in_progress' },
            { content: 'Verify packaged app flow', status: 'pending' },
          ],
        },
      })
    ).toEqual([
      { content: 'Inspect current vault layout', status: 'completed' },
      { content: 'Reconnect runtime plan card', status: 'in_progress' },
      { content: 'Verify packaged app flow', status: 'pending' },
    ]);
  });

  it('unwraps todo-write shaped payloads from nested result envelopes', () => {
    expect(
      extractCodexRuntimePlanEntries({
        result: {
          Ok: {
            todos: [
              { title: 'Collect runtime signals', state: 'done' },
              { title: 'Highlight active step', state: 'active' },
              { title: 'Fade out after settle', state: 'todo' },
            ],
          },
        },
      })
    ).toEqual([
      { content: 'Collect runtime signals', status: 'completed' },
      { content: 'Highlight active step', status: 'in_progress' },
      { content: 'Fade out after settle', status: 'pending' },
    ]);
  });

  it('ignores unrelated payloads that do not contain a valid plan shape', () => {
    expect(extractCodexRuntimePlanEntries({ result: { message: 'no todo payload here' } })).toEqual([]);
    expect(extractCodexRuntimePlanEntries(['just', 'strings'])).toEqual([]);
  });
});
