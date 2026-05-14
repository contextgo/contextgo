/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';

export const DEFAULT_SPACE_CANVAS_PATH = path.posix.join('Canvas', 'Space Overview.canvas');
export const PROJECTS_DIR = 'Projects';
export const SESSIONS_DIR = 'Sessions';
export const PROJECT_CONTEXT_DIR = '_context';
export const CANVAS_DIR = 'Canvas';
export const SYSTEM_DIR = 'System';
export const CONTEXT_ENGINE_SYSTEM_DIR = path.posix.join(SYSTEM_DIR, 'Context Engine');
export const OPERATIONS_DIR = path.posix.join(CONTEXT_ENGINE_SYSTEM_DIR, 'Operations');
export const CONTEXT_ENGINE_RUNS_DIR = path.posix.join(CONTEXT_ENGINE_SYSTEM_DIR, 'Runs');
export const CONTEXT_ENGINE_MEMORY_DIR = path.posix.join(CONTEXT_ENGINE_SYSTEM_DIR, 'Memory');
export const CONTEXT_ENGINE_RELATIONS_DIR = path.posix.join(CONTEXT_ENGINE_SYSTEM_DIR, 'Relations');
export const CONTEXT_ENGINE_IMPORTS_DIR = path.posix.join(CONTEXT_ENGINE_SYSTEM_DIR, 'Imports');
export const AGENT_DESK_DIR = path.posix.join(SYSTEM_DIR, 'Agent Desk');
export const WORKBENCH_DIR = path.posix.join(SYSTEM_DIR, 'Workbench');
export const SPACE_MEMORY_FILE_NAME = 'Space Memory.md';
export const PROFILE_MEMORY_FILE_NAME = 'Profile Memory.md';
export const CONNECTOR_DIGEST_FILE_NAME = 'Connector Digest.md';
export const SOURCE_DOCS_DIR = 'Sources';
export const CONNECTOR_SOURCES_DIR = path.posix.join(SOURCE_DOCS_DIR, 'Connectors');
export const PROJECT_SESSIONS_DIR_NAME = 'Sessions';
export const PROJECT_SESSION_STATE_DIR_NAME = 'sessions';
export const SESSION_ARCHIVES_DIR_NAME = 'archives';
export const SESSION_ARCHIVE_OVERVIEW_FILE_NAME = 'overview.md';
export const SESSION_ARCHIVE_EXTRACTION_FILE_NAME = 'extraction.md';
export const SESSION_ARCHIVE_STATUS_FILE_NAME = 'status.json';
export const PROJECT_GRAPH_FILE_NAME = 'Project Graph.canvas';
export const PROJECT_INSIGHTS_FILE_NAME = 'Project Insights.md';
export const PROJECT_BASELINE_FILE_NAME = 'baseline.md';
export const PROJECT_AUTOMATION_FILE_NAME = 'Automation.md';
export const LEGACY_PROJECT_CAPABILITIES_FILE_NAME = 'Capabilities.md';
export const PROJECT_AUTOMATION_DIR_NAME = 'automation';
export const LEGACY_PROJECT_CAPABILITIES_DIR_NAME = 'capabilities';
export const PROJECT_CAPABILITY_SKILLS_DIR_NAME = 'skills';
export const PROJECT_CAPABILITY_HOOKS_DIR_NAME = 'hooks';
export const PROJECT_CAPABILITY_COMMANDS_DIR_NAME = 'commands';
export const PROJECT_CAPABILITY_SCHEDULES_DIR_NAME = 'schedules';
export const CONNECTOR_IMPORT_OVERVIEW_FILE_NAME = 'Import Overview.md';
export const CONNECTOR_IMPORT_RUNS_DIR_NAME = 'import-runs';
export const CONNECTOR_IMPORT_DOCS_DIR_NAME = 'docs';
export const CONNECTOR_IMPORT_RAW_DIR_NAME = 'raw';
export const RELATIONS_FILE_NAME = 'relations.jsonl';
export const CONNECTOR_IMPORT_INDEX_FILE_NAME = 'connector-import-index.md';
export const ACTIVE_AGENTS_FILE_NAME = 'Active Agents.md';
export const DECISION_INBOX_FILE_NAME = 'Decision Inbox.md';
export const ARTIFACT_LEDGER_FILE_NAME = 'Artifact Ledger.md';
export const CONTEXT_FLOW_WORKBENCH_FILE_NAME = 'Context Flow Workbench.md';
export const ATTENTION_QUEUE_FILE_NAME = 'Attention Queue.md';
export const SIGNAL_MATRIX_FILE_NAME = 'Signal Matrix.md';
export const HANDOFF_BUS_FILE_NAME = 'Handoff Bus.md';

