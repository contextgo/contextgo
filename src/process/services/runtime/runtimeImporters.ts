/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ProjectRuntimePolicy } from '@/common/types/projectRuntime';

export type RuntimeImportResult = {
  imported: boolean;
  importedFrom: ProjectRuntimePolicy['importedFrom'];
  lastImportedAt: string | null;
};

export async function importProjectLocalRuntime(
  workspace: string,
  policy: ProjectRuntimePolicy
): Promise<RuntimeImportResult> {
  void workspace;
  void policy;

  return {
    imported: false,
    importedFrom: null,
    lastImportedAt: null,
  };
}
