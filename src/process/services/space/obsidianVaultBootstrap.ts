/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SpaceVaultProviderRef } from '@/common/config/storage';
import crypto from 'node:crypto';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

type ObsidianVaultRegistryEntry = {
  path: string;
  ts: number;
  open?: boolean;
};

type ObsidianVaultRegistry = {
  vaults?: Record<string, ObsidianVaultRegistryEntry>;
};

type ObsidianBootstrapPaths = {
  appConfigDir: string;
  registryPath: string;
  windowStatePath: (vaultId: string) => string;
};

type ObsidianBootstrapOptions = {
  homeDir?: string;
  platform?: NodeJS.Platform;
  appDataDir?: string;
  xdgConfigHome?: string;
  now?: () => number;
};

const DEFAULT_WINDOW_STATE = {
  isMaximized: false,
  devTools: false,
  zoom: 0,
  x: 352,
  y: 103,
  width: 1280,
  height: 840,
} as const;

const DEFAULT_CORE_PLUGINS = {
  'file-explorer': true,
  'global-search': true,
  switcher: true,
  graph: true,
  backlink: true,
  canvas: true,
  'outgoing-link': true,
  'tag-pane': true,
  footnotes: false,
  properties: true,
  'page-preview': true,
  'daily-notes': true,
  templates: true,
  'note-composer': true,
  'command-palette': true,
  'slash-command': false,
  'editor-status': true,
  bookmarks: true,
  'markdown-importer': false,
  'zk-prefixer': false,
  'random-note': false,
  outline: true,
  'word-count': true,
  slides: false,
  'audio-recorder': false,
  workspaces: false,
  'file-recovery': true,
  publish: false,
  sync: true,
  bases: true,
  webviewer: false,
} as const;

const DEFAULT_GRAPH_COLOR_GROUPS = [
  {
    query: 'file:Home',
    color: { a: 1, rgb: 0x2f7d6a },
  },
  {
    query: 'path:"Projects/" path:"/Sources/"',
    color: { a: 1, rgb: 0x3b82f6 },
  },
  {
    query: 'path:"Projects/" path:"/Sessions/"',
    color: { a: 1, rgb: 0xf59e0b },
  },
  {
    query: 'path:"Projects/" path:"/_context/"',
    color: { a: 1, rgb: 0x8b5cf6 },
  },
  {
    query: 'path:"Canvas/"',
    color: { a: 1, rgb: 0xec4899 },
  },
  {
    query: 'path:"System/"',
    color: { a: 1, rgb: 0x64748b },
  },
  {
    query: 'path:"Projects/"',
    color: { a: 1, rgb: 0x10b981 },
  },
] as const;

const DEFAULT_GRAPH_STATE = {
  'collapse-filter': true,
  search: '',
  showTags: false,
  showAttachments: false,
  hideUnresolved: false,
  showOrphans: true,
  'collapse-color-groups': false,
  colorGroups: DEFAULT_GRAPH_COLOR_GROUPS,
  'collapse-display': true,
  showArrow: false,
  textFadeMultiplier: 0,
  nodeSizeMultiplier: 1,
  lineSizeMultiplier: 1,
  'collapse-forces': true,
  centerStrength: 0.518713248970312,
  repelStrength: 10,
  linkStrength: 1,
  linkDistance: 250,
  scale: 1,
  close: false,
} as const;

const createWorkspaceTemplate = (landingNotePath: string) => ({
  main: {
    id: 'contextgo-main',
    type: 'split',
    children: [
      {
        id: 'contextgo-main-tabs',
        type: 'tabs',
        children: [
          {
            id: 'contextgo-home',
            type: 'leaf',
            state: {
              type: 'markdown',
              state: {
                file: landingNotePath,
                mode: 'source',
                source: true,
              },
            },
          },
        ],
      },
    ],
    direction: 'vertical',
  },
  left: {
    id: 'contextgo-left',
    type: 'split',
    children: [
      {
        id: 'contextgo-left-tabs',
        type: 'tabs',
        children: [
          {
            id: 'contextgo-file-explorer',
            type: 'leaf',
            state: {
              type: 'file-explorer',
              state: {
                sortOrder: 'alphabetical',
                autoReveal: true,
              },
              icon: 'lucide-folder-closed',
              title: 'Files',
            },
          },
        ],
      },
    ],
    direction: 'horizontal',
    width: 280,
  },
  right: {
    id: 'contextgo-right',
    type: 'split',
    children: [
      {
        id: 'contextgo-right-tabs',
        type: 'tabs',
        children: [
          {
            id: 'contextgo-outline',
            type: 'leaf',
            state: {
              type: 'outline',
              state: {
                followCursor: false,
                showSearch: false,
                searchQuery: '',
              },
              icon: 'lucide-list',
              title: 'Outline',
            },
          },
        ],
      },
    ],
    direction: 'horizontal',
    width: 280,
    collapsed: true,
  },
  'left-ribbon': {
    hiddenItems: {
      'switcher:Open quick switcher': false,
      'graph:Open graph view': false,
      'canvas:Create new canvas': false,
      "daily-notes:Open today's daily note": false,
      'templates:Insert template': false,
      'command-palette:Open command palette': false,
      'bases:Create new base': false,
    },
  },
  active: 'contextgo-home',
  lastOpenFiles: [landingNotePath],
});