export type ConnectorIngestMode =
  | 'initial_full_import'
  | 'manual_import'
  | 'incremental_sync'
  | 'cursor_replay'
  | 'watch_refresh';

export type VaultSchemaMemoryKind =
  | 'Profile'
  | 'Preferences'
  | 'Decisions'
  | 'Workflows'
  | 'Patterns'
  | 'Tools'
  | 'Skills';

export type VaultRelationType =
  | 'derived_from'
  | 'promoted_to'
  | 'mounted_into'
  | 'summarizes'
  | 'supersedes'
  | 'evidence_for'
  | 'related_to';

export type ContextgoNamespace = 'space' | 'project' | 'session' | 'source' | 'automation' | 'connector' | 'memory';
export type ContextgoProjection =
  | 'semantic-context'
  | 'source-mirror'
  | 'automation-inventory'
  | 'connector-import'
  | 'schema-memory'
  | 'governance-trace';

export type ConversationDocumentPaths = {
  sessionRelativePath: string;
};

const INVALID_VAULT_PATH_CHARS_REGEX = /[\p{Cc}<>:"/\\|?*]/gu;

export const sanitizeVaultPathSegment = (value: string): string => {
  const normalized = value
    .normalize('NFKC')
    .trim()
    .replace(INVALID_VAULT_PATH_CHARS_REGEX, ' ')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/\.+$/g, '');

  return normalized || 'item';
};

export const getProjectDocumentFileName = (projectFolderName: string): string => {
  return `${sanitizeVaultPathSegment(projectFolderName)}.md`;
};

export const getProjectRelativePath = (projectFolderName: string): string => {
  return path.posix.join(PROJECTS_DIR, projectFolderName, getProjectDocumentFileName(projectFolderName));
};

export const getProjectGraphRelativePath = (projectFolderName: string): string => {
  return path.posix.join(PROJECTS_DIR, projectFolderName, PROJECT_GRAPH_FILE_NAME);
};

export const getProjectInsightsRelativePath = (projectFolderName: string): string => {
  return path.posix.join(PROJECTS_DIR, projectFolderName, PROJECT_INSIGHTS_FILE_NAME);
};

export const getProjectBaselineRelativePath = (projectFolderName: string): string => {
  return path.posix.join(PROJECTS_DIR, projectFolderName, PROJECT_CONTEXT_DIR, PROJECT_BASELINE_FILE_NAME);
};

export const getProjectAutomationRelativePath = (projectFolderName: string): string => {
  return path.posix.join(PROJECTS_DIR, projectFolderName, PROJECT_CONTEXT_DIR, PROJECT_AUTOMATION_FILE_NAME);
};

export const getProjectAutomationItemsRelativeDir = (projectFolderName: string, capabilityDirName: string): string => {
  return path.posix.join(
    PROJECTS_DIR,
    projectFolderName,
    PROJECT_CONTEXT_DIR,
    PROJECT_AUTOMATION_DIR_NAME,
    capabilityDirName
  );
};

export const getProjectAutomationItemRelativePath = (
  projectFolderName: string,
  capabilityDirName: string,
  itemName: string
): string => {
  return path.posix.join(
    getProjectAutomationItemsRelativeDir(projectFolderName, capabilityDirName),
    `${sanitizeVaultPathSegment(itemName)}.md`
  );
};

export const getProjectSessionsRelativeDir = (projectFolderName: string): string => {
  return path.posix.join(PROJECTS_DIR, projectFolderName, PROJECT_SESSIONS_DIR_NAME);
};

