/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  AgentActivityState,
  IExtensionAgentActivityEvent,
  IExtensionAgentActivityItem,
  IExtensionAgentActivitySnapshot,
  IExtensionSystemRunItem,
} from '@/common/adapter/ipcBridge';
import type { TMessage } from '@/common/chat/chatLib';
import { getConversationRuntimeBackend, type TChatConversation } from '@/common/config/storage';
import type { IChannelRun } from '@process/channels/types';
import { getDatabase } from '@process/services/database';
import type { IConversationRepository } from '@process/services/database/IConversationRepository';
import type { IWorkerTaskManager } from '@process/task/IWorkerTaskManager';

const STATUS_TO_SYNCING = new Set(['connecting', 'connected', 'authenticated']);
const CONTEXT_ENGINE_BACKEND = 'context-engine';

type MaintenanceRunMetadata = {
  kind?: string;
  systemManaged?: boolean;
  assistantId?: string;
  systemOwner?: string;
  systemRole?: string;
  governanceIdentity?: string;
  jobType?: string;
  threadId?: string;
  projectSlug?: string;
  reason?: string;
  source?: string;
  trigger?: {
    label?: string;
    event?: string;
  };
  executionBoundary?: {
    vaultRoot?: string;
    spaceName?: string;
    spaceId?: string;
  };
  currentTask?: string;
  scopeLabel?: string;
  latestArtifactSummary?: string;
  artifactRelativePath?: string;
  artifactTitle?: string;
  artifactTargets?: string[];
  events?: Array<{
    kind: 'status' | 'tool' | 'message';
    text: string;
    at: number;
  }>;
};

const normalizeRuntimeStatus = (status?: string): 'pending' | 'running' | 'finished' | 'unknown' => {
  if (status === 'pending' || status === 'running' || status === 'finished') return status;
  return 'unknown';
};

const normalizeRunRuntimeStatus = (status: IChannelRun['status']): 'pending' | 'running' | 'finished' | 'unknown' => {
  if (status === 'error' || status === 'cancelled' || status === 'terminated') {
    return 'finished';
  }
  return normalizeRuntimeStatus(status);
};

const mapStatusToState = (
  runtimeStatus: 'pending' | 'running' | 'finished' | 'unknown',
  lastStatus?: string,
  recentEvents: IExtensionAgentActivityEvent[] = []
): AgentActivityState => {
  if (lastStatus === 'error' || recentEvents.some((e) => /error|failed|失败|异常/i.test(e.text))) return 'error';

  const hasWriteEvent = recentEvents.some((e) => /write|patch|edit|写入|修改|生成文件/i.test(e.text));
  const hasResearchEvent = recentEvents.some((e) => /search|web|fetch|crawl|调研|检索|搜索/i.test(e.text));
  const hasToolEvent = recentEvents.some((e) => e.kind === 'tool');

  if (runtimeStatus === 'pending' || (lastStatus && STATUS_TO_SYNCING.has(lastStatus))) return 'syncing';
  if (runtimeStatus === 'running' && hasWriteEvent) return 'writing';
  if (runtimeStatus === 'running' && hasResearchEvent) return 'researching';
  if (runtimeStatus === 'running' && hasToolEvent) return 'executing';
  return 'idle';
};

const resolveAgentIdentity = (conversation: TChatConversation): { backend: string; agentName: string } => {
  if (
    (conversation.extra as { groupMeta?: { hiddenFromHistory?: boolean } } | undefined)?.groupMeta?.hiddenFromHistory
  ) {
    return { backend: 'hidden', agentName: 'Hidden Conversation' };
  }
  if (conversation.type === 'acp') {
    const backend = getConversationRuntimeBackend(conversation);
    const agentName = String(conversation.extra?.agentName || backend);
    return { backend, agentName };
  }
  if (conversation.type === 'codex') {
    return { backend: 'codex', agentName: 'Codex' };
  }
  if (conversation.type === 'gemini') {
    return { backend: 'gemini', agentName: 'Gemini' };
  }
  if (conversation.type === 'group') {
    return { backend: 'group', agentName: 'Group' };
  }
  return { backend: 'unknown', agentName: 'Unknown' };
};

