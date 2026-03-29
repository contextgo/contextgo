/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

export type ContextEngineStage = 'design';

export type ContextEngineCollaborationMode = 'single-device' | 'multi-device' | 'shared-space';

export const CONTEXT_ENGINE_MODULE = {
  packageName: '@contextgo/context-engine',
  stage: 'design' as const,
  targetModes: ['single-device', 'multi-device', 'shared-space'] as const,
};

export type {
  AssignCronJobSpaceInput,
  BackfillConversationSpaceResult,
  BackfillCronJobSpaceResult,
  ConversationLike,
  ConversationSpaceBinding,
  CreateSpaceInput,
  EnsureConversationSpaceInput,
  ISpaceMigrationService,
  ISpaceOwnershipService,
  ISpaceRepository,
  ISpaceService,
  PreviewTargetLike,
  SpaceKind,
  SpaceRecord,
  SpaceSource,
  UpsertPreviewSnapshotSpaceInput,
} from './foundation';
