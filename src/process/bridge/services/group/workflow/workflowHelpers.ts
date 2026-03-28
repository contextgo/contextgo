/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  DEFAULT_WORKFLOW_GROUP_TEMPLATE,
  getWorkflowGroupTemplateDefinition,
  getWorkflowTemplateRoleOrder,
  normalizeWorkflowGroupTemplate,
  normalizeWorkflowTemplateMaxIterations,
  normalizeWorkflowTemplateScoreTarget,
  type WorkflowTemplateRole,
} from '@/common/config/group';
import type {
  GroupParticipant,
  GroupParticipantRole,
  WorkflowGroupDecision,
  WorkflowGroupOrchestration,
  WorkflowGroupRunState,
} from '@/common/config/storage';

export type WorkflowEvaluation = {
  score?: number;
  decision: WorkflowGroupDecision;
  summary: string;
  strengths: string[];
  issues: string[];
  nextActions: string[];
  raw: string;
};

export type WorkflowArtifactUpdate = {
  path?: string;
  status?: 'written' | 'proposed';
  content?: string;
  raw: string;
};

export type WorkflowRoleParticipants = {
  planner: GroupParticipant;
  writer: GroupParticipant;
  evaluator: GroupParticipant;
};

const ARTIFACT_PATH_HEADER = '[Artifact Path]';
const ARTIFACT_STATUS_HEADER = '[Artifact Status]';
const ARTIFACT_CONTENT_HEADER = '[Artifact Content]';
const ARTIFACT_CONTENT_FENCE_PATTERN = '```(?:[a-z0-9_-]+)?[ \\t]*\\n([\\s\\S]*?)\\n```';

const isFiniteNumber = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value);
};

const clampScore = (value: number): number => {
  return Math.max(0, Math.min(10, Number(value.toFixed(1))));
};

const normalizeArrayField = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => String(item).trim()).filter(Boolean);
};

const deriveWorkflowRole = (
  index: number,
  currentRole: GroupParticipantRole | undefined,
  assignedRoles: Set<WorkflowTemplateRole>,
  roleOrder: WorkflowTemplateRole[]
): GroupParticipantRole => {
  if (currentRole && currentRole !== 'custom' && roleOrder.includes(currentRole) && !assignedRoles.has(currentRole)) {
    return currentRole;
  }

  const preferredRole = roleOrder[index];
  if (preferredRole && !assignedRoles.has(preferredRole)) {
    return preferredRole;
  }

  return roleOrder.find((role) => !assignedRoles.has(role)) || 'custom';
};

const tryParseJsonObject = (value: string): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const extractJsonObject = (value: string): Record<string, unknown> | null => {
  const codeBlockMatches = value.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi);
  for (const match of codeBlockMatches) {
    const parsed = tryParseJsonObject(match[1]?.trim() || '');
    if (parsed) {
      return parsed;
    }
  }

  const firstBrace = value.indexOf('{');
  const lastBrace = value.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return tryParseJsonObject(value.slice(firstBrace, lastBrace + 1));
  }

  return null;
};

const extractScoreFromText = (value: string): number | undefined => {
  const scoreMatch =
    value.match(/"score"\s*:\s*(\d+(?:\.\d+)?)/i) ||
    value.match(/score[^0-9]{0,10}(\d+(?:\.\d+)?)/i) ||
    value.match(/(\d+(?:\.\d+)?)\s*\/\s*10/i);

  if (!scoreMatch) {
    return undefined;
  }

  const parsed = Number(scoreMatch[1]);
  return Number.isFinite(parsed) ? clampScore(parsed) : undefined;
};

const deriveDecision = (
  value: string | undefined,
  score: number | undefined,
  rawText: string,
  scoreTarget: number
): WorkflowGroupDecision => {
  if (value === 'continue' || value === 'accept' || value === 'stop') {
    return value;
  }

  const normalizedText = rawText.toLowerCase();
  if (normalizedText.includes('"decision":"accept"') || normalizedText.includes('decision: accept')) {
    return 'accept';
  }
  if (normalizedText.includes('"decision":"stop"') || normalizedText.includes('decision: stop')) {
    return 'stop';
  }
  if (normalizedText.includes('blocked') || normalizedText.includes('cannot proceed')) {
    return 'stop';
  }
  if (score !== undefined && score >= scoreTarget) {
    return 'accept';
  }

  return 'continue';
};

