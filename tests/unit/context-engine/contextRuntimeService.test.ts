import { beforeEach, describe, expect, it, vi } from 'vitest';

const PROJECT_SLUG = 'workspace-b9e43543';
const CONTEXT_RUNTIME_EVAL_BASELINES = {
  outgoingContextWindow: 'context-runtime/outgoing-context-window',
  autoPromotion: 'context-runtime/assistant-turn-auto-promotion',
  pendingReview: 'context-runtime/assistant-turn-pending-review',
  delegationLifecycle: 'context-runtime/delegation-lifecycle-envelope',
} as const;

const mockSpaceService = {
  getSpace: vi.fn(async () => ({
    id: 'space-1',
    providerRef: {
      kind: 'obsidian-vault',
      vaultPath: '/tmp/vault',
      vaultName: 'My-Space-space-1',
      landingNotePath: 'Home.md',
    },
  })),
};

const mockProjectContextMirrorService = {
  syncProjectContext: vi.fn(async () => ({
    projectSlug: PROJECT_SLUG,
    projectDocs: [
      {
        projectSlug: PROJECT_SLUG,
        title: 'workspace',
        relativePath: 'Projects/workspace/workspace.md',
        absolutePath: '/tmp/vault/Projects/workspace/workspace.md',
        content: '# workspace\n\nPrefer minimal diffs.',
        tags: ['project', 'wiki'],
      },
    ],
    sourceDocs: [
      {
        projectSlug: PROJECT_SLUG,
        title: 'agents',
        relativePath: 'Projects/workspace/Sources/AGENTS.md',
        absolutePath: '/tmp/vault/Projects/workspace/Sources/AGENTS.md',
        content: '# AGENTS\n\nStart from AGENTS.md.',
        tags: ['project', 'source'],
      },
    ],
  })),
  buildMountedSections: vi.fn(
    (snapshot?: {
      projectDocs?: Array<{ title: string; content: string; relativePath: string }>;
      sourceDocs?: Array<{ title: string; content: string; relativePath: string }>;
    }) => {
      if (!snapshot) {
        return [];
      }

      return [
        ...(snapshot.projectDocs ?? []).map((doc, index) => ({
          kind: 'profile' as const,
          id: `profile:${doc.relativePath}`,
          summary: `${doc.title}\n${doc.content}`,
          priority: 94 - index,
          tokenCount: 24,
        })),
        ...(snapshot.sourceDocs ?? []).map((doc, index) => ({
          kind: 'source' as const,
          id: `source:${doc.relativePath}`,
          summary: `${doc.title}\n${doc.content}`,
          priority: 72 - index,
          tokenCount: 24,
        })),
      ];
    }
  ),
};

const mockDb = {
  getConversationMessages: vi.fn(),
  getConversation: vi.fn(),
};

const mockContextService = {
  retrieve: vi.fn(),
  assemble: vi.fn(),
  ingestSource: vi.fn(),
  appendSystemOperation: vi.fn(),
  indexTextDocument: vi.fn(),
  evaluatePromotion: vi.fn(),
  saveMemoryCandidate: vi.fn(),
  saveMemory: vi.fn(),
  listProfiles: vi.fn(),
};

const mockVaultSyncService = {
  ensureConversationContext: vi.fn(),
  appendUserTurnStarted: vi.fn(),
  appendAssistantTurnCompleted: vi.fn(),
  appendConversationStopped: vi.fn(),
  appendContextCheckpoint: vi.fn(),
  appendSessionTimelineEvent: vi.fn(),
  readSessionWorkingSetSection: vi.fn(),
  readSessionWorkingContextSection: vi.fn(),
  removeConversationContext: vi.fn(),
};

vi.mock('@process/services/database', () => ({
  getDatabase: vi.fn(async () => mockDb),
}));

const { ContextRuntimeService } = await import('../../../src/process/services/context/ContextRuntimeService');

