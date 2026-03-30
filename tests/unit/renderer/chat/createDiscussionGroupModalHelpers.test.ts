import { describe, expect, it } from 'vitest';
import { resolveHarnessDefaultSelectionKeys } from '@/renderer/pages/conversation/platforms/group/createDiscussionGroupModalHelpers';

const PLANNER_ID = 'builtin-engineering-planner';
const WORKBENCH_ID = 'builtin-engineering-workbench';
const REVIEWER_ID = 'builtin-engineering-reviewer';

describe('createDiscussionGroupModalHelpers', () => {
  it('prefers the built-in planner, workbench, and reviewer trio for harness mode', () => {
    const selectionKeys = resolveHarnessDefaultSelectionKeys([
      {
        type: 'cli-agent',
        participantKey: 'codex:/usr/local/bin/codex:Codex CLI',
        selectionKey: 'cli-agent:codex:/usr/local/bin/codex:Codex CLI',
      },
      {
        type: 'preset-assistant',
        participantKey: REVIEWER_ID,
        selectionKey: `preset-assistant:${REVIEWER_ID}`,
      },
      {
        type: 'preset-assistant',
        participantKey: PLANNER_ID,
        selectionKey: `preset-assistant:${PLANNER_ID}`,
      },
      {
        type: 'preset-assistant',
        participantKey: WORKBENCH_ID,
        selectionKey: `preset-assistant:${WORKBENCH_ID}`,
      },
    ]);

    expect(selectionKeys).toEqual([
      `preset-assistant:${PLANNER_ID}`,
      `preset-assistant:${WORKBENCH_ID}`,
      `preset-assistant:${REVIEWER_ID}`,
    ]);
  });

  it('falls back to the remaining available participants when a built-in harness role is missing', () => {
    const selectionKeys = resolveHarnessDefaultSelectionKeys([
      {
        type: 'preset-assistant',
        participantKey: PLANNER_ID,
        selectionKey: `preset-assistant:${PLANNER_ID}`,
      },
      {
        type: 'cli-agent',
        participantKey: 'codex:/usr/local/bin/codex:Codex CLI',
        selectionKey: 'cli-agent:codex:/usr/local/bin/codex:Codex CLI',
      },
      {
        type: 'preset-assistant',
        participantKey: REVIEWER_ID,
        selectionKey: `preset-assistant:${REVIEWER_ID}`,
      },
      {
        type: 'preset-assistant',
        participantKey: 'builtin-cowork',
        selectionKey: 'preset-assistant:builtin-cowork',
      },
    ]);

    expect(selectionKeys).toEqual([
      `preset-assistant:${PLANNER_ID}`,
      `preset-assistant:${REVIEWER_ID}`,
      'cli-agent:codex:/usr/local/bin/codex:Codex CLI',
    ]);
  });
});
