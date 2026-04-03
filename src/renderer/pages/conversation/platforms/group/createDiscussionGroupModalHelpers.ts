/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

export const HARNESS_DEFAULT_PRESET_ASSISTANT_IDS = [
  'builtin-workflow-planner',
  'builtin-workflow-writer',
  'builtin-workflow-evaluator',
] as const;

export type HarnessSelectableParticipant = {
  type: 'preset-assistant' | 'cli-agent';
  participantKey: string;
  selectionKey: string;
};

const resolveHarnessPreferredSelectionKeys = (participants: HarnessSelectableParticipant[]): string[] => {
  return HARNESS_DEFAULT_PRESET_ASSISTANT_IDS.map(
    (assistantId) =>
      participants.find(
        (participant) => participant.type === 'preset-assistant' && participant.participantKey === assistantId
      )?.selectionKey
  ).filter((selectionKey): selectionKey is string => Boolean(selectionKey));
};

export const orderHarnessSelectableParticipants = <T extends HarnessSelectableParticipant>(participants: T[]): T[] => {
  const preferredSelectionKeys = resolveHarnessPreferredSelectionKeys(participants);
  const participantBySelectionKey = new Map(participants.map((participant) => [participant.selectionKey, participant]));
  const preferredParticipants = preferredSelectionKeys
    .map((selectionKey) => participantBySelectionKey.get(selectionKey))
    .filter((participant): participant is T => Boolean(participant));

  const seen = new Set(preferredSelectionKeys);
  const fallbackParticipants = participants.filter((participant) => !seen.has(participant.selectionKey));

  return [...preferredParticipants, ...fallbackParticipants];
};

export const resolveHarnessDefaultSelectionKeys = (
  participants: HarnessSelectableParticipant[],
  count = 3
): string[] => {
  return orderHarnessSelectableParticipants(participants)
    .slice(0, count)
    .map((participant) => participant.selectionKey);
};
