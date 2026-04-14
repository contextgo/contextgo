/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { getDatabase } from '@process/services/database';
import { SpaceVaultContextSyncService } from '@process/services/space/SpaceVaultContextSyncService';
import path from 'node:path';
import type { ProfileSegment } from '../../../../../packages/context-engine/src/domain';
import { collectSessionSignalKinds } from '../ContextJobOrchestrator';
import type { ContextServiceImpl } from '../ContextServiceImpl';
import {
  createSessionCompactionProfileId,
  createSessionCompactionProfileKey,
  type ContextJob,
  type ProjectPromotionCandidate,
  type SessionCompactionArtifact,
  type SessionCompactionSnapshot,
} from '../contextDomain';
import { ContextCompactionSummarizer } from './ContextCompactionSummarizer';

type SupportedContextService = Pick<
  ContextServiceImpl,
  'evaluateCompaction' | 'listMemoryCandidates' | 'listProfiles' | 'saveProfile'
>;

type SupportedVaultSyncService = Pick<
  SpaceVaultContextSyncService,
  'appendContextCheckpoint' | 'writeSessionWorkingSet'
>;

const SESSIONS_DIR = 'Sessions';

function sanitizeSessionPathSegment(value: string): string {
  return (
    value
      .trim()
      .replace(/[^a-z0-9._-]+/gi, '-')
      .replace(/^-+|-+$/g, '') || 'session'
  );
}

function getSessionArtifactRelativePath(threadId: string): string {
  return path.posix.join(SESSIONS_DIR, `${sanitizeSessionPathSegment(threadId)}.md`);
}

