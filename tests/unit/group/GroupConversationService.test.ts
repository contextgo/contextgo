import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IConversationService } from '@/process/services/IConversationService';
import type { IWorkerTaskManager } from '@/process/task/IWorkerTaskManager';

const { conversationResponseEmit, turnCompletedEmit, sendMessageMock, stopStreamingMock, insertMessageMock } =
  vi.hoisted(() => ({
    conversationResponseEmit: vi.fn(),
    turnCompletedEmit: vi.fn(),
    sendMessageMock: vi.fn(),
    stopStreamingMock: vi.fn(),
    insertMessageMock: vi.fn(),
  }));

vi.mock('@/common', () => ({
  ipcBridge: {
    conversation: {
      responseStream: {
        emit: conversationResponseEmit,
      },
      turnCompleted: {
        emit: turnCompletedEmit,
      },
    },
  },
}));

vi.mock('@process/channels/agent/ChannelMessageService', () => ({
  getChannelMessageService: () => ({
    sendMessage: sendMessageMock,
    stopStreaming: stopStreamingMock,
  }),
}));

vi.mock('@process/services/database', () => ({
  getDatabase: vi.fn(async () => ({
    insertMessage: insertMessageMock,
  })),
}));

import { GroupConversationService } from '@/process/bridge/services/group/GroupConversationService';

const model = {
  platform: 'openai',
  name: 'Test Model',
  useModel: 'gpt-4.1',
};

beforeEach(() => {
  vi.clearAllMocks();
});

type MockCreateConversationParams = {
  type: string;
  id?: string;
  name?: string;
  model: typeof model;
  extra: Record<string, unknown>;
};

const createService = (conversationService: Partial<IConversationService>) => {
  return new GroupConversationService(
    conversationService as IConversationService,
    {
      kill: vi.fn(),
    } as unknown as IWorkerTaskManager
  );
};

const buildWorkflowConversation = (workspace: string) => ({
  id: 'group-1',
  type: 'group' as const,
  name: 'Workflow Group',
  model,
  createTime: 1,
  modifyTime: 1,
  extra: {
    workspace,
    customWorkspace: false,
    participants: [
      {
        id: 'participant-planner',
        participantType: 'cli-agent' as const,
        participantKey: 'planner',
        name: 'Planner',
        childConversationId: 'planner-child',
        role: 'planner' as const,
      },
      {
        id: 'participant-writer',
        participantType: 'cli-agent' as const,
        participantKey: 'writer',
        name: 'Writer',
        childConversationId: 'writer-child',
        role: 'writer' as const,
      },
      {
        id: 'participant-evaluator',
        participantType: 'cli-agent' as const,
        participantKey: 'evaluator',
        name: 'Evaluator',
        childConversationId: 'evaluator-child',
        role: 'evaluator' as const,
      },
    ],
    orchestration: {
      kind: 'workflow' as const,
      template: 'planner-writer-evaluator' as const,
      maxIterations: 3,
      scoreTarget: 8,
      artifactPath: 'team-output.md',
    },
  },
});