const toEventText = (message: TMessage): { kind: 'status' | 'tool' | 'message'; text: string; at: number } | null => {
  const at = Number(message.createdAt || Date.now());
  if (message.type === 'agent_status') {
    const content = (message.content || {}) as { status?: string };
    return {
      kind: 'status',
      text: `状态: ${String(content.status || 'unknown')}`,
      at,
    };
  }

  if (
    message.type === 'tool_call' ||
    message.type === 'acp_tool_call' ||
    message.type === 'codex_tool_call' ||
    message.type === 'tool_group'
  ) {
    return { kind: 'tool', text: '工具执行中', at };
  }

  if (message.type === 'text' && message.position === 'left') {
    const content = message.content as { content?: string };
    const text = String(content?.content || '').trim();
    if (!text) return null;
    return { kind: 'message', text: text.slice(0, 80), at };
  }

  return null;
};

const rankedState: Record<AgentActivityState, number> = {
  error: 5,
  writing: 4,
  researching: 3,
  executing: 2,
  syncing: 1,
  idle: 0,
};

function readMaintenanceMetadata(run: IChannelRun): MaintenanceRunMetadata {
  if (!run.metadata || typeof run.metadata !== 'object' || Array.isArray(run.metadata)) {
    return {};
  }
  return run.metadata as MaintenanceRunMetadata;
}

function getDefaultTaskLabel(runtimeStatus: 'pending' | 'running' | 'finished' | 'unknown'): string {
  return runtimeStatus === 'running' || runtimeStatus === 'pending' ? '执行中' : '空闲';
}

function mergeActivityItem(
  byAgent: Map<string, IExtensionAgentActivityItem>,
  key: string,
  next: IExtensionAgentActivityItem
): void {
  const existing = byAgent.get(key);
  if (!existing) {
    byAgent.set(key, next);
    return;
  }

  existing.conversations += next.conversations;
  existing.activeConversations += next.activeConversations;

  if (next.lastActiveAt > existing.lastActiveAt) {
    existing.lastActiveAt = next.lastActiveAt;
    existing.currentTask = next.currentTask || existing.currentTask;
    existing.lastStatus = next.lastStatus || existing.lastStatus;
    existing.scopeLabel = next.scopeLabel || existing.scopeLabel;
    existing.assistantId = next.assistantId || existing.assistantId;
    existing.systemOwner = next.systemOwner || existing.systemOwner;
    existing.systemRole = next.systemRole || existing.systemRole;
    existing.maintenanceKind = next.maintenanceKind || existing.maintenanceKind;
    existing.artifactRelativePath = next.artifactRelativePath || existing.artifactRelativePath;
    existing.artifactTitle = next.artifactTitle || existing.artifactTitle;
  }

  if (!existing.assistantId && next.assistantId) {
    existing.assistantId = next.assistantId;
  }
  if (!existing.systemOwner && next.systemOwner) {
    existing.systemOwner = next.systemOwner;
  }
  if (!existing.systemRole && next.systemRole) {
    existing.systemRole = next.systemRole;
  }
  if (!existing.maintenanceKind && next.maintenanceKind) {
    existing.maintenanceKind = next.maintenanceKind;
  }
  if (!existing.artifactRelativePath && next.artifactRelativePath) {
    existing.artifactRelativePath = next.artifactRelativePath;
  }
  if (!existing.artifactTitle && next.artifactTitle) {
    existing.artifactTitle = next.artifactTitle;
  }

  if (next.runtimeStatus === 'running') {
    existing.runtimeStatus = 'running';
  } else if (next.runtimeStatus === 'pending' && existing.runtimeStatus !== 'running') {
    existing.runtimeStatus = 'pending';
  } else if (next.runtimeStatus === 'finished' && existing.runtimeStatus === 'unknown') {
    existing.runtimeStatus = 'finished';
  }

  if (rankedState[next.state] > rankedState[existing.state]) {
    existing.state = next.state;
  }

  existing.recentEvents = [...existing.recentEvents, ...next.recentEvents].toSorted((a, b) => b.at - a.at).slice(0, 6);
}

async function resolveMaintenanceAgentName(run: IChannelRun, cache: Map<string, string>): Promise<string> {
  const cached = cache.get(run.agentProfileId);
  if (cached) {
    return cached;
  }

  const db = await getDatabase();
  const profile = db.getAgentProfile(run.agentProfileId);
  const name = profile.success && profile.data?.name ? profile.data.name : run.agentProfileId;
  cache.set(run.agentProfileId, name);
  return name;
}

