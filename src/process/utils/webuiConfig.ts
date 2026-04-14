/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ProcessConfig } from './initStorage';
import { SERVER_CONFIG } from '../webserver/config/constants';
import { getHostBrowserEntryService } from '@process/services/host/HostBrowserEntryService';

const WEBUI_CONFIG_FILE = 'webui.config.json';
const DESKTOP_WEBUI_ENABLED_KEY = 'webui.desktop.enabled';
const DESKTOP_WEBUI_ALLOW_REMOTE_KEY = 'webui.desktop.allowRemote';
const DESKTOP_WEBUI_PORT_KEY = 'webui.desktop.port';
const DESKTOP_WEBUI_PRODUCTION_PORT = 25808;
const DESKTOP_WEBUI_DEVELOPMENT_PORT = 25809;

const getDefaultDesktopWebUIPort = (): number => {
  return app.isPackaged ? DESKTOP_WEBUI_PRODUCTION_PORT : DESKTOP_WEBUI_DEVELOPMENT_PORT;
};

export const resolvePreferredDesktopWebUIPort = (value: unknown): number => {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : getDefaultDesktopWebUIPort();
};

export type WebUIUserConfig = {
  port?: number | string;
  allowRemote?: boolean;
};

export const parsePortValue = (value: unknown): number | null => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const portNumber = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (!Number.isFinite(portNumber) || portNumber < 1 || portNumber > 65535) {
    return null;
  }
  return portNumber;
};

export const parseBooleanEnv = (value?: string): boolean | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return null;
};

export const loadUserWebUIConfig = (): { config: WebUIUserConfig; path: string | null; exists: boolean } => {
  try {
    const userDataPath = app.getPath('userData');
    const configPath = path.join(userDataPath, WEBUI_CONFIG_FILE);
    if (!fs.existsSync(configPath)) {
      return { config: {}, path: configPath, exists: false };
    }

    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { config: {}, path: configPath, exists: false };
    }
    return { config: parsed as WebUIUserConfig, path: configPath, exists: true };
  } catch {
    return { config: {}, path: null, exists: false };
  }
};

export const resolveWebUIPort = (
  config: WebUIUserConfig,
  getSwitchValue: (flag: string) => string | undefined
): number => {
  const cliPort = parsePortValue(getSwitchValue('port') ?? getSwitchValue('webui-port'));
  if (cliPort) return cliPort;

  const envPort = parsePortValue(process.env.CONTEXTGO_PORT ?? process.env.PORT);
  if (envPort) return envPort;

  const configPort = parsePortValue(config.port);
  if (configPort) return configPort;

  return SERVER_CONFIG.DEFAULT_PORT;
};

export const resolveRemoteAccess = (config: WebUIUserConfig, isRemoteMode: boolean): boolean => {
  const envRemote = parseBooleanEnv(process.env.CONTEXTGO_ALLOW_REMOTE || process.env.CONTEXTGO_REMOTE);
  const hostHint = process.env.CONTEXTGO_HOST?.trim();
  const hostRequestsRemote = hostHint ? ['0.0.0.0', '::', '::0'].includes(hostHint) : false;
  const configRemote = config.allowRemote === true;

  return isRemoteMode || hostRequestsRemote || envRemote === true || configRemote;
};

export const restoreDesktopWebUIFromPreferences = async (): Promise<void> => {
  try {
    const enabled = (await ProcessConfig.get(DESKTOP_WEBUI_ENABLED_KEY)) === true;
    if (!enabled) return;

    const [allowRemotePref, portPref] = await Promise.all([
      ProcessConfig.get(DESKTOP_WEBUI_ALLOW_REMOTE_KEY),
      ProcessConfig.get(DESKTOP_WEBUI_PORT_KEY),
    ]);
    const allowRemote = allowRemotePref === true;
    const preferredPort = resolvePreferredDesktopWebUIPort(portPref);
    const instance = await getHostBrowserEntryService().ensureForDemand('local-client', {
      preferredPort,
      allowRemote,
      reason: 'desktop-preferences',
    });
    console.log(
      `[WebUI] Auto-restored from desktop preferences (port=${instance.port}, allowRemote=${instance.allowRemote})`
    );
  } catch (error) {
    console.error('[WebUI] Failed to auto-restore from desktop preferences:', error);
  }
};

export const getPreferredDesktopWebUIPort = async (): Promise<number> => {
  const portPref = await ProcessConfig.get(DESKTOP_WEBUI_PORT_KEY);
  return resolvePreferredDesktopWebUIPort(portPref);
};

export const ensureDesktopWebUIForOfficialRemote = async (): Promise<void> => {
  try {
    await app.whenReady();

    const preferredPort = await getPreferredDesktopWebUIPort();

    console.log(`[WebUI] Ensuring Official Remote runtime (preferredPort=${preferredPort})`);
    const instance = await getHostBrowserEntryService().ensureForDemand('official-remote', {
      preferredPort,
      allowRemote: false,
      reason: 'official-remote',
      allowPortFallback: true,
    });
    await ProcessConfig.set(DESKTOP_WEBUI_PORT_KEY, instance.port);
    console.log(`[WebUI] Official Remote runtime ensured (port=${instance.port}, allowRemote=false)`);
  } catch (error) {
    console.error('[WebUI] Failed to ensure browser entry for Official Remote:', error);
    throw error;
  }
};

export const releaseDesktopWebUIForOfficialRemote = async (): Promise<void> => {
  await app.whenReady();

  const localAccessEnabled = (await ProcessConfig.get(DESKTOP_WEBUI_ENABLED_KEY)) === true;
  if (localAccessEnabled) {
    return;
  }

  if (!getHostBrowserEntryService().getCurrentInstance()) {
    return;
  }

  await getHostBrowserEntryService().releaseDemand('official-remote', 'Official Remote runtime released');
  console.log('[WebUI] Official Remote runtime released because local access is disabled.');
};
