/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The top pill bar reflects the selected runtime only.
 */
export const resolveDisplayedAgentPillKey = ({
  selectedAgentKey,
}: {
  selectedAgentKey: string;
  isPresetAgent?: boolean;
  currentEffectiveAgentInfo?: unknown;
}): string => {
  return selectedAgentKey;
};