export const getProjectSessionStateRelativeDir = (projectFolderName: string): string => {
  return path.posix.join(PROJECTS_DIR, projectFolderName, PROJECT_CONTEXT_DIR, PROJECT_SESSION_STATE_DIR_NAME);
};

export const getSessionContextRootRelativePath = (conversationId: string, projectFolderName?: string): string => {
  const sanitizedConversationId = sanitizeVaultPathSegment(conversationId);
  return projectFolderName
    ? path.posix.join(getProjectSessionStateRelativeDir(projectFolderName), sanitizedConversationId)
    : path.posix.join(PROJECT_SESSION_STATE_DIR_NAME, sanitizedConversationId);
};

export const getSessionTimelineRelativePath = (conversationId: string, projectFolderName?: string): string => {
  return path.posix.join(getSessionContextRootRelativePath(conversationId, projectFolderName), 'timeline.md');
};

export const getSessionWorkingContextRelativePath = (conversationId: string, projectFolderName?: string): string => {
  return path.posix.join(getSessionContextRootRelativePath(conversationId, projectFolderName), 'working-context.md');
};

export const getSessionCheckpointsRelativeDir = (conversationId: string, projectFolderName?: string): string => {
  return path.posix.join(getSessionContextRootRelativePath(conversationId, projectFolderName), 'checkpoints');
};

export const getSessionArchivesRelativeDir = (conversationId: string, projectFolderName?: string): string => {
  return path.posix.join(
    getSessionContextRootRelativePath(conversationId, projectFolderName),
    SESSION_ARCHIVES_DIR_NAME
  );
};

export const getSessionArchiveRelativeDir = (
  conversationId: string,
  archiveId: string,
  projectFolderName?: string
): string => {
  return path.posix.join(
    getSessionArchivesRelativeDir(conversationId, projectFolderName),
    sanitizeVaultPathSegment(archiveId)
  );
};

export const getSessionArchiveOverviewRelativePath = (
  conversationId: string,
  archiveId: string,
  projectFolderName?: string
): string => {
  return path.posix.join(
    getSessionArchiveRelativeDir(conversationId, archiveId, projectFolderName),
    SESSION_ARCHIVE_OVERVIEW_FILE_NAME
  );
};

export const getSessionArchiveExtractionRelativePath = (
  conversationId: string,
  archiveId: string,
  projectFolderName?: string
): string => {
  return path.posix.join(
    getSessionArchiveRelativeDir(conversationId, archiveId, projectFolderName),
    SESSION_ARCHIVE_EXTRACTION_FILE_NAME
  );
};

export const getSessionArchiveStatusRelativePath = (
  conversationId: string,
  archiveId: string,
  projectFolderName?: string
): string => {
  return path.posix.join(
    getSessionArchiveRelativeDir(conversationId, archiveId, projectFolderName),
    SESSION_ARCHIVE_STATUS_FILE_NAME
  );
};

export const getProjectSourceRelativePath = (projectFolderName: string, sourceDocRelativePath: string): string => {
  return path.posix.join(PROJECTS_DIR, projectFolderName, SOURCE_DOCS_DIR, sourceDocRelativePath);
};

export const getSessionRelativePath = (conversationId: string, projectFolderName?: string): string => {
  const sanitizedConversationId = sanitizeVaultPathSegment(conversationId);
  return projectFolderName
    ? path.posix.join(getProjectSessionsRelativeDir(projectFolderName), `${sanitizedConversationId}.md`)
    : path.posix.join(SESSIONS_DIR, `${sanitizedConversationId}.md`);
};

export const getConversationDocumentPaths = (
  conversationId: string,
  projectFolderName?: string
): ConversationDocumentPaths => {
  return {
    sessionRelativePath: getSessionRelativePath(conversationId, projectFolderName),
  };
};

export const getOperationLogDailyRelativePath = (timestamp: string): string => {
  return path.posix.join(OPERATIONS_DIR, `${timestamp.slice(0, 10)}.md`);
};

