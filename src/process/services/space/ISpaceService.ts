/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TSpace } from '@/common/config/storage';
import type { ManagedSlashCommandRecord } from '@/common/chat/slash/library';

export interface ISpaceService {
  getSpace(id: string): Promise<TSpace | undefined>;
  getCommandLibrary(id: string): Promise<ManagedSlashCommandRecord[]>;
  listSpaces(): Promise<TSpace[]>;
  createSpace(name: string, description?: string): Promise<TSpace>;
  saveCommandLibrary(id: string, library: ManagedSlashCommandRecord[]): Promise<ManagedSlashCommandRecord[]>;
  updateSpace(id: string, updates: Partial<TSpace>): Promise<TSpace | undefined>;
  openSpaceVault(id: string): Promise<{
    opened: boolean;
    fallback: 'obsidian-uri' | 'folder' | 'none';
    target: string;
    obsidianInstalled: boolean;
  }>;
  renameSpace(id: string, name: string): Promise<void>;
  archiveSpace(id: string): Promise<void>;
  ensureDefaultSpace(): Promise<TSpace>;
}