describe('GroupConversationService discussion mode', () => {
  it('preserves legacy discussion orchestration fields when kind is missing', async () => {
    const createConversation = vi.fn(async (params: MockCreateConversationParams) => {
      if (params.type === 'group') {
        return {
          id: params.id,
          type: 'group',
          name: params.name,
          model: params.model,
          createTime: 1,
          modifyTime: 1,
          extra: {
            workspace: '/tmp/shared-group-workspace',
            customWorkspace: false,
            participants: [],
            orchestration: params.extra.orchestration,
          },
        };
      }

      return {
        id: `${params.name}-child`,
        type: 'acp',
        name: params.name,
        model,
        createTime: 1,
        modifyTime: 1,
        extra: params.extra,
      };
    });
    const service = createService({
      createConversation,
      updateConversation: vi.fn(async () => {}),
      deleteConversation: vi.fn(async () => {}),
    });

    const result = await service.createConversation({
      id: 'group-legacy',
      type: 'group',
      name: 'Legacy Group',
      model,
      extra: {
        participants: [
          {
            id: 'participant-1',
            participantType: 'cli-agent',
            participantKey: 'codex:/usr/local/bin/codex:Codex',
            name: 'Codex',
            childConversationId: '',
            conversation: {
              type: 'acp',
              name: 'Codex',
              model,
              extra: {
                backend: 'codex',
              },
            },
          },
          {
            id: 'participant-2',
            participantType: 'cli-agent',
            participantKey: 'claude:/usr/local/bin/claude:Claude',
            name: 'Claude',
            childConversationId: '',
            conversation: {
              type: 'acp',
              name: 'Claude',
              model,
              extra: {
                backend: 'claude',
              },
            },
          },
        ],
        orchestration: {
          mode: 'broadcast',
          rounds: 1,
        },
      },
    } as unknown as MockCreateConversationParams);

    expect(result.extra.orchestration).toEqual({
      kind: 'discussion',
      mode: 'broadcast',
      rounds: 1,
    });
  });

  it('creates child conversations under the parent group workspace', async () => {
    const createConversation = vi.fn(async (params: MockCreateConversationParams) => {
      if (params.type === 'group') {
        return {
          id: params.id,
          type: 'group',
          name: params.name,
          model: params.model,
          createTime: 1,
          modifyTime: 1,
          extra: {
            workspace: '/tmp/shared-group-workspace',
            customWorkspace: false,
            participants: [],
            orchestration: params.extra.orchestration,
          },
        };
      }

      return {
        id: `${params.name}-child`,
        type: 'acp',
        name: params.name,
        model,
        createTime: 1,
        modifyTime: 1,
        extra: params.extra,
      };
    });
    const updateConversation = vi.fn(async () => {});

    const service = createService({
      createConversation,
      updateConversation,
      deleteConversation: vi.fn(async () => {}),
    });

    const result = await service.createConversation({
      id: 'group-1',
      type: 'group',
      name: 'Architecture Review',
      model,
      extra: {
        participants: [
          {
            id: 'participant-1',
            participantType: 'cli-agent',
            participantKey: 'codex:/usr/local/bin/codex:Codex',
            name: 'Codex',
            childConversationId: '',
            conversation: {
              type: 'acp',
              name: 'Codex',
              model,
              extra: {
                backend: 'codex',
              },
            },
          },
          {
            id: 'participant-2',
            participantType: 'cli-agent',
            participantKey: 'claude:/usr/local/bin/claude:Claude',
            name: 'Claude',
            childConversationId: '',
            conversation: {
              type: 'acp',
              name: 'Claude',
              model,
              extra: {
                backend: 'claude',
              },
            },
          },
        ],
        orchestration: {
          kind: 'discussion',
          mode: 'broadcast',
          rounds: 1,
        },
      },
    } as unknown as MockCreateConversationParams);

    expect(createConversation).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: 'group',
        id: 'group-1',
      })
    );
    expect(createConversation).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        name: 'Codex',
        extra: expect.objectContaining({
          workspace: '/tmp/shared-group-workspace',
          customWorkspace: false,
          groupMeta: expect.objectContaining({
            parentGroupId: 'group-1',
            participantId: 'participant-1',
            hiddenFromHistory: true,
          }),
        }),
      })
    );
    expect(createConversation).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        name: 'Claude',
        extra: expect.objectContaining({
          workspace: '/tmp/shared-group-workspace',
          customWorkspace: false,
          groupMeta: expect.objectContaining({
            parentGroupId: 'group-1',
            participantId: 'participant-2',
            hiddenFromHistory: true,
          }),
        }),
      })
    );
    expect(updateConversation).toHaveBeenCalledWith(
      'group-1',
      expect.objectContaining({
        extra: expect.objectContaining({
          participants: [
            expect.objectContaining({
              childConversationId: 'Codex-child',
            }),
            expect.objectContaining({
              childConversationId: 'Claude-child',
            }),
          ],
        }),
      })
    );
    expect(result.extra.workspace).toBe('/tmp/shared-group-workspace');
    expect(result.extra.participants).toHaveLength(2);
  });

  it('persists the user message before projecting assistant replies', async () => {
    const service = createService({
      getConversation: vi.fn(async () => ({
        id: 'group-1',
        type: 'group',
        name: 'Group',
        model,
        createTime: 1,
        modifyTime: 1,
        extra: {
          workspace: '/tmp/shared-group-workspace',
          customWorkspace: false,
          participants: [
            {
              id: 'participant-1',
              participantType: 'cli-agent',
              participantKey: 'codex:/usr/local/bin/codex:Codex',
              name: 'Codex',
              childConversationId: 'child-1',
            },
          ],
          orchestration: {
            kind: 'discussion',
            mode: 'broadcast',
            rounds: 1,
          },
        },
      })),
      updateConversation: vi.fn(async () => {}),
    });

    sendMessageMock.mockImplementation(
      async (
        _groupId: string,
        _childId: string,
        _prompt: string,
        onChunk: (chunk: {
          id: string;
          msg_id: string;
          type: 'text';
          position: 'left';
          conversation_id: string;
          content: { content: string };
          createdAt: number;
        }) => void
      ) => {
        onChunk({
          id: 'assistant-msg-1',
          msg_id: 'assistant-msg-1',
          type: 'text',
          position: 'left',
          conversation_id: 'child-1',
          content: {
            content: 'Projected reply',
          },
          createdAt: 2,
        });
      }
    );

    await service.sendMessage({
      conversationId: 'group-1',
      input: 'Summarize the rollout plan.',
      msgId: 'user-msg-1',
    });

    expect(insertMessageMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        conversation_id: 'group-1',
        msg_id: 'user-msg-1',
        position: 'right',
        content: {
          content: 'Summarize the rollout plan.',
        },
      })
    );
    expect(insertMessageMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        conversation_id: 'group-1',
        position: 'left',
        content: expect.objectContaining({
          content: 'Projected reply',
          groupMeta: expect.objectContaining({
            participantId: 'participant-1',
            childConversationId: 'child-1',
          }),
        }),
      })
    );
    expect(insertMessageMock).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        conversation_id: 'group-1',
        position: 'left',
        content: expect.objectContaining({
          groupMeta: expect.objectContaining({
            participantId: 'group-round-summary:1',
            summaryKind: 'round',
          }),
        }),
      })
    );
    expect(insertMessageMock).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        conversation_id: 'group-1',
        position: 'left',
        content: expect.objectContaining({
          groupMeta: expect.objectContaining({
            participantId: 'group-final-summary',
            summaryKind: 'final',
          }),
        }),
      })
    );
  });
});

