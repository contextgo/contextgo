/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

// src/process/task/IWorkerTaskManager.ts

import type { IAgentManager } from './IAgentManager';
import type { BuildConversationOptions, AgentType } from './agentTypes';

export interface IWorkerTaskManager {
  getTask(id: string): IAgentManager | undefined;
  getOrBuildTask(id: string, options?: BuildConversationOptions): Promise<IAgentManager>;
  addTask(id: string, task: IAgentManager): void;
  kill(id: string): void;
  clear(): void;
  listTasks(): Array<{ id: string; type: AgentType }>;
}
