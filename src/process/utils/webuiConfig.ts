/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { app } from 'electron';
import { webui } from '@/common/adapter/ipcBridge';
import * as fs from 'fs';
import * as path from 'path';
import { getWebServerInstance, setWebServerInstance } from '../bridge/webuiBridge';
import { ProcessConfig } from './initStorage';
import { startWebServerWithInstance } from '../webserver';
import { cleanupWebAdapter } from '../webserver/adapter';
import { SERVER_CONFIG } from '../webserver/config/constants';

const WEBUI_CONFIG_FILE = 'webui.config.json';
const DESKTOP_WEBUI_ENABLED_KEY = 'webui.desktop.enabled';
const DESKTOP_WEBUI_ALLOW_REMOTE_KEY = 'webui.desktop.allowRemote';
const DESKTOP_WEBUI_PORT_KEY = 'webui.desktop.port';

const emitWebuiRuntimeStatus = (port: number, allowRemote: boolean): void => {
  webui.statusChanged.emit({
    running: true,
    port,
    localUrl: `http://localhost:${port}`,
    networkUrl: getNetworkUrl(port, allowRemote),
  });
};

const stopCurrentWebuiInstance = async (reason: string): Promise<void> => {
  const currentInstance = getWebServerInstance();
  if (!currentInstance) {
    return;
  }

  try {
    const { server, wss } = currentInstance;
    wss.clients.forEach((client) => client.close(1000, reason));
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      setTimeout(resolve, 2000);
    });
    cleanupWebAdapter();
  } catch (error) {
    console.warn(`[WebUI] Failed to stop WebUI instance (${reason}):`, error);
  }

  setWebServerInstance(null);
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

const getNetworkUrl = (port: number, allowRemote: boolean): string | undefined => {
  if (!allowRemote) {
    return undefined;
  }

  const nets = require('node:os').networkInterfaces() as ReturnType<typeof import('node:os').networkInterfaces>;
  for (const name of Object.keys(nets)) {
    const netInfo = nets[name];
    if (!netInfo) {
      continue;
    }

    for (const net of netInfo) {
      const isIPv4 = net.family === 'IPv4' || (net.family as unknown) === 4;
      if (isIPv4 && !net.internal) {
        return `http://${net.address}:${port}`;
      }
    }
  }

  return undefined;
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
    const preferredPort = typeof portPref === 'number' && portPref > 0 ? portPref : SERVER_CONFIG.DEFAULT_PORT;

    const instance = await startWebServerWithInstance(preferredPort, allowRemote);
    setWebServerInstance(instance);
    console.log(`[WebUI] Auto-restored from desktop preferences (port=${preferredPort}, allowRemote=${allowRemote})`);
  } catch (error) {
    console.error('[WebUI] Failed to auto-restore from desktop preferences:', error);
  }
};

export const ensureDesktopWebUIForOfficialRemote = async (): Promise<void> => {
  try {
    await app.whenReady();

    const portPref = await ProcessConfig.get(DESKTOP_WEBUI_PORT_KEY);
    const preferredPort = typeof portPref === 'number' && portPref > 0 ? portPref : SERVER_CONFIG.DEFAULT_PORT;
    const currentInstance = getWebServerInstance();

    if (currentInstance && Number.isFinite(currentInstance.port) && currentInstance.port > 0) {
      emitWebuiRuntimeStatus(currentInstance.port, currentInstance.allowRemote);
      return;
    }

    const instance = await startWebServerWithInstance(preferredPort, false);
    setWebServerInstance(instance);
    await ProcessConfig.set(DESKTOP_WEBUI_PORT_KEY, instance.port);
    emitWebuiRuntimeStatus(instance.port, false);
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

  if (!getWebServerInstance()) {
    return;
  }

  await stopCurrentWebuiInstance('Official Remote runtime released');
  webui.statusChanged.emit({ running: false });
  console.log('[WebUI] Official Remote runtime released because local access is disabled.');
};