export const getContextRunRelativePath = (runId: string): string => {
  return path.posix.join(CONTEXT_ENGINE_RUNS_DIR, `${sanitizeVaultPathSegment(runId)}.md`);
};

export const getSpaceMemoryRelativePath = (): string => {
  return path.posix.join(CONTEXT_ENGINE_SYSTEM_DIR, SPACE_MEMORY_FILE_NAME);
};

export const getProfileMemoryRelativePath = (): string => {
  return path.posix.join(CONTEXT_ENGINE_SYSTEM_DIR, PROFILE_MEMORY_FILE_NAME);
};

export const getConnectorDigestRelativePath = (): string => {
  return path.posix.join(CONTEXT_ENGINE_SYSTEM_DIR, CONNECTOR_DIGEST_FILE_NAME);
};

export const getSchemaMemoryRelativeDir = (kind: VaultSchemaMemoryKind): string => {
  return path.posix.join(CONTEXT_ENGINE_MEMORY_DIR, kind);
};

export const getSchemaMemoryRelativePath = (kind: VaultSchemaMemoryKind, title: string): string => {
  return path.posix.join(getSchemaMemoryRelativeDir(kind), `${sanitizeVaultPathSegment(title)}.md`);
};

export const getRelationsManifestRelativePath = (): string => {
  return path.posix.join(CONTEXT_ENGINE_RELATIONS_DIR, RELATIONS_FILE_NAME);
};

export const getConnectorImportIndexRelativePath = (): string => {
  return path.posix.join(CONTEXT_ENGINE_IMPORTS_DIR, CONNECTOR_IMPORT_INDEX_FILE_NAME);
};

export const getConnectorRootRelativeDir = (connectorId: string): string => {
  return path.posix.join(CONNECTOR_SOURCES_DIR, sanitizeVaultPathSegment(connectorId));
};

export const getConnectorImportOverviewRelativePath = (connectorId: string): string => {
  return path.posix.join(getConnectorRootRelativeDir(connectorId), CONNECTOR_IMPORT_OVERVIEW_FILE_NAME);
};

export const getConnectorImportRunsRelativeDir = (connectorId: string): string => {
  return path.posix.join(getConnectorRootRelativeDir(connectorId), CONNECTOR_IMPORT_RUNS_DIR_NAME);
};

export const getConnectorImportRunRelativePath = (connectorId: string, runId: string): string => {
  return path.posix.join(getConnectorImportRunsRelativeDir(connectorId), `${sanitizeVaultPathSegment(runId)}.md`);
};

export const getConnectorDocsRelativeDir = (connectorId: string): string => {
  return path.posix.join(getConnectorRootRelativeDir(connectorId), CONNECTOR_IMPORT_DOCS_DIR_NAME);
};

export const getConnectorRawRelativeDir = (connectorId: string): string => {
  return path.posix.join(getConnectorRootRelativeDir(connectorId), CONNECTOR_IMPORT_RAW_DIR_NAME);
};

export const getActiveAgentsRelativePath = (): string => {
  return path.posix.join(AGENT_DESK_DIR, ACTIVE_AGENTS_FILE_NAME);
};

export const getDecisionInboxRelativePath = (): string => {
  return path.posix.join(AGENT_DESK_DIR, DECISION_INBOX_FILE_NAME);
};

export const getArtifactLedgerRelativePath = (): string => {
  return path.posix.join(AGENT_DESK_DIR, ARTIFACT_LEDGER_FILE_NAME);
};

export const getContextFlowWorkbenchRelativePath = (): string => {
  return path.posix.join(WORKBENCH_DIR, CONTEXT_FLOW_WORKBENCH_FILE_NAME);
};

export const getAttentionQueueRelativePath = (): string => {
  return path.posix.join(WORKBENCH_DIR, ATTENTION_QUEUE_FILE_NAME);
};

export const getSignalMatrixRelativePath = (): string => {
  return path.posix.join(WORKBENCH_DIR, SIGNAL_MATRIX_FILE_NAME);
};

export const getHandoffBusRelativePath = (): string => {
  return path.posix.join(WORKBENCH_DIR, HANDOFF_BUS_FILE_NAME);
};
