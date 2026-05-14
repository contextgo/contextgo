import { describe, expect, it, vi } from 'vitest';

describe('hostRuntimeModel', () => {
  it('resolves gui-host by default and exposes desktop/mobile/browser clients', async () => {
    const originalArgv = [...process.argv];
    process.argv = originalArgv.filter((value) => value !== '--webui');

    try {
      const { getHostRuntimeSupportedClients, resolveHostRuntimeMode } =
        await import('@/process/services/host/hostRuntimeModel');

      const mode = resolveHostRuntimeMode();
      expect(mode).toBe('gui-host');
      expect(getHostRuntimeSupportedClients(mode)).toEqual(['desktop-client', 'mobile-client', 'browser-client']);
    } finally {
      process.argv = originalArgv;
      vi.resetModules();
    }
  });

  it('resolves headless-host in webui mode and omits desktop-client support', async () => {
    const originalArgv = [...process.argv];
    process.argv = [...originalArgv, '--webui'];

    try {
      const { getHostRuntimeSupportedClients, resolveHostRuntimeMode } =
        await import('@/process/services/host/hostRuntimeModel');

      const mode = resolveHostRuntimeMode();
      expect(mode).toBe('headless-host');
      expect(getHostRuntimeSupportedClients(mode)).toEqual(['mobile-client', 'browser-client']);
    } finally {
      process.argv = originalArgv;
      vi.resetModules();
    }
  });
});
