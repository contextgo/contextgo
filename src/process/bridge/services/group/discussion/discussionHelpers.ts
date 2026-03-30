/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  CollaborationParticipantRole,
  DiscussionGroupMode,
  DiscussionGroupOrchestration,
  GroupCollaborationConfig,
} from '@/common/config/storage';

export type DiscussionRoundSummary = {
  participantId: string;
  participantName: string;
  content: string;
};

export const normalizeDiscussionOrchestration = (
  orchestration?: Partial<DiscussionGroupOrchestration> & { mode?: DiscussionGroupMode }
): DiscussionGroupOrchestration => {
  const mode = orchestration?.mode || 'debate';
  const rounds = orchestration?.rounds || (mode === 'debate' ? 2 : 1);
  return {
    kind: 'discussion',
    mode,
    rounds: rounds === 2 ? 2 : 1,
  };
};

export const normalizeGroupCollaboration = (
  collaboration?: Partial<GroupCollaborationConfig>
): GroupCollaborationConfig => {
  if (collaboration?.mode === 'planner-generator-evaluator') {
    return {
      mode: 'planner-generator-evaluator',
      executionBoundary:
        collaboration.executionBoundary?.type === 'git-repository'
          ? {
              type: 'git-repository',
              repositoryRoot: collaboration.executionBoundary.repositoryRoot || '',
              branch: collaboration.executionBoundary.branch ?? null,
              gitDir: collaboration.executionBoundary.gitDir ?? null,
              remoteUrl: collaboration.executionBoundary.remoteUrl ?? null,
            }
          : {
              type: 'git-repository',
              repositoryRoot: '',
              branch: null,
              gitDir: null,
              remoteUrl: null,
            },
    };
  }

  return {
    mode: 'discussion',
    executionBoundary: {
      type: 'workspace',
    },
  };
};

const buildHarnessBoundaryContext = (collaboration: GroupCollaborationConfig): string => {
  if (collaboration.executionBoundary.type !== 'git-repository') {
    return '';
  }

  const boundaryLines = [`- Repository Root: ${collaboration.executionBoundary.repositoryRoot || '(missing)'}`];
  if (collaboration.executionBoundary.branch) {
    boundaryLines.push(`- Current Branch: ${collaboration.executionBoundary.branch}`);
  }
  if (collaboration.executionBoundary.remoteUrl) {
    boundaryLines.push(`- Remote URL: ${collaboration.executionBoundary.remoteUrl}`);
  }

  return boundaryLines.join('\n');
};

const buildHarnessPrompt = (options: {
  collaboration: GroupCollaborationConfig;
  participantName: string;
  participantRole?: CollaborationParticipantRole;
  userInput: string;
}): string | null => {
  if (options.collaboration.mode !== 'planner-generator-evaluator') {
    return null;
  }

  const boundaryContext = buildHarnessBoundaryContext(options.collaboration);

  if (options.participantRole === 'planner') {
    return `${options.userInput}

[Harness Mode]
You are ${options.participantName}, the Planner.

[Repository Boundary]
${boundaryContext}

[Planner Objectives]
- Produce a concrete implementation plan that can be executed inside this repository boundary.
- Break the work into tractable implementation steps with explicit risk notes.
- Call out assumptions, dependencies, and validation checkpoints.
- Do not write code. Hand off a clear plan for the Generator.`;
  }

  if (options.participantRole === 'generator') {
    return `${options.userInput}

[Harness Mode]
You are ${options.participantName}, the Generator.

[Repository Boundary]
${boundaryContext}

[Generator Objectives]
- Translate the plan into implementation work and a code-change strategy.
- Focus on the code paths, files, and execution order required to complete the task.
- Highlight tradeoffs that the Evaluator should verify afterward.
- Be pragmatic and implementation-oriented.`;
  }

  if (options.participantRole === 'evaluator') {
    return `${options.userInput}

[Harness Mode]
You are ${options.participantName}, the Evaluator.

[Repository Boundary]
${boundaryContext}

[Evaluator Objectives]
- Stay read-only and assess the proposed solution with a PASS/FAIL rubric.
- Enumerate failure conditions, missing validation, and regression risks.
- Approve only when the implementation plan is coherent, testable, and safe to ship.`;
  }

  return `${options.userInput}

[Harness Mode]
You are ${options.participantName}. Work within the shared repository boundary and contribute your role-specific analysis.`;
};

export const buildDiscussionRoundPrompt = (options: {
  collaboration?: GroupCollaborationConfig;
  mode: DiscussionGroupMode;
  round: number;
  userInput: string;
  participantName: string;
  participantRole?: CollaborationParticipantRole;
  peerSummaries: DiscussionRoundSummary[];
}): string => {
  const {
    collaboration = normalizeGroupCollaboration(),
    mode,
    round,
    userInput,
    participantName,
    participantRole,
    peerSummaries,
  } = options;

  const harnessPrompt = buildHarnessPrompt({
    collaboration,
    participantName,
    participantRole,
    userInput,
  });
  if (harnessPrompt) {
    return harnessPrompt;
  }

  if (mode === 'broadcast') {
    return userInput;
  }

  if (mode === 'relay') {
    if (peerSummaries.length === 0) {
      return `${userInput}

[Discussion Protocol]
You are ${participantName}. Start the relay discussion with an independent answer.`;
    }

    const peerContext = peerSummaries
      .map((summary) => `- ${summary.participantName}: ${summary.content.trim()}`)
      .join('\n');

    return `${userInput}

[Relay Discussion Context]
You are ${participantName}. Review the earlier assistants' responses and continue the discussion.

[Earlier Assistants]
${peerContext}

[Response Requirements]
- Build on useful points, challenge weak assumptions, and add at least one new angle.
- Keep your answer concise and action-oriented.
- End with your recommendation or next step for the user.`;
  }

  if (round <= 1 || peerSummaries.length === 0) {
    return `${userInput}

[Discussion Protocol]
Respond independently as ${participantName}. Do not assume the other assistants agree with you.`;
  }

  const peerContext = peerSummaries
    .map((summary) => `- ${summary.participantName}: ${summary.content.trim()}`)
    .join('\n');

  return `${userInput}

[Round 2 Discussion Context]
You are ${participantName}. Review the other assistants' round 1 responses and then provide your own updated answer.

[Other Assistants]
${peerContext}

[Response Requirements]
- Keep your answer concise and decision-oriented.
- Call out disagreements only when they materially affect the recommendation.
- End with your final recommendation for the user.`;
};
