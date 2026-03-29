/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  DEFAULT_WORKFLOW_GROUP_TEMPLATE,
  formatWorkflowRoleLabel,
  getWorkflowGroupTemplateDefinition,
  getWorkflowTemplateRoleOrder,
  getWorkflowTemplateStageDefinitions,
  normalizeWorkflowGroupTemplate,
  normalizeWorkflowTemplateMaxIterations,
  normalizeWorkflowTemplateReviewMode,
  normalizeWorkflowTemplateScoreTarget,
  type WorkflowTemplateStageDefinition,
  type WorkflowTemplateRole,
} from '@/common/config/group';
import type {
  GroupParticipant,
  GroupParticipantRole,
  WorkflowGroupDecision,
  WorkflowGroupOrchestration,
  WorkflowGroupRunState,
  WorkflowGroupStageRecord,
} from '@/common/config/storage';
import { uuid } from '@/common/utils';

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
  planning: GroupParticipant;
  writing: GroupParticipant;
  evaluating: GroupParticipant;
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
  const firstMeaningfulLine = value
    .replace(/```(?:json)?[\s\S]*?```/gi, '')
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);

  return firstMeaningfulLine || 'Evaluation stage completed.';
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
    reviewMode: normalizeWorkflowTemplateReviewMode(orchestration?.reviewMode, template),
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

const hasExpectedWorkflowRoles = (
  assignedRoles: GroupParticipantRole[],
  roleOrder: WorkflowTemplateRole[]
): boolean => {
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
    throw new Error(`Workflow template ${definition.id} requires unique ${definition.roleOrder.join(', ')} roles.`);
  }

  return normalizedParticipants as Array<T & { role: WorkflowTemplateRole }>;
};

export const resolveWorkflowRoleParticipants = (
  participants: GroupParticipant[],
  template?: string
): WorkflowRoleParticipants => {
  const normalizedParticipants = normalizeWorkflowParticipants(participants, template);
  const stageDefinitions = getWorkflowTemplateStageDefinitions(template);
  const stageRoles = {
    planning: stageDefinitions.find((stage) => stage.kind === 'planning')?.role,
    writing: stageDefinitions.find((stage) => stage.kind === 'writing')?.role,
    evaluating: stageDefinitions.find((stage) => stage.kind === 'evaluating')?.role,
  };
  const planning = normalizedParticipants.find((participant) => participant.role === stageRoles.planning);
  const writing = normalizedParticipants.find((participant) => participant.role === stageRoles.writing);
  const evaluating = normalizedParticipants.find((participant) => participant.role === stageRoles.evaluating);

  if (!planning || !writing || !evaluating) {
    const definition = getWorkflowGroupTemplateDefinition(template);
    throw new Error(
      `Workflow template ${definition.id} requires stage participants for ${stageRoles.planning}, ${stageRoles.writing}, and ${stageRoles.evaluating}.`
    );
  }

  return {
    planning,
    writing,
    evaluating,
  };
};

export const buildInitialWorkflowRunState = (
  orchestration: WorkflowGroupOrchestration,
  participants: Array<{ id: string; role?: GroupParticipantRole }> = []
): WorkflowGroupRunState => {
  const stageDefinitions = getWorkflowTemplateStageDefinitions(orchestration.template);
  const entryStage = stageDefinitions[0];
  const planningRole = entryStage?.role;
  const planningParticipant =
    participants.length > 0
      ? assignWorkflowParticipantRoles(participants, orchestration.template).find(
          (participant) => participant.role === planningRole
        )
      : undefined;
  const now = Date.now();

  return {
    runId: uuid(),
    status: 'idle',
    stage: entryStage?.kind || 'planning',
    activeStageId: entryStage?.id,
    iteration: 0,
    artifactPath: orchestration.artifactPath,
    activeParticipantId: planningParticipant?.id,
    stageHistory: [],
    updatedAt: now,
  };
};