function makeConversation() {
  return {
    id: 'conv-1',
    name: 'Context Engine Test',
    type: 'acp',
    model: {
      id: 'model-1',
      name: 'Model 1',
      useModel: 'model-1',
      platform: 'openai',
      apiKey: '',
      baseUrl: '',
    },
    source: 'contextgo',
    createTime: 1,
    modifyTime: 1,
    extra: {
      backend: 'claude',
      workspace: '/tmp/workspace',
      workingDirectory: '/tmp/workspace',
      spaceId: 'space-1',
    },
  };
}

function createObservedEventBus() {
  const observedEvents: Array<{ type: string; payload: Record<string, unknown> }> = [];

  return {
    observedEvents,
    eventBus: {
      emit: vi.fn(async (type: string, payload: Record<string, unknown>) => {
        observedEvents.push({ type, payload });
      }),
    },
  };
}

function findObservedEvent(
  observedEvents: readonly Array<{ type: string; payload: Record<string, unknown> }>,
  type: string
) {
  return observedEvents.find((event) => event.type === type);
}

function summarizeRuntimeEventBaseline(event: { type: string; payload: Record<string, unknown> } | undefined) {
  const snapshot =
    typeof event?.payload.snapshot === 'object' && event.payload.snapshot !== null && !Array.isArray(event.payload.snapshot)
      ? (event.payload.snapshot as {
          userTurns?: number;
          assistantReplies?: number;
          interruptions?: number;
          lastUserGoal?: string;
          lastAssistantOutcome?: string;
          recentSignals?: Array<{ kind?: string }>;
        })
      : undefined;

  return {
    type: event?.type ?? 'missing',
    projectSlug: typeof event?.payload.projectSlug === 'string' ? event.payload.projectSlug : null,
    userTurns: snapshot?.userTurns ?? 0,
    assistantReplies: snapshot?.assistantReplies ?? 0,
    interruptions: snapshot?.interruptions ?? 0,
    lastUserGoal: snapshot?.lastUserGoal ?? null,
    lastAssistantOutcome: snapshot?.lastAssistantOutcome ?? null,
    signalKinds: (snapshot?.recentSignals ?? [])
      .map((signal) => signal.kind)
      .filter((kind): kind is string => typeof kind === 'string'),
  };
}

