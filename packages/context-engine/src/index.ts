/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

export * from './domain';
export * from './operations';
export * from './promotion';
export * from './compaction';
export * from './forgetting';
export * from './contracts';
export * from './vectorIndex';
export * from './ContextEngineService';
export * from './inMemoryStores';

export type ContextEngineStage = 'design' | 'contract';

export type ContextEngineCollaborationMode = 'single-device' | 'multi-device' | 'shared-space';

export const CONTEXT_ENGINE_MODULE = {
  packageName: '@contextgo/context-engine',
  stage: 'contract' as const,
  capabilities: ['promotion', 'compaction', 'forgetting', 'local-first', 'op-log', 'strategy-adapters'] as const,
  targetModes: ['single-device', 'multi-device', 'shared-space'] as const,
};
