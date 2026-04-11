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
      participantKey: 'builtin-everything-in-claude-code',
      selectionKey: 'preset:builtin-everything-in-claude-code',
    },
    {
      type: 'cli-agent' as const,
      participantKey: 'codex:codex:Codex',
      selectionKey: 'cli:codex:codex:Codex',
    },
    {
      type: 'preset-assistant' as const,
      participantKey: 'builtin-superpowers',
      selectionKey: 'preset:builtin-superpowers',
    },
  ];

  it('orders preferred harness assistants before unrelated participants', () => {
    expect(orderHarnessSelectableParticipants(participants).map((item) => item.participantKey)).toEqual([
      'builtin-superpowers',
      'builtin-everything-in-claude-code',
      'codex:codex:Codex',
    ]);
  });

  it('filters harness participants down to the required preset assistants only', () => {
    expect(filterHarnessSelectableParticipants(participants).map((item) => item.participantKey)).toEqual([
      'builtin-everything-in-claude-code',
      'builtin-superpowers',
    ]);
  });

  it('resolves the default harness selection keys in supported assistant order', () => {
    expect(resolveHarnessDefaultSelectionKeys(participants)).toEqual([
      'preset:builtin-superpowers',
      'preset:builtin-everything-in-claude-code',
      'cli:codex:codex:Codex',
    ]);
  });
});
