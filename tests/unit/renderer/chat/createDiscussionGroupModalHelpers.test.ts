import { describe, expect, it } from 'vitest';
import { resolveHarnessDefaultSelectionKeys } from '@/renderer/pages/conversation/platforms/group/createDiscussionGroupModalHelpers';

const PLANNER_ID = 'builtin-workflow-planner';
const WRITER_ID = 'builtin-workflow-writer';
const EVALUATOR_ID = 'builtin-workflow-evaluator';

describe('createDiscussionGroupModalHelpers', () => {
  it('prefers the built-in planner, writer, and evaluator trio for harness mode', () => {
    const selectionKeys = resolveHarnessDefaultSelectionKeys([
      {
        type: 'cli-agent',
        participantKey: 'codex:/usr/local/bin/codex:Codex CLI',
        selectionKey: 'cli-agent:codex:/usr/local/bin/codex:Codex CLI',
      },
      {
        type: 'preset-assistant',
        participantKey: EVALUATOR_ID,
        selectionKey: `preset-assistant:${EVALUATOR_ID}`,
      },
      {
        type: 'preset-assistant',
        participantKey: PLANNER_ID,
        selectionKey: `preset-assistant:${PLANNER_ID}`,
      },
      {
        type: 'preset-assistant',
        participantKey: WRITER_ID,
        selectionKey: `preset-assistant:${WRITER_ID}`,
      },
    ]);

    expect(selectionKeys).toEqual([
      `preset-assistant:${PLANNER_ID}`,
      `preset-assistant:${WRITER_ID}`,
      `preset-assistant:${EVALUATOR_ID}`,
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
        participantKey: EVALUATOR_ID,
        selectionKey: `preset-assistant:${EVALUATOR_ID}`,
      },
      {
        type: 'preset-assistant',
        participantKey: 'builtin-cowork',
        selectionKey: 'preset-assistant:builtin-cowork',
      },
    ]);

    expect(selectionKeys).toEqual([
      `preset-assistant:${PLANNER_ID}`,
      `preset-assistant:${EVALUATOR_ID}`,
      'cli-agent:codex:/usr/local/bin/codex:Codex CLI',
    ]);
  });
});
