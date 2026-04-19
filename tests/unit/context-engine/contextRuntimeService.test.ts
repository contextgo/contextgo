import { beforeEach, describe, expect, it, vi } from 'vitest';

const PROJECT_SLUG = 'workspace-b9e43543';

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

const mockProjectCapabilityService = {
  readSnapshot: vi.fn(),
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
      trace: {
        query: 'release context',
        queryTerms: ['release', 'context'],
        searchMode: 'hybrid' as const,
        entries: [
          {
            entityKind: 'memory' as const,
            entityId: 'memory-1',
            score: 88,
            reasons: [{ kind: 'lexical_match' as const, matchedTerms: ['release'] }],
          },
          {
            entityKind: 'profile' as const,
            entityId: 'profile-1',
            score: 36,
            reasons: [{ kind: 'profile_memory_link' as const, memoryIds: ['memory-1'] }],
          },
        ],
      },
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
      trace: {
        budgetTokens: 420,
        spentTokens: 12,
        entries: [
          {
            sectionId: 'instruction-0',
            sectionKind: 'instruction',
            source: 'pinned_instruction',
            tokenCount: 8,
            priority: 110,
            outcome: 'kept',
          },
        ],
      },
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
    mockProjectCapabilityService.readSnapshot.mockResolvedValue({
      workspacePath: '/tmp/workspace',
      automationRootRelativePath: '.contextgo',
      counts: {
        skill: 1,
        hook: 1,
        command: 1,
        schedule: 1,
      },
      skills: [
        {
          kind: 'skill',
          id: 'release-validation',
          name: 'release-validation',
          description: 'Validate release steps.',
          docKey: 'skill:release-validation',
          workspaceRelativePath: '.contextgo/skills/release-validation',
          compatibility: [],
          implicitInvocation: false,
        },
      ],
      hooks: [
        {
          kind: 'hook',
          id: 'post-release-check',
          name: 'post-release-check',
          description: 'Hook for post release validation.',
          docKey: 'hook:post-release-check',
          workspaceRelativePath: '.contextgo/hooks/post-release-check',
          manifestRelativePath: '.contextgo/hooks/post-release-check/manifest.json',
          events: [],
          runnableEvents: [],
          outputTargets: [],
          selected: true,
        },
      ],
      commands: [
        {
          kind: 'command',
          id: 'release-verify',
          name: 'release-verify',
          description: 'Run release verification.',
          docKey: 'command:release-verify',
          commandType: 'project',
          enabled: true,
          template: 'release verify',
        },
      ],
      schedules: [
        {
          kind: 'schedule',
          id: 'nightly-release-sweep',
          name: 'nightly-release-sweep',
          description: 'Nightly release sweep.',
          docKey: 'schedule:nightly-release-sweep',
          enabled: true,
          scheduleKind: 'cron',
          scheduleLabel: '0 1 * * *',
          message: 'Nightly release sweep',
          conversationId: 'conv-1',
          agentType: 'preset',
          createdBy: 'user',
        },
      ],
    });
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

  it('baseline[RT1]: assembles and injects a context pack before user request content', async () => {
    const service = new ContextRuntimeService(
      mockContextService as any,
      undefined,
      mockVaultSyncService as any,
      undefined,
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
        overlays: expect.objectContaining({
          mountedSections: expect.arrayContaining([
            expect.objectContaining({ kind: 'profile', id: 'profile:Projects/workspace/workspace.md' }),
            expect.objectContaining({ kind: 'source', id: 'source:Projects/workspace/Sources/AGENTS.md' }),
          ]),
        }),
        mountedBoundary: expect.objectContaining({
          boundaryId: expect.stringMatching(/^mounted-boundary:conv-1:/),
          mode: 'frozen-snapshot',
          refreshPolicy: 'next-turn-rebuild',
          threadSummaryIncluded: true,
          mountedSectionIds: ['profile:Projects/workspace/workspace.md', 'source:Projects/workspace/Sources/AGENTS.md'],
          mountedProfileIds: [],
          pinnedInstructionIds: ['instruction-0'],
          fences: {
            recapture: 'no-recapture',
            reingest: 'no-reingest',
          },
        }),
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
        overlays: expect.objectContaining({
          mountedSections: expect.arrayContaining([
            expect.objectContaining({
              id: 'session-working-context:conv-1',
              summary: 'Current Task\nShip the release with minimal, verifiable changes.',
            }),
          ]),
        }),
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
        overlays: expect.objectContaining({
          mountedProfiles: [
            expect.objectContaining({
              id: 'profile-compact-1',
              key: 'session.compaction.conv-1',
              summary: 'Compacted session summary for the active release thread.',
            }),
          ],
        }),
      })
    );
  });

  it('freezes mounted state before assembly and keeps snapshot version local to runtime', async () => {
    const previousTurnText = 'Previous release context stays mounted until this turn snapshot is prepared.';
    const currentUserInput = 'New request: change the release checklist for this handoff.';
    mockDb.getConversationMessages.mockReturnValue({
      data: [
        {
          id: 'm-prev',
          conversation_id: 'conv-1',
          type: 'text',
          position: 'right',
          content: { content: previousTurnText },
          createdAt: 1,
        },
      ],
    });
    mockVaultSyncService.readSessionWorkingContextSection.mockResolvedValue({
      kind: 'profile',
      id: 'session-working-context:conv-1',
      summary: 'Current Task\nUse the frozen release checklist snapshot.',
      priority: 96,
      tokenCount: 18,
    });
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
      userInput: currentUserInput,
      agentInput: currentUserInput,
      agentContent: `[User Request]\n${currentUserInput}`,
      msgId: 'msg-frozen-mounted-state',
    });

    expect(mockContextService.assemble).toHaveBeenCalledWith(
      expect.objectContaining({
        overlays: expect.objectContaining({
          threadSummary: expect.stringContaining(previousTurnText),
          mountedSections: expect.arrayContaining([
            expect.objectContaining({ id: 'session-working-context:conv-1' }),
            expect.objectContaining({ id: 'profile:Projects/workspace/workspace.md' }),
            expect.objectContaining({ id: 'source:Projects/workspace/Sources/AGENTS.md' }),
          ]),
          mountedProfiles: [
            expect.objectContaining({
              id: 'profile-compact-1',
              key: 'session.compaction.conv-1',
            }),
          ],
          pinnedInstructions: ['Prefer space-consistent answers and reuse approved workflows when relevant.'],
        }),
      })
    );
    expect(mockContextService.assemble.mock.calls[0]?.[0]?.overlays).not.toHaveProperty('preparedAt');
    expect(mockContextService.assemble.mock.calls[0]?.[0]?.overlays?.threadSummary).not.toContain(currentUserInput);
    expect(mockContextService.assemble.mock.invocationCallOrder[0]).toBeLessThan(
      mockContextService.ingestSource.mock.invocationCallOrder[0]
    );
    const checkpointBody = mockVaultSyncService.appendContextCheckpoint.mock.calls.at(-1)?.[0]?.body;
    expect(checkpointBody).toContain('Mounted thread summary: yes');
    expect(checkpointBody).toContain('Mounted sections: 3');
    expect(checkpointBody).toContain('Mounted profiles: 1');
    expect(checkpointBody).toMatch(/Mounted boundary: mounted-boundary:conv-1:\d+/);
    expect(checkpointBody).toContain('Boundary mode: frozen-snapshot');
    expect(checkpointBody).toContain('Boundary refresh: next-turn-rebuild');
    expect(checkpointBody).toContain('Boundary fences: no-recapture, no-reingest');
    expect(checkpointBody).toContain(
      'Mounted section ids: session-working-context:conv-1, profile:Projects/workspace/workspace.md, source:Projects/workspace/Sources/AGENTS.md'
    );
    expect(checkpointBody).toContain('Mounted profile ids: profile-compact-1');
  });

  it('persists a compact retrieval and assembly trace through checkpoint and timeline surfaces', async () => {
    mockContextService.retrieve.mockResolvedValueOnce({
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
      trace: {
        query: 'release trace',
        queryTerms: ['release', 'trace'],
        searchMode: 'hybrid' as const,
        entries: [
          {
            entityKind: 'memory' as const,
            entityId: 'memory-1',
            score: 88,
            reasons: [{ kind: 'lexical_match' as const, matchedTerms: ['release'] }],
          },
          {
            entityKind: 'profile' as const,
            entityId: 'profile-1',
            score: 36,
            reasons: [{ kind: 'profile_memory_link' as const, memoryIds: ['memory-1'] }],
          },
        ],
      },
    });
    mockContextService.assemble.mockResolvedValueOnce({
      pack: {
        id: 'pack-trace-1',
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
      omittedEntityIds: ['memory-1'],
      trace: {
        budgetTokens: 420,
        spentTokens: 18,
        entries: [
          {
            sectionId: 'instruction-0',
            sectionKind: 'instruction',
            source: 'pinned_instruction',
            tokenCount: 8,
            priority: 110,
            outcome: 'kept',
          },
          {
            sectionId: 'memory-1',
            sectionKind: 'memory',
            source: 'retrieved_memory',
            tokenCount: 20,
            priority: 80,
            outcome: 'omitted',
            omissionReason: 'budget',
          },
        ],
      },
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
      userInput: 'Summarize the release context trace for this turn.',
      agentInput: 'Summarize the release context trace for this turn.',
      agentContent: '[User Request]\nSummarize the release context trace for this turn.',
      msgId: 'msg-trace',
    });

    expect(mockVaultSyncService.appendContextCheckpoint).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Context Window Prepared',
        body: expect.stringContaining('Assembly Trace'),
      })
    );
    const checkpointBody = mockVaultSyncService.appendContextCheckpoint.mock.calls.at(-1)?.[0]?.body;
    expect(checkpointBody).toContain('Retrieval entries: 2');
    expect(checkpointBody).toContain('Budget spent: 18 / 420');
    expect(checkpointBody).toContain('Mounted thread summary: no');
    expect(checkpointBody).toContain('Mounted sections: 2');
    expect(checkpointBody).toContain('Mounted profiles: 0');
    expect(checkpointBody).toContain('Pinned instructions: 1');
    expect(checkpointBody).toContain('Boundary mode: frozen-snapshot');
    expect(checkpointBody).toContain('Boundary refresh: next-turn-rebuild');
    expect(checkpointBody).toContain('Boundary fences: no-recapture, no-reingest');
    expect(checkpointBody).toContain('Assembly kept: 1');
    expect(checkpointBody).toContain('Omitted sections: 1');

    const traceTimelineCall = mockVaultSyncService.appendSessionTimelineEvent.mock.calls.find(
      (call) => call[0]?.title === 'Context trace'
    );
    expect(traceTimelineCall?.[0]?.body).toContain('retrieval 2');
    expect(traceTimelineCall?.[0]?.body).toContain('mounted 2/0');
    expect(traceTimelineCall?.[0]?.body).toContain('boundary frozen-snapshot');
    expect(traceTimelineCall?.[0]?.body).toContain('refresh next-turn-rebuild');
    expect(traceTimelineCall?.[0]?.body).toContain('fences no-recapture/no-reingest');
    expect(traceTimelineCall?.[0]?.body).toContain('kept 1');
    expect(traceTimelineCall?.[0]?.body).toContain('omitted 1');
    expect(traceTimelineCall?.[0]?.body).toContain('budget 18/420');
  });

  it('emits mounted boundary metadata through runtime governance events', async () => {
    const observedEvents: Array<{ type: string; payload: Record<string, unknown> }> = [];
    const eventBus = {
      emit: vi.fn(async (type: string, payload: Record<string, unknown>) => {
        observedEvents.push({ type, payload });
      }),
    };
    mockVaultSyncService.readSessionWorkingContextSection.mockResolvedValue({
      kind: 'profile',
      id: 'session-working-context:conv-1',
      summary: 'Current Task\nShip the release with minimal, verifiable changes.',
      priority: 96,
      tokenCount: 18,
    });
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
      eventBus as any,
      mockProjectContextMirrorService as any,
      mockSpaceService as any
    );

    await service.prepareOutgoingTurn({
      conversation: makeConversation(),
      userInput: 'Use the mounted release boundary for this turn.',
      agentInput: 'Use the mounted release boundary for this turn.',
      agentContent: '[User Request]\nUse the mounted release boundary for this turn.',
      msgId: 'msg-mounted-boundary-events',
    });

    const preparedEvent = observedEvents.find((event) => event.type === 'context.window.prepared');
    expect(preparedEvent?.payload.mountedBoundary).toEqual(
      expect.objectContaining({
        boundaryId: expect.stringMatching(/^mounted-boundary:conv-1:/),
        mode: 'frozen-snapshot',
        refreshPolicy: 'next-turn-rebuild',
        threadSummaryIncluded: false,
        mountedSectionIds: [
          'session-working-context:conv-1',
          'profile:Projects/workspace/workspace.md',
          'source:Projects/workspace/Sources/AGENTS.md',
        ],
        mountedProfileIds: ['profile-compact-1'],
        pinnedInstructionIds: ['instruction-0'],
        fences: {
          recapture: 'no-recapture',
          reingest: 'no-reingest',
        },
      })
    );

    await service.completeAssistantTurn(
      'conv-1',
      'Decision: keep the mounted release boundary frozen for the current turn.',
      'assistant-mounted-boundary'
    );

    const turnCompletedEvent = observedEvents.find((event) => event.type === 'session.turn.completed');
    expect(turnCompletedEvent?.payload.mountedBoundary).toEqual(
      expect.objectContaining({
        boundaryId: preparedEvent?.payload.mountedBoundary?.boundaryId,
        mode: 'frozen-snapshot',
        refreshPolicy: 'next-turn-rebuild',
        fences: {
          recapture: 'no-recapture',
          reingest: 'no-reingest',
        },
      })
    );
  });

  it('auto-promotes strong candidates into durable memories', async () => {
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
  });

  it('notifies humans when candidates require review instead of auto-promotion', async () => {
    const notifyPendingReview = vi.fn();
    mockContextService.evaluatePromotion.mockResolvedValue({
      score: 40,
      shouldPromote: false,
      rationale: ['keep-as-candidate'],
    });
    const service = new ContextRuntimeService(
      mockContextService as any,
      notifyPendingReview,
      mockVaultSyncService as any,
      undefined,
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

  it('adds context and capability usage evidence into session governance outputs', async () => {
    const observedEvents: Array<{ type: string; payload: Record<string, unknown> }> = [];
    const eventBus = {
      emit: vi.fn(async (type: string, payload: Record<string, unknown>) => {
        observedEvents.push({ type, payload });
      }),
    };
    const service = new ContextRuntimeService(
      mockContextService as any,
      undefined,
      mockVaultSyncService as any,
      eventBus as any,
      mockProjectContextMirrorService as any,
      mockSpaceService as any,
      mockProjectCapabilityService as any
    );

    await service.prepareOutgoingTurn({
      conversation: makeConversation(),
      userInput: 'Use /release-verify and the release-validation skill for this handoff.',
      agentInput: 'Use /release-verify and the release-validation skill for this handoff.',
      agentContent: '[User Request]\nUse /release-verify and the release-validation skill for this handoff.',
      msgId: 'msg-usage',
    });

    await service.completeAssistantTurn(
      'conv-1',
      'Decision: use /release-verify with release-validation before handoff.',
      'assistant-usage'
    );

    expect(mockVaultSyncService.appendContextCheckpoint).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Context Signals Extracted',
        body: expect.stringContaining('Usage Evidence'),
      })
    );
    expect(mockVaultSyncService.appendContextCheckpoint.mock.calls.at(-1)?.[0]?.body).toContain(
      'Used command surface: /release-verify'
    );
    expect(mockVaultSyncService.appendContextCheckpoint.mock.calls.at(-1)?.[0]?.body).toContain(
      'Used skill surface: release-validation'
    );

    const turnCompletedEvent = observedEvents.find((event) => event.type === 'session.turn.completed');
    expect(turnCompletedEvent?.payload.promotionCandidate).toEqual(
      expect.objectContaining({
        detail: expect.stringContaining('Usage evidence: Used command surface: /release-verify'),
      })
    );
    expect(turnCompletedEvent?.payload.promotionCandidate?.confidence).toBeGreaterThan(0.88);
  });

  it('emits delegation.completed with the governance lifecycle envelope', async () => {
    const observedEvents: Array<{ type: string; payload: Record<string, unknown> }> = [];
    const eventBus = {
      emit: vi.fn(async (type: string, payload: Record<string, unknown>) => {
        observedEvents.push({ type, payload });
      }),
    };
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
  });
});
