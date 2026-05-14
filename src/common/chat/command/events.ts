/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ManagedSlashCommandRecord } from '../slash/library';

export type CommandEventScope = 'project' | 'space';

export type CommandEventAction = 'list' | 'create' | 'update' | 'delete' | 'error';

export type CommandEventPayload = {
  source: 'assistant-skill';
  action: CommandEventAction;
  scope?: CommandEventScope;
  commandName?: string;
  commands?: ManagedSlashCommandRecord[];
  command?: ManagedSlashCommandRecord;
  error?: string;
};
