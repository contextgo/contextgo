/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

export type ExternalSessionProvider = 'claude' | 'codex' | 'gemini' | 'opencode';

/**
 * Product-visible external session providers.
 */
export type ProductVisibleExternalSessionProvider = 'claude' | 'codex' | 'gemini' | 'opencode';

export type ExternalSessionSummary = {
  provider: ExternalSessionProvider;
  sessionId: string;
  title: string;
  workspace: string;
  updatedAt: number;
  origin?: string;
  modelProvider?: string;
  model?: string;
  reasoningEffort?: string;
};

export type ImportExternalSessionParams = {
  provider: ExternalSessionProvider;
  sessionId: string;
};
