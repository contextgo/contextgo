/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ProjectRuntimePolicy, ProjectRuntimeResolvedSource } from '@/common/types/projectRuntime';
import { getProjectRuntimeRoot } from './ProjectRuntimePaths';
import { importProjectLocalRuntime, type RuntimeImportResult } from './runtimeImporters';
import { readProjectRuntimePolicy, writeProjectRuntimePolicy } from './runtimePolicyStore';
import { getProjectRuntimeEnv } from '@process/utils/shellEnv';

export type ResolvedProjectRuntime = {
  policy: ProjectRuntimePolicy;
  effectiveSource: ProjectRuntimeResolvedSource;
  runtimeRoot: string;
  runtimeEnv: Record<string, string>;
};

const buildDefaultProjectRuntimePolicy = (): ProjectRuntimePolicy => ({
  version: 1,
  mode: 'auto',
  resolvedSource: 'model_center',
  providerProtocol: 'openai',
  baseUrl: null,
  apiKeyRef: null,
  defaultModel: null,
  importedFrom: null,
  lastImportedAt: null,
});

type ProjectRuntimeServiceDeps = {
  readPolicy?: (workspace: string) => Promise<ProjectRuntimePolicy | null>;
  writePolicy?: (workspace: string, policy: ProjectRuntimePolicy) => Promise<void>;
  importLocalRuntime?: (workspace: string, policy: ProjectRuntimePolicy) => Promise<RuntimeImportResult>;
};

type ResolveProjectRuntimeOptions = {
  persistDefaultPolicy?: boolean;
};

export class ProjectRuntimeService {
  private readonly readPolicy;
  private readonly writePolicy;
  private readonly importLocalRuntime;

  constructor(deps: ProjectRuntimeServiceDeps = {}) {
    this.readPolicy = deps.readPolicy ?? readProjectRuntimePolicy;
    this.writePolicy = deps.writePolicy ?? writeProjectRuntimePolicy;
    this.importLocalRuntime = deps.importLocalRuntime ?? importProjectLocalRuntime;
  }

  async resolve(workspace: string, options: ResolveProjectRuntimeOptions = {}): Promise<ResolvedProjectRuntime> {
    const existingPolicy = await this.readPolicy(workspace);
    const policy = existingPolicy ?? buildDefaultProjectRuntimePolicy();

    const runtimeRoot = getProjectRuntimeRoot(workspace);
    const runtimeEnv = getProjectRuntimeEnv({
      workspace,
      runtimeRoot,
    });
    const shouldPersistPolicy = options.persistDefaultPolicy !== false;

    if (!existingPolicy && shouldPersistPolicy) {
      await this.writePolicy(workspace, policy);
    }

    if (policy.mode === 'project_managed') {
      return {
        policy,
        effectiveSource: 'model_center',
        runtimeRoot,
        runtimeEnv,
      };
    }

    if (policy.mode === 'import_local_runtime' || policy.mode === 'auto') {
      const imported = (await this.importLocalRuntime(workspace, policy)) ?? {
        imported: false,
        importedFrom: null,
        lastImportedAt: null,
      };
      const nextPolicy: ProjectRuntimePolicy = {
        ...policy,
        resolvedSource: imported.imported ? 'imported_local_runtime' : 'model_center',
        importedFrom: imported.importedFrom,
        lastImportedAt: imported.lastImportedAt,
      };

      if (shouldPersistPolicy) {
        await this.writePolicy(workspace, nextPolicy);
      }

      return {
        policy: nextPolicy,
        effectiveSource: nextPolicy.resolvedSource,
        runtimeRoot,
        runtimeEnv,
      };
    }

    return {
      policy,
      effectiveSource: policy.resolvedSource,
      runtimeRoot,
      runtimeEnv,
    };
  }
}