const readJsonFile = async <T>(filePath: string, fallback: T): Promise<T> => {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
};

const writeJsonFile = async (filePath: string, value: unknown): Promise<void> => {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const ensureJsonFile = async (filePath: string, value: unknown): Promise<void> => {
  if (existsSync(filePath)) {
    return;
  }

  await writeJsonFile(filePath, value);
};

const resolveComparableVaultPath = async (vaultPath: string): Promise<string> => {
  try {
    return await fs.realpath(vaultPath);
  } catch {
    return path.resolve(vaultPath);
  }
};

const findRegisteredVaultId = async (
  registry: ObsidianVaultRegistry,
  vaultPath: string
): Promise<string | undefined> => {
  const comparableVaultPath = await resolveComparableVaultPath(vaultPath);

  for (const [vaultId, entry] of Object.entries(registry.vaults ?? {})) {
    if (entry.path === vaultPath) {
      return vaultId;
    }

    const comparableEntryPath = await resolveComparableVaultPath(entry.path);
    if (comparableEntryPath === comparableVaultPath) {
      return vaultId;
    }
  }

  return undefined;
};

const buildFallbackVaultId = (vaultPath: string): string => {
  return crypto.createHash('sha1').update(vaultPath).digest('hex').slice(0, 16);
};

const getObsidianBootstrapPaths = (options: ObsidianBootstrapOptions = {}): ObsidianBootstrapPaths => {
  const platform = options.platform ?? process.platform;
  const homeDir = options.homeDir ?? os.homedir();

  let appConfigDir: string;
  if (platform === 'darwin') {
    appConfigDir = path.join(homeDir, 'Library', 'Application Support', 'obsidian');
  } else if (platform === 'win32') {
    appConfigDir = path.join(
      options.appDataDir ?? process.env.APPDATA ?? path.join(homeDir, 'AppData', 'Roaming'),
      'obsidian'
    );
  } else {
    appConfigDir = path.join(
      options.xdgConfigHome ?? process.env.XDG_CONFIG_HOME ?? path.join(homeDir, '.config'),
      'obsidian'
    );
  }

  return {
    appConfigDir,
    registryPath: path.join(appConfigDir, 'obsidian.json'),
    windowStatePath: (vaultId: string) => path.join(appConfigDir, `${vaultId}.json`),
  };
};

const ensureObsidianWorkspaceFiles = async (providerRef: SpaceVaultProviderRef): Promise<void> => {
  const obsidianDir = path.join(providerRef.vaultPath, '.obsidian');
  await fs.mkdir(obsidianDir, { recursive: true });

  const landingNotePath = providerRef.landingNotePath ?? 'Home.md';
  await Promise.all([
    ensureJsonFile(path.join(obsidianDir, 'app.json'), {}),
    ensureJsonFile(path.join(obsidianDir, 'appearance.json'), {}),
    ensureJsonFile(path.join(obsidianDir, 'core-plugins.json'), DEFAULT_CORE_PLUGINS),
    ensureJsonFile(path.join(obsidianDir, 'graph.json'), DEFAULT_GRAPH_STATE),
    ensureJsonFile(path.join(obsidianDir, 'workspace.json'), createWorkspaceTemplate(landingNotePath)),
  ]);
};

const registerObsidianVault = async (
  providerRef: SpaceVaultProviderRef,
  options: ObsidianBootstrapOptions = {}
): Promise<void> => {
  const paths = getObsidianBootstrapPaths(options);
  await fs.mkdir(paths.appConfigDir, { recursive: true });

  const registry = await readJsonFile<ObsidianVaultRegistry>(paths.registryPath, { vaults: {} });
  const now = options.now?.() ?? Date.now();
  const vaultId =
    (await findRegisteredVaultId(registry, providerRef.vaultPath)) ?? buildFallbackVaultId(providerRef.vaultPath);
  const existingEntry = registry.vaults?.[vaultId];
  const nextRegistry: ObsidianVaultRegistry = {
    vaults: {
      ...(registry.vaults ?? {}),
      [vaultId]: {
        path: providerRef.vaultPath,
        ts: existingEntry?.ts ?? now,
        open: true,
      },
    },
  };

  await writeJsonFile(paths.registryPath, nextRegistry);
  await ensureJsonFile(paths.windowStatePath(vaultId), DEFAULT_WINDOW_STATE);
};

export const ensureObsidianVaultBootstrap = async (
  providerRef: SpaceVaultProviderRef,
  options: ObsidianBootstrapOptions = {}
): Promise<void> => {
  await ensureObsidianWorkspaceFiles(providerRef);
  await registerObsidianVault(providerRef, options);
};

export const obsidianVaultBootstrapInternals = {
  buildFallbackVaultId,
  findRegisteredVaultId,
  getObsidianBootstrapPaths,
};
