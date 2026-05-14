/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Singleton ConversationServiceImpl wired with a SqliteConversationRepository.
 * Extracted to a separate module to avoid circular dependencies.
 */

import { SqliteConversationRepository } from '@process/services/database/SqliteConversationRepository';
import { SqliteSpaceRepository } from '@process/services/database/space/SqliteSpaceRepository';
import { ConversationServiceImpl } from './ConversationServiceImpl';
import type { IConversationService } from './IConversationService';
import { SpaceServiceImpl } from './space/SpaceServiceImpl';

export const conversationServiceSingleton: IConversationService = new ConversationServiceImpl(
  new SqliteConversationRepository(),
  new SpaceServiceImpl(new SqliteSpaceRepository())
);
