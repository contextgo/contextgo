/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TChatConversation } from '@/common/config/storage';
import { resolveWorkspacePath, WORKSPACE_AUTOMATION_DIR } from '@process/bridge/services/workspaceAutomation';
import type {
  IAgentProfile,
  IChannelBinding,
  IChannelPublishObjectCatalogEntry,
  IConnectorInstance,
  IRemoteIdentity,
} from '@process/channels/types';
import {
  getChannelAccountId,
  getChannelBindingPublishObject,
  getChannelPublishObjectCatalogEntryIdentity,
  withChannelAccountId,
} from '@process/channels/types';
import {
  describeRemoteIdentityObject,
  inferRemoteIdentityPublishObject,
  isChannelObjectFallbackTitle,
} from '@process/channels/utils';
import fs from 'node:fs/promises';
import path from 'node:path';

const WORKSPACE_CHANNELS_DIR = path.join(WORKSPACE_AUTOMATION_DIR, 'channels');
const WORKSPACE_CHANNEL_AGENT_PROFILES_FILE = path.join(WORKSPACE_CHANNELS_DIR, 'agent-profiles.json');
const WORKSPACE_CHANNEL_BINDINGS_FILE = path.join(WORKSPACE_CHANNELS_DIR, 'bindings.json');
const WORKSPACE_CHANNEL_PUBLISH_OBJECTS_FILE = path.join(WORKSPACE_CHANNELS_DIR, 'publish-objects.json');
const CHANNEL_STORAGE_VERSION = 1;

type AgentProfileStoreDocument = {
  version: number;
  agentProfiles: IAgentProfile[];
};

type ChannelBindingStoreDocument = {
  version: number;
  bindings: IChannelBinding[];
};

type PublishObjectCatalogStoreDocument = {
  version: number;
  publishObjects: IChannelPublishObjectCatalogEntry[];
};

export type ProjectChannelPublicationSnapshot = {
  workspacePath: string;
  agentProfiles: IAgentProfile[];
  bindings: IChannelBinding[];
  publishObjects: IChannelPublishObjectCatalogEntry[];
};

export type ProjectChannelPublicationCatalog = {
  workspaces: string[];
  agentProfiles: IAgentProfile[];
  bindings: IChannelBinding[];
  publishObjects: IChannelPublishObjectCatalogEntry[];
  agentProfileWorkspaceById: Record<string, string>;
  bindingWorkspaceById: Record<string, string>;
};

export function getConversationWorkspacePath(conversation: Pick<TChatConversation, 'extra'>): string | undefined {
  return resolveConversationWorkspace(conversation);
}

const pathExists = async (targetPath: string): Promise<boolean> => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const normalizeAgentProfiles = (profiles: readonly IAgentProfile[]): IAgentProfile[] => {
  return profiles
    .map((profile) => ({
      ...profile,
      workspaceRef: profile.workspaceRef?.trim() || undefined,
      spaceId: profile.spaceId?.trim() || undefined,
      promptProfile: profile.promptProfile ?? {},
      toolPolicy: profile.toolPolicy ?? {},
      memoryPolicy: profile.memoryPolicy ?? {},
      delegationPolicy: profile.delegationPolicy ?? {},
      archived: profile.archived === true,
    }))
    .toSorted((left, right) => right.updatedAt - left.updatedAt || left.createdAt - right.createdAt);
};

const normalizeChannelBindings = (bindings: readonly IChannelBinding[]): IChannelBinding[] => {
  return bindings
    .filter((binding) => binding.temporary !== true)
    .map((binding) => {
      const normalized = withChannelAccountId({
        ...binding,
        temporary: false,
        metadata: binding.metadata ?? {},
      });
      normalized.scopeKey = normalized.scopeKey?.trim() || undefined;
      return normalized;
    })
    .toSorted((left, right) => right.priority - left.priority || left.createdAt - right.createdAt);
};

