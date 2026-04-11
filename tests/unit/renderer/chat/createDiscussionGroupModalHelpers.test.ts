import { describe, expect, it } from 'vitest';
import { resolveHarnessDefaultSelectionKeys } from '@/renderer/pages/conversation/platforms/group/createDiscussionGroupModalHelpers';

const SUPERPOWERS_ID = 'builtin-superpowers';
const CLAUDE_CODE_ID = 'builtin-everything-in-claude-code';

describe('createDiscussionGroupModalHelpers', () => {
  it('prefers the two supported built-in harness assistants first', () => {
    const selectionKeys = resolveHarnessDefaultSelectionKeys([
      {
        type: 'cli-agent',
        participantKey: 'codex:/usr/local/bin/codex:Codex CLI',
        selectionKey: 'cli-agent:codex:/usr/local/bin/codex:Codex CLI',
      },
      {
        type: 'preset-assistant',
        participantKey: CLAUDE_CODE_ID,
        selectionKey: `preset-assistant:${CLAUDE_CODE_ID}`,
      },
      {
        type: 'preset-assistant',
        participantKey: SUPERPOWERS_ID,
        selectionKey: `preset-assistant:${SUPERPOWERS_ID}`,
      },
    ]);

    expect(selectionKeys).toEqual([
      `preset-assistant:${SUPERPOWERS_ID}`,
      `preset-assistant:${CLAUDE_CODE_ID}`,
      'cli-agent:codex:/usr/local/bin/codex:Codex CLI',
    ]);
  });

  it('falls back to the remaining available participants when one built-in harness assistant is missing', () => {
    const selectionKeys = resolveHarnessDefaultSelectionKeys([
      {
        type: 'preset-assistant',
        participantKey: SUPERPOWERS_ID,
        selectionKey: `preset-assistant:${SUPERPOWERS_ID}`,
      },
      {
        type: 'cli-agent',
        participantKey: 'codex:/usr/local/bin/codex:Codex CLI',
        selectionKey: 'cli-agent:codex:/usr/local/bin/codex:Codex CLI',
      },
      {
        type: 'preset-assistant',
        participantKey: 'builtin-custom-reviewer',
        selectionKey: 'preset-assistant:builtin-custom-reviewer',
      },
    ]);

    expect(selectionKeys).toEqual([
      `preset-assistant:${SUPERPOWERS_ID}`,
      'cli-agent:codex:/usr/local/bin/codex:Codex CLI',
      'preset-assistant:builtin-custom-reviewer',
    ]);
  });
});
