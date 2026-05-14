/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

// src/process/services/IConversationService.ts

import type { ConversationSource, TChatConversation, TProviderWithModel } from '@/common/config/storage';
import type { ICreateConversationExtra, ConversationType, NonGroupConversationType } from '@/common/adapter/ipcBridge';
import type { AcpBackend } from '@/common/types/acpTypes';

export interface CreateConversationParams {
  type: ConversationType;
  id?: string;
  name?: string;
  model: TProviderWithModel;
  source?: ConversationSource;
  channelChatId?: string;
  extra: ICreateConversationExtra & {
    backend?: AcpBackend;
  };
}

export type RuntimeConversationCreateParams = CreateConversationParams & {
  type: NonGroupConversationType;
  extra: ICreateConversationExtra & {
    backend?: AcpBackend;
  };
};

export interface MigrateConversationParams {
  conversation: TChatConversation;
  sourceConversationId?: string;
  migrateSchedule?: boolean;
  sourceWorkspace?: string;
}

export interface IConversationService {
  createConversation(params: CreateConversationParams): Promise<TChatConversation>;
  deleteConversation(id: string): Promise<void>;
  updateConversation(id: string, updates: Partial<TChatConversation>, mergeExtra?: boolean): Promise<void>;
  getConversation(id: string): Promise<TChatConversation | undefined>;
  createWithMigration(params: MigrateConversationParams): Promise<TChatConversation>;
  /** Returns all conversations without pagination. */
  listAllConversations(): Promise<TChatConversation[]>;
}
