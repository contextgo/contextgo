import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  checkAgentHealthInvokeMock,
  cleanupRuntimeSettingsTest,
  emitManagedRuntimeInstallEvent,
  flushPromises,
  installManagedRuntimeInvokeMock,
  renderRuntimeSettings,
  resetRuntimeSettingsMocks,
  revealPathInvokeMock,
} from './runtimeSettingsTestHarness';

describe('Runtime Settings actions', () => {
  beforeEach(() => {
    resetRuntimeSettingsMocks();
  });

  afterEach(async () => {
    await cleanupRuntimeSettingsTest();
  });

  it('reveals the runtime config path in the system file manager', async () => {
    renderRuntimeSettings();

    await screen.findByText('Runtime Management');
    await act(async () => {
      fireEvent.click(within(screen.getByTestId('runtime-card-codex')).getByRole('button', { name: 'Reveal' }));
      await flushPromises();
    });
    expect(revealPathInvokeMock).toHaveBeenCalledWith('/Users/tester/.codex');
  });

  it('runs a health check for the selected runtime card', async () => {
    renderRuntimeSettings();

    await screen.findByText('Runtime Management');
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Check availability' })[0]);
      await flushPromises();
    });
    expect(checkAgentHealthInvokeMock).toHaveBeenCalledWith({ backend: 'codex' });
  });

  it('runs managed install for a missing runtime', async () => {
    renderRuntimeSettings();

    await screen.findByText('Runtime Management');
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Install locally' })[0]);
      await flushPromises();
    });
    expect(installManagedRuntimeInvokeMock).toHaveBeenCalled();
  });

  it('renders install progress logs from managed runtime events', async () => {
    renderRuntimeSettings();

    await screen.findByText('Runtime Management');
    fireEvent.click(screen.getAllByRole('button', { name: 'Install locally' })[0]);

    emitManagedRuntimeInstallEvent({
      backend: 'opencode',
      command: 'npm install -g @opencode-ai/cli',
      stage: 'running',
      chunk: 'downloading package\n',
    });

    emitManagedRuntimeInstallEvent({
      backend: 'opencode',
      command: 'npm install -g @opencode-ai/cli',
      stage: 'refreshing',
      message: 'Refreshing runtime detection for opencode',
    });

    await screen.findByText('Install progress');
    expect(screen.getByText('Refreshing runtime detection for opencode')).toBeInTheDocument();
    expect(screen.getByText(/downloading package/i)).toBeInTheDocument();
  });

  it('does not show install action for unmanaged runtimes', async () => {
    renderRuntimeSettings();

    await screen.findByText('Runtime Management');

    const geminiCard = screen.getByTestId('runtime-card-gemini');
    expect(within(geminiCard).queryByRole('button', { name: 'Install locally' })).not.toBeInTheDocument();
    expect(within(geminiCard).getByRole('button', { name: 'Official page' })).toBeInTheDocument();
  });
});
