/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

export const HARNESS_DEFAULT_PRESET_ASSISTANT_IDS = [
  'builtin-engineering-planner',
  'builtin-engineering-workbench',
  'builtin-engineering-reviewer',
] as const;

export type HarnessSelectableParticipant = {
  type: 'preset-assistant' | 'cli-agent';
  participantKey: string;
  selectionKey: string;
};

export const resolveHarnessDefaultSelectionKeys = (participants: HarnessSelectableParticipant[]): string[] => {
  const preferredSelectionKeys = HARNESS_DEFAULT_PRESET_ASSISTANT_IDS.map(
    (assistantId) =>
      participants.find(
        (participant) => participant.type === 'preset-assistant' && participant.participantKey === assistantId
      )?.selectionKey
  ).filter((selectionKey): selectionKey is string => Boolean(selectionKey));

  const seen = new Set(preferredSelectionKeys);
  const fallbackSelectionKeys = participants
    .map((participant) => participant.selectionKey)
    .filter((selectionKey) => !seen.has(selectionKey));

  return [...preferredSelectionKeys, ...fallbackSelectionKeys].slice(0, 3);
};
