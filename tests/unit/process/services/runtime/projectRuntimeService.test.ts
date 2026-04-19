import { describe, expect, it, vi } from 'vitest';
import { ProjectRuntimeService } from '@process/services/runtime/ProjectRuntimeService';
import type { ProjectRuntimeBackend, ProjectRuntimePolicy } from '@/common/types/projectRuntime';

const buildPolicy = (overrides: Partial<ProjectRuntimePolicy> = {}): ProjectRuntimePolicy => ({
  version: 1,
  mode: 'auto',
  resolvedSource: 'model_center',
  providerProtocol: 'openai',
  baseUrl: null,
  apiKeyRef: null,
  defaultModel: null,
  importedFrom: null,
  lastImportedAt: null,
  ...overrides,
});

describe('ProjectRuntimeService', () => {
  it('returns project-managed model center state without reading global runtime files', async () => {
    const readPolicy = vi.fn(
      async (): Promise<ProjectRuntimePolicy> =>
        buildPolicy({
          mode: 'project_managed',
          baseUrl: 'https://model-center.internal/v1',
          apiKeyRef: 'project-secret:runtime-primary',
          defaultModel: 'gpt-5.4',
        })
    );
    const service = new ProjectRuntimeService({
      readPolicy,
      writePolicy: vi.fn(),
    });

    const resolved = await service.resolve('/workspace/app');

    expect(readPolicy).toHaveBeenCalledWith('/workspace/app');
    expect(resolved.policy.mode).toBe('project_managed');
    expect(resolved.effectiveSource).toBe('model_center');
    expect(resolved.runtimeRoot).toBe('/workspace/app/.contextgo');
    expect(resolved.runtimeEnv).toMatchObject({
      HOME: '/workspace/app/.contextgo',
      XDG_CONFIG_HOME: '/workspace/app/.contextgo',
      XDG_DATA_HOME: '/workspace/app/.contextgo',
    });
    expect(resolved.runtimeEnv.CODEX_API_KEY).toBeUndefined();
  });

  it('resolves auto mode to a project-owned imported runtime when the current backend has an override', async () => {
    const hasBackendOverride = vi.fn(async () => true);
    const ensureBackendProjection = vi.fn(async () => {});
    const service = new ProjectRuntimeService({
      readPolicy: async (): Promise<ProjectRuntimePolicy> =>
        buildPolicy({
          importedFrom: { codex: '~/.codex/config.toml' },
        }),
      writePolicy: vi.fn(),
      ensureBackendProjection,
      hasBackendOverride,
    });

    const resolved = await service.resolve('/workspace/app', {
      backend: 'codex',
    });

    expect(hasBackendOverride).toHaveBeenCalledWith('/workspace/app', 'codex');
    expect(ensureBackendProjection).toHaveBeenCalledWith('/workspace/app', 'codex');
    expect(resolved.effectiveSource).toBe('imported_local_runtime');
    expect(resolved.runtimeRoot).toBe('/workspace/app/.contextgo');
    expect(resolved.policy.importedFrom).toEqual({ codex: '~/.codex/config.toml' });
  });

  it('falls back to project-managed model-center state when no project-owned override exists for the backend', async () => {
    const hasBackendOverride = vi.fn(async () => false);
    const importLocalRuntime = vi.fn(async () => ({
      imported: false,
      importedFrom: null,
      lastImportedAt: null,
    }));
    const writePolicy = vi.fn();
    const service = new ProjectRuntimeService({
      readPolicy: async (): Promise<ProjectRuntimePolicy> => buildPolicy(),
      writePolicy,
      importLocalRuntime,
      hasBackendOverride,
    });

    const resolved = await service.resolve('/workspace/app', {
      backend: 'codex',
    });

    expect(hasBackendOverride).toHaveBeenCalledWith('/workspace/app', 'codex');
    expect(importLocalRuntime).toHaveBeenCalledWith('/workspace/app', expect.any(Object), 'codex');
    expect(resolved.effectiveSource).toBe('model_center');
    expect(resolved.policy.resolvedSource).toBe('model_center');
    expect(resolved.runtimeRoot).toBe('/workspace/app/.contextgo');
    expect(resolved.runtimeEnv.HOME).toBe('/workspace/app/.contextgo');
  });

  it('creates a default auto policy when the project has no runtime policy yet', async () => {
    const writePolicy = vi.fn();
    const service = new ProjectRuntimeService({
      readPolicy: async () => null,
      writePolicy,
    });

    const resolved = await service.resolve('/workspace/app');

    expect(writePolicy).toHaveBeenCalledWith(
      '/workspace/app',
      expect.objectContaining({
        version: 1,
        mode: 'auto',
        resolvedSource: 'model_center',
        providerProtocol: 'openai',
      })
    );
    expect(resolved.policy.mode).toBe('auto');
    expect(resolved.effectiveSource).toBe('model_center');
  });

  it('resolves runtime state in read-only mode without persisting a default policy or mutating runtime state', async () => {
    const writePolicy = vi.fn();
    const hasBackendOverride = vi.fn(async () => false);
    const service = new ProjectRuntimeService({
      readPolicy: async () => null,
      writePolicy,
      hasBackendOverride,
    });

    const resolved = await service.resolve('/workspace/app', {
      backend: 'codex',
      persistDefaultPolicy: false,
    });

    expect(writePolicy).not.toHaveBeenCalled();
    expect(hasBackendOverride).toHaveBeenCalledWith('/workspace/app', 'codex');
    expect(resolved.policy.mode).toBe('auto');
    expect(resolved.effectiveSource).toBe('model_center');
    expect(resolved.runtimeRoot).toBe('/workspace/app/.contextgo');
    expect(resolved.runtimeEnv.HOME).toBe('/workspace/app/.contextgo');
  });

  it('imports the current global runtime without dropping other backend metadata', async () => {
    const writePolicy = vi.fn();
    const importLocalRuntimeForBackend = vi.fn(async (_workspace: string, backend: ProjectRuntimeBackend) => ({
      imported: true,
      importedFrom: { [backend]: '~/.codex/config.toml' },
      lastImportedAt: '2026-04-18T10:00:00.000Z',
    }));
    const service = new ProjectRuntimeService({
      readPolicy: async (): Promise<ProjectRuntimePolicy> =>
        buildPolicy({
          importedFrom: {
            claude: '~/.claude/settings.json',
          },
        }),
      writePolicy,
      importLocalRuntimeForBackend,
      hasBackendOverride: vi.fn(async () => true),
    });

    const result = await service.importCurrentGlobalRuntime('/workspace/app', 'codex');

    expect(importLocalRuntimeForBackend).toHaveBeenCalledWith('/workspace/app', 'codex');
    expect(result.policy.mode).toBe('import_local_runtime');
    expect(result.policy.resolvedSource).toBe('imported_local_runtime');
    expect(result.policy.importedFrom).toEqual({
      claude: '~/.claude/settings.json',
      codex: '~/.codex/config.toml',
    });
    expect(result.runtimeRoot).toBe('/workspace/app/.contextgo');
    expect(writePolicy).toHaveBeenCalledWith(
      '/workspace/app',
      expect.objectContaining({
        mode: 'import_local_runtime',
        importedFrom: {
          claude: '~/.claude/settings.json',
          codex: '~/.codex/config.toml',
        },
      })
    );
  });

  it('keeps other imported backends active when resetting a single backend override', async () => {
    let currentPolicy: ProjectRuntimePolicy = buildPolicy({
      mode: 'import_local_runtime',
      resolvedSource: 'imported_local_runtime',
      importedFrom: {
        codex: '~/.codex/config.toml',
        claude: '~/.claude/settings.json',
      },
      lastImportedAt: '2026-04-18T10:00:00.000Z',
    });
    const writePolicy = vi.fn(async (_workspace: string, policy: ProjectRuntimePolicy) => {
      currentPolicy = policy;
    });
    const clearBackendOverride = vi.fn(async () => {});
    const ensureBackendProjection = vi.fn(async () => {});
    const service = new ProjectRuntimeService({
      readPolicy: async (): Promise<ProjectRuntimePolicy> => currentPolicy,
      writePolicy,
      clearBackendOverride,
      ensureBackendProjection,
      hasBackendOverride: vi.fn(async (_workspace, backend) => backend === 'claude'),
    });

    await service.resetProjectRuntimeOverride('/workspace/app', 'codex');
    const resolvedClaude = await service.resolve('/workspace/app', {
      backend: 'claude',
    });

    expect(clearBackendOverride).toHaveBeenCalledWith('/workspace/app', 'codex');
    expect(currentPolicy.mode).toBe('import_local_runtime');
    expect(currentPolicy.importedFrom).toEqual({
      claude: '~/.claude/settings.json',
    });
    expect(resolvedClaude.effectiveSource).toBe('imported_local_runtime');
    expect(resolvedClaude.policy.importedFrom).toEqual({
      claude: '~/.claude/settings.json',
    });
    expect(ensureBackendProjection).toHaveBeenCalledWith('/workspace/app', 'claude');
    expect(resolvedClaude.runtimeRoot).toBe('/workspace/app/.contextgo');
    expect(writePolicy).toHaveBeenCalledWith(
      '/workspace/app',
      expect.objectContaining({
        mode: 'import_local_runtime',
        importedFrom: {
          claude: '~/.claude/settings.json',
        },
      })
    );
  });

  it('returns to project-managed mode when the last imported backend override is reset', async () => {
    const writePolicy = vi.fn();
    const clearBackendOverride = vi.fn(async () => {});
    const service = new ProjectRuntimeService({
      readPolicy: async (): Promise<ProjectRuntimePolicy> =>
        buildPolicy({
          mode: 'import_local_runtime',
          resolvedSource: 'imported_local_runtime',
          importedFrom: {
            codex: '~/.codex/config.toml',
          },
          lastImportedAt: '2026-04-18T10:00:00.000Z',
        }),
      writePolicy,
      clearBackendOverride,
      hasBackendOverride: vi.fn(async () => false),
    });

    const result = await service.resetProjectRuntimeOverride('/workspace/app', 'codex');

    expect(clearBackendOverride).toHaveBeenCalledWith('/workspace/app', 'codex');
    expect(result.policy.mode).toBe('project_managed');
    expect(result.effectiveSource).toBe('model_center');
    expect(result.policy.importedFrom).toBeNull();
    expect(result.policy.lastImportedAt).toBeNull();
    expect(writePolicy).toHaveBeenCalledWith(
      '/workspace/app',
      expect.objectContaining({
        mode: 'project_managed',
        importedFrom: null,
        lastImportedAt: null,
      })
    );
  });

  it('clears all runtime projections when saving project-managed policy state', async () => {
    const writePolicy = vi.fn();
    const clearBackendOverride = vi.fn(async () => {});
    const service = new ProjectRuntimeService({
      readPolicy: async (): Promise<ProjectRuntimePolicy> =>
        buildPolicy({
          mode: 'import_local_runtime',
          resolvedSource: 'imported_local_runtime',
          importedFrom: {
            codex: '~/.codex/config.toml',
          },
          lastImportedAt: '2026-04-18T10:00:00.000Z',
        }),
      writePolicy,
      clearBackendOverride,
      hasBackendOverride: vi.fn(async () => false),
    });

    const result = await (
      service as unknown as {
        saveProjectRuntimePolicy: (
          workspace: string,
          policy: ProjectRuntimePolicy
        ) => Promise<{
          policy: ProjectRuntimePolicy;
          effectiveSource: 'model_center' | 'imported_local_runtime';
          runtimeRoot: string;
        }>;
      }
    ).saveProjectRuntimePolicy(
      '/workspace/app',
      buildPolicy({
        mode: 'project_managed',
        resolvedSource: 'imported_local_runtime',
        importedFrom: {
          codex: '~/.codex/config.toml',
        },
        lastImportedAt: '2026-04-18T10:00:00.000Z',
      })
    );

    expect(clearBackendOverride).toHaveBeenCalledTimes(4);
    expect(clearBackendOverride).toHaveBeenCalledWith('/workspace/app', 'gemini');
    expect(clearBackendOverride).toHaveBeenCalledWith('/workspace/app', 'claude');
    expect(clearBackendOverride).toHaveBeenCalledWith('/workspace/app', 'codex');
    expect(clearBackendOverride).toHaveBeenCalledWith('/workspace/app', 'opencode');
    expect(result.policy.mode).toBe('project_managed');
    expect(result.policy.resolvedSource).toBe('model_center');
    expect(result.policy.importedFrom).toBeNull();
    expect(result.policy.lastImportedAt).toBeNull();
    expect(writePolicy).toHaveBeenCalledWith(
      '/workspace/app',
      expect.objectContaining({
        mode: 'project_managed',
        resolvedSource: 'model_center',
        importedFrom: null,
        lastImportedAt: null,
      })
    );
  });
});
