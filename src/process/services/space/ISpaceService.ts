/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ManagedSlashCommandRecord } from '@/common/chat/slash/library';
import type { TSpace } from '@/common/config/storage';

export interface ISpaceService {
  getSpace(id: string): Promise<TSpace | undefined>;
  listSpaces(): Promise<TSpace[]>;
  createSpace(name: string, description?: string): Promise<TSpace>;
  updateSpace(id: string, updates: Partial<TSpace>): Promise<TSpace | undefined>;
  getSpaceCommandLibrary(id: string): Promise<ManagedSlashCommandRecord[]>;
  saveSpaceCommandLibrary(id: string, commands: ManagedSlashCommandRecord[]): Promise<ManagedSlashCommandRecord[]>;
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