const SOURCE_PRIORITY: Record<IChannelPublishObjectCatalogEntry['displayProfile']['source'], number> = {
  'official-pull': 4,
  'runtime-resolved': 3,
  'inbound-learned': 2,
  manual: 1,
};

const QUALITY_PRIORITY: Record<IChannelPublishObjectCatalogEntry['displayProfile']['quality'], number> = {
  resolved: 3,
  inferred: 2,
  fallback: 1,
};

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = [
    ...new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    ),
  ];
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeCatalogSource(value: unknown): IChannelPublishObjectCatalogEntry['displayProfile']['source'] {
  return value === 'official-pull' || value === 'runtime-resolved' || value === 'inbound-learned' || value === 'manual'
    ? value
    : 'manual';
}

function normalizeDisplayQuality(value: unknown): IChannelPublishObjectCatalogEntry['displayProfile']['quality'] {
  return value === 'resolved' || value === 'inferred' || value === 'fallback' ? value : 'fallback';
}

function normalizePublishObjects(
  publishObjects: readonly IChannelPublishObjectCatalogEntry[]
): IChannelPublishObjectCatalogEntry[] {
  const merged = new Map<string, IChannelPublishObjectCatalogEntry>();

  for (const publishObject of publishObjects) {
    const normalizedEntry: IChannelPublishObjectCatalogEntry = {
      id: publishObject.id,
      channelAccountId: publishObject.channelAccountId,
      nativeObjectType: publishObject.nativeObjectType.trim() || 'chat',
      nativeObjectId: publishObject.nativeObjectId.trim() || 'connector-default',
      parentNativeObjectId: publishObject.parentNativeObjectId?.trim() || undefined,
      displayProfile: {
        title: publishObject.displayProfile.title.trim(),
        subtitle: publishObject.displayProfile.subtitle?.trim() || undefined,
        parentTitle: publishObject.displayProfile.parentTitle?.trim() || undefined,
        source: normalizeCatalogSource(publishObject.displayProfile.source),
        quality: normalizeDisplayQuality(publishObject.displayProfile.quality),
        resolvedAt: publishObject.displayProfile.resolvedAt,
      },
      aliases: normalizeStringArray(publishObject.aliases),
      rawFacts:
        publishObject.rawFacts && typeof publishObject.rawFacts === 'object' && !Array.isArray(publishObject.rawFacts)
          ? publishObject.rawFacts
          : undefined,
      createdAt: publishObject.createdAt,
      updatedAt: publishObject.updatedAt,
    };
    normalizedEntry.id = getChannelPublishObjectCatalogEntryIdentity(normalizedEntry);

    const existing = merged.get(normalizedEntry.id);
    if (!existing) {
      merged.set(normalizedEntry.id, normalizedEntry);
      continue;
    }

    const existingSource = SOURCE_PRIORITY[existing.displayProfile.source];
    const nextSource = SOURCE_PRIORITY[normalizedEntry.displayProfile.source];
    const existingQuality = QUALITY_PRIORITY[existing.displayProfile.quality];
    const nextQuality = QUALITY_PRIORITY[normalizedEntry.displayProfile.quality];
    const preferred =
      nextSource > existingSource ||
      (nextSource === existingSource &&
        (nextQuality > existingQuality ||
          (nextQuality === existingQuality && normalizedEntry.updatedAt > existing.updatedAt)))
        ? normalizedEntry
        : existing;
    const secondary = preferred === normalizedEntry ? existing : normalizedEntry;

    merged.set(preferred.id, {
      ...preferred,
      displayProfile: {
        ...preferred.displayProfile,
        subtitle: preferred.displayProfile.subtitle ?? secondary.displayProfile.subtitle,
        parentTitle: preferred.displayProfile.parentTitle ?? secondary.displayProfile.parentTitle,
      },
      aliases: normalizeStringArray([...(preferred.aliases ?? []), ...(secondary.aliases ?? [])]),
      rawFacts: {
        ...secondary.rawFacts,
        ...preferred.rawFacts,
      },
      createdAt: Math.min(existing.createdAt, normalizedEntry.createdAt),
      updatedAt: Math.max(existing.updatedAt, normalizedEntry.updatedAt),
    });
  }

  return Array.from(merged.values()).toSorted(
    (left, right) => right.updatedAt - left.updatedAt || left.id.localeCompare(right.id)
  );
}

