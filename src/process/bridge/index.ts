/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { acpDetector } from '@process/agent/acp/AcpDetector';
import type { IChannelRepository } from '@process/services/database/IChannelRepository';
import type { IConversationRepository } from '@process/services/database/IConversationRepository';
import type { IConversationService } from '@process/services/IConversationService';
import type { IWorkerTaskManager } from '@process/task/IWorkerTaskManager';
import type { ISpaceService } from '@process/services/space/ISpaceService';
import { initAcpConversationBridge } from './acpConversationBridge';
import { initApplicationBridge } from './applicationBridge';
import { initAuthBridge } from './authBridge';
import { initBedrockBridge } from './bedrockBridge';
import { initBrowserContextBridge } from './browserContextBridge';
import { initChannelBridge } from './channelBridge';
import { initCloudBridge } from './cloudBridge';
import { initConversationBridge } from './conversationBridge';
import { initScheduleBridge } from './scheduleBridge';
import { initDatabaseBridge } from './databaseBridge';
import { initDialogBridge } from './dialogBridge';
import { initDocumentBridge } from './documentBridge';
import { initFileWatchBridge } from './fileWatchBridge';
import { initFsBridge } from './fsBridge';
import { initGeminiBridge } from './geminiBridge';
import { initGeminiConversationBridge } from './geminiConversationBridge';
import { initMcpBridge } from './mcpBridge';
import { initModelBridge } from './modelBridge';
import { initPreviewHistoryBridge } from './previewHistoryBridge';
import { initShellBridge } from './shellBridge';
import { initSpaceBridge } from './spaceBridge';
import { initStarOfficeBridge } from './starOfficeBridge';
import { initTaskBridge } from './taskBridge';
import { initUpdateBridge } from './updateBridge';
import { initWebuiBridge } from './webuiBridge';
import { initSystemSettingsBridge } from './systemSettingsBridge';
import { initWindowControlsBridge } from './windowControlsBridge';
import { initNotificationBridge } from './notificationBridge';
import { initExtensionsBridge } from './extensionsBridge';
import { initExternalConnectorCatalogBridge } from './externalConnectorCatalogBridge';
import { initWeixinLoginBridge } from './weixinLoginBridge';

export interface BridgeDependencies {
  conversationService: IConversationService;
  conversationRepo: IConversationRepository;
  workerTaskManager: IWorkerTaskManager;
  channelRepo: IChannelRepository;
  spaceService: ISpaceService;
}

/**
 * 初始化所有IPC桥接模块
 */
export function initAllBridges(deps: BridgeDependencies): void {
  initDialogBridge();
  initShellBridge();
  initFsBridge();
  initFileWatchBridge();
  initConversationBridge(deps.conversationService, deps.workerTaskManager);
  initApplicationBridge(deps.workerTaskManager);
  initCloudBridge();
  initGeminiConversationBridge(deps.workerTaskManager);
  // 额外的 Gemini 辅助桥（订阅检测等）需要在对话桥初始化后可用 / extra helpers after core bridges
  initGeminiBridge();
  initBedrockBridge();
  initBrowserContextBridge();
  initExternalConnectorCatalogBridge();
  initAcpConversationBridge(deps.workerTaskManager, deps.conversationService);
  initAuthBridge();
  initModelBridge();
  initMcpBridge();
  initPreviewHistoryBridge();
  initDocumentBridge();
  initSpaceBridge(deps.spaceService);
  initWindowControlsBridge();
  initUpdateBridge();
  initWebuiBridge();
  initChannelBridge(deps.channelRepo);
  initDatabaseBridge(deps.conversationRepo);
  initExtensionsBridge(deps.conversationRepo, deps.workerTaskManager);
  initScheduleBridge();
  initSystemSettingsBridge();
  initNotificationBridge();
  initTaskBridge(deps.workerTaskManager);
  initStarOfficeBridge();
  initWeixinLoginBridge();
}

/**
 * 初始化ACP检测器
 */
export async function initializeAcpDetector(): Promise<void> {
  try {
    await acpDetector.initialize();
  } catch (error) {
    console.error('[ACP] Failed to initialize detector:', error);
  }
}

// 导出初始化函数供单独使用

export {
  initAcpConversationBridge,
  initApplicationBridge,
  initAuthBridge,
  initBedrockBridge,
  initBrowserContextBridge,
  initChannelBridge,
  initCloudBridge,
  initConversationBridge,
  initScheduleBridge,
  initDatabaseBridge,
  initDialogBridge,
  initDocumentBridge,
  initExtensionsBridge,
  initExternalConnectorCatalogBridge,
  initFsBridge,
  initGeminiBridge,
  initGeminiConversationBridge,
  initMcpBridge,
  initModelBridge,
  initNotificationBridge,
  initPreviewHistoryBridge,
  initShellBridge,
  initSpaceBridge,
  initStarOfficeBridge,
  initSystemSettingsBridge,
  initTaskBridge,
  initUpdateBridge,
  initWebuiBridge,
  initWindowControlsBridge,
  initWeixinLoginBridge,
};
// 导出窗口控制相关工具函数
export { registerWindowMaximizeListeners } from './windowControlsBridge';
