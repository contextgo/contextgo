/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { logger } from '@office-ai/platform';
import { initAllBridges } from '../bridge';
import { SqliteChannelRepository } from '@process/services/database/SqliteChannelRepository';
import { SqliteConversationRepository } from '@process/services/database/SqliteConversationRepository';
import { SqliteSpaceRepository } from '@process/services/database/space/SqliteSpaceRepository';
import { ConversationServiceImpl } from '@process/services/ConversationServiceImpl';
import { SpaceServiceImpl } from '@process/services/space/SpaceServiceImpl';
import { scheduleService } from '@process/services/context/scheduleServiceSingleton';
import { workerTaskManager } from '@process/task/workerTaskManagerSingleton';

logger.config({ print: true });

const repo = new SqliteConversationRepository();
const spaceService = new SpaceServiceImpl(new SqliteSpaceRepository());
const conversationServiceImpl = new ConversationServiceImpl(repo, spaceService);
const channelRepo = new SqliteChannelRepository();

// 初始化所有IPC桥接
initAllBridges({
  conversationService: conversationServiceImpl,
  conversationRepo: repo,
  workerTaskManager,
  channelRepo,
  spaceService,
});

// Initialize the unified context schedule service (restores timers and conversation schedules).
void scheduleService.init().catch((error: unknown) => {
  console.error('[initBridge] Failed to initialize ContextScheduleService:', error);
});
