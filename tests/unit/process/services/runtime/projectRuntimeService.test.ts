import { describe, expect, it, vi } from 'vitest';
import { ProjectRuntimeService } from '@process/services/runtime/ProjectRuntimeService';
import type { ProjectRuntimePolicy } from '@/common/types/projectRuntime';

describe('ProjectRuntimeService', () => {
  it('returns project-managed model center state without reading global runtime files', async () => {
    const readPolicy = vi.fn(
      async (): Promise<ProjectRuntimePolicy> => ({
        version: 1,
        mode: 'project_managed',
        resolvedSource: 'model_center',
        providerProtocol: 'openai',
        baseUrl: 'https://model-center.internal/v1',
        apiKeyRef: 'project-secret:runtime-primary',
        defaultModel: 'gpt-5.4',
        importedFrom: null,
        lastImportedAt: null,
      })
    );
    const importLocalRuntime = vi.fn();
    const service = new ProjectRuntimeService({
      readPolicy,
      writePolicy: vi.fn(),
      importLocalRuntime,
    });

    const resolved = await service.resolve('/workspace/app');

    expect(readPolicy).toHaveBeenCalledWith('/workspace/app');
    expect(importLocalRuntime).not.toHaveBeenCalled();
    expect(resolved.policy.mode).toBe('project_managed');
    expect(resolved.effectiveSource).toBe('model_center');
    expect(resolved.runtimeRoot).toBe('/workspace/app/.contextgo');
    expect(resolved.runtimeEnv).toMatchObject({
      HOME: '/workspace/app/.contextgo',
      XDG_CONFIG_HOME: '/workspace/app/.contextgo',
      XDG_DATA_HOME: '/workspace/app/.contextgo',
    });
  });

  it('imports local runtime config when mode is import_local_runtime', async () => {
    const importLocalRuntime = vi.fn(async () => ({
      imported: true,
      importedFrom: { codex: '~/.codex/config.toml' },
      lastImportedAt: '2026-04-17T10:00:00.000Z',
    }));
    const writePolicy = vi.fn();
    const service = new ProjectRuntimeService({
      readPolicy: async (): Promise<ProjectRuntimePolicy> => ({
        version: 1,
        mode: 'import_local_runtime',
        resolvedSource: 'imported_local_runtime',
        providerProtocol: 'openai',
        baseUrl: null,
        apiKeyRef: null,
        defaultModel: 'gpt-5.4',
        importedFrom: null,
        lastImportedAt: null,
      }),
      writePolicy,
      importLocalRuntime,
    });

    const resolved = await service.resolve('/workspace/app');

    expect(importLocalRuntime).toHaveBeenCalledWith('/workspace/app', expect.any(Object));
    expect(writePolicy).toHaveBeenCalledTimes(1);
    expect(resolved.effectiveSource).toBe('imported_local_runtime');
    expect(resolved.policy.importedFrom).toEqual({ codex: '~/.codex/config.toml' });
  });

  it('falls back to model center when auto mode cannot import local runtime', async () => {
    const importLocalRuntime = vi.fn(async () => ({
      imported: false,
      importedFrom: null,
      lastImportedAt: null,
    }));
    const writePolicy = vi.fn();
    const service = new ProjectRuntimeService({
      readPolicy: async (): Promise<ProjectRuntimePolicy> => ({
        version: 1,
        mode: 'auto',
        resolvedSource: 'model_center',
        providerProtocol: 'openai',
        baseUrl: 'https://model-center.internal/v1',
        apiKeyRef: 'project-secret:runtime-primary',
        defaultModel: 'gpt-5.4',
        importedFrom: null,
        lastImportedAt: null,
      }),
      writePolicy,
      importLocalRuntime,
    });

    const resolved = await service.resolve('/workspace/app');

    expect(importLocalRuntime).toHaveBeenCalledWith('/workspace/app', expect.any(Object));
    expect(writePolicy).toHaveBeenCalledTimes(1);
    expect(resolved.effectiveSource).toBe('model_center');
    expect(resolved.policy.resolvedSource).toBe('model_center');
  });

  it('creates a default auto policy when the project has no runtime policy yet', async () => {
    const writePolicy = vi.fn();
    const service = new ProjectRuntimeService({
      readPolicy: async () => null,
      writePolicy,
      importLocalRuntime: vi.fn(),
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

  it('resolves runtime state in read-only mode without persisting a default policy', async () => {
    const writePolicy = vi.fn();
    const service = new ProjectRuntimeService({
      readPolicy: async () => null,
      writePolicy,
      importLocalRuntime: vi.fn(),
    });

    const resolved = await service.resolve('/workspace/app', {
      persistDefaultPolicy: false,
    });

    expect(writePolicy).not.toHaveBeenCalled();
    expect(resolved.policy.mode).toBe('auto');
    expect(resolved.runtimeRoot).toBe('/workspace/app/.contextgo');
    expect(resolved.runtimeEnv.HOME).toBe('/workspace/app/.contextgo');
  });
});
