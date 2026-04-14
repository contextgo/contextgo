/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { uuid } from '@/common/utils';
import { SqliteConversationRepository } from '@process/services/database/SqliteConversationRepository';
import { createSqliteContextEngineDependencies } from '../database/context/SqliteContextStores';
import { SqliteContextScheduleStore } from '../database/context/SqliteContextScheduleStore';
import { ContextRuntimeService } from './ContextRuntimeService';
import { ContextServiceImpl } from './ContextServiceImpl';
import { ContextJobQueue } from './ContextJobQueue';
import { ContextEventBus } from './events/ContextEventBus';
import { ContextTriggerRouter } from './events/ContextTriggerRouter';
import { registerContextJobRunProjector } from './events/handlers/ContextJobRunProjector';
import { registerOperationLogProjector } from './events/handlers/OperationLogProjector';
import { registerOperationLogVaultProjector } from './events/handlers/OperationLogVaultProjector';
import { registerSessionSignalProjector } from './events/handlers/SessionSignalProjector';
import { ConversationScheduleDispatcher } from './events/schedule/ConversationScheduleDispatcher';
import { ContextScheduleService } from './events/schedule/ContextScheduleService';
import { JsonWorkspaceScheduleConfigStore } from './events/schedule/WorkspaceScheduleConfigStore';
import { JsonWorkspaceScheduleRuntimeStore } from './events/schedule/WorkspaceScheduleRuntimeStore';
import { ConnectorDigestJobHandler } from './jobs/ConnectorDigestJobHandler';
import { ContextJobRunner } from './jobs/ContextJobRunner';
import { ProjectCapabilityCurationJobHandler } from './jobs/ProjectCapabilityCurationJobHandler';
import { ProjectPromotionJobHandler } from './jobs/ProjectPromotionJobHandler';
import { SessionCompactionJobHandler } from './jobs/SessionCompactionJobHandler';
import { SpaceMemoryDistillationJobHandler } from './jobs/SpaceMemoryDistillationJobHandler';
import { ContextExecutionBoundaryResolver } from './projectContext/ContextExecutionBoundaryResolver';
import { ContextRuntimeScheduleCapability } from './scheduling/RuntimeScheduleCapability';
import { createVectorIndexProviderFromEnv } from './vector/VectorProviderFactory';
import { workerTaskManager } from '@process/task/workerTaskManagerSingleton';
import { SpaceVaultContextSyncService } from '@process/services/space/SpaceVaultContextSyncService';

const vectorIndex = createVectorIndexProviderFromEnv();
const conversationRepo = new SqliteConversationRepository();

export const contextEventBus = new ContextEventBus();
export const contextJobQueue = new ContextJobQueue();
export const contextExecutionBoundaryResolver = new ContextExecutionBoundaryResolver();

export const contextService = new ContextServiceImpl(
  createSqliteContextEngineDependencies({
    vectorIndex,
  })
);

const contextVaultSyncService = new SpaceVaultContextSyncService();
const sessionCompactionJobHandler = new SessionCompactionJobHandler(contextService, contextVaultSyncService);
const projectPromotionJobHandler = new ProjectPromotionJobHandler(contextVaultSyncService);
const projectCapabilityCurationJobHandler = new ProjectCapabilityCurationJobHandler(contextVaultSyncService);
const spaceMemoryDistillationJobHandler = new SpaceMemoryDistillationJobHandler(contextVaultSyncService);
const connectorDigestJobHandler = new ConnectorDigestJobHandler(contextVaultSyncService);

export const contextJobRunner = new ContextJobRunner(
  contextJobQueue,
  contextEventBus,
  sessionCompactionJobHandler,
  projectPromotionJobHandler,
  spaceMemoryDistillationJobHandler,
  connectorDigestJobHandler,
  connectorDigestJobHandler,
  projectCapabilityCurationJobHandler
);

export const contextTriggerRouter = new ContextTriggerRouter(contextEventBus, contextExecutionBoundaryResolver);

export const contextScheduleService = new ContextScheduleService(
  new SqliteContextScheduleStore(),
  contextTriggerRouter,
  new ConversationScheduleDispatcher(() => workerTaskManager, conversationRepo),
  conversationRepo,
  new JsonWorkspaceScheduleConfigStore(),
  new JsonWorkspaceScheduleRuntimeStore()
);

export const contextRuntimeScheduleCapability = new ContextRuntimeScheduleCapability(contextScheduleService);

registerSessionSignalProjector(contextEventBus);
contextTriggerRouter.register();
registerContextJobRunProjector(contextEventBus, contextVaultSyncService);
registerOperationLogProjector(contextEventBus, contextService);
registerOperationLogVaultProjector(contextEventBus);
contextEventBus.on('context.job.queued', async (event) => {
  contextJobQueue.enqueue(event.payload.job);
  void contextJobRunner.kick();
});

export const contextRuntimeService = new ContextRuntimeService(
  contextService,
  ({ conversationId, candidates }) => {
    const preview = candidates
      .slice(0, 3)
      .map((candidate) => `- ${candidate.summary}`)
      .join('\n');

    ipcBridge.conversation.responseStream.emit({
      type: 'system',
      conversation_id: conversationId,
      msg_id: uuid(),
      data: `[ContextGo Review Required]\n${candidates.length} memory candidate(s) need human review before promotion.\n${preview}`,
    });
  },
  undefined,
  contextEventBus
);
