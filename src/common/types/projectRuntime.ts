/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

export const PROJECT_RUNTIME_MODES = ['project_managed', 'import_local_runtime', 'auto'] as const;
export type ProjectRuntimeMode = (typeof PROJECT_RUNTIME_MODES)[number];

export const PROJECT_RUNTIME_BACKENDS = ['gemini', 'claude', 'codex', 'opencode'] as const;
export type ProjectRuntimeBackend = (typeof PROJECT_RUNTIME_BACKENDS)[number];

export type ProjectRuntimeResolvedSource = 'model_center' | 'imported_local_runtime';
export type ProjectRuntimeProviderProtocol = 'openai' | 'anthropic' | 'gemini';

export type ProjectRuntimePolicy = {
  version: 1;
  mode: ProjectRuntimeMode;
  resolvedSource: ProjectRuntimeResolvedSource;
  providerProtocol: ProjectRuntimeProviderProtocol;
  baseUrl: string | null;
  apiKeyRef: string | null;
  defaultModel: string | null;
  importedFrom: Partial<Record<ProjectRuntimeBackend, string>> | null;
  lastImportedAt: string | null;
};
