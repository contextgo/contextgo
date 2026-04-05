import { describe, expect, it } from 'vitest';
import {
  filterHarnessSelectableParticipants,
  orderHarnessSelectableParticipants,
  resolveHarnessDefaultSelectionKeys,
} from '@/renderer/pages/conversation/platforms/group/createDiscussionGroupModalHelpers';

describe('createDiscussionGroupModalHelpers', () => {
  const participants = [
    {
      type: 'preset-assistant' as const,
      participantKey: 'builtin-workflow-evaluator',
      selectionKey: 'preset:builtin-workflow-evaluator',
    },
    {
      type: 'cli-agent' as const,
      participantKey: 'codex:codex:Codex',
      selectionKey: 'cli:codex:codex:Codex',
    },
    {
      type: 'preset-assistant' as const,
      participantKey: 'builtin-workflow-planner',
      selectionKey: 'preset:builtin-workflow-planner',
    },
    {
      type: 'preset-assistant' as const,
      participantKey: 'builtin-superpowers',
      selectionKey: 'preset:builtin-superpowers',
    },
    {
      type: 'preset-assistant' as const,
      participantKey: 'builtin-workflow-writer',
      selectionKey: 'preset:builtin-workflow-writer',
    },
  ];

  it('orders preferred harness assistants before unrelated participants', () => {
    expect(orderHarnessSelectableParticipants(participants).map((item) => item.participantKey)).toEqual([
      'builtin-workflow-planner',
      'builtin-workflow-writer',
      'builtin-workflow-evaluator',
      'codex:codex:Codex',
      'builtin-superpowers',
    ]);
  });

  it('filters harness participants down to the required preset assistants only', () => {
    expect(filterHarnessSelectableParticipants(participants).map((item) => item.participantKey)).toEqual([
      'builtin-workflow-evaluator',
      'builtin-workflow-planner',
      'builtin-workflow-writer',
    ]);
  });

  it('resolves the default harness selection keys in planner writer evaluator order', () => {
    expect(resolveHarnessDefaultSelectionKeys(participants)).toEqual([
      'preset:builtin-workflow-planner',
      'preset:builtin-workflow-writer',
      'preset:builtin-workflow-evaluator',
    ]);
  });
});