function estimateTokenCount(value: string | undefined): number {
  if (!value) {
    return 0;
  }
  const normalized = value.trim();
  return normalized ? Math.max(1, Math.ceil(normalized.length / 4)) : 0;
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function getSnapshot(job: ContextJob): SessionCompactionSnapshot {
  const snapshot = job.payload.snapshot;
  if (!snapshot || typeof snapshot !== 'object') {
    return {
      userTurns: 0,
      assistantReplies: 0,
      interruptions: 0,
      recentSignals: [],
    };
  }

  const typed = snapshot as Partial<SessionCompactionSnapshot>;
  return {
    userTurns: typed.userTurns ?? 0,
    assistantReplies: typed.assistantReplies ?? 0,
    interruptions: typed.interruptions ?? 0,
    lastUserGoal: typed.lastUserGoal,
    lastAssistantOutcome: typed.lastAssistantOutcome,
    recentSignals: typed.recentSignals ?? [],
  };
}

function deriveCompactionTopic(
  candidateKinds: readonly string[],
  signalKinds: readonly string[]
): 'preference' | 'constraint' | 'decision' | 'identity' | 'workflow' {
  if (candidateKinds.includes('workflow')) {
    return 'workflow';
  }
  if (candidateKinds.includes('decision')) {
    return 'decision';
  }
  if (candidateKinds.includes('constraint')) {
    return 'constraint';
  }
  if (candidateKinds.includes('identity')) {
    return 'identity';
  }
  if (signalKinds.includes('repeated_request') || signalKinds.includes('strategy_shift')) {
    return 'workflow';
  }
  return 'preference';
}

function buildProfileSummary(input: {
  currentTask?: string;
  stableStrategies: readonly string[];
  failureModes: readonly string[];
  pendingConstraints: readonly string[];
  pressure: number;
}): string {
  return [
    input.currentTask ? `Current task: ${input.currentTask}` : undefined,
    input.stableStrategies.length > 0
      ? ['Stable strategies:', ...input.stableStrategies.map((item) => `- ${item}`)].join('\n')
      : undefined,
    input.failureModes.length > 0
      ? ['Failure modes:', ...input.failureModes.map((item) => `- ${item}`)].join('\n')
      : undefined,
    input.pendingConstraints.length > 0
      ? ['Pending constraints:', ...input.pendingConstraints.map((item) => `- ${item}`)].join('\n')
      : undefined,
    `Compaction pressure: ${input.pressure}`,
  ]
    .filter((value): value is string => Boolean(value))
    .join('\n\n');
}

function buildDetail(input: {
  snapshot: SessionCompactionSnapshot;
  signalKinds: readonly string[];
  currentTask?: string;
  stableStrategies: readonly string[];
  failureModes: readonly string[];
  pendingConstraints: readonly string[];
  promotedSummaries: readonly string[];
  pendingSummaries: readonly string[];
  decision: {
    pressure: number;
    strategy: string;
    shouldCompact: boolean;
    rationale: readonly string[];
  };
}): string {
  return [
    '## Session State',
    '',
    `- User turns in snapshot: ${input.snapshot.userTurns}`,
    `- Assistant replies in snapshot: ${input.snapshot.assistantReplies}`,
    `- Interruptions in snapshot: ${input.snapshot.interruptions}`,
    input.snapshot.lastUserGoal ? `- Latest user goal: ${input.snapshot.lastUserGoal}` : '',
    input.snapshot.lastAssistantOutcome ? `- Latest assistant outcome: ${input.snapshot.lastAssistantOutcome}` : '',
    '',
    '## Structured Compaction',
    '',
    input.currentTask ? `- Current task: ${input.currentTask}` : '- Current task: not resolved yet.',
    '',
    '### Stable Strategies',
    '',
    ...(input.stableStrategies.length > 0
      ? input.stableStrategies.map((summary) => `- ${summary}`)
      : ['- No stable strategies extracted yet.']),
    '',
    '### Failure Modes',
    '',
    ...(input.failureModes.length > 0
      ? input.failureModes.map((summary) => `- ${summary}`)
      : ['- No recurring failure modes detected yet.']),
    '',
    '### Pending Constraints',
    '',
    ...(input.pendingConstraints.length > 0
      ? input.pendingConstraints.map((summary) => `- ${summary}`)
      : ['- No unresolved constraints detected.']),
    '',
    '## Signals',
    '',
    ...(input.signalKinds.length > 0
      ? input.signalKinds.map((kind) => `- ${kind}`)
      : ['- No durable session signals yet.']),
    '',
    '## Stable Takeaways',
    '',
    ...(input.promotedSummaries.length > 0
      ? input.promotedSummaries.slice(0, 4).map((summary) => `- ${summary}`)
      : ['- No promoted memory candidates yet.']),
    '',
    '## Pending Review',
    '',
    ...(input.pendingSummaries.length > 0
      ? input.pendingSummaries.slice(0, 4).map((summary) => `- ${summary}`)
      : ['- No pending review candidates.']),
    '',
    '## Compaction Decision',
    '',
    `- Pressure: ${input.decision.pressure}`,
    `- Strategy: ${input.decision.strategy}`,
    `- Should compact now: ${input.decision.shouldCompact ? 'yes' : 'no'}`,
    `- Rationale: ${input.decision.rationale.join(', ')}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function buildPromotionCandidate(input: {
  job: ContextJob;
  currentTask?: string;
  stableStrategies: readonly string[];
  pendingConstraints: readonly string[];
  promotedCount: number;
  pressure: number;
}): ProjectPromotionCandidate | undefined {
  if (!input.job.projectSlug || !input.job.threadId) {
    return undefined;
  }

  const summary = input.stableStrategies[0] ?? input.currentTask;
  if (!summary) {
    return undefined;
  }

  const detailParts = [
    input.currentTask ? `Current task: ${input.currentTask}` : undefined,
    input.stableStrategies.length > 1
      ? ['Stable strategies:', ...input.stableStrategies.slice(1).map((item) => `- ${item}`)].join('\n')
      : undefined,
    input.pendingConstraints.length > 0
      ? ['Pending constraints:', ...input.pendingConstraints.map((item) => `- ${item}`)].join('\n')
      : undefined,
    `Promoted signals: ${input.promotedCount}`,
    `Compaction pressure: ${input.pressure}`,
  ].filter((value): value is string => Boolean(value));

  return {
    projectSlug: input.job.projectSlug,
    summary,
    detail: detailParts.join('\n\n') || undefined,
    sourceThreadIds: [input.job.threadId],
    confidence: Math.min(0.96, 0.78 + input.promotedCount * 0.04 + Math.min(0.08, input.pressure / 1000)),
  };
}

export class SessionCompactionJobHandler {
  constructor(
    private readonly contextService: SupportedContextService,
    private readonly vaultSyncService: SupportedVaultSyncService = new SpaceVaultContextSyncService(),
    private readonly summarizer = new ContextCompactionSummarizer()
  ) {}

  async run(job: ContextJob): Promise<SessionCompactionArtifact | undefined> {
    if (job.type !== 'session_compaction' || !job.threadId) {
      return undefined;
    }

    const snapshot = getSnapshot(job);
    const candidates = await this.contextService.listMemoryCandidates({
      spaceId: job.spaceId,
      threadId: job.threadId,
    });
    const promotedCandidates = candidates.filter((candidate) => candidate.state === 'promoted');
    const approvedCandidates = candidates.filter((candidate) => candidate.state === 'approved');
    const pendingCandidates = candidates.filter((candidate) => candidate.state === 'pending_review');
    const stableCandidates = [...promotedCandidates, ...approvedCandidates];
    const promotedSummaries = uniqueStrings(stableCandidates.map((candidate) => candidate.summary));
    const pendingSummaries = uniqueStrings(pendingCandidates.map((candidate) => candidate.summary));
    const signalKinds = collectSessionSignalKinds(snapshot.recentSignals);
    const normalizedCandidateSummaries = candidates
      .map((candidate) => candidate.summary.trim().toLowerCase())
      .filter(Boolean);
    const redundantMemoryCount = Math.max(
      0,
      normalizedCandidateSummaries.length - new Set(normalizedCandidateSummaries).size
    );
    const distinctSourceCount = new Set(candidates.flatMap((candidate) => candidate.sourceIds)).size;
    const approximateTokenCount = [
      snapshot.lastUserGoal,
      snapshot.lastAssistantOutcome,
      ...promotedSummaries,
      ...pendingSummaries,
    ].reduce((sum, value) => sum + estimateTokenCount(value), 0);
    const decision = await this.contextService.evaluateCompaction({
      spaceId: job.spaceId,
      candidate: {
        topic: deriveCompactionTopic(
          stableCandidates.map((candidate) => candidate.kind),
          signalKinds
        ),
        acceptedMemoryCount: stableCandidates.length,
        redundantMemoryCount,
        contradictoryMemoryCount: 0,
        staleMemoryCount: Math.max(0, snapshot.interruptions - 1),
        distinctSourceCount,
        approximateTokenCount,
      },
    });

    const structured = await this.summarizer.summarize({
      job,
      snapshot,
      signalKinds,
      promotedSummaries,
      pendingSummaries,
      decision,
    });
    const summary = buildProfileSummary({
      currentTask: structured.currentTask,
      stableStrategies: structured.stableStrategies,
      failureModes: structured.failureModes,
      pendingConstraints: structured.pendingConstraints,
      pressure: decision.pressure,
    });
    const detail = buildDetail({
      snapshot,
      signalKinds,
      currentTask: structured.currentTask,
      stableStrategies: structured.stableStrategies,
      failureModes: structured.failureModes,
      pendingConstraints: structured.pendingConstraints,
      promotedSummaries,
      pendingSummaries,
      decision,
    });
    const key = createSessionCompactionProfileKey(job.threadId);
    const existingProfile = (
      await this.contextService.listProfiles({
        spaceId: job.spaceId,
        keyPrefix: key,
        state: 'active',
      })
    ).toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
    const now = new Date().toISOString();
    const profile: ProfileSegment = {
      id: existingProfile?.id ?? createSessionCompactionProfileId(job.threadId),
      spaceId: job.spaceId,
      key,
      summary,
      memoryIds: stableCandidates
        .map((candidate) => candidate.promotedMemoryId)
        .filter((memoryId): memoryId is string => typeof memoryId === 'string' && memoryId.length > 0),
      confidence: Math.min(
        0.96,
        0.42 + stableCandidates.length * 0.1 + pendingCandidates.length * 0.03 + (decision.shouldCompact ? 0.1 : 0)
      ),
      state: 'active',
      createdAt: existingProfile?.createdAt ?? now,
      updatedAt: now,
    };

    await this.contextService.saveProfile(profile, {
      operationType: 'profile.compacted',
      threadId: job.threadId,
    });

    const database = await getDatabase();
    const conversationResult = database.getConversation(job.threadId);
    const sessionRelativePath = getSessionArtifactRelativePath(job.threadId);
    const sessionNoteTitle =
      conversationResult.success && conversationResult.data?.name ? conversationResult.data.name : job.threadId;
    const workingSetArtifact =
      conversationResult.success && conversationResult.data
        ? await this.vaultSyncService.writeSessionWorkingSet({
            conversation: conversationResult.data,
            timestamp: now,
            currentTask: structured.currentTask,
            stableStrategies: structured.stableStrategies,
            failureModes: structured.failureModes,
            pendingConstraints: structured.pendingConstraints,
            signalKinds,
            pressure: decision.pressure,
            sourceProfileKey: profile.key,
          })
        : undefined;
    if (conversationResult.success && conversationResult.data) {
      await this.vaultSyncService.appendContextCheckpoint({
        conversation: conversationResult.data,
        timestamp: Date.parse(now),
        title: 'Session Compaction Updated',
        bullets: [
          `Profile: \`${profile.key}\``,
          `Promoted takeaways: ${promotedSummaries.length}`,
          `Pending review: ${pendingSummaries.length}`,
          `Signals: ${signalKinds.length}`,
          `Pressure: ${decision.pressure}`,
        ],
        body: detail,
      });
    }

    return {
      threadId: job.threadId,
      profileId: profile.id,
      profileKey: profile.key,
      summary,
      detail,
      noteTitle: sessionNoteTitle,
      relativePath: sessionRelativePath,
      workingSetTitle: workingSetArtifact?.title,
      workingSetRelativePath: workingSetArtifact?.relativePath,
      currentTask: structured.currentTask,
      stableStrategies: structured.stableStrategies,
      failureModes: structured.failureModes,
      pendingConstraints: structured.pendingConstraints,
      signalKinds,
      candidateCount: candidates.length,
      pendingReviewCount: pendingCandidates.length,
      promotedCount: promotedCandidates.length,
      pressure: decision.pressure,
      promotionCandidate: buildPromotionCandidate({
        job,
        currentTask: structured.currentTask,
        stableStrategies: structured.stableStrategies,
        pendingConstraints: structured.pendingConstraints,
        promotedCount: promotedCandidates.length,
        pressure: decision.pressure,
      }),
    };
  }
}
