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
import { PROJECT_RUNTIME_BACKENDS } from '@/common/types/projectRuntime';
import { getProjectRuntimeRoot } from './ProjectRuntimePaths';
import {
  clearProjectRuntimeOverride,
  ensureProjectRuntimeProjectionForBackend,
  hasProjectRuntimeOverride,
  importProjectLocalRuntime,
  importProjectLocalRuntimeForBackend,
  type RuntimeImportResult,
} from './runtimeImporters';
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
  importLocalRuntime?: (
    workspace: string,
    policy: ProjectRuntimePolicy,
    backend?: ProjectRuntimeBackend
  ) => Promise<RuntimeImportResult>;
  importLocalRuntimeForBackend?: (workspace: string, backend: ProjectRuntimeBackend) => Promise<RuntimeImportResult>;
  ensureBackendProjection?: (workspace: string, backend: ProjectRuntimeBackend) => Promise<void>;
  clearBackendOverride?: (workspace: string, backend: ProjectRuntimeBackend) => Promise<void>;
  hasBackendOverride?: (workspace: string, backend: ProjectRuntimeBackend) => Promise<boolean>;
};

type ResolveProjectRuntimeOptions = {
  persistDefaultPolicy?: boolean;
  allowMutations?: boolean;
  backend?: ProjectRuntimeBackend;
};

export class ProjectRuntimeService {
  private readonly readPolicy;
  private readonly writePolicy;
  private readonly importLocalRuntime;
  private readonly importLocalRuntimeForBackend;
  private readonly ensureBackendProjection;
  private readonly clearBackendOverride;
  private readonly hasBackendOverride;

  constructor(deps: ProjectRuntimeServiceDeps = {}) {
    this.readPolicy = deps.readPolicy ?? readProjectRuntimePolicy;
    this.writePolicy = deps.writePolicy ?? writeProjectRuntimePolicy;
    this.importLocalRuntime = deps.importLocalRuntime ?? importProjectLocalRuntime;
    this.importLocalRuntimeForBackend = deps.importLocalRuntimeForBackend ?? importProjectLocalRuntimeForBackend;
    this.ensureBackendProjection = deps.ensureBackendProjection ?? ensureProjectRuntimeProjectionForBackend;
    this.clearBackendOverride = deps.clearBackendOverride ?? clearProjectRuntimeOverride;
    this.hasBackendOverride = deps.hasBackendOverride ?? hasProjectRuntimeOverride;
  }

  private buildResolvedRuntime(
    workspace: string,
    policy: ProjectRuntimePolicy,
    importedRuntime?: Pick<RuntimeImportResult, 'injectedEnv'>
  ): ResolvedProjectRuntime {
    const runtimeRoot = getProjectRuntimeRoot(workspace);

    return {
      policy,
      effectiveSource: policy.resolvedSource,
      runtimeRoot,
      runtimeEnv: getProjectRuntimeEnv({
        workspace,
        runtimeRoot,
        injectedEnv: importedRuntime?.injectedEnv,
      }),
    };
  }

  private mergeImportedFrom(
    current: ProjectRuntimePolicy['importedFrom'],
    next: ProjectRuntimePolicy['importedFrom']
  ): ProjectRuntimePolicy['importedFrom'] {
    if (!next) {
      return current;
    }

    return Object.assign({}, current, next);
  }

  private removeImportedBackend(
    current: ProjectRuntimePolicy['importedFrom'],
    backend: ProjectRuntimeBackend
  ): ProjectRuntimePolicy['importedFrom'] {
    if (!current) {
      return null;
    }

    const next = { ...current };
    delete next[backend];
    return Object.keys(next).length > 0 ? next : null;
  }