function mapBindingDiscoverySource(
  binding: IChannelBinding
): IChannelPublishObjectCatalogEntry['displayProfile']['source'] {
  const publishObject = getChannelBindingPublishObject(binding);

  if (publishObject.discoverySource === 'pulled') {
    return 'official-pull';
  }

  if (publishObject.discoverySource === 'inbound-learned') {
    return 'inbound-learned';
  }

  return 'manual';
}

function toBindingCatalogEntry(binding: IChannelBinding, now: number): IChannelPublishObjectCatalogEntry | null {
  const channelAccountId = getChannelAccountId(binding);
  if (!channelAccountId) {
    return null;
  }

  const publishObject = getChannelBindingPublishObject(binding);
  const metadata =
    binding.metadata && typeof binding.metadata === 'object' && !Array.isArray(binding.metadata)
      ? binding.metadata
      : {};
  const title = publishObject.displayName ?? publishObject.nativeObjectId;
  const entry: IChannelPublishObjectCatalogEntry = {
    id: '',
    channelAccountId,
    nativeObjectType: publishObject.nativeObjectType,
    nativeObjectId: publishObject.nativeObjectId,
    parentNativeObjectId: publishObject.parentNativeObjectId,
    displayProfile: {
      title,
      subtitle: typeof metadata.objectSubtitle === 'string' ? metadata.objectSubtitle : undefined,
      parentTitle: typeof metadata.parentObjectTitle === 'string' ? metadata.parentObjectTitle : undefined,
      source: mapBindingDiscoverySource(binding),
      quality:
        title === publishObject.nativeObjectId || /^Topic\s+\S+$/u.test(title) || /^Channel\s+\S+$/u.test(title)
          ? 'fallback'
          : 'inferred',
      resolvedAt: binding.updatedAt || now,
    },
    aliases: normalizeStringArray([binding.scopeKey]),
    rawFacts:
      publishObject.metadata && typeof publishObject.metadata === 'object' && !Array.isArray(publishObject.metadata)
        ? publishObject.metadata
        : undefined,
    createdAt: binding.createdAt || now,
    updatedAt: binding.updatedAt || now,
  };
  entry.id = getChannelPublishObjectCatalogEntryIdentity(entry);
  return entry;
}

function toRemoteIdentityCatalogEntry(
  identity: IRemoteIdentity,
  connector: IConnectorInstance,
  now: number
): IChannelPublishObjectCatalogEntry {
  const publishObject = inferRemoteIdentityPublishObject(identity, connector.platform);
  const descriptor = describeRemoteIdentityObject(identity, connector.platform);
  const source: IChannelPublishObjectCatalogEntry['displayProfile']['source'] =
    typeof identity.metadata?.chatName === 'string' || typeof identity.metadata?.userDisplayName === 'string'
      ? 'runtime-resolved'
      : 'inbound-learned';
  const title = publishObject.displayName ?? descriptor.title;

  const entry: IChannelPublishObjectCatalogEntry = {
    id: '',
    channelAccountId: connector.id,
    nativeObjectType: publishObject.nativeObjectType,
    nativeObjectId: publishObject.nativeObjectId,
    parentNativeObjectId: publishObject.parentNativeObjectId,
    displayProfile: {
      title,
      subtitle: descriptor.subtitle,
      parentTitle: descriptor.parentTitle,
      source,
      quality: isChannelObjectFallbackTitle({
        platform: connector.platform,
        kind: descriptor.kind,
        title,
        nativeObjectId: publishObject.nativeObjectId,
      })
        ? 'fallback'
        : 'resolved',
      resolvedAt: identity.lastActive ?? now,
    },
    aliases: normalizeStringArray([identity.remoteChatId, identity.platformChatId, identity.remoteUserId]),
    rawFacts: {
      ...publishObject.metadata,
      ...(identity.remoteChatType ? { remoteChatType: identity.remoteChatType } : {}),
    },
    createdAt: identity.authorizedAt || now,
    updatedAt: identity.lastActive ?? now,
  };
  entry.id = getChannelPublishObjectCatalogEntryIdentity(entry);
  return entry;
}

