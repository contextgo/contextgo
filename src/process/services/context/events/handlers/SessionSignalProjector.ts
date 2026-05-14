/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SessionSignal } from '../../contextDomain';
import type { ContextEventBus } from '../ContextEventBus';
import i18n, { i18nReady } from '@process/services/i18n';

function createSignal(input: {
  kind: SessionSignal['kind'];
  summary: string;
  detail?: string;
  occurredAt: string;
  metadata?: SessionSignal['metadata'];
}): SessionSignal {
  return {
    kind: input.kind,
    summary: input.summary,
    detail: input.detail,
    score: 0.8,
    occurredAt: input.occurredAt,
    metadata: input.metadata,
  };
}

function formatContextWindowPreparedSignal(input: {
  occurredAt: string;
  recentSignalsCount: number;
  userTurns: number;
  assistantReplies: number;
}): SessionSignal {
  const summary = i18n.t('agent.contextEngine.operationLog.signal.context_window_prepared.summary', {
    defaultValue: 'Prepared the context needed to continue this turn.',
  });
  const detail =
    input.recentSignalsCount > 0
      ? i18n.t('agent.contextEngine.operationLog.signal.context_window_prepared.recentSignals', {
          count: input.recentSignalsCount,
          defaultValue: 'Included {{count}} recent context records.',
        })
      : undefined;

  return createSignal({
    kind: 'context_window_prepared',
    summary,
    detail,
    occurredAt: input.occurredAt,
    metadata: {
      userTurns: input.userTurns,
      assistantReplies: input.assistantReplies,
    },
  });
}

export function registerSessionSignalProjector(bus: ContextEventBus): void {
  bus.on('context.window.prepared', async (event) => {
    await i18nReady;
    await bus.emit('session.signal.detected', {
      spaceId: event.payload.spaceId,
      threadId: event.payload.threadId,
      projectSlug: event.payload.projectSlug,
      signal: formatContextWindowPreparedSignal({
        occurredAt: new Date(event.payload.preparedAt).toISOString(),
        recentSignalsCount: event.payload.snapshot.recentSignals.length,
        userTurns: event.payload.snapshot.userTurns,
        assistantReplies: event.payload.snapshot.assistantReplies,
      }),
    });
  });

  bus.on('session.turn.completed', async (event) => {
    if (event.payload.promotionCandidate) {
      await i18nReady;
      await bus.emit('session.signal.detected', {
        spaceId: event.payload.spaceId,
        threadId: event.payload.threadId,
        projectSlug: event.payload.projectSlug,
        signal: createSignal({
          kind: 'memory_candidate_promoted',
          summary: event.payload.promotionCandidate.summary,
          occurredAt: new Date(event.payload.completedAt).toISOString(),
          metadata: {
            confidence: event.payload.promotionCandidate.confidence,
          },
        }),
      });
    }
  });

  bus.on('session.interrupted', async (event) => {
    await i18nReady;
    await bus.emit('session.signal.detected', {
      spaceId: event.payload.spaceId,
      threadId: event.payload.threadId,
      projectSlug: event.payload.projectSlug,
      signal: createSignal({
        kind: 'user_interrupt',
        summary: i18n.t('agent.contextEngine.operationLog.signal.user_interrupt.summary', {
          defaultValue: 'The current run was stopped manually.',
        }),
        occurredAt: new Date(event.payload.interruptedAt).toISOString(),
        metadata: {
          interruptions: event.payload.snapshot.interruptions,
        },
      }),
    });
  });
}
