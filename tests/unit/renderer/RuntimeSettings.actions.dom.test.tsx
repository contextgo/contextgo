import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  checkAgentHealthInvokeMock,
  cloudGetStatusInvokeMock,
  cloudStartLoginInvokeMock,
  configureManagedRuntimeModelInvokeMock,
  cleanupRuntimeSettingsTest,
  emitManagedRuntimeInstallEvent,
  flushPromises,
  getLocalTokenUsageInvokeMock,
  installManagedRuntimeInvokeMock,
  listManagedRuntimeTokenGroupsInvokeMock,
  renderRuntimeSettings,
  resetRuntimeSettingsMocks,
  revealPathInvokeMock,
  syncManagedRuntimeModelProviderInvokeMock,
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

    await screen.findByText('/opt/codex/bin/codex');
    const codexCard = screen.getByTestId('runtime-card-codex');
    await act(async () => {
      fireEvent.click(within(codexCard).getByRole('button', { name: 'Reveal' }));
      await flushPromises();
    });
    expect(revealPathInvokeMock).toHaveBeenCalledWith('/Users/tester/.codex');
  });

  it('runs a health check for the selected runtime card', async () => {
    renderRuntimeSettings();

    await screen.findByRole('button', { name: 'Check availability' });
    const codexCard = screen.getByTestId('runtime-card-codex');
    await act(async () => {
      fireEvent.click(within(codexCard).getByRole('button', { name: 'Check availability' }));
      await flushPromises();
    });
    expect(checkAgentHealthInvokeMock).toHaveBeenCalledWith({ backend: 'codex' });
  });

  it('configures a runtime model through InferMesh from the runtime card', async () => {
    renderRuntimeSettings();

    await screen.findByText('/opt/codex/bin/codex');
    const codexCard = screen.getByTestId('runtime-card-codex');
    await act(async () => {
      fireEvent.click(within(codexCard).getByRole('button', { name: 'Configure InferMesh' }));
      await flushPromises();
    });
    expect(configureManagedRuntimeModelInvokeMock).not.toHaveBeenCalled();
    await screen.findByRole('dialog');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
      await flushPromises();
    });

    expect(configureManagedRuntimeModelInvokeMock).toHaveBeenCalledWith({
      backend: 'codex',
      provider: 'infermesh',
      model: 'gpt-5.5',
      group: 'openai-codex-0.3x',
    });
  });

  it('shows ContextGo Cloud sign-in state before InferMesh runtime configuration', async () => {
    cloudGetStatusInvokeMock.mockResolvedValue({
      success: true,
      data: {
        authenticated: false,
        browserSessionExpired: false,
        user: null,
        device: null,
        deviceTokenAvailable: false,
        officialRemote: {
          desired: false,
          running: false,
          browserEntryReady: false,
        },
        hostRuntime: {
          authority: 'host-runtime',
          defaultRemoteAccess: 'official-remote',
          exposure: 'loopback',
          lifecycle: 'running',
          mode: 'desktop',
          platform: 'macos',
          running: true,
          supportedClients: ['desktop-client'],
          officialRemoteDesired: false,
          officialRemoteReady: false,
        },
        providers: ['github', 'google'],
        authBaseUrl: 'https://contextgo.test',
        apiBaseUrl: 'https://api.contextgo.test',
      },
    });

    renderRuntimeSettings();

    await screen.findByText('ContextGo Account');
    expect(screen.getByRole('button', { name: 'Continue with GitHub' })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Continue with GitHub' }));
      await flushPromises();
    });

    expect(cloudStartLoginInvokeMock).toHaveBeenCalledWith({ provider: 'github' });
  });

  it('syncs an InferMesh token group before loading runtime models', async () => {
    renderRuntimeSettings();

    await screen.findByText('/opt/codex/bin/codex');
    const codexCard = screen.getByTestId('runtime-card-codex');
    await act(async () => {
      fireEvent.click(within(codexCard).getByRole('button', { name: 'Configure InferMesh' }));
      await flushPromises();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sync token and models' }));
      await flushPromises();
    });

    expect(syncManagedRuntimeModelProviderInvokeMock).toHaveBeenCalledWith({
      provider: 'infermesh',
      group: 'openai-codex-0.3x',
    });
  });

  it('opens the local token usage report from the runtime page', async () => {
    renderRuntimeSettings();

    await screen.findByText('Runtime Management');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Local token usage' }));
      await flushPromises();
    });

    expect(getLocalTokenUsageInvokeMock).toHaveBeenCalledWith({ forceRefresh: false });
    expect(await screen.findByText('Total tokens')).toBeInTheDocument();
    expect(screen.getAllByText('1,700').length).toBeGreaterThan(0);
    expect(screen.getByText('/Users/tester/.codex')).toBeInTheDocument();
    expect(screen.getByText('Unsupported')).toBeInTheDocument();
  });

  it('uses the default InferMesh token group when a new account has no token yet', async () => {
    listManagedRuntimeTokenGroupsInvokeMock.mockResolvedValueOnce({
      success: true,
      data: {
        provider: 'infermesh',
        groups: [],
      },
    });
    renderRuntimeSettings();

    await screen.findByText('/opt/codex/bin/codex');
    const codexCard = screen.getByTestId('runtime-card-codex');
    await act(async () => {
      fireEvent.click(within(codexCard).getByRole('button', { name: 'Configure InferMesh' }));
      await flushPromises();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sync token and models' }));
      await flushPromises();
    });

    expect(syncManagedRuntimeModelProviderInvokeMock).toHaveBeenCalledWith({
      provider: 'infermesh',
      group: 'default',
    });
  });

  it('runs managed install for a missing runtime', async () => {
    renderRuntimeSettings();

    const opencodeCard = await screen.findByTestId('runtime-card-opencode');
    await act(async () => {
      fireEvent.click(within(opencodeCard).getByRole('button', { name: 'Install locally' }));
      await flushPromises();
    });
    expect(installManagedRuntimeInvokeMock).toHaveBeenCalled();
  });

  it('renders install progress logs from managed runtime events', async () => {
    renderRuntimeSettings();

    const opencodeCard = await screen.findByTestId('runtime-card-opencode');
    fireEvent.click(within(opencodeCard).getByRole('button', { name: 'Install locally' }));

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

  it('shows managed install action for gemini', async () => {
    renderRuntimeSettings();

    const geminiCard = await screen.findByTestId('runtime-card-gemini');
    expect(within(geminiCard).getByRole('button', { name: 'Install locally' })).toBeInTheDocument();
    expect(within(geminiCard).getByRole('button', { name: 'Official page' })).toBeInTheDocument();
  });
});