describe('GroupConversationService workflow mode', () => {
  it('rejects workflow payloads that exceed the template participant contract', async () => {
    const service = createService({
      createConversation: vi.fn(async () => {
        throw new Error('should not create conversations');
      }),
      updateConversation: vi.fn(async () => {}),
      deleteConversation: vi.fn(async () => {}),
    });

    await expect(
      service.createConversation({
        id: 'group-invalid',
        type: 'group',
        name: 'Invalid Workflow',
        model,
        extra: {
          participants: [
            {
              id: 'participant-1',
              participantType: 'cli-agent',
              participantKey: 'planner',
              name: 'Planner',
              childConversationId: '',
              conversation: {
                type: 'acp',
                name: 'Planner',
                model,
                extra: {
                  backend: 'codex',
                },
              },
            },
            {
              id: 'participant-2',
              participantType: 'cli-agent',
              participantKey: 'writer',
              name: 'Writer',
              childConversationId: '',
              conversation: {
                type: 'acp',
                name: 'Writer',
                model,
                extra: {
                  backend: 'qwen',
                },
              },
            },
            {
              id: 'participant-3',
              participantType: 'cli-agent',
              participantKey: 'evaluator',
              name: 'Evaluator',
              childConversationId: '',
              conversation: {
                type: 'acp',
                name: 'Evaluator',
                model,
                extra: {
                  backend: 'claude',
                },
              },
            },
            {
              id: 'participant-4',
              participantType: 'cli-agent',
              participantKey: 'extra',
              name: 'Extra',
              childConversationId: '',
              conversation: {
                type: 'acp',
                name: 'Extra',
                model,
                extra: {
                  backend: 'openclaw-gateway',
                },
              },
            },
          ],
          orchestration: {
            kind: 'workflow',
            template: 'planner-writer-evaluator',
            maxIterations: 3,
            scoreTarget: 8,
            artifactPath: 'team-output.md',
          },
        },
      } as unknown as MockCreateConversationParams)
    ).rejects.toThrow('requires exactly 3 participants');
  });

  it('rejects duplicate sends while a group run is already active', async () => {
    const service = createService({
      getConversation: vi.fn(async () => ({
        ...buildWorkflowConversation('/tmp/group-workflow'),
        status: 'running' as const,
      })),
    });

    await expect(
      service.sendMessage({
        conversationId: 'group-1',
        input: 'Try to send again.',
        msgId: 'duplicate-msg',
      })
    ).rejects.toThrow('already running');
  });

  it('recovers abandoned workflow runs back to a sendable finished state', async () => {
    const updateConversation = vi.fn(async () => {});
    const service = createService({
      listAllConversations: vi.fn(async () => [
        {
          ...buildWorkflowConversation('/tmp/group-workflow'),
          status: 'running' as const,
          extra: {
            ...buildWorkflowConversation('/tmp/group-workflow').extra,
            runState: {
              runId: 'run-1',
              status: 'running' as const,
              stage: 'writing' as const,
              activeStageId: 'draft-artifact',
              iteration: 2,
              artifactPath: 'team-output.md',
              activeParticipantId: 'participant-writer',
              stageHistory: [],
              updatedAt: 123,
            },
          },
        },
      ]),
      updateConversation,
    });

    await service.recoverAbandonedWorkflowRuns();

    expect(updateConversation).toHaveBeenCalledWith(
      'group-1',
      expect.objectContaining({
        status: 'finished',
        extra: expect.objectContaining({
          runState: expect.objectContaining({
            status: 'failed',
            stage: 'failed',
            activeStageId: undefined,
            iteration: 2,
            artifactPath: 'team-output.md',
            activeParticipantId: undefined,
          }),
        }),
      }),
      true
    );
  });

  it('runs the planner-writer-evaluator workflow, materializes the artifact, and persists projected stage messages', async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), 'group-workflow-'));
    const updateConversation = vi.fn(async () => {});
    let evaluatorPrompt = '';

    try {
      const service = createService({
        getConversation: vi.fn(async () => buildWorkflowConversation(workspace)),
        updateConversation,
      });

      sendMessageMock.mockImplementation(
        async (
          _groupId: string,
          childId: string,
          prompt: string,
          onChunk: (chunk: {
            id: string;
            msg_id: string;
            type: 'text';
            position: 'left';
            conversation_id: string;
            content: { content: string };
            createdAt: number;
          }) => void
        ) => {
          if (childId === 'planner-child') {
            onChunk({
              id: 'planner-msg',
              msg_id: 'planner-msg',
              type: 'text',
              position: 'left',
              conversation_id: 'planner-child',
              content: {
                content: '## Objective\nShip a stronger draft.\n## Acceptance Criteria\n- Clear structure',
              },
              createdAt: 2,
            });
            return;
          }

          if (childId === 'writer-child') {
            onChunk({
              id: 'writer-msg',
              msg_id: 'writer-msg',
              type: 'text',
              position: 'left',
              conversation_id: 'writer-child',
              content: {
                content: `[Artifact Path]
team-output.md

[Artifact Status]
proposed

[Artifact Content]
\`\`\`md
# Release Plan

- Step 1
- Step 2
\`\`\`

[Change Summary]
- Added the first draft`,
              },
              createdAt: 3,
            });
            return;
          }

          evaluatorPrompt = prompt;
          onChunk({
            id: 'evaluator-msg',
            msg_id: 'evaluator-msg',
            type: 'text',
            position: 'left',
            conversation_id: 'evaluator-child',
            content: {
              content:
                '```json\n{"score": 8.5, "decision": "accept", "summary": "Clear enough for the first milestone", "issues": [], "nextActions": ["Polish wording"]}\n```',
            },
            createdAt: 4,
          });
        }
      );

      await service.sendMessage({
        conversationId: 'group-1',
        input: 'Produce a draft release plan.',
        msgId: 'user-msg-1',
      });

      expect(await readFile(path.join(workspace, 'team-output.md'), 'utf-8')).toBe(
        '# Release Plan\n\n- Step 1\n- Step 2\n'
      );
      expect(evaluatorPrompt).toContain('# Release Plan');
      expect(evaluatorPrompt).toContain('- Step 1');

      expect(insertMessageMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          conversation_id: 'group-1',
          msg_id: 'user-msg-1',
          position: 'right',
        })
      );
      expect(insertMessageMock).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          content: expect.objectContaining({
            groupMeta: expect.objectContaining({
              kind: 'workflow',
              participantRole: 'planner',
              stage: 'planning',
              iteration: 0,
            }),
          }),
        })
      );
      expect(insertMessageMock).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          content: expect.objectContaining({
            groupMeta: expect.objectContaining({
              kind: 'workflow',
              participantRole: 'writer',
              stage: 'writing',
              iteration: 1,
            }),
          }),
        })
      );
      expect(insertMessageMock).toHaveBeenNthCalledWith(
        4,
        expect.objectContaining({
          content: expect.objectContaining({
            groupMeta: expect.objectContaining({
              kind: 'workflow',
              participantRole: 'evaluator',
              stage: 'evaluating',
              iteration: 1,
            }),
          }),
        })
      );
      expect(updateConversation).toHaveBeenCalledWith(
        'group-1',
        expect.objectContaining({
          extra: expect.objectContaining({
            runState: expect.objectContaining({
              runId: expect.any(String),
              status: 'completed',
              stage: 'completed',
              activeStageId: undefined,
              latestDecision: 'accept',
              latestScore: 8.5,
              planningBrief: expect.stringContaining('## Objective'),
              stageHistory: [
                expect.objectContaining({
                  stageId: 'plan-brief',
                  stage: 'planning',
                  status: 'completed',
                }),
                expect.objectContaining({
                  stageId: 'draft-artifact',
                  stage: 'writing',
                  status: 'completed',
                  iteration: 1,
                }),
                expect.objectContaining({
                  stageId: 'review-artifact',
                  stage: 'evaluating',
                  status: 'completed',
                  iteration: 1,
                }),
              ],
            }),
          }),
        }),
        true
      );
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('loops writing stages before a tail evaluation when review mode is final-only', async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), 'group-workflow-'));
    const updateConversation = vi.fn(async () => {});
    let writerCallCount = 0;

    try {
      const service = createService({
        getConversation: vi.fn(async () => ({
          ...buildWorkflowConversation(workspace),
          extra: {
            ...buildWorkflowConversation(workspace).extra,
            orchestration: {
              kind: 'workflow' as const,
              template: 'planner-writer-evaluator' as const,
              maxIterations: 2,
              scoreTarget: 8,
              artifactPath: 'team-output.md',
              reviewMode: 'final-only' as const,
            },
          },
        })),
        updateConversation,
      });

      sendMessageMock.mockImplementation(
        async (
          _groupId: string,
          childId: string,
          _prompt: string,
          onChunk: (chunk: {
            id: string;
            msg_id: string;
            type: 'text';
            position: 'left';
            conversation_id: string;
            content: { content: string };
            createdAt: number;
          }) => void
        ) => {
          if (childId === 'planner-child') {
            onChunk({
              id: 'planner-msg',
              msg_id: 'planner-msg',
              type: 'text',
              position: 'left',
              conversation_id: 'planner-child',
              content: {
                content: '## Objective\nBuild in two passes.\n## Acceptance Criteria\n- Final artifact is coherent',
              },
              createdAt: 2,
            });
            return;
          }

          if (childId === 'writer-child') {
            writerCallCount += 1;
            onChunk({
              id: `writer-msg-${writerCallCount}`,
              msg_id: `writer-msg-${writerCallCount}`,
              type: 'text',
              position: 'left',
              conversation_id: 'writer-child',
              content: {
                content: `[Artifact Path]
team-output.md

[Artifact Status]
proposed

[Artifact Content]
\`\`\`md
# Iteration ${writerCallCount}

- Pass ${writerCallCount}
\`\`\`

[Change Summary]
- Updated pass ${writerCallCount}`,
              },
              createdAt: 3 + writerCallCount,
            });
            return;
          }

          onChunk({
            id: 'evaluator-msg',
            msg_id: 'evaluator-msg',
            type: 'text',
            position: 'left',
            conversation_id: 'evaluator-child',
            content: {
              content:
                '```json\n{"score": 8.2, "decision": "accept", "summary": "Final review passed", "issues": [], "nextActions": []}\n```',
            },
            createdAt: 6,
          });
        }
      );

      await service.sendMessage({
        conversationId: 'group-1',
        input: 'Produce a draft release plan.',
        msgId: 'user-msg-1',
      });

      expect(writerCallCount).toBe(2);
      expect(sendMessageMock.mock.calls.map((call) => call[1])).toEqual([
        'planner-child',
        'writer-child',
        'writer-child',
        'evaluator-child',
      ]);
      expect(updateConversation).toHaveBeenCalledWith(
        'group-1',
        expect.objectContaining({
          extra: expect.objectContaining({
            runState: expect.objectContaining({
              status: 'completed',
              latestDecision: 'accept',
              stageHistory: [
                expect.objectContaining({ stageId: 'plan-brief', iteration: 0 }),
                expect.objectContaining({ stageId: 'draft-artifact', iteration: 1 }),
                expect.objectContaining({ stageId: 'draft-artifact', iteration: 2 }),
                expect.objectContaining({ stageId: 'review-artifact', iteration: 2 }),
              ],
            }),
          }),
        }),
        true
      );
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('fails the workflow when the writer omits the required artifact content block', async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), 'group-workflow-'));
    const updateConversation = vi.fn(async () => {});

    try {
      const service = createService({
        getConversation: vi.fn(async () => buildWorkflowConversation(workspace)),
        updateConversation,
      });

      sendMessageMock.mockImplementation(
        async (
          _groupId: string,
          childId: string,
          _prompt: string,
          onChunk: (chunk: {
            id: string;
            msg_id: string;
            type: 'text';
            position: 'left';
            conversation_id: string;
            content: { content: string };
            createdAt: number;
          }) => void
        ) => {
          if (childId === 'planner-child') {
            onChunk({
              id: 'planner-msg',
              msg_id: 'planner-msg',
              type: 'text',
              position: 'left',
              conversation_id: 'planner-child',
              content: {
                content: '## Objective\nDraft the release plan.\n## Acceptance Criteria\n- Include milestones',
              },
              createdAt: 2,
            });
            return;
          }

          if (childId === 'writer-child') {
            onChunk({
              id: 'writer-msg',
              msg_id: 'writer-msg',
              type: 'text',
              position: 'left',
              conversation_id: 'writer-child',
              content: {
                content: `[Artifact Path]
team-output.md

[Artifact Status]
proposed

[Change Summary]
- Forgot to include the artifact body`,
              },
              createdAt: 3,
            });
            return;
          }

          throw new Error('Evaluator should not run when artifact validation fails.');
        }
      );

      await expect(
        service.sendMessage({
          conversationId: 'group-1',
          input: 'Produce a draft release plan.',
          msgId: 'user-msg-1',
        })
      ).rejects.toThrow('Workflow writing stage must include [Artifact Content] with the full artifact body.');

      expect(sendMessageMock.mock.calls.map((call) => call[1])).toEqual(['planner-child', 'writer-child']);
      expect(updateConversation).toHaveBeenCalledWith(
        'group-1',
        expect.objectContaining({
          extra: expect.objectContaining({
            runState: expect.objectContaining({
              runId: expect.any(String),
              status: 'failed',
              stage: 'failed',
              activeStageId: undefined,
            }),
          }),
        }),
        true
      );
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
