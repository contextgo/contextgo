/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ProjectRuntimeBackend,
  ProjectRuntimePolicy,
  ProjectRuntimeResolvedSource,
} from '@/common/types/projectRuntime';
import { getProjectRuntimeRoot } from './ProjectRuntimePaths';
import {
  clearProjectRuntimeOverride,
  importProjectLocalRuntime,
  importProjectLocalRuntimeForBackend,
  type RuntimeImportResult,
} from './runtimeImporters';
import { readProjectRuntimePolicy, writeProjectRuntimePolicy } from './runtimePolicyStore';

export type ResolvedProjectRuntime = {
  policy: ProjectRuntimePolicy;
  effectiveSource: ProjectRuntimeResolvedSource;
  runtimeRoot: string;
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
  importLocalRuntimeForBackend?: (workspace: string, backend: ProjectRuntimeBackend) => Promise<RuntimeImportResult>;
  clearBackendOverride?: (workspace: string, backend: ProjectRuntimeBackend) => Promise<void>;
};

export class ProjectRuntimeService {
  private readonly readPolicy;
  private readonly writePolicy;
  private readonly importLocalRuntime;
  private readonly importLocalRuntimeForBackend;
  private readonly clearBackendOverride;

  constructor(deps: ProjectRuntimeServiceDeps = {}) {
    this.readPolicy = deps.readPolicy ?? readProjectRuntimePolicy;
    this.writePolicy = deps.writePolicy ?? writeProjectRuntimePolicy;
    this.importLocalRuntime = deps.importLocalRuntime ?? importProjectLocalRuntime;
    this.importLocalRuntimeForBackend = deps.importLocalRuntimeForBackend ?? importProjectLocalRuntimeForBackend;
    this.clearBackendOverride = deps.clearBackendOverride ?? clearProjectRuntimeOverride;
  }

  async resolve(workspace: string): Promise<ResolvedProjectRuntime> {
    const existingPolicy = await this.readPolicy(workspace);
    const policy = existingPolicy ?? buildDefaultProjectRuntimePolicy();

    const runtimeRoot = getProjectRuntimeRoot(workspace);

    if (!existingPolicy) {
      await this.writePolicy(workspace, policy);
    }

    if (policy.mode === 'project_managed') {
      return {
        policy,
        effectiveSource: 'model_center',
        runtimeRoot,
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

      await this.writePolicy(workspace, nextPolicy);

      return {
        policy: nextPolicy,
        effectiveSource: nextPolicy.resolvedSource,
        runtimeRoot,
      };
    }

    return {
      policy,
      effectiveSource: policy.resolvedSource,
      runtimeRoot,
    };
  }

  async importCurrentGlobalRuntime(workspace: string, backend: ProjectRuntimeBackend): Promise<ResolvedProjectRuntime> {
    const policy = (await this.readPolicy(workspace)) ?? buildDefaultProjectRuntimePolicy();
    const runtimeRoot = getProjectRuntimeRoot(workspace);
    const imported = await this.importLocalRuntimeForBackend(workspace, backend);

    if (!imported.imported) {
      return {
        policy,
        effectiveSource: policy.resolvedSource,
        runtimeRoot,
      };
    }

    const nextPolicy: ProjectRuntimePolicy = {
      ...policy,
      mode: 'import_local_runtime',
      resolvedSource: 'imported_local_runtime',
      importedFrom: imported.importedFrom,
      lastImportedAt: imported.lastImportedAt,
    };

    await this.writePolicy(workspace, nextPolicy);

    return {
      policy: nextPolicy,
      effectiveSource: nextPolicy.resolvedSource,
      runtimeRoot,
    };
  }

  async resetProjectRuntimeOverride(
    workspace: string,
    backend: ProjectRuntimeBackend
  ): Promise<ResolvedProjectRuntime> {
    const policy = (await this.readPolicy(workspace)) ?? buildDefaultProjectRuntimePolicy();
    const runtimeRoot = getProjectRuntimeRoot(workspace);

    await this.clearBackendOverride(workspace, backend);

    const nextPolicy: ProjectRuntimePolicy = {
      ...policy,
      mode: 'auto',
      resolvedSource: 'model_center',
      importedFrom: null,
      lastImportedAt: null,
    };

    await this.writePolicy(workspace, nextPolicy);

    return {
      policy: nextPolicy,
      effectiveSource: nextPolicy.resolvedSource,
      runtimeRoot,
    };
  }
}
