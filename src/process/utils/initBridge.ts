/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { logger } from '@office-ai/platform';
import { initAllBridges } from '../bridge';
import { SqliteChannelRepository } from '@process/services/database/SqliteChannelRepository';
import { SqliteConversationRepository } from '@process/services/database/SqliteConversationRepository';
import { SqliteSpaceRepository } from '@process/services/database/space/SqliteSpaceRepository';
import { ConversationServiceImpl } from '@process/services/ConversationServiceImpl';
import { SpaceServiceImpl } from '@process/services/space/SpaceServiceImpl';
import { cronService } from '@process/services/cron/cronServiceSingleton';
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
});

// Initialize cron service (load jobs from database and start timers)
void cronService.init().catch((error) => {
  console.error('[initBridge] Failed to initialize CronService:', error);
});