export const getWorkflowStageDefinition = (
  template: string | undefined,
  stageId: string | undefined
): WorkflowTemplateStageDefinition | undefined => {
  if (!stageId) {
    return undefined;
  }

  return getWorkflowTemplateStageDefinitions(template).find((stage) => stage.id === stageId);
};

export const resolveWorkflowParticipantForStage = (
  participants: GroupParticipant[],
  stage: Pick<WorkflowTemplateStageDefinition, 'role'>,
  template?: string
): GroupParticipant => {
  const normalizedParticipants = normalizeWorkflowParticipants(participants, template);
  const participant = normalizedParticipants.find((item) => item.role === stage.role);
  if (!participant) {
    throw new Error(
      `Workflow template ${template || DEFAULT_WORKFLOW_GROUP_TEMPLATE} has no participant for role ${stage.role}.`
    );
  }

  return participant;
};

export const beginWorkflowStageRecord = (options: {
  runState: WorkflowGroupRunState;
  stage: Pick<WorkflowTemplateStageDefinition, 'id' | 'kind' | 'role'>;
  participant?: Pick<GroupParticipant, 'id' | 'role'>;
  iteration: number;
}): WorkflowGroupStageRecord[] => {
  const now = Date.now();
  return [
    ...options.runState.stageHistory,
    {
      stageId: options.stage.id,
      stage: options.stage.kind,
      participantId: options.participant?.id,
      participantRole: options.participant?.role,
      iteration: options.iteration,
      startedAt: now,
      status: 'running',
    },
  ];
};

export const finalizeWorkflowStageHistory = (
  stageHistory: WorkflowGroupStageRecord[],
  stageId: string,
  status: WorkflowGroupStageRecord['status']
): WorkflowGroupStageRecord[] => {
  const now = Date.now();
  for (let index = stageHistory.length - 1; index >= 0; index -= 1) {
    const entry = stageHistory[index];
    if (entry.stageId === stageId && entry.status === 'running') {
      const nextHistory = [...stageHistory];
      nextHistory[index] = {
        ...entry,
        status,
        completedAt: now,
      };
      return nextHistory;
    }
  }

  return stageHistory;
};

export const buildWorkflowExecutionState = (options: {
  runState: WorkflowGroupRunState;
  stage: Pick<WorkflowTemplateStageDefinition, 'id' | 'kind' | 'role'>;
  participant?: GroupParticipant;
  iteration: number;
  artifactPath: string;
  status?: WorkflowGroupRunState['status'];
  planningBrief?: string;
  latestScore?: number;
  latestDecision?: WorkflowGroupDecision;
}): WorkflowGroupRunState => {
  const nextStageHistory = beginWorkflowStageRecord({
    runState: options.runState,
    stage: options.stage,
    participant: options.participant,
    iteration: options.iteration,
  });

  return {
    ...options.runState,
    ...(options.status ? { status: options.status } : {}),
    stage: options.stage.kind,
    activeStageId: options.stage.id,
    iteration: options.iteration,
    artifactPath: options.artifactPath,
    activeParticipantId: options.participant?.id,
    planningBrief: options.planningBrief ?? options.runState.planningBrief,
    latestScore: options.latestScore ?? options.runState.latestScore,
    latestDecision: options.latestDecision ?? options.runState.latestDecision,
    startedAt: options.runState.startedAt || Date.now(),
    stageHistory: nextStageHistory,
    updatedAt: Date.now(),
  };
};

export const finalizeWorkflowRunState = (options: {
  runState: WorkflowGroupRunState;
  terminalStatus: Exclude<WorkflowGroupRunState['status'], 'idle' | 'running'>;
  terminalStage: WorkflowGroupRunState['stage'];
  iteration: number;
  artifactPath: string;
  latestScore?: number;
  latestDecision?: WorkflowGroupDecision;
}): WorkflowGroupRunState => {
  return {
    ...options.runState,
    status: options.terminalStatus,
    stage: options.terminalStage,
    iteration: options.iteration,
    artifactPath: options.artifactPath,
    activeParticipantId: undefined,
    activeStageId: undefined,
    latestScore: options.latestScore ?? options.runState.latestScore,
    latestDecision: options.latestDecision ?? options.runState.latestDecision,
    completedAt: Date.now(),
    updatedAt: Date.now(),
  };
};