const resolveConversationWorkspace = (conversation: Pick<TChatConversation, 'extra'>): string | undefined => {
  const extra = conversation.extra as Record<string, unknown> | undefined;
  const workspace = typeof extra?.workspace === 'string' ? extra.workspace : undefined;
  const workingDirectory = typeof extra?.workingDirectory === 'string' ? extra.workingDirectory : undefined;
  return resolveWorkspacePath(workingDirectory || workspace);
};

async function readJsonDocument<T>(targetPath: string): Promise<T | null> {
  if (!(await pathExists(targetPath))) {
    return null;
  }

  try {
    const raw = await fs.readFile(targetPath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJsonDocument(targetPath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function resolveAgentProfilesFile(workspacePath: string): string {
  return path.join(workspacePath, WORKSPACE_CHANNEL_AGENT_PROFILES_FILE);
}

function resolveBindingsFile(workspacePath: string): string {
  return path.join(workspacePath, WORKSPACE_CHANNEL_BINDINGS_FILE);
}

function resolvePublishObjectsFile(workspacePath: string): string {
  return path.join(workspacePath, WORKSPACE_CHANNEL_PUBLISH_OBJECTS_FILE);
}

function pickLatestById<T extends { id: string; updatedAt: number; createdAt: number }>(items: readonly T[]): T[] {
  const byId = new Map<string, T>();

  for (const item of items) {
    const existing = byId.get(item.id);
    if (
      !existing ||
      item.updatedAt > existing.updatedAt ||
      (item.updatedAt === existing.updatedAt && item.createdAt > existing.createdAt)
    ) {
      byId.set(item.id, item);
    }
  }

  return Array.from(byId.values()).toSorted(
    (left, right) => right.updatedAt - left.updatedAt || left.createdAt - right.createdAt
  );
}

export class ProjectChannelPublicationService {
  resolveConversationWorkspace(conversation: Pick<TChatConversation, 'extra'>): string | undefined {
    return getConversationWorkspacePath(conversation);
  }

  listConversationWorkspaces(conversations: readonly Pick<TChatConversation, 'extra'>[]): string[] {
    return Array.from(
      new Set(
        conversations
          .map((conversation) => this.resolveConversationWorkspace(conversation))
          .filter((workspacePath): workspacePath is string => Boolean(workspacePath))
      )
    ).toSorted((left, right) => left.localeCompare(right));
  }

  async readSnapshot(workspace?: string): Promise<ProjectChannelPublicationSnapshot | undefined> {
    const workspacePath = resolveWorkspacePath(workspace);
    if (!workspacePath) {
      return undefined;
    }

    try {
      const stat = await fs.stat(workspacePath);
      if (!stat.isDirectory()) {
        return undefined;
      }
    } catch {
      return undefined;
    }

    const [agentProfilesDoc, bindingsDoc, publishObjectsDoc] = await Promise.all([
      readJsonDocument<AgentProfileStoreDocument>(resolveAgentProfilesFile(workspacePath)),
      readJsonDocument<ChannelBindingStoreDocument>(resolveBindingsFile(workspacePath)),
      readJsonDocument<PublishObjectCatalogStoreDocument>(resolvePublishObjectsFile(workspacePath)),
    ]);

    return {
      workspacePath,
      agentProfiles: normalizeAgentProfiles(agentProfilesDoc?.agentProfiles ?? []),
      bindings: normalizeChannelBindings(bindingsDoc?.bindings ?? []),
      publishObjects: normalizePublishObjects(publishObjectsDoc?.publishObjects ?? []),
    };
  }

  async readCatalogForWorkspaces(workspaces: readonly string[]): Promise<ProjectChannelPublicationCatalog> {
    const uniqueWorkspaces = Array.from(
      new Set(
        workspaces
          .map((workspace) => resolveWorkspacePath(workspace))
          .filter((workspace): workspace is string => Boolean(workspace))
      )
    ).toSorted((left, right) => left.localeCompare(right));

    const snapshots = await Promise.all(uniqueWorkspaces.map((workspace) => this.readSnapshot(workspace)));
    const resolvedSnapshots = snapshots.filter((snapshot): snapshot is ProjectChannelPublicationSnapshot =>
      Boolean(snapshot)
    );
    const agentProfileWorkspaceById: Record<string, string> = {};
    const bindingWorkspaceById: Record<string, string> = {};
    const allProfiles: IAgentProfile[] = [];
    const allBindings: IChannelBinding[] = [];
    const allPublishObjects: IChannelPublishObjectCatalogEntry[] = [];

    for (const snapshot of resolvedSnapshots) {
      for (const profile of snapshot.agentProfiles) {
        allProfiles.push(profile);
        agentProfileWorkspaceById[profile.id] = snapshot.workspacePath;
      }
      for (const binding of snapshot.bindings) {
        allBindings.push(binding);
        bindingWorkspaceById[binding.id] = snapshot.workspacePath;
      }
      allPublishObjects.push(...snapshot.publishObjects);
    }

    return {
      workspaces: resolvedSnapshots.map((snapshot) => snapshot.workspacePath),
      agentProfiles: pickLatestById(normalizeAgentProfiles(allProfiles)),
      bindings: pickLatestById(normalizeChannelBindings(allBindings)),
      publishObjects: normalizePublishObjects(allPublishObjects),
      agentProfileWorkspaceById,
      bindingWorkspaceById,
    };
  }

  async readCatalogForConversations(
    conversations: readonly Pick<TChatConversation, 'extra'>[]
  ): Promise<ProjectChannelPublicationCatalog> {
    return this.readCatalogForWorkspaces(this.listConversationWorkspaces(conversations));
  }

  async resolvePublishObjectCatalog(
    workspace: string,
    params: {
      bindings: readonly IChannelBinding[];
      remoteIdentities: readonly IRemoteIdentity[];
      channelAccounts: readonly IConnectorInstance[];
    }
  ): Promise<IChannelPublishObjectCatalogEntry[]> {
    const workspacePath = resolveWorkspacePath(workspace);
    if (!workspacePath) {
      return [];
    }

    const snapshot = await this.readSnapshot(workspacePath);
    const connectorMap = new Map(params.channelAccounts.map((connector) => [connector.id, connector] as const));
    const now = Date.now();
    const bindingEntries = params.bindings
      .map((binding) => toBindingCatalogEntry(binding, now))
      .filter((entry): entry is IChannelPublishObjectCatalogEntry => Boolean(entry));
    const remoteIdentityEntries = params.remoteIdentities
      .map((identity) => {
        const connector = connectorMap.get(getChannelAccountId(identity) ?? identity.connectorId);
        return connector ? toRemoteIdentityCatalogEntry(identity, connector, now) : null;
      })
      .filter((entry): entry is IChannelPublishObjectCatalogEntry => Boolean(entry));
    const publishObjects = normalizePublishObjects([
      ...(snapshot?.publishObjects ?? []),
      ...bindingEntries,
      ...remoteIdentityEntries,
    ]);

    await writeJsonDocument(resolvePublishObjectsFile(workspacePath), {
      version: CHANNEL_STORAGE_VERSION,
      publishObjects,
    } satisfies PublishObjectCatalogStoreDocument);

    return publishObjects;
  }

  async getAgentProfile(workspace: string, profileId: string): Promise<IAgentProfile | null> {
    const snapshot = await this.readSnapshot(workspace);
    return snapshot?.agentProfiles.find((profile) => profile.id === profileId) ?? null;
  }

  async getAgentProfileByPublishedConversation(
    workspace: string,
    conversationId: string
  ): Promise<IAgentProfile | null> {
    const snapshot = await this.readSnapshot(workspace);
    return snapshot?.agentProfiles.find((profile) => profile.publishedFromConversationId === conversationId) ?? null;
  }

  async upsertAgentProfile(workspace: string, profile: IAgentProfile): Promise<IAgentProfile> {
    const workspacePath = resolveWorkspacePath(workspace);
    if (!workspacePath) {
      throw new Error('Workspace path is required to persist a project publication profile');
    }

    const snapshot = await this.readSnapshot(workspacePath);
    const nextProfile: IAgentProfile = {
      ...profile,
      workspaceRef: profile.workspaceRef?.trim() || workspacePath,
      spaceId: profile.spaceId?.trim() || undefined,
      promptProfile: profile.promptProfile ?? {},
      toolPolicy: profile.toolPolicy ?? {},
      memoryPolicy: profile.memoryPolicy ?? {},
      delegationPolicy: profile.delegationPolicy ?? {},
      archived: profile.archived === true,
    };

    const agentProfiles = normalizeAgentProfiles([
      ...(snapshot?.agentProfiles.filter((item) => item.id !== nextProfile.id) ?? []),
      nextProfile,
    ]);

    await writeJsonDocument(resolveAgentProfilesFile(workspacePath), {
      version: CHANNEL_STORAGE_VERSION,
      agentProfiles,
    } satisfies AgentProfileStoreDocument);

    return nextProfile;
  }

  async getChannelBindings(workspace: string, channelAccountId?: string): Promise<IChannelBinding[]> {
    const snapshot = await this.readSnapshot(workspace);
    if (!snapshot) {
      return [];
    }

    return channelAccountId
      ? snapshot.bindings.filter((binding) => binding.channelAccountId === channelAccountId)
      : snapshot.bindings;
  }

  async upsertChannelBinding(workspace: string, binding: IChannelBinding): Promise<IChannelBinding> {
    if (binding.temporary) {
      throw new Error('Temporary channel bindings are runtime state and cannot be stored in project config');
    }

    const workspacePath = resolveWorkspacePath(workspace);
    if (!workspacePath) {
      throw new Error('Workspace path is required to persist a project channel binding');
    }

    const snapshot = await this.readSnapshot(workspacePath);
    const nextBinding = withChannelAccountId({
      ...binding,
      temporary: false,
      metadata: binding.metadata ?? {},
      scopeKey: binding.scopeKey?.trim() || undefined,
    });

    const bindings = normalizeChannelBindings([
      ...(snapshot?.bindings.filter((item) => item.id !== nextBinding.id) ?? []),
      nextBinding,
    ]);

    await writeJsonDocument(resolveBindingsFile(workspacePath), {
      version: CHANNEL_STORAGE_VERSION,
      bindings,
    } satisfies ChannelBindingStoreDocument);

    return nextBinding;
  }

  async deleteChannelBinding(workspace: string, bindingId: string): Promise<boolean> {
    const workspacePath = resolveWorkspacePath(workspace);
    if (!workspacePath) {
      return false;
    }

    const snapshot = await this.readSnapshot(workspacePath);
    if (!snapshot) {
      return false;
    }

    const bindings = snapshot.bindings.filter((binding) => binding.id !== bindingId);
    if (bindings.length === snapshot.bindings.length) {
      return false;
    }

    await writeJsonDocument(resolveBindingsFile(workspacePath), {
      version: CHANNEL_STORAGE_VERSION,
      bindings: normalizeChannelBindings(bindings),
    } satisfies ChannelBindingStoreDocument);

    return true;
  }
}
