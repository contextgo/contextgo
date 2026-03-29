/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DiscussionGroupMode, DiscussionGroupOrchestration } from '@/common/config/storage';

export type DiscussionRoundSummary = {
  participantId: string;
  participantName: string;
  content: string;
};

export const normalizeDiscussionOrchestration = (
  orchestration?: Partial<DiscussionGroupOrchestration> & { mode?: DiscussionGroupMode }
): DiscussionGroupOrchestration => {
  const mode = orchestration?.mode || 'debate';
  const rounds = orchestration?.rounds || (mode === 'debate' ? 2 : 1);
  return {
    kind: 'discussion',
    mode,
    rounds: rounds === 2 ? 2 : 1,
  };
};

export const buildDiscussionRoundPrompt = (options: {
  mode: DiscussionGroupMode;
  round: number;
  userInput: string;
  participantName: string;
  peerSummaries: DiscussionRoundSummary[];
}): string => {
  const { mode, round, userInput, participantName, peerSummaries } = options;

  if (mode === 'broadcast') {
    return userInput;
  }

  if (mode === 'relay') {
    if (peerSummaries.length === 0) {
      return `${userInput}

[Discussion Protocol]
You are ${participantName}. Start the relay discussion with an independent answer.`;
    }

    const peerContext = peerSummaries
      .map((summary) => `- ${summary.participantName}: ${summary.content.trim()}`)
      .join('\n');

    return `${userInput}

[Relay Discussion Context]
You are ${participantName}. Review the earlier assistants' responses and continue the discussion.

[Earlier Assistants]
${peerContext}

[Response Requirements]
- Build on useful points, challenge weak assumptions, and add at least one new angle.
- Keep your answer concise and action-oriented.
- End with your recommendation or next step for the user.`;
  }

  if (round <= 1 || peerSummaries.length === 0) {
    return `${userInput}

[Discussion Protocol]
Respond independently as ${participantName}. Do not assume the other assistants agree with you.`;
  }

  const peerContext = peerSummaries
    .map((summary) => `- ${summary.participantName}: ${summary.content.trim()}`)
    .join('\n');

  return `${userInput}

[Round 2 Discussion Context]
You are ${participantName}. Review the other assistants' round 1 responses and then provide your own updated answer.

[Other Assistants]
${peerContext}

[Response Requirements]
- Keep your answer concise and decision-oriented.
- Call out disagreements only when they materially affect the recommendation.
- End with your final recommendation for the user.`;
};