describe('ContextRuntimeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.getConversationMessages.mockReturnValue({ data: [] });
    mockDb.getConversation.mockReturnValue({ success: true, data: makeConversation() });
    mockContextService.retrieve.mockResolvedValue({
      memories: [
        {
          memory: {
            id: 'memory-1',
            spaceId: 'space-1',
            kind: 'workflow',
            summary: 'Use the approved release checklist before shipping.',
            sourceIds: ['source-memory'],
            chunkIds: [],
            confidence: 0.9,
            tier: 'experiential',
            priority: 'high',
            state: 'accepted',
            createdAt: '2026-03-30T00:00:00.000Z',
            updatedAt: '2026-03-30T00:00:00.000Z',
          },
          score: 88,
          matchedBy: ['release'],
        },
      ],
      profiles: [
        {
          id: 'profile-1',
          spaceId: 'space-1',
          key: 'style',
          summary: 'Team prefers minimal diffs and explicit validation steps.',
          memoryIds: ['memory-1'],
          confidence: 0.8,
          state: 'active',
          createdAt: '2026-03-30T00:00:00.000Z',
          updatedAt: '2026-03-30T00:00:00.000Z',
        },
      ],
      chunks: [],
      sources: [],
      totalEstimatedTokens: 80,
    });
    mockContextService.assemble.mockResolvedValue({
      pack: {
        id: 'pack-1',
        spaceId: 'space-1',
        threadId: 'conv-1',
        budgetTokens: 420,
        sections: [
          {
            kind: 'profile',
            id: 'profile-1',
            summary: 'Team prefers minimal diffs and explicit validation steps.',
            tokenCount: 12,
            priority: 90,
          },
        ],
        provenance: {
          sourceIds: [],
          memoryIds: ['memory-1'],
          profileIds: ['profile-1'],
          artifactIds: [],
        },
        generatedAt: '2026-03-30T00:00:00.000Z',
      },
      omittedEntityIds: [],
    });
    mockContextService.ingestSource.mockResolvedValue({
      source: { id: 'source-1' },
      chunkIds: [],
      operations: [],
    });
    mockContextService.appendSystemOperation.mockResolvedValue(undefined);
    mockContextService.indexTextDocument.mockResolvedValue({ snapshot: { id: 'doc-1' }, chunks: [] });
    mockContextService.evaluatePromotion.mockResolvedValue({
      score: 72,
      shouldPromote: true,
      rationale: ['promote'],
    });
    mockContextService.saveMemoryCandidate.mockResolvedValue(undefined);
    mockContextService.saveMemory.mockResolvedValue(undefined);
    mockContextService.listProfiles.mockResolvedValue([]);
    mockVaultSyncService.readSessionWorkingSetSection.mockResolvedValue(undefined);
    mockVaultSyncService.readSessionWorkingContextSection.mockResolvedValue(undefined);
  });

  it('registers a bound thread operation when a conversation has a space', async () => {
    const service = new ContextRuntimeService(
      mockContextService as any,
      undefined,
      mockVaultSyncService as any,
      undefined,
      mockProjectContextMirrorService as any,
      mockSpaceService as any
    );

    await service.registerConversation(makeConversation());

    expect(mockContextService.appendSystemOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        spaceId: 'space-1',
        threadId: 'conv-1',
        type: 'thread.bound',
        entityId: 'conv-1',
      })
    );
    expect(mockVaultSyncService.ensureConversationContext).toHaveBeenCalledWith({ conversation: makeConversation() });
  });

  it('removes vault context when a conversation is deleted', async () => {
    const service = new ContextRuntimeService(
      mockContextService as any,
      undefined,
      mockVaultSyncService as any,
      undefined,
      mockProjectContextMirrorService as any,
      mockSpaceService as any
    );
    const conversation = makeConversation();
    const remainingConversations = [
      {
        ...makeConversation(),
        id: 'conv-2',
      },
    ];

    await service.removeConversationContext(conversation as any, remainingConversations as any);

    expect(mockVaultSyncService.removeConversationContext).toHaveBeenCalledWith({
      conversation,
      remainingConversations,
    });
  });

  it(
    `[${CONTEXT_RUNTIME_EVAL_BASELINES.outgoingContextWindow}] keeps the outgoing context window baseline stable`,
    async () => {
    const { observedEvents, eventBus } = createObservedEventBus();
    const service = new ContextRuntimeService(
      mockContextService as any,
      undefined,
      mockVaultSyncService as any,
      eventBus as any,
      mockProjectContextMirrorService as any,
      mockSpaceService as any
    );
    const recentMessages = [
      {
        id: 'm-1',
        conversation_id: 'conv-1',
        type: 'text',
        position: 'right',
        content: { content: 'Please help with release prep.' },
        createdAt: 1,
      },
    ];
    mockDb.getConversationMessages.mockReturnValue({ data: recentMessages });

    const result = await service.prepareOutgoingTurn({
      conversation: makeConversation(),
      userInput: 'We prefer release changes to stay minimal and verifiable.',
      agentInput: 'We prefer release changes to stay minimal and verifiable.',
      agentContent: '[User Request]\nWe prefer release changes to stay minimal and verifiable.',
      msgId: 'msg-1',
    });

    expect(mockContextService.retrieve).toHaveBeenCalledWith(
      expect.objectContaining({ spaceId: 'space-1', threadId: 'conv-1', projectSlug: PROJECT_SLUG })
    );
    expect(mockProjectContextMirrorService.syncProjectContext).toHaveBeenCalledWith(
      expect.objectContaining({ spaceId: 'space-1', vaultPath: '/tmp/vault' })
    );
    expect(mockContextService.assemble).toHaveBeenCalledWith(
      expect.objectContaining({
        mountedSections: expect.arrayContaining([
          expect.objectContaining({ kind: 'profile', id: 'profile:Projects/workspace/workspace.md' }),
          expect.objectContaining({ kind: 'source', id: 'source:Projects/workspace/Sources/AGENTS.md' }),
        ]),
      })
    );
    expect(mockContextService.ingestSource).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'conversation-message', title: 'User message', checksum: 'msg-1' })
    );
    expect(mockContextService.indexTextDocument).toHaveBeenCalledWith(
      expect.objectContaining({ sourceId: 'source-1', tier: 'working' })
    );
    expect(mockVaultSyncService.appendUserTurnStarted).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation: expect.objectContaining({ id: 'conv-1' }),
        userInput: 'We prefer release changes to stay minimal and verifiable.',
        msgId: 'msg-1',
      })
    );
    expect(mockVaultSyncService.appendSessionTimelineEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation: expect.objectContaining({ id: 'conv-1' }),
        title: 'User query',
        body: 'We prefer release changes to stay minimal and verifiable.',
      })
    );
    expect(mockVaultSyncService.appendContextCheckpoint).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation: expect.objectContaining({ id: 'conv-1' }),
        title: 'Context Window Prepared',
      })
    );
    expect(summarizeRuntimeEventBaseline(findObservedEvent(observedEvents, 'context.window.prepared'))).toEqual({
      type: 'context.window.prepared',
      projectSlug: PROJECT_SLUG,
      userTurns: 1,
      assistantReplies: 0,
      interruptions: 0,
      lastUserGoal: 'We prefer release changes to stay minimal and verifiable.',
      lastAssistantOutcome: null,
      signalKinds: ['context_window_prepared'],
    });
    expect(result.agentContent).toContain('[ContextGo Runtime Context]');
    expect(result.agentContent).toContain('[User Request]');
    expect(result.agentInput).toContain('read-only background data');
  });

  it('mounts session working context into outgoing context when available', async () => {
    mockVaultSyncService.readSessionWorkingContextSection.mockResolvedValue({
      kind: 'profile',
      id: 'session-working-context:conv-1',
      summary: 'Current Task\nShip the release with minimal, verifiable changes.',
      priority: 96,
      tokenCount: 18,
    });
    const service = new ContextRuntimeService(
      mockContextService as any,
      undefined,
      mockVaultSyncService as any,
      undefined,
      mockProjectContextMirrorService as any,
      mockSpaceService as any
    );

    await service.prepareOutgoingTurn({
      conversation: makeConversation(),
      userInput: 'Use the latest release context.',
      agentInput: 'Use the latest release context.',
      agentContent: '[User Request]\nUse the latest release context.',
      msgId: 'msg-working-set',
    });

    expect(mockContextService.assemble).toHaveBeenCalledWith(
      expect.objectContaining({
        mountedSections: expect.arrayContaining([
          expect.objectContaining({
            id: 'session-working-context:conv-1',
            summary: 'Current Task\nShip the release with minimal, verifiable changes.',
          }),
        ]),
      })
    );
    expect(mockVaultSyncService.readSessionWorkingContextSection).toHaveBeenCalledWith({
      conversation: expect.objectContaining({ id: 'conv-1' }),
    });
  });

  it('mounts session compaction summary into outgoing context when available', async () => {
    mockContextService.listProfiles.mockResolvedValue([
      {
        id: 'profile-compact-1',
        spaceId: 'space-1',
        key: 'session.compaction.conv-1',
        summary: 'Compacted session summary for the active release thread.',
        memoryIds: ['memory-1'],
        confidence: 0.88,
        state: 'active',
        createdAt: '2026-04-08T00:00:00.000Z',
        updatedAt: '2026-04-08T00:10:00.000Z',
      },
    ]);
    const service = new ContextRuntimeService(
      mockContextService as any,
      undefined,
      mockVaultSyncService as any,
      undefined,
      mockProjectContextMirrorService as any,
      mockSpaceService as any
    );

    await service.prepareOutgoingTurn({
      conversation: makeConversation(),
      userInput: 'Use the latest release context.',
      agentInput: 'Use the latest release context.',
      agentContent: '[User Request]\nUse the latest release context.',
      msgId: 'msg-compact',
    });

    expect(mockContextService.assemble).toHaveBeenCalledWith(
      expect.objectContaining({
        mountedProfiles: [
          expect.objectContaining({
            id: 'profile-compact-1',
            key: 'session.compaction.conv-1',
            summary: 'Compacted session summary for the active release thread.',
          }),
        ],
      })
    );
  });

  it(
    `[${CONTEXT_RUNTIME_EVAL_BASELINES.autoPromotion}] keeps the auto-promotion baseline stable`,
    async () => {
    const { observedEvents, eventBus } = createObservedEventBus();
    const service = new ContextRuntimeService(
      mockContextService as any,
      undefined,
      mockVaultSyncService as any,
      eventBus as any,
      mockProjectContextMirrorService as any,
      mockSpaceService as any
    );
    await service.prepareOutgoingTurn({
      conversation: makeConversation(),
      userInput: 'We prefer test-first debugging and we must avoid large diffs.',
      agentInput: 'We prefer test-first debugging and we must avoid large diffs.',
      agentContent: 'We prefer test-first debugging and we must avoid large diffs.',
      msgId: 'msg-2',
    });

    await service.completeAssistantTurn(
      'conv-1',
      'Decision: use the staged release checklist.\nNext steps:\n- Run focused tests\n- Keep diffs small',
      'assistant-1'
    );

    expect(mockContextService.ingestSource).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'conversation-message', title: 'Assistant response', checksum: 'assistant-1' })
    );
    expect(mockContextService.indexTextDocument).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Assistant response', tier: 'working' })
    );
    expect(mockVaultSyncService.appendAssistantTurnCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation: expect.objectContaining({ id: 'conv-1' }),
        assistantMessageId: 'assistant-1',
      })
    );
    expect(mockVaultSyncService.appendContextCheckpoint).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation: expect.objectContaining({ id: 'conv-1' }),
        title: 'Context Signals Extracted',
      })
    );
    expect(mockContextService.saveMemoryCandidate).toHaveBeenCalled();
    expect(mockContextService.saveMemory).toHaveBeenCalled();
    const savedSummaries = mockContextService.saveMemory.mock.calls.map((call) => call[0].summary);
    expect(savedSummaries.some((summary: string) => summary.includes('Decision'))).toBe(true);
    expect(summarizeRuntimeEventBaseline(findObservedEvent(observedEvents, 'session.turn.completed'))).toEqual({
      type: 'session.turn.completed',
      projectSlug: PROJECT_SLUG,
      userTurns: 1,
      assistantReplies: 1,
      interruptions: 0,
      lastUserGoal: 'We prefer test-first debugging and we must avoid large diffs.',
      lastAssistantOutcome: 'Decision: use the staged release checklist. Next steps: - Run focused tests - Keep diffs small',
      signalKinds: ['memory_candidate_promoted'],
    });
  });

  it(
    `[${CONTEXT_RUNTIME_EVAL_BASELINES.pendingReview}] keeps the pending-review baseline stable`,
    async () => {
    const notifyPendingReview = vi.fn();
    const { observedEvents, eventBus } = createObservedEventBus();
    mockContextService.evaluatePromotion.mockResolvedValue({
      score: 40,
      shouldPromote: false,
      rationale: ['keep-as-candidate'],
    });
    const service = new ContextRuntimeService(
      mockContextService as any,
      notifyPendingReview,
      mockVaultSyncService as any,
      eventBus as any,
      mockProjectContextMirrorService as any,
      mockSpaceService as any
    );
    await service.prepareOutgoingTurn({
      conversation: makeConversation(),
      userInput: 'We should not change the release checklist without review.',
      agentInput: 'We should not change the release checklist without review.',
      agentContent: 'We should not change the release checklist without review.',
      msgId: 'msg-3',
    });

    await service.completeAssistantTurn(
      'conv-1',
      'Plan: keep the current checklist and review changes manually.',
      'assistant-2'
    );

    expect(mockContextService.saveMemory).not.toHaveBeenCalled();
    expect(mockContextService.saveMemoryCandidate).toHaveBeenCalledWith(
      expect.objectContaining({ reviewStatus: 'pending', state: 'pending_review' }),
      expect.objectContaining({ operationType: 'memory.candidate_created' })
    );
    expect(notifyPendingReview).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'conv-1', spaceId: 'space-1' })
    );
    expect(summarizeRuntimeEventBaseline(findObservedEvent(observedEvents, 'session.turn.completed'))).toEqual({
      type: 'session.turn.completed',
      projectSlug: PROJECT_SLUG,
      userTurns: 1,
      assistantReplies: 1,
      interruptions: 0,
      lastUserGoal: 'We should not change the release checklist without review.',
      lastAssistantOutcome: 'Plan: keep the current checklist and review changes manually.',
      signalKinds: ['memory_candidate_created'],
    });
  });

  it('records a stop event when a prepared turn is interrupted', async () => {
    const service = new ContextRuntimeService(
      mockContextService as any,
      undefined,
      mockVaultSyncService as any,
      undefined,
      mockProjectContextMirrorService as any,
      mockSpaceService as any
    );
    const conversation = makeConversation();

    await service.prepareOutgoingTurn({
      conversation,
      userInput: 'Stop this turn if it hangs.',
      agentInput: 'Stop this turn if it hangs.',
      agentContent: 'Stop this turn if it hangs.',
      msgId: 'msg-stop',
    });

    await service.recordConversationStopped(conversation as any, 'user-stop');

    expect(mockVaultSyncService.appendConversationStopped).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation: expect.objectContaining({ id: 'conv-1' }),
        reason: 'user-stop',
      })
    );
  });

  it(
    `[${CONTEXT_RUNTIME_EVAL_BASELINES.delegationLifecycle}] keeps the delegation lifecycle envelope stable`,
    async () => {
    const { observedEvents, eventBus } = createObservedEventBus();
    const service = new ContextRuntimeService(
      mockContextService as any,
      undefined,
      mockVaultSyncService as any,
      eventBus as any,
      mockProjectContextMirrorService as any,
      mockSpaceService as any
    );

    await (service as any).captureDelegationCompletion({
      conversation: makeConversation(),
      delegationSummary: 'Planner delegate completed release validation synthesis.',
      snapshot: {
        userTurns: 3,
        assistantReplies: 2,
        interruptions: 0,
        recentSignals: [],
      },
    });

    expect(observedEvents).toContainEqual(
      expect.objectContaining({
        type: 'delegation.completed',
        payload: expect.objectContaining({
          spaceId: 'space-1',
          threadId: 'conv-1',
          projectSlug: PROJECT_SLUG,
          delegationSummary: 'Planner delegate completed release validation synthesis.',
        }),
      })
    );
    expect(summarizeRuntimeEventBaseline(findObservedEvent(observedEvents, 'delegation.completed'))).toEqual({
      type: 'delegation.completed',
      projectSlug: PROJECT_SLUG,
      userTurns: 3,
      assistantReplies: 2,
      interruptions: 0,
      lastUserGoal: null,
      lastAssistantOutcome: null,
      signalKinds: [],
    });
  });
});