const summarizeRawEvaluation = (value: string): string => {
  const normalized = value
    .replace(/```(?:json)?[\s\S]*?```/gi, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return normalized[0] || 'Evaluator review completed.';
};

const normalizeArtifactContent = (value: string | undefined): string | undefined => {
  const normalized = value?.trim();
  return normalized ? `${normalized}\n` : undefined;
};

const normalizeWorkflowArtifactPathValue = (artifactPath?: string): string | undefined => {
  const rawPath = artifactPath?.trim().replace(/\\/g, '/');
  if (!rawPath) {
    return undefined;
  }

  const collapsed = rawPath.replace(/\/+/g, '/').replace(/^\.\//, '');
  const segments = collapsed.split('/').filter(Boolean);
  if (
    collapsed.startsWith('/') ||
    collapsed.endsWith('/') ||
    segments.length === 0 ||
    segments.some((segment) => segment === '.' || segment === '..')
  ) {
    return undefined;
  }

  return segments.join('/');
};

const extractHeaderValue = (rawText: string, header: string): string | undefined => {
  const escapedHeader = header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = rawText.match(new RegExp(`${escapedHeader}[ \\t]*\\n+([^\\n]+)`, 'i'));
  const value = match?.[1]?.trim();
  return value || undefined;
};

const extractArtifactContentBlock = (rawText: string): string | undefined => {
  const escapedHeader = ARTIFACT_CONTENT_HEADER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const blockMatch = rawText.match(new RegExp(`${escapedHeader}[ \\t]*\\n+${ARTIFACT_CONTENT_FENCE_PATTERN}`, 'i'));
  if (blockMatch?.[1]) {
    return normalizeArtifactContent(blockMatch[1]);
  }

  return undefined;
};

export const normalizeWorkflowArtifactPath = (artifactPath?: string): string => {
  return (
    normalizeWorkflowArtifactPathValue(artifactPath) ||
    getWorkflowGroupTemplateDefinition(DEFAULT_WORKFLOW_GROUP_TEMPLATE).defaults.artifactPath
  );
};

export const normalizeWorkflowOrchestration = (
  orchestration?: Partial<WorkflowGroupOrchestration>
): WorkflowGroupOrchestration => {
  const template = normalizeWorkflowGroupTemplate(orchestration?.template);
  const artifactPath =
    normalizeWorkflowArtifactPathValue(orchestration?.artifactPath) ||
    getWorkflowGroupTemplateDefinition(template).defaults.artifactPath;

  return {
    kind: 'workflow',
    template,
    maxIterations: normalizeWorkflowTemplateMaxIterations(
      isFiniteNumber(orchestration?.maxIterations) ? orchestration.maxIterations : undefined,
      template
    ),
    scoreTarget: normalizeWorkflowTemplateScoreTarget(
      isFiniteNumber(orchestration?.scoreTarget) ? orchestration.scoreTarget : undefined,
      template
    ),
    artifactPath,
  };
};

export const assignWorkflowParticipantRoles = <T extends { role?: GroupParticipantRole }>(
  participants: T[],
  template?: string
): T[] => {
  const roleOrder = getWorkflowTemplateRoleOrder(template);
  const assignedRoles = new Set<WorkflowTemplateRole>();

  return participants.map((participant, index) => {
    const role = deriveWorkflowRole(index, participant.role, assignedRoles, roleOrder);
    if (role !== 'custom') {
      assignedRoles.add(role);
    }

    return {
      ...participant,
      role,
    };
  });
};

const hasExpectedWorkflowRoles = (assignedRoles: GroupParticipantRole[], roleOrder: WorkflowTemplateRole[]): boolean => {
  if (assignedRoles.length !== roleOrder.length) {
    return false;
  }

  if (new Set(assignedRoles).size !== roleOrder.length) {
    return false;
  }

  return roleOrder.every((role) => assignedRoles.includes(role));
};

export const normalizeWorkflowParticipants = <T extends { role?: GroupParticipantRole }>(
  participants: T[],
  template?: string
): Array<T & { role: WorkflowTemplateRole }> => {
  const definition = getWorkflowGroupTemplateDefinition(template);
  if (participants.length !== definition.requiredParticipantCount) {
    throw new Error(
      `Workflow template ${definition.id} requires exactly ${definition.requiredParticipantCount} participants.`
    );
  }

  const normalizedParticipants = assignWorkflowParticipantRoles(participants, definition.id);
  const assignedRoles = normalizedParticipants.map((participant) => participant.role).filter(Boolean);

  if (
    assignedRoles.some((role): role is 'custom' => role === 'custom') ||
    !hasExpectedWorkflowRoles(assignedRoles, definition.roleOrder)
  ) {
    throw new Error(
      `Workflow template ${definition.id} requires unique ${definition.roleOrder.join(', ')} roles.`
    );
  }

  return normalizedParticipants as Array<T & { role: WorkflowTemplateRole }>;
};

export const resolveWorkflowRoleParticipants = (
  participants: GroupParticipant[],
  template?: string
): WorkflowRoleParticipants => {
  const normalizedParticipants = normalizeWorkflowParticipants(participants, template);
  const planner = normalizedParticipants.find((participant) => participant.role === 'planner');
  const writer = normalizedParticipants.find((participant) => participant.role === 'writer');
  const evaluator = normalizedParticipants.find((participant) => participant.role === 'evaluator');

  if (!planner || !writer || !evaluator) {
    throw new Error('Workflow group requires planner, writer, and evaluator participants.');
  }

  return {
    planner,
    writer,
    evaluator,
  };
};

export const buildInitialWorkflowRunState = (
  orchestration: WorkflowGroupOrchestration,
  participants: Array<{ id: string; role?: GroupParticipantRole }> = []
): WorkflowGroupRunState => {
  const plannerParticipant =
    participants.length > 0
      ? assignWorkflowParticipantRoles(participants, orchestration.template).find(
          (participant) => participant.role === 'planner'
        )
      : undefined;

  return {
    status: 'idle',
    stage: 'planning',
    iteration: 0,
    artifactPath: orchestration.artifactPath,
    activeParticipantId: plannerParticipant?.id,
    updatedAt: Date.now(),
  };
};

export const parseWorkflowEvaluation = (value: string, scoreTarget: number): WorkflowEvaluation => {
  const parsed = extractJsonObject(value);
  const score =
    parsed && isFiniteNumber(parsed.score) ? clampScore(parsed.score) : extractScoreFromText(value);
  const decision = deriveDecision(
    parsed && typeof parsed.decision === 'string' ? parsed.decision : undefined,
    score,
    value,
    scoreTarget
  );

  return {
    score,
    decision,
    summary:
      (parsed && typeof parsed.summary === 'string' && parsed.summary.trim()) || summarizeRawEvaluation(value),
    strengths: normalizeArrayField(parsed?.strengths),
    issues: normalizeArrayField(parsed?.issues),
    nextActions: normalizeArrayField(parsed?.nextActions),
    raw: value,
  };
};

export const extractWorkflowArtifactUpdate = (
  value: string
): WorkflowArtifactUpdate => {
  const declaredPathValue = extractHeaderValue(value, ARTIFACT_PATH_HEADER);
  const declaredPath = normalizeWorkflowArtifactPathValue(declaredPathValue);
  const statusValue = extractHeaderValue(value, ARTIFACT_STATUS_HEADER)?.toLowerCase();
  const content = extractArtifactContentBlock(value);

  return {
    path: declaredPath,
    status: statusValue === 'written' || statusValue === 'proposed' ? statusValue : undefined,
    content,
    raw: value,
  };
};

export const formatWorkflowEvaluationForWriter = (evaluation: WorkflowEvaluation): string => {
  const sections = [
    `[Evaluator Summary]`,
    `Decision: ${evaluation.decision}`,
    evaluation.score !== undefined ? `Score: ${evaluation.score}/10` : undefined,
    `Summary: ${evaluation.summary}`,
    evaluation.issues.length > 0 ? `Issues:\n${evaluation.issues.map((item) => `- ${item}`).join('\n')}` : undefined,
    evaluation.nextActions.length > 0
      ? `Next Actions:\n${evaluation.nextActions.map((item) => `- ${item}`).join('\n')}`
      : undefined,
  ];

  return sections.filter(Boolean).join('\n');
};

export const buildPlannerPrompt = (options: {
  userInput: string;
  participantName: string;
  artifactPath: string;
  scoreTarget: number;
  maxIterations: number;
}): string => {
  const { userInput, participantName, artifactPath, scoreTarget, maxIterations } = options;

  return `${userInput}

[Workflow Role]
You are ${participantName}, the Planner in a planner-writer-evaluator workflow.

[Shared Constraints]
- Shared artifact path: ${artifactPath}
- Target score: ${scoreTarget}/10
- Maximum writer/evaluator iterations: ${maxIterations}

[Planner Responsibilities]
- Convert the request into a clear objective.
- Define concrete acceptance criteria for the writer and evaluator.
- Point out risks, assumptions, and the first iteration focus.

[Output Format]
Return concise markdown with these sections:
## Objective
## Acceptance Criteria
## Artifact Plan
## Risks
## First Iteration Focus`;
};

export const buildWriterPrompt = (options: {
  userInput: string;
  participantName: string;
  artifactPath: string;
  iteration: number;
  planningBrief: string;
  artifactContent?: string;
  evaluatorFeedback?: string;
}): string => {
  const { userInput, participantName, artifactPath, iteration, planningBrief, artifactContent, evaluatorFeedback } =
    options;

  return `${userInput}

[Workflow Role]
You are ${participantName}, the Writer in a planner-writer-evaluator workflow.

[Iteration]
Current iteration: ${iteration}
Shared artifact path: ${artifactPath}

[Planner Brief]
${planningBrief}

[Current Artifact]
${artifactContent || '(No artifact file found yet. Create or revise the artifact in the shared workspace.)'}

[Evaluator Feedback]
${evaluatorFeedback || '(No evaluator feedback yet. Produce the strongest first draft possible.)'}

[Writer Responsibilities]
- Update or create the artifact in the shared workspace when your tools allow it.
- Keep the work grounded in the requested deliverable, not meta-discussion.
- The artifact must stay at exactly: ${artifactPath}
- If you cannot modify the file directly, you must include the full replacement artifact content in your response.

[Response Requirements]
Return markdown with this exact structure:
${ARTIFACT_PATH_HEADER}
${artifactPath}

${ARTIFACT_STATUS_HEADER}
written | proposed

${ARTIFACT_CONTENT_HEADER}
\`\`\`md
<full current artifact content for ${artifactPath}>
\`\`\`

[Change Summary]
- Summarize what changed
- Mention blockers if the artifact could not be written directly

Do not omit ${ARTIFACT_CONTENT_HEADER}. The evaluator will review only the artifact content for ${artifactPath}.`;
};

export const buildEvaluatorPrompt = (options: {
  userInput: string;
  participantName: string;
  artifactPath: string;
  iteration: number;
  planningBrief: string;
  artifactContent: string;
  scoreTarget: number;
}): string => {
  const { userInput, participantName, artifactPath, iteration, planningBrief, artifactContent, scoreTarget } = options;

  return `${userInput}

[Workflow Role]
You are ${participantName}, the Evaluator in a planner-writer-evaluator workflow.

[Evaluation Context]
- Iteration: ${iteration}
- Shared artifact path: ${artifactPath}
- Accept threshold: ${scoreTarget}/10

[Planner Brief]
${planningBrief}

[Artifact To Review]
${artifactContent}

[Evaluator Responsibilities]
- Judge the artifact against the planner brief with a skeptical, concrete standard.
- Penalize vague structure, missing requirements, shallow reasoning, or weak craft.
- Prefer actionable criticism over praise.

[Output Format]
Return a JSON object:
{
  "score": 0-10,
  "decision": "continue" | "accept" | "stop",
  "summary": "one short paragraph",
  "strengths": ["..."],
  "issues": ["..."],
  "nextActions": ["..."]
}

[Decision Rules]
- Use "accept" only when the artifact clearly meets the brief and the score is at least ${scoreTarget}.
- Use "continue" when the artifact is improvable within the remaining budget.
- Use "stop" only when the task is blocked, unsafe, or cannot be completed as requested.`;
};
