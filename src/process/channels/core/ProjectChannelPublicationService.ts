/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TChatConversation } from '@/common/config/storage';
import { resolveWorkspacePath, WORKSPACE_AUTOMATION_DIR } from '@process/bridge/services/workspaceAutomation';
import type { IAgentProfile, IChannelBinding } from '@process/channels/types';
import { withChannelAccountId } from '@process/channels/types';
import fs from 'node:fs/promises';
import path from 'node:path';

const WORKSPACE_CHANNELS_DIR = path.join(WORKSPACE_AUTOMATION_DIR, 'channels');
const WORKSPACE_CHANNEL_AGENT_PROFILES_FILE = path.join(WORKSPACE_CHANNELS_DIR, 'agent-profiles.json');
const WORKSPACE_CHANNEL_BINDINGS_FILE = path.join(WORKSPACE_CHANNELS_DIR, 'bindings.json');
const CHANNEL_STORAGE_VERSION = 1;

type AgentProfileStoreDocument = {
  version: number;
  agentProfiles: IAgentProfile[];
};

type ChannelBindingStoreDocument = {
  version: number;
  bindings: IChannelBinding[];
};

export type ProjectChannelPublicationSnapshot = {
  workspacePath: string;
  agentProfiles: IAgentProfile[];
  bindings: IChannelBinding[];
};

export type ProjectChannelPublicationCatalog = {
  workspaces: string[];
  agentProfiles: IAgentProfile[];
  bindings: IChannelBinding[];
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
      return {
        ...normalized,
        scopeKey: normalized.scopeKey?.trim() || undefined,
      } satisfies IChannelBinding;
    })
    .toSorted((left, right) => right.priority - left.priority || left.createdAt - right.createdAt);
};

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

    const [agentProfilesDoc, bindingsDoc] = await Promise.all([
      readJsonDocument<AgentProfileStoreDocument>(resolveAgentProfilesFile(workspacePath)),
      readJsonDocument<ChannelBindingStoreDocument>(resolveBindingsFile(workspacePath)),
    ]);

    return {
      workspacePath,
      agentProfiles: normalizeAgentProfiles(agentProfilesDoc?.agentProfiles ?? []),
      bindings: normalizeChannelBindings(bindingsDoc?.bindings ?? []),
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

    for (const snapshot of resolvedSnapshots) {
      for (const profile of snapshot.agentProfiles) {
        allProfiles.push(profile);
        agentProfileWorkspaceById[profile.id] = snapshot.workspacePath;
      }
      for (const binding of snapshot.bindings) {
        allBindings.push(binding);
        bindingWorkspaceById[binding.id] = snapshot.workspacePath;
      }
    }

    return {
      workspaces: resolvedSnapshots.map((snapshot) => snapshot.workspacePath),
      agentProfiles: pickLatestById(normalizeAgentProfiles(allProfiles)),
      bindings: pickLatestById(normalizeChannelBindings(allBindings)),
      agentProfileWorkspaceById,
      bindingWorkspaceById,
    };
  }

  async readCatalogForConversations(
    conversations: readonly Pick<TChatConversation, 'extra'>[]
  ): Promise<ProjectChannelPublicationCatalog> {
    return this.readCatalogForWorkspaces(this.listConversationWorkspaces(conversations));
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
