import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import {
  cleanupRuntimeSettingsTest,
  renderRuntimeSettings,
  resetRuntimeSettingsMocks,
} from './runtimeSettingsTestHarness';

describe('Runtime Settings overview', () => {
  beforeEach(() => {
    resetRuntimeSettingsMocks();
  });

  afterEach(async () => {
    await cleanupRuntimeSettingsTest();
  });

  it('renders the dedicated runtime entry and shows the simplified runtime management content', async () => {
    renderRuntimeSettings();

    expect(await screen.findByText('Runtime Management')).toBeInTheDocument();
    expect(screen.getByText('Codex')).toBeInTheDocument();
    expect(screen.getByText('Claude Code')).toBeInTheDocument();
    expect(screen.getByTestId('runtime-card-claude')).toBeInTheDocument();
    expect(screen.getByTestId('runtime-card-opencode')).toBeInTheDocument();
    expect(screen.queryByTestId('runtime-card-openclaw-gateway')).not.toBeInTheDocument();
    expect(screen.queryByTestId('runtime-card-nanobot')).not.toBeInTheDocument();
    expect(screen.queryByTestId('runtime-card-qwen')).not.toBeInTheDocument();
    expect(screen.queryByTestId('runtime-card-auggie')).not.toBeInTheDocument();

    const codexCard = screen.getByTestId('runtime-card-codex');
    expect(within(codexCard).getByText('/opt/codex/bin/codex')).toBeInTheDocument();
    expect(within(codexCard).getByText('Takeover sessions 1')).toBeInTheDocument();
    expect(within(codexCard).getByRole('button', { name: 'Open config' })).toBeInTheDocument();
    expect(within(codexCard).getByRole('button', { name: 'Reveal' })).toBeInTheDocument();
  });

  it('does not render the removed custom runtime section', async () => {
    renderRuntimeSettings();

    await screen.findByText('Runtime Management');

    expect(screen.queryByText('Custom Runtime Adapters')).not.toBeInTheDocument();
    expect(screen.queryByText('Custom runtimes')).not.toBeInTheDocument();
  });

  it('hides install actions for a detected runtime and keeps login actions available', async () => {
    renderRuntimeSettings();

    await screen.findByText('Runtime Management');

    const codexCard = screen.getByTestId('runtime-card-codex');

    expect(within(codexCard).queryByRole('button', { name: 'Install locally' })).not.toBeInTheDocument();
    expect(within(codexCard).queryByText('Needs Login')).not.toBeInTheDocument();
  });

  it('hides availability checks for missing runtimes', async () => {
    renderRuntimeSettings();

    await screen.findByText('Runtime Management');

    const claudeCard = screen.getByTestId('runtime-card-claude');
    expect(within(claudeCard).queryByRole('button', { name: 'Check availability' })).not.toBeInTheDocument();
    expect(within(claudeCard).getByRole('button', { name: 'Open config' })).toBeInTheDocument();
    expect(within(claudeCard).getByRole('button', { name: 'Reveal' })).toBeInTheDocument();
    expect(within(claudeCard).getByRole('button', { name: 'Official page' })).toBeInTheDocument();
    expect(within(claudeCard).queryByText('No path is being used yet.')).not.toBeInTheDocument();

    const opencodeCard = screen.getByTestId('runtime-card-opencode');
    expect(within(opencodeCard).queryByRole('button', { name: 'Check availability' })).not.toBeInTheDocument();
    expect(within(opencodeCard).getByRole('button', { name: 'Install locally' })).toBeInTheDocument();
    expect(within(opencodeCard).getByRole('button', { name: 'Open config' })).toBeInTheDocument();
    expect(within(opencodeCard).getByRole('button', { name: 'Reveal' })).toBeInTheDocument();
    expect(within(opencodeCard).getByRole('button', { name: 'Official page' })).toBeInTheDocument();
    expect(within(opencodeCard).queryByText('No path is being used yet.')).not.toBeInTheDocument();
  });

  it('shows docs for missing runtimes and keeps install entry when managed install is supported', async () => {
    renderRuntimeSettings();

    await screen.findByText('Runtime Management');

    const opencodeCard = screen.getByTestId('runtime-card-opencode');

    expect(within(opencodeCard).getByRole('button', { name: 'Install locally' })).toBeInTheDocument();
    expect(within(opencodeCard).getByRole('button', { name: 'Official page' })).toBeInTheDocument();
  });
});