function toMaintenanceEvents(run: IChannelRun, metadata: MaintenanceRunMetadata): IExtensionAgentActivityEvent[] {
  const baseConversationId = run.conversationId || run.id;
  const events = Array.isArray(metadata.events)
    ? metadata.events
        .filter((event) => Boolean(event?.text))
        .map(
          (event): IExtensionAgentActivityEvent => ({
            conversationId: baseConversationId,
            kind: event.kind,
            text: event.text,
            at: event.at,
          })
        )
    : [];

  if (events.length > 0) {
    return events.toSorted((a, b) => b.at - a.at).slice(0, 6);
  }

  const at = run.endedAt || run.startedAt || Date.now();
  return [
    {
      conversationId: baseConversationId,
      kind: 'status',
      text: metadata.currentTask || run.status,
      at,
    },
  ];
}

export class ActivitySnapshotBuilder {
  constructor(
    private readonly repo: IConversationRepository,
    private readonly taskManager: IWorkerTaskManager
  ) {}

  async build(): Promise<IExtensionAgentActivitySnapshot> {
    const conversationsResult = await this.repo.getUserConversations(undefined, 0, 10000);
    const conversations = conversationsResult.data.filter((conv) => {
      const extra = conv.extra as { isHealthCheck?: boolean; groupMeta?: { hiddenFromHistory?: boolean } } | undefined;
      return extra?.isHealthCheck !== true && extra?.groupMeta?.hiddenFromHistory !== true;
    });

    const byAgent = new Map<string, IExtensionAgentActivityItem>();
    const systemRuns: IExtensionSystemRunItem[] = [];
    const conversationSnapshots = await Promise.all(
      conversations.map(async (conversation) => {
        const { backend, agentName } = resolveAgentIdentity(conversation);
        const task = this.taskManager.getTask(conversation.id);
        const runtimeStatus = normalizeRuntimeStatus(task?.status || conversation.status);
        const recentMessagesResult = await this.repo.getMessages(conversation.id, 0, 20, 'DESC');
        const recentMessages = recentMessagesResult.data;
        const events = recentMessages
          .map((m) => toEventText(m))
          .filter(
            (
              e
            ): e is {
              kind: 'status' | 'tool' | 'message';
              text: string;
              at: number;
            } => Boolean(e)
          )
          .slice(0, 6)
          .map(
            (e): IExtensionAgentActivityEvent => ({
              conversationId: conversation.id,
              kind: e.kind,
              text: e.text,
              at: e.at,
            })
          );

        const lastStatus = recentMessages.find((m) => m.type === 'agent_status')?.content as
          | { status?: string }
          | undefined;
        const state = mapStatusToState(runtimeStatus, lastStatus?.status, events);

        return {
          conversation,
          backend,
          agentName,
          runtimeStatus,
          lastStatus: lastStatus?.status,
          state,
          events,
        };
      })
    );

    let runningConversations = 0;

    for (const snapshot of conversationSnapshots) {
      if (snapshot.runtimeStatus === 'running' || snapshot.runtimeStatus === 'pending') {
        runningConversations += 1;
      }

      const key = `${snapshot.backend}::${snapshot.agentName}`;
      const latestEventAt = snapshot.events[0]?.at || snapshot.conversation.modifyTime || Date.now();
      mergeActivityItem(byAgent, key, {
        id: key,
        backend: snapshot.backend,
        agentName: snapshot.agentName,
        state: snapshot.state,
        runtimeStatus: snapshot.runtimeStatus,
        conversations: 1,
        activeConversations: snapshot.runtimeStatus === 'running' || snapshot.runtimeStatus === 'pending' ? 1 : 0,
        lastActiveAt: latestEventAt,
        lastStatus: snapshot.lastStatus,
        currentTask: snapshot.events[0]?.text || getDefaultTaskLabel(snapshot.runtimeStatus),
        runType: 'interactive',
        recentEvents: snapshot.events,
      });
    }

    const db = await getDatabase();
    const runsResult = db.listChannelRuns({
      backend: CONTEXT_ENGINE_BACKEND,
      limit: 40,
    });
    const profileNameCache = new Map<string, string>();
    const runs = runsResult.success ? runsResult.data || [] : [];
    const maintenanceSnapshots = await Promise.all(
      runs.map(async (run) => {
        const metadata = readMaintenanceMetadata(run);
        if (metadata.systemManaged !== true) {
          return null;
        }

        const agentName = await resolveMaintenanceAgentName(run, profileNameCache);
        const runtimeStatus = normalizeRunRuntimeStatus(run.status);
        const events = toMaintenanceEvents(run, metadata);
        const lastStatus = run.status === 'error' ? 'error' : run.status;
        const state = mapStatusToState(runtimeStatus, lastStatus, events);

        return {
          run,
          metadata,
          agentName,
          runtimeStatus,
          events,
          state,
        };
      })
    );

    for (const snapshot of maintenanceSnapshots) {
      if (!snapshot) {
        continue;
      }

      const key = `${snapshot.run.backend}::${snapshot.agentName}`;
      const latestEventAt = snapshot.events[0]?.at || snapshot.run.endedAt || snapshot.run.startedAt || Date.now();

      mergeActivityItem(byAgent, key, {
        id: key,
        backend: snapshot.run.backend,
        agentName: snapshot.agentName,
        state: snapshot.state,
        runtimeStatus: snapshot.runtimeStatus,
        conversations: 1,
        activeConversations: snapshot.runtimeStatus === 'running' || snapshot.runtimeStatus === 'pending' ? 1 : 0,
        lastActiveAt: latestEventAt,
        lastStatus: snapshot.run.status,
        currentTask:
          snapshot.metadata.currentTask || snapshot.events[0]?.text || getDefaultTaskLabel(snapshot.runtimeStatus),
        runType: 'maintenance',
        systemManaged: true,
        assistantId: snapshot.metadata.assistantId,
        systemOwner: snapshot.metadata.systemOwner,
        systemRole: snapshot.metadata.systemRole,
        governanceIdentity: snapshot.metadata.governanceIdentity,
        scopeLabel: snapshot.metadata.scopeLabel,
        maintenanceKind: snapshot.metadata.jobType,
        latestArtifactSummary: snapshot.metadata.latestArtifactSummary,
        artifactRelativePath: snapshot.metadata.artifactRelativePath,
        artifactTitle: snapshot.metadata.artifactTitle,
        artifactTargets: snapshot.metadata.artifactTargets,
        recentEvents: snapshot.events,
      });

      systemRuns.push({
        id: snapshot.run.id,
        rootRunId: snapshot.run.rootRunId,
        backend: snapshot.run.backend,
        agentProfileId: snapshot.run.agentProfileId,
        agentName: snapshot.agentName,
        state: snapshot.state,
        runtimeStatus: snapshot.runtimeStatus,
        lastActiveAt: latestEventAt,
        lastStatus: snapshot.run.status,
        currentTask:
          snapshot.metadata.currentTask || snapshot.events[0]?.text || getDefaultTaskLabel(snapshot.runtimeStatus),
        systemManaged: snapshot.metadata.systemManaged === true,
        assistantId: snapshot.metadata.assistantId,
        systemOwner: snapshot.metadata.systemOwner,
        systemRole: snapshot.metadata.systemRole,
        governanceIdentity: snapshot.metadata.governanceIdentity,
        scopeLabel: snapshot.metadata.scopeLabel,
        maintenanceKind: snapshot.metadata.jobType,
        latestArtifactSummary: snapshot.metadata.latestArtifactSummary,
        artifactRelativePath: snapshot.metadata.artifactRelativePath,
        artifactTitle: snapshot.metadata.artifactTitle,
        artifactTargets: snapshot.metadata.artifactTargets,
        threadId: snapshot.metadata.threadId || snapshot.run.conversationId,
        projectSlug: snapshot.metadata.projectSlug,
        reason: snapshot.metadata.reason,
        source: snapshot.metadata.source,
        triggerLabel: snapshot.metadata.trigger?.label,
        triggerEvent: snapshot.metadata.trigger?.event,
        executionBoundaryPath: snapshot.metadata.executionBoundary?.vaultRoot,
        executionBoundaryLabel:
          snapshot.metadata.executionBoundary?.spaceName || snapshot.metadata.executionBoundary?.spaceId,
        recentEvents: snapshot.events,
      });
    }

    return {
      generatedAt: Date.now(),
      totalConversations: conversations.length,
      runningConversations,
      agents: Array.from(byAgent.values()).toSorted((a, b) => b.lastActiveAt - a.lastActiveAt),
      systemRuns: systemRuns.toSorted((a, b) => b.lastActiveAt - a.lastActiveAt),
    };
  }
}