  async resolve(workspace: string, options: ResolveProjectRuntimeOptions = {}): Promise<ResolvedProjectRuntime> {
    const existingPolicy = await this.readPolicy(workspace);
    const policy = existingPolicy ?? buildDefaultProjectRuntimePolicy();
    const shouldAllowMutations = options.allowMutations !== false && options.persistDefaultPolicy !== false;

    if (policy.mode === 'project_managed') {
      const nextPolicy: ProjectRuntimePolicy =
        existingPolicy?.resolvedSource === 'model_center' ? policy : { ...policy, resolvedSource: 'model_center' };

      if ((!existingPolicy || nextPolicy !== policy) && options.persistDefaultPolicy !== false) {
        await this.writePolicy(workspace, nextPolicy);
      }

      return this.buildResolvedRuntime(workspace, nextPolicy);
    }

    let importedRuntime: RuntimeImportResult | null = null;
    const backend = options.backend;

    if (backend && (await this.hasBackendOverride(workspace, backend))) {
      if (shouldAllowMutations) {
        await this.ensureBackendProjection(workspace, backend);
      }
      importedRuntime = {
        imported: true,
        importedFrom: policy.importedFrom,
        lastImportedAt: policy.lastImportedAt,
      };
    } else if (backend && shouldAllowMutations) {
      importedRuntime = await this.importLocalRuntime(workspace, policy, backend);
    }

    const nextPolicy: ProjectRuntimePolicy = (() => {
      if (importedRuntime?.imported) {
        return {
          ...policy,
          resolvedSource: 'imported_local_runtime',
          importedFrom: this.mergeImportedFrom(policy.importedFrom, importedRuntime.importedFrom),
          lastImportedAt: importedRuntime.lastImportedAt ?? policy.lastImportedAt,
        };
      }

      if (backend) {
        const importedFrom = this.removeImportedBackend(policy.importedFrom, backend);
        return {
          ...policy,
          resolvedSource: 'model_center',
          importedFrom,
          lastImportedAt: importedFrom === null ? null : policy.lastImportedAt,
        };
      }

      return {
        ...policy,
        resolvedSource: 'model_center',
      };
    })();

    const shouldPersistPolicy =
      shouldAllowMutations &&
      (!existingPolicy ||
        existingPolicy.resolvedSource !== nextPolicy.resolvedSource ||
        JSON.stringify(existingPolicy.importedFrom) !== JSON.stringify(nextPolicy.importedFrom) ||
        existingPolicy.lastImportedAt !== nextPolicy.lastImportedAt);

    if (shouldPersistPolicy) {
      await this.writePolicy(workspace, nextPolicy);
    }

    return this.buildResolvedRuntime(workspace, nextPolicy, importedRuntime ?? undefined);
  }

  async importCurrentGlobalRuntime(workspace: string, backend: ProjectRuntimeBackend): Promise<ResolvedProjectRuntime> {
    const policy = (await this.readPolicy(workspace)) ?? buildDefaultProjectRuntimePolicy();
    const importedRuntime = await this.importLocalRuntimeForBackend(workspace, backend);

    if (!importedRuntime.imported) {
      throw new Error(`No local ${backend} runtime config is available to import.`);
    }

    const nextPolicy: ProjectRuntimePolicy = {
      ...policy,
      mode: 'import_local_runtime',
      resolvedSource: 'imported_local_runtime',
      importedFrom: this.mergeImportedFrom(policy.importedFrom, importedRuntime.importedFrom),
      lastImportedAt: importedRuntime.lastImportedAt ?? policy.lastImportedAt,
    };

    await this.writePolicy(workspace, nextPolicy);

    return this.buildResolvedRuntime(workspace, nextPolicy, importedRuntime);
  }

  async resetProjectRuntimeOverride(
    workspace: string,
    backend: ProjectRuntimeBackend
  ): Promise<ResolvedProjectRuntime> {
    const policy = (await this.readPolicy(workspace)) ?? buildDefaultProjectRuntimePolicy();
    const importedFrom = this.removeImportedBackend(policy.importedFrom, backend);

    await this.clearBackendOverride(workspace, backend);

    const nextPolicy: ProjectRuntimePolicy = {
      ...policy,
      mode: importedFrom ? 'import_local_runtime' : 'project_managed',
      resolvedSource: 'model_center',
      importedFrom,
      lastImportedAt: importedFrom ? policy.lastImportedAt : null,
    };

    await this.writePolicy(workspace, nextPolicy);

    return this.buildResolvedRuntime(workspace, nextPolicy);
  }

  async saveProjectRuntimePolicy(workspace: string, policy: ProjectRuntimePolicy): Promise<ResolvedProjectRuntime> {
    const nextPolicy: ProjectRuntimePolicy =
      policy.mode === 'project_managed'
        ? {
            ...policy,
            resolvedSource: 'model_center',
            importedFrom: null,
            lastImportedAt: null,
          }
        : {
            ...policy,
            resolvedSource: policy.importedFrom ? policy.resolvedSource : 'model_center',
          };

    if (nextPolicy.mode === 'project_managed') {
      await Promise.all(PROJECT_RUNTIME_BACKENDS.map((backend) => this.clearBackendOverride(workspace, backend)));
    }

    await this.writePolicy(workspace, nextPolicy);

    return this.buildResolvedRuntime(workspace, nextPolicy);
  }
}
