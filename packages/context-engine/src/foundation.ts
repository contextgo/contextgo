export type SpaceKind = 'personal' | 'project' | 'channel' | 'temporary';

export type SpaceSource = 'manual' | 'migration' | 'channel-import' | 'system';

export type SpaceRecord = {
  id: string;
  userId: string;
  name: string;
  slug?: string;
  description?: string;
  kind: SpaceKind;
  source: SpaceSource;
  isDefault: boolean;
  archivedAt?: number;
  createdAt: number;
  updatedAt: number;
};

export type ConversationLike = {
  id: string;
  userId?: string;
  extra?: Record<string, unknown>;
};

export type ConversationSpaceBinding = {
  conversationId: string;
  spaceId: string;
  mountId?: string;
  workingDirectory?: string;
  legacyWorkspace?: string;
};

export type CreateSpaceInput = {
  userId: string;
  name: string;
  slug?: string;
  description?: string;
  kind: SpaceKind;
  source: SpaceSource;
  isDefault?: boolean;
};

export type EnsureConversationSpaceInput = {
  conversationId: string;
  userId: string;
  requestedSpaceId?: string;
  mountId?: string;
  workingDirectory?: string;
  legacyWorkspace?: string;
};

export type AssignCronJobSpaceInput = {
  cronJobId: string;
  spaceId: string;
};

export type PreviewTargetLike = {
  conversationId?: string;
  workingDirectory?: string;
  legacyWorkspace?: string;
  filePath?: string;
  contentType: string;
};

export type UpsertPreviewSnapshotSpaceInput = {
  snapshotId: string;
  spaceId?: string;
  conversationId?: string;
  contentType: string;
  fileName?: string;
  filePath?: string;
  storagePath: string;
  identityHash: string;
  createdAt: number;
  updatedAt: number;
};

export type BackfillConversationSpaceResult = {
  scannedCount: number;
  updatedCount: number;
  skippedCount: number;
};

export type BackfillCronJobSpaceResult = {
  scannedCount: number;
  updatedCount: number;
  skippedCount: number;
};

export type ISpaceRepository = {
  insert(space: SpaceRecord): Promise<void>;
  update(spaceId: string, updates: Partial<SpaceRecord>): Promise<void>;
  getById(spaceId: string): Promise<SpaceRecord | null>;
  getDefaultSpace(userId: string): Promise<SpaceRecord | null>;
  listByUser(userId: string): Promise<SpaceRecord[]>;
  delete(spaceId: string): Promise<void>;
};

export type ISpaceService = {
  createSpace(input: CreateSpaceInput): Promise<SpaceRecord>;
  getSpace(spaceId: string): Promise<SpaceRecord | null>;
  listSpaces(userId: string): Promise<SpaceRecord[]>;
  ensureDefaultSpace(userId: string): Promise<SpaceRecord>;
  ensureConversationBinding(input: EnsureConversationSpaceInput): Promise<ConversationSpaceBinding>;
  resolveConversationBinding(conversation: ConversationLike): Promise<ConversationSpaceBinding>;
};

export type ISpaceOwnershipService = {
  assignCronJobToSpace(input: AssignCronJobSpaceInput): Promise<void>;
  listSpaceCronJobs(spaceId: string): Promise<string[]>;
  upsertPreviewSnapshotIndex(input: UpsertPreviewSnapshotSpaceInput): Promise<void>;
  resolvePreviewTargetSpace(target: PreviewTargetLike): Promise<string | null>;
};

export type ISpaceMigrationService = {
  backfillConversationSpaces(userId: string): Promise<BackfillConversationSpaceResult>;
  backfillCronJobSpaces(): Promise<BackfillCronJobSpaceResult>;
};
