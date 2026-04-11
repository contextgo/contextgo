/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';

export const DEFAULT_SPACE_CANVAS_PATH = path.posix.join('Canvas', 'Space Overview.canvas');
export const PROJECTS_DIR = 'Projects';
export const SESSIONS_DIR = 'Sessions';
export const SESSION_STATE_DIR = path.posix.join(SESSIONS_DIR, '_state');
export const PROJECT_CONTEXT_DIR = '_context';
export const CANVAS_DIR = 'Canvas';
export const SYSTEM_DIR = 'System';
export const CONTEXT_ENGINE_SYSTEM_DIR = path.posix.join(SYSTEM_DIR, 'Context Engine');
export const OPERATIONS_DIR = path.posix.join(CONTEXT_ENGINE_SYSTEM_DIR, 'Operations');
export const CONTEXT_ENGINE_RUNS_DIR = path.posix.join(CONTEXT_ENGINE_SYSTEM_DIR, 'Runs');
export const SPACE_MEMORY_FILE_NAME = 'Space Memory.md';
export const CONNECTOR_DIGEST_FILE_NAME = 'Connector Digest.md';
export const SOURCE_DOCS_DIR = 'Sources';
export const PROJECT_SESSIONS_DIR_NAME = 'Sessions';
export const PROJECT_SESSION_STATE_DIR_NAME = 'sessions';
export const PROJECT_GRAPH_FILE_NAME = 'Project Graph.canvas';
export const PROJECT_INSIGHTS_FILE_NAME = 'Project Insights.md';
export const PROJECT_BASELINE_FILE_NAME = 'baseline.md';
export const SESSION_WORKING_SET_FILE_NAME = 'working-set.md';

export type ConversationDocumentPaths = {
  sessionRelativePath: string;
  workingSetRelativePath: string;
};

export const sanitizeVaultPathSegment = (value: string): string => {
  const normalized = value
    .normalize('NFKC')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
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

export const getProjectSessionsRelativeDir = (projectFolderName: string): string => {
  return path.posix.join(PROJECTS_DIR, projectFolderName, PROJECT_SESSIONS_DIR_NAME);
};

export const getProjectSessionStateRelativeDir = (projectFolderName: string): string => {
  return path.posix.join(PROJECTS_DIR, projectFolderName, PROJECT_CONTEXT_DIR, PROJECT_SESSION_STATE_DIR_NAME);
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

export const getSessionWorkingSetRelativePath = (conversationId: string, projectFolderName?: string): string => {
  const sanitizedConversationId = sanitizeVaultPathSegment(conversationId);
  return projectFolderName
    ? path.posix.join(
        getProjectSessionStateRelativeDir(projectFolderName),
        sanitizedConversationId,
        SESSION_WORKING_SET_FILE_NAME
      )
    : path.posix.join(SESSION_STATE_DIR, sanitizedConversationId, SESSION_WORKING_SET_FILE_NAME);
};

export const getConversationDocumentPaths = (
  conversationId: string,
  projectFolderName?: string
): ConversationDocumentPaths => {
  return {
    sessionRelativePath: getSessionRelativePath(conversationId, projectFolderName),
    workingSetRelativePath: getSessionWorkingSetRelativePath(conversationId, projectFolderName),
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

export const getConnectorDigestRelativePath = (): string => {
  return path.posix.join(CONTEXT_ENGINE_SYSTEM_DIR, CONNECTOR_DIGEST_FILE_NAME);
};