const describeStageRole = (role: string, stageLabel: 'Planning' | 'Writing' | 'Evaluation'): string => {
  return `${formatWorkflowRoleLabel(role)} (${stageLabel} Stage)`;
};

export const parseWorkflowEvaluation = (value: string, scoreTarget: number): WorkflowEvaluation => {
  const parsed = extractJsonObject(value);
  const score = parsed && isFiniteNumber(parsed.score) ? clampScore(parsed.score) : extractScoreFromText(value);
  const decision = deriveDecision(
    parsed && typeof parsed.decision === 'string' ? parsed.decision : undefined,
    score,
    value,
    scoreTarget
  );

  return {
    score,
    decision,
    summary: (parsed && typeof parsed.summary === 'string' && parsed.summary.trim()) || summarizeRawEvaluation(value),
    strengths: normalizeArrayField(parsed?.strengths),
    issues: normalizeArrayField(parsed?.issues),
    nextActions: normalizeArrayField(parsed?.nextActions),
    raw: value,
  };
};

export const extractWorkflowArtifactUpdate = (value: string): WorkflowArtifactUpdate => {
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
    `[Evaluation Summary]`,
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
  roleId?: string;
}): string => {
  const { userInput, participantName, artifactPath, scoreTarget, maxIterations, roleId } = options;
  const roleLabel = describeStageRole(roleId || 'planner', 'Planning');

  return `${userInput}

[Workflow Role]
You are ${participantName}, acting as ${roleLabel} in a multi-agent workflow harness.

[Shared Constraints]
- Shared artifact path: ${artifactPath}
- Target score: ${scoreTarget}/10
- Maximum write/evaluate iterations: ${maxIterations}

[Planning Stage Responsibilities]
- Convert the request into a clear objective.
- Define concrete acceptance criteria for the writing and evaluation stages.
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
  roleId?: string;
}): string => {
  const {
    userInput,
    participantName,
    artifactPath,
    iteration,
    planningBrief,
    artifactContent,
    evaluatorFeedback,
    roleId,
  } = options;
  const roleLabel = describeStageRole(roleId || 'writer', 'Writing');

  return `${userInput}

[Workflow Role]
You are ${participantName}, acting as ${roleLabel} in a multi-agent workflow harness.

[Iteration]
Current iteration: ${iteration}
Shared artifact path: ${artifactPath}

[Planning Brief]
${planningBrief}

[Current Artifact]
${artifactContent || '(No artifact file found yet. Create or revise the artifact in the shared workspace.)'}

[Evaluation Feedback]
${evaluatorFeedback || '(No evaluation feedback yet. Produce the strongest first draft possible.)'}

[Writing Stage Responsibilities]
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

Do not omit ${ARTIFACT_CONTENT_HEADER}. The evaluation stage will review only the artifact content for ${artifactPath}.`;
};

export const buildEvaluatorPrompt = (options: {
  userInput: string;
  participantName: string;
  artifactPath: string;
  iteration: number;
  planningBrief: string;
  artifactContent: string;
  scoreTarget: number;
  roleId?: string;
}): string => {
  const { userInput, participantName, artifactPath, iteration, planningBrief, artifactContent, scoreTarget, roleId } =
    options;
  const roleLabel = describeStageRole(roleId || 'evaluator', 'Evaluation');

  return `${userInput}

[Workflow Role]
You are ${participantName}, acting as ${roleLabel} in a multi-agent workflow harness.

[Evaluation Context]
- Iteration: ${iteration}
- Shared artifact path: ${artifactPath}
- Accept threshold: ${scoreTarget}/10

[Planning Brief]
${planningBrief}

[Artifact To Review]
${artifactContent}

[Evaluation Stage Responsibilities]
- Judge the artifact against the planning brief with a skeptical, concrete standard.
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
