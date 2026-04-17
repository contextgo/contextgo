/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TChatConversation, SpaceVaultProviderRef, TSpace } from '@/common/config/storage';
import type { ProjectCapabilityRecord, ProjectCapabilitySnapshot } from './ProjectCapabilityService';
import type { ContextPackSection } from '../../../../packages/context-engine/src/domain';
import type { ISpaceService } from './ISpaceService';
import { ProjectCapabilityService } from './ProjectCapabilityService';
import { SpaceServiceImpl } from './SpaceServiceImpl';
import {
  CANVAS_DIR,
  CONTEXT_ENGINE_SYSTEM_DIR,
  DEFAULT_SPACE_CANVAS_PATH,
  getConversationDocumentPaths,
  getOperationLogDailyRelativePath,
  getConnectorDigestRelativePath,
  getContextRunRelativePath,
  getProjectBaselineRelativePath,
  getProjectCapabilitiesRelativePath,
  getProjectCapabilityItemRelativePath,
  getProjectGraphRelativePath,
  getProjectInsightsRelativePath,
  getProjectRelativePath,
  getProjectSessionStateRelativeDir,
  getProjectSessionsRelativeDir,
  getProjectSourceRelativePath,
  getSpaceMemoryRelativePath,
  OPERATIONS_DIR,
  PROJECT_CAPABILITY_COMMANDS_DIR_NAME,
  PROJECT_CAPABILITY_HOOKS_DIR_NAME,
  PROJECT_CAPABILITY_SCHEDULES_DIR_NAME,
  PROJECT_CAPABILITY_SKILLS_DIR_NAME,
  PROJECT_CONTEXT_DIR,
  PROJECT_SESSION_STATE_DIR_NAME,
  PROJECT_SESSIONS_DIR_NAME,
  PROJECTS_DIR,
  SOURCE_DOCS_DIR,
  SYSTEM_DIR,
  sanitizeVaultPathSegment,
} from './vaultLayout';
import { isSpaceVaultProviderRef } from './vaultBinding';
import { SqliteSpaceRepository } from '@process/services/database/space/SqliteSpaceRepository';
import { formatProjectCuratorProposal } from '@process/services/context/jobs/ProjectCuratorProposalFormatter';
import {
  formatConnectorDigestEntry,
  formatSpaceCuratorProfileMemory,
} from '@process/services/context/jobs/SpaceCuratorDistillationFormatter';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const GENERATED_MARKER = '<!-- contextgo-generated -->';
const MAX_SCANNED_SOURCE_DOCS = 24;
const MAX_SCAN_DEPTH = 4;
const MAX_SOURCE_DOC_BYTES = 256 * 1024;
const SESSION_EXCERPT_LIMIT = 2000;
const SESSION_SUMMARY_EXCERPT_LIMIT = 160;
const SESSION_RECENT_EVENT_LIMIT = 5;
const EXCLUDED_DIRECTORIES = new Set([
  '.git',
  '.obsidian',
  '.trash',
  '.next',
  '.turbo',
  '.bun',
  'node_modules',
  'dist',
  'build',
  'coverage',
  'tmp',
  'temp',
]);

type ConversationContextTarget = {
  space: TSpace;
  vaultPath: string;
  project?: ProjectContext;
};

type ProjectContext = {
  slug: string;
  name: string;
  folderName: string;
  workspacePath: string;
  folderPath: string;
  notePath: string;
  relativePath: string;
  sourceDocs: SourceDoc[];
};

type ProjectCapabilityDoc = {
  title: string;
  relativePath: string;
  body: string;
};

type SourceDoc = {
  sourcePath: string;
  relativePath: string;
  title: string;
  noteTitle: string;
  references: string[];
  backlinks: string[];
};

type SessionMeta = {
  conversationId: string;
  title: string;
  projectSlug?: string;
  relativePath: string;
  updatedAt: string;
};

type ProjectMeta = {
  slug: string;
  title: string;
  noteTitle: string;
  relativePath: string;
  updatedAt: string;
};

type ProjectBinding = {
  slug: string;
  name: string;
  folderName: string;
  workspacePath?: string;
  relativePath: string;
};

type SpaceMeta = {
  title: string;
  noteTitle: string;
  relativePath: string;
};

type FrontmatterRecord = Record<string, string>;

type RegisterConversationInput = {
  conversation: TChatConversation;
};

type RemoveConversationContextInput = {
  conversation: TChatConversation;
  remainingConversations: readonly TChatConversation[];
};

type UserTurnEventInput = {
  conversation: TChatConversation;
  userInput: string;
  preparedAt: number;
  msgId?: string;
};

type AssistantTurnEventInput = {
  conversation: TChatConversation;
  assistantText: string;
  completedAt: number;
  assistantMessageId?: string;
  preparedAt?: number;
};

type ConversationStopEventInput = {
  conversation: TChatConversation;
  stoppedAt: number;
  reason: string;
  preparedAt?: number;
};

type SessionContextCheckpointInput = {
  conversation: TChatConversation;
  timestamp: number;
  title: string;
  bullets?: readonly string[];
  body?: string;
};

type SessionTimelineEventInput = {
  conversation: TChatConversation;
  timestamp: string;
  title: string;
  body: string;
};

type SessionCheckpointWriteInput = {
  conversation: TChatConversation;
  timestamp: string;
  kind: string;
  title: string;
  summary: string;
  detail?: string;
};

type SessionWorkingSetWriteInput = {
  conversation: TChatConversation;
  timestamp: string;
  currentTask?: string;
  stableStrategies: readonly string[];
  failureModes: readonly string[];
  pendingConstraints: readonly string[];
  signalKinds: readonly string[];
  pressure: number;
  sourceProfileKey?: string;
};

type OperationLogEntryInput = {
  spaceId: string;
  timestamp: string;
  title: string;
  bullets?: readonly string[];
  body?: string;
};

type ProjectPromotionWriteInput = {
  spaceId: string;
  projectSlug: string;
  summary: string;
  detail?: string;
  sourceThreadIds: readonly string[];
  timestamp: string;
};

type ContextRunWriteInput = {
  spaceId: string;
  runId: string;
  title: string;
  summary: string;
  detail?: string;
  timestamp: string;
};

type SpaceMemoryDistillationWriteInput = {
  spaceId: string;
  summary: string;
  detail?: string;
  timestamp: string;
};

type ProfileMemoryDistillationWriteInput = {
  spaceId: string;
  summary: string;
  detail?: string;
  bullets: readonly string[];
  timestamp: string;
};

type ConnectorDigestWriteInput = {
  spaceId: string;
  summary: string;
  detail?: string;
  timestamp: string;
};

type ProjectCapabilityCurationWriteInput = {
  spaceId: string;
  projectSlug: string;
  summary: string;
  detail?: string;
  timestamp: string;
};

type ProjectCuratorProposalWriteInput = {
  spaceId: string;
  projectSlug: string;
  title: string;
  proposalKind: 'project_rules' | 'project_skill';
  summary: string;
  targetPath: string;
  additions: readonly string[];
  evidence: readonly string[];
  timestamp: string;
};

type JsonCanvasFile = {
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
};

type SessionTimelineEvent = {
  timestamp: string;
  title: string;
  body: string;
};

type SessionCheckpointArtifact = {
  title: string;
  relativePath: string;
  summary: string;
};

const nowIso = (timestamp = Date.now()): string => new Date(timestamp).toISOString();

const toPosixRelativePath = (value: string): string => value.split(path.sep).join(path.posix.sep);

const trimTrailingSlash = (value: string): string => value.replace(/[\\/]+$/g, '');

const stableHash = (value: string): string => crypto.createHash('sha1').update(value).digest('hex').slice(0, 8);

const createProjectSlug = (workspacePath: string): string => {
  const baseName = sanitizeVaultPathSegment(path.basename(trimTrailingSlash(workspacePath)) || 'project').toLowerCase();
  return `${baseName}-${stableHash(workspacePath)}`;
};

const createProjectFolderName = (workspacePath: string): string => {
  return sanitizeVaultPathSegment(path.basename(trimTrailingSlash(workspacePath)) || 'project');
};

export const createWorkspaceProjectSlug = (workspacePath: string): string => createProjectSlug(workspacePath);

const stripMarkdownExtension = (value: string): string => value.replace(/\.(md|canvas)$/i, '');

const HOME_RELATIVE_PATH = 'Home.md';

const getSpaceNoteTitle = (spaceName: string): string => `${spaceName} Space`;

const getProjectNoteTitle = (projectName: string): string => projectName;

const getProjectInsightsTitle = (projectName: string): string => `${projectName} Insights`;

const getProjectBaselineTitle = (projectName: string): string => `${projectName} Baseline`;

const getProjectCapabilitiesTitle = (projectName: string): string => `${projectName} Capabilities`;

const getCapabilitySectionTitle = (kind: ProjectCapabilityRecord['kind']): string => {
  if (kind === 'skill') {
    return 'Skills';
  }
  if (kind === 'hook') {
    return 'Hooks';
  }
  if (kind === 'command') {
    return 'Commands';
  }
  return 'Schedules';
};
const getSessionWorkingSetTitle = (conversationTitle: string): string => `${conversationTitle} Working Set`;
const getSessionWorkingContextTitle = (conversationTitle: string): string => `${conversationTitle} Working Context`;

const getSessionNoteTitle = (conversationTitle: string, conversationId: string): string => {
  return `${conversationTitle.replace(/\s+Session$/i, '')} Session (${conversationId.slice(0, 8)})`;
};

const getSourceDocNoteTitle = (sourceTitle: string, _relativePath: string): string => {
  return sourceTitle;
};

const toWikiLink = (relativePath: string, alias?: string): string => {
  const target = stripMarkdownExtension(toPosixRelativePath(relativePath));
  return alias ? `[[${target}|${alias}]]` : `[[${target}]]`;
};

const sanitizeSessionTitle = (value: string | undefined, fallback: string): string => {
  const normalized = value?.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return fallback;
  }

  const firstLine = normalized
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) {
    return fallback;
  }

  const cleaned = firstLine.replace(/^#\s+/, '').trim();

  if (!cleaned || cleaned.length > 120 || /^\[(?:Assistant Rules|Available Skills|User Request)\b/i.test(cleaned)) {
    return fallback;
  }

  return cleaned;
};

const toCanvasFileReference = (_canvasRelativePath: string, targetRelativePath: string): string => {
  return toPosixRelativePath(targetRelativePath);
};

const getSessionContextRootRelativePath = (conversationId: string, projectFolderName?: string): string => {
  const sanitizedConversationId = sanitizeVaultPathSegment(conversationId);
  return projectFolderName
    ? path.posix.join(getProjectSessionStateRelativeDir(projectFolderName), sanitizedConversationId)
    : path.posix.join(PROJECT_SESSION_STATE_DIR_NAME, sanitizedConversationId);
};

const getSessionTimelineRelativePath = (conversationId: string, projectFolderName?: string): string => {
  return path.posix.join(getSessionContextRootRelativePath(conversationId, projectFolderName), 'timeline.md');
};

const getSessionWorkingContextRelativePath = (conversationId: string, projectFolderName?: string): string => {
  return path.posix.join(getSessionContextRootRelativePath(conversationId, projectFolderName), 'working-context.md');
};

const getSessionCheckpointRelativePath = (
  conversationId: string,
  projectFolderName: string | undefined,
  timestamp: string,
  kind: string
): string => {
  const safeTimestamp = timestamp.replace(/[:]/g, '-').replace(/\.\d{3}Z$/, 'Z');
  return path.posix.join(
    getSessionContextRootRelativePath(conversationId, projectFolderName),
    'checkpoints',
    `${safeTimestamp}-${sanitizeVaultPathSegment(kind)}.md`
  );
};

const safeExcerpt = (value: string, limit = SESSION_EXCERPT_LIMIT): string => {
  const normalized = value.replace(/\r\n/g, '\n').trim();
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, limit).trimEnd()}\n...`;
};

const toMarkdownCodeBlock = (value: string): string => {
  const content = safeExcerpt(value);
  return ['```md', content || '(empty)', '```'].join('\n');
};

const frontmatter = (record: Record<string, string | number | undefined>): string => {
  const lines = Object.entries(record)
    .filter((entry): entry is [string, string | number] => entry[1] !== undefined)
    .map(([key, value]) => `${key}: ${String(value)}`);

  return ['---', ...lines, '---', ''].join('\n');
};

const parseFrontmatter = (content: string | undefined): FrontmatterRecord => {
  if (!content?.startsWith('---\n')) {
    return {};
  }

  const endIndex = content.indexOf('\n---\n', 4);
  if (endIndex === -1) {
    return {};
  }

  const block = content.slice(4, endIndex);
  const record: FrontmatterRecord = {};
  for (const line of block.split('\n')) {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (key && value) {
      record[key] = value;
    }
  }

  return record;
};

const unwrapFrontmatterValue = (value: string | undefined): string | undefined => {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }

  return normalized.replace(/^(["'])(.*)\1$/, '$2').trim() || undefined;
};

const getMarkdownDisplayTitle = (content: string | undefined, fallback: string): string => {
  const frontmatterTitle = unwrapFrontmatterValue(parseFrontmatter(content).title);
  if (frontmatterTitle) {
    return frontmatterTitle;
  }

  const heading = content?.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return heading || fallback;
};

const stripMatchingLeadingHeading = (content: string, title: string): string => {
  const normalized = content.replace(/\r\n/g, '\n');
  const match = normalized.match(/^#\s+(.+)\n+/);
  if (!match) {
    return normalized;
  }

  const heading = match[1]?.trim().replace(/\s+/g, ' ');
  const normalizedTitle = title.trim().replace(/\s+/g, ' ');
  if (!heading || heading !== normalizedTitle) {
    return normalized;
  }

  return normalized.slice(match[0].length).replace(/^\n+/, '');
};

const ensureDirectory = async (absolutePath: string): Promise<void> => {
  await fs.mkdir(absolutePath, { recursive: true });
};

const ensureFile = async (absolutePath: string, content: string): Promise<void> => {
  await ensureDirectory(path.dirname(absolutePath));
  await fs.writeFile(absolutePath, content, 'utf8');
};

const fileExists = async (absolutePath: string): Promise<boolean> => {
  try {
    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
};

const readUtf8 = async (absolutePath: string): Promise<string | undefined> => {
  try {
    return await fs.readFile(absolutePath, 'utf8');
  } catch {
    return undefined;
  }
};

const readDirectorySafe = async (absolutePath: string) => {
  try {
    return await fs.readdir(absolutePath, { withFileTypes: true, encoding: 'utf8' });
  } catch {
    return [];
  }
};

const isMarkdownFile = (entryName: string): boolean => /\.md$/i.test(entryName);

const resolveSourceDocReference = (
  target: string,
  currentRelativePath: string,
  sourcePaths: Set<string>,
  basenameIndex: Map<string, string[]>
): string | undefined => {
  const trimmed = target.trim().replace(/^<|>$/g, '');
  if (!trimmed || /^(#|mailto:|obsidian:|data:)/i.test(trimmed) || /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    return undefined;
  }

  const withoutHash = trimmed.split('#')[0]?.split('?')[0]?.trim();
  if (!withoutHash || withoutHash.endsWith('/')) {
    return undefined;
  }

  const normalized = toPosixRelativePath(withoutHash.replace(/^\/+/, ''));
  const candidateWithExtension = /\.[a-z0-9]+$/i.test(normalized) ? normalized : `${normalized}.md`;
  const candidates = new Set<string>([
    path.posix.normalize(candidateWithExtension),
    path.posix.normalize(path.posix.join(path.posix.dirname(currentRelativePath), candidateWithExtension)),
  ]);

  for (const candidate of candidates) {
    if (sourcePaths.has(candidate)) {
      return candidate;
    }
  }

  if (!candidateWithExtension.includes('/')) {
    const basenameMatches = basenameIndex.get(path.posix.basename(candidateWithExtension)) || [];
    if (basenameMatches.length === 1) {
      return basenameMatches[0];
    }
  }

  return undefined;
};

const extractMarkdownLinks = (
  content: string,
  currentRelativePath: string,
  sourcePaths: Set<string>,
  basenameIndex: Map<string, string[]>
): string[] => {
  const results = new Set<string>();
  const wikiLinkPattern = /\[\[([^\]]+)\]\]/g;
  const markdownLinkPattern = /\[[^\]]+\]\(([^)]+)\)/g;

  for (const match of content.matchAll(wikiLinkPattern)) {
    const target = match[1]?.split('|')[0]?.trim();
    if (!target) {
      continue;
    }
    const resolved = resolveSourceDocReference(target, currentRelativePath, sourcePaths, basenameIndex);
    if (resolved && resolved !== currentRelativePath) {
      results.add(resolved);
    }
  }

  for (const match of content.matchAll(markdownLinkPattern)) {
    const target = match[1]?.split(/\s+"/)[0]?.trim();
    if (!target) {
      continue;
    }
    const resolved = resolveSourceDocReference(target, currentRelativePath, sourcePaths, basenameIndex);
    if (resolved && resolved !== currentRelativePath) {
      results.add(resolved);
    }
  }

  return Array.from(results).toSorted((left, right) => left.localeCompare(right));
};

const scanProjectMarkdownFiles = async (workspacePath: string): Promise<SourceDoc[]> => {
  const queue: Array<{ absolutePath: string; relativePath: string; depth: number }> = [
    { absolutePath: workspacePath, relativePath: '', depth: 0 },
  ];
  const results: SourceDoc[] = [];

  while (queue.length > 0 && results.length < MAX_SCANNED_SOURCE_DOCS) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    const entries = await readDirectorySafe(current.absolutePath);
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      if (results.length >= MAX_SCANNED_SOURCE_DOCS) {
        break;
      }

      const nextRelativePath = current.relativePath ? path.join(current.relativePath, entry.name) : entry.name;
      const nextAbsolutePath = path.join(current.absolutePath, entry.name);

      if (entry.isDirectory()) {
        if (current.depth + 1 > MAX_SCAN_DEPTH || EXCLUDED_DIRECTORIES.has(entry.name)) {
          continue;
        }
        queue.push({
          absolutePath: nextAbsolutePath,
          relativePath: nextRelativePath,
          depth: current.depth + 1,
        });
        continue;
      }

      if (!entry.isFile() || !isMarkdownFile(entry.name)) {
        continue;
      }

      try {
        const stat = await fs.stat(nextAbsolutePath);
        if (stat.size > MAX_SOURCE_DOC_BYTES) {
          continue;
        }
      } catch {
        continue;
      }

      const sourceContent = await readUtf8(nextAbsolutePath);
      const sourceTitle = getMarkdownDisplayTitle(sourceContent, stripMarkdownExtension(entry.name));

      results.push({
        sourcePath: nextAbsolutePath,
        relativePath: toPosixRelativePath(nextRelativePath),
        title: sourceTitle,
        noteTitle: getSourceDocNoteTitle(sourceTitle, toPosixRelativePath(nextRelativePath)),
        references: [],
        backlinks: [],
      });
    }
  }

  results.sort((left, right) => {
    const leftPriority =
      left.relativePath === 'AGENTS.md' ? 0 : left.relativePath.toLowerCase() === 'readme.md' ? 1 : 2;
    const rightPriority =
      right.relativePath === 'AGENTS.md' ? 0 : right.relativePath.toLowerCase() === 'readme.md' ? 1 : 2;
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }
    return left.relativePath.localeCompare(right.relativePath);
  });

  const sourcePaths = new Set(results.map((sourceDoc) => sourceDoc.relativePath));
  const basenameIndex = new Map<string, string[]>();
  for (const sourceDoc of results) {
    const key = path.posix.basename(sourceDoc.relativePath);
    const bucket = basenameIndex.get(key);
    if (bucket) {
      bucket.push(sourceDoc.relativePath);
    } else {
      basenameIndex.set(key, [sourceDoc.relativePath]);
    }
  }

  const docsWithReferences = await Promise.all(
    results.map(async (sourceDoc) => {
      const sourceContent = (await readUtf8(sourceDoc.sourcePath)) ?? '';
      return {
        ...sourceDoc,
        references: extractMarkdownLinks(sourceContent, sourceDoc.relativePath, sourcePaths, basenameIndex),
      };
    })
  );

  const backlinkMap = new Map<string, Set<string>>();
  for (const sourceDoc of docsWithReferences) {
    for (const reference of sourceDoc.references) {
      const bucket = backlinkMap.get(reference);
      if (bucket) {
        bucket.add(sourceDoc.relativePath);
      } else {
        backlinkMap.set(reference, new Set([sourceDoc.relativePath]));
      }
    }
  }

  return docsWithReferences.map((sourceDoc) => ({
    ...sourceDoc,
    backlinks: Array.from(backlinkMap.get(sourceDoc.relativePath) || []).toSorted((left, right) =>
      left.localeCompare(right)
    ),
  }));
};

const buildSourceDocLink = (project: ProjectContext, sourceRelativePath: string, alias?: string): string => {
  const sourceDoc = project.sourceDocs.find((item) => item.relativePath === sourceRelativePath);
  if (!sourceDoc) {
    const fallbackPath = getProjectSourceRelativePath(project.folderName, sourceRelativePath);
    return toWikiLink(fallbackPath, alias || sourceRelativePath);
  }

  return toWikiLink(
    getProjectSourceRelativePath(project.folderName, sourceDoc.relativePath),
    alias || sourceDoc.noteTitle
  );
};

const buildSourceGraphList = (project: ProjectContext, sourceRelativePaths: string[], emptyLabel: string): string[] => {
  if (sourceRelativePaths.length === 0) {
    return [`- ${emptyLabel}`];
  }

  return sourceRelativePaths.map((relativePath) => `- ${buildSourceDocLink(project, relativePath)}`);
};

const buildSourceDocFrontmatter = (project: ProjectContext, sourceDoc: SourceDoc, updatedAt: string): string => {
  return frontmatter({
    contextgoType: 'source',
    title: sourceDoc.noteTitle,
    projectSlug: project.slug,
    workspace: project.workspacePath,
    sourcePath: sourceDoc.sourcePath,
    relativePath: sourceDoc.relativePath,
    updatedAt,
  });
};

const buildProjectFrontmatter = (project: ProjectContext, updatedAt: string): string => {
  return frontmatter({
    contextgoType: 'project',
    title: getProjectNoteTitle(project.name),
    projectSlug: project.slug,
    workspace: project.workspacePath,
    updatedAt,
  });
};

const buildProjectInsightsFrontmatter = (project: ProjectContext, updatedAt: string): string => {
  return frontmatter({
    contextgoType: 'project-insights',
    title: getProjectInsightsTitle(project.name),
    projectSlug: project.slug,
    workspace: project.workspacePath,
    updatedAt,
  });
};

const buildProjectInsightsFrontmatterFromBinding = (project: ProjectBinding, updatedAt: string): string => {
  return frontmatter({
    contextgoType: 'project-insights',
    title: getProjectInsightsTitle(project.name),
    projectSlug: project.slug,
    workspace: project.workspacePath,
    updatedAt,
  });
};

const buildProjectBaselineFrontmatter = (project: ProjectContext, updatedAt: string): string => {
  return frontmatter({
    contextgoType: 'project-baseline',
    title: getProjectBaselineTitle(project.name),
    projectSlug: project.slug,
    workspace: project.workspacePath,
    updatedAt,
  });
};

const buildProjectCapabilitiesFrontmatter = (project: ProjectContext, updatedAt: string): string => {
  return frontmatter({
    contextgoType: 'project-capabilities',
    title: getProjectCapabilitiesTitle(project.name),
    projectSlug: project.slug,
    workspace: project.workspacePath,
    updatedAt,
  });
};
const buildSessionFrontmatter = (
  conversation: TChatConversation,
  project: ProjectContext | undefined,
  updatedAt: string
): string => {
  return frontmatter({
    contextgoType: 'session',
    conversationId: conversation.id,
    spaceId: conversation.extra?.spaceId,
    projectSlug: project?.slug,
    workspace: conversation.extra?.workingDirectory || conversation.extra?.workspace,
    updatedAt,
  });
};

const buildSessionWorkingSetFrontmatter = (
  conversation: TChatConversation,
  project: ProjectContext | undefined,
  updatedAt: string
): string => {
  return frontmatter({
    contextgoType: 'session-working-set',
    conversationId: conversation.id,
    spaceId: conversation.extra?.spaceId,
    projectSlug: project?.slug,
    workspace: conversation.extra?.workingDirectory || conversation.extra?.workspace,
    updatedAt,
  });
};

const buildSessionWorkingContextFrontmatter = (
  conversation: TChatConversation,
  project: ProjectContext | undefined,
  updatedAt: string
): string => {
  return frontmatter({
    contextgoType: 'session-working-context',
    conversationId: conversation.id,
    spaceId: conversation.extra?.spaceId,
    projectSlug: project?.slug,
    workspace: conversation.extra?.workingDirectory || conversation.extra?.workspace,
    updatedAt,
  });
};

const buildHomeFrontmatter = (space: TSpace, updatedAt: string): string => {
  return frontmatter({
    contextgoType: 'space',
    title: getSpaceNoteTitle(space.name),
    spaceId: space.id,
    spaceName: space.name,
    engine: space.engine,
    updatedAt,
  });
};

const buildSourceDocument = async (
  spaceName: string,
  project: ProjectContext,
  sourceDoc: SourceDoc,
  updatedAt: string
): Promise<string> => {
  const sourceContent = (await readUtf8(sourceDoc.sourcePath)) ?? '';
  const sourceBody = stripMatchingLeadingHeading(sourceContent, sourceDoc.noteTitle);

  return [
    buildSourceDocFrontmatter(project, sourceDoc, updatedAt),
    GENERATED_MARKER,
    `# ${sourceDoc.noteTitle}`,
    '',
    `> Mirrored from \`${sourceDoc.sourcePath}\``,
    '',
    `- Space doc: ${toWikiLink(HOME_RELATIVE_PATH, getSpaceNoteTitle(spaceName))}`,
    `- Project doc: ${toWikiLink(project.relativePath, getProjectNoteTitle(project.name))}`,
    `- Source path: \`${sourceDoc.relativePath}\``,
    '',
    '## Graph Context',
    '',
    `- Outbound references: ${sourceDoc.references.length}`,
    `- Backlinks: ${sourceDoc.backlinks.length}`,
    ...buildSourceGraphList(project, sourceDoc.references, 'No outbound source-doc references yet.'),
    '',
    '### Referenced By',
    '',
    ...buildSourceGraphList(project, sourceDoc.backlinks, 'No backlinks from scanned source docs yet.'),
    '',
    sourceBody,
    sourceContent.endsWith('\n') ? '' : '\n',
  ].join('\n');
};

const getCapabilityDirName = (kind: ProjectCapabilityRecord['kind']): string => {
  if (kind === 'skill') {
    return PROJECT_CAPABILITY_SKILLS_DIR_NAME;
  }
  if (kind === 'hook') {
    return PROJECT_CAPABILITY_HOOKS_DIR_NAME;
  }
  if (kind === 'command') {
    return PROJECT_CAPABILITY_COMMANDS_DIR_NAME;
  }
  return PROJECT_CAPABILITY_SCHEDULES_DIR_NAME;
};

const getProjectCapabilityRecords = (snapshot: ProjectCapabilitySnapshot): ProjectCapabilityRecord[] => {
  return [...snapshot.skills, ...snapshot.hooks, ...snapshot.commands, ...snapshot.schedules];
};

const getCapabilityDisplayName = (capability: ProjectCapabilityRecord): string => {
  return capability.kind === 'command' ? `/${capability.name}` : capability.name;
};

const getProjectCapabilityRelativePath = (project: ProjectContext, capability: ProjectCapabilityRecord): string => {
  return getProjectCapabilityItemRelativePath(
    project.folderName,
    getCapabilityDirName(capability.kind),
    getCapabilityDisplayName(capability)
  );
};

const getProjectCapabilityLink = (project: ProjectContext, capability: ProjectCapabilityRecord): string => {
  return toWikiLink(getProjectCapabilityRelativePath(project, capability), getCapabilityDisplayName(capability));
};

const summarizeProjectCapability = (capability: ProjectCapabilityRecord): string => {
  if (capability.kind === 'skill') {
    return capability.implicitInvocation ? 'implicit invocation enabled' : 'manual invocation';
  }
  if (capability.kind === 'hook') {
    return [
      capability.selected ? 'selected' : 'available',
      capability.runnableEvents.length > 0
        ? capability.runnableEvents.join(', ')
        : capability.events.length > 0
          ? capability.events.join(', ')
          : 'no events',
    ].join(' · ');
  }
  if (capability.kind === 'command') {
    return [capability.enabled ? 'enabled' : 'disabled', capability.commandType].join(' · ');
  }
  return [capability.enabled ? 'enabled' : 'disabled', capability.scheduleLabel].join(' · ');
};

const buildProjectCapabilitySectionLines = (
  project: ProjectContext,
  capabilities: readonly ProjectCapabilityRecord[],
  emptyLabel: string
): string[] => {
  if (capabilities.length === 0) {
    return [`- ${emptyLabel}`];
  }

  return capabilities.map(
    (capability) => `- ${getProjectCapabilityLink(project, capability)} · ${summarizeProjectCapability(capability)}`
  );
};

const buildProjectCapabilitiesDocument = (
  project: ProjectContext,
  snapshot: ProjectCapabilitySnapshot,
  updatedAt: string
): string => {
  return [
    buildProjectCapabilitiesFrontmatter(project, updatedAt),
    GENERATED_MARKER,
    `# ${getProjectCapabilitiesTitle(project.name)}`,
    '',
    `- Project doc: ${toWikiLink(project.relativePath, getProjectNoteTitle(project.name))}`,
    `- Workspace: \`${project.workspacePath}\``,
    `- Local-first automation root: \`${snapshot.automationRootRelativePath}\``,
    `- Updated at: ${updatedAt}`,
    '',
    '## Counts',
    '',
    `- Skills: ${snapshot.counts.skill}`,
    `- Hooks: ${snapshot.counts.hook}`,
    `- Commands: ${snapshot.counts.command}`,
    `- Schedules: ${snapshot.counts.schedule}`,
    '',
    '## Skills',
    '',
    ...buildProjectCapabilitySectionLines(project, snapshot.skills, 'No project skills mirrored yet.'),
    '',
    '## Hooks',
    '',
    ...buildProjectCapabilitySectionLines(project, snapshot.hooks, 'No project hooks mirrored yet.'),
    '',
    '## Commands',
    '',
    ...buildProjectCapabilitySectionLines(project, snapshot.commands, 'No project commands mirrored yet.'),
    '',
    '## Schedules',
    '',
    ...buildProjectCapabilitySectionLines(project, snapshot.schedules, 'No project schedules mirrored yet.'),
    '',
    '## Notes',
    '',
    '- These documents mirror the project-local .contextgo capability surface into the space vault.',
    '- The project directory remains the source of truth; vault notes exist for browsing, linking, and graphing.',
    '',
  ].join('\n');
};

const buildProjectCapabilityDocument = (
  project: ProjectContext,
  capability: ProjectCapabilityRecord,
  updatedAt: string
): ProjectCapabilityDoc => {
  const title = getCapabilityDisplayName(capability);
  const relativePath = getProjectCapabilityRelativePath(project, capability);
  const frontmatterBlock = frontmatter({
    contextgoType: 'project-capability',
    title,
    projectSlug: project.slug,
    workspace: project.workspacePath,
    capabilityKind: capability.kind,
    capabilityId: capability.id,
    updatedAt,
  });

  const detailLines: string[] = [];

  if (capability.kind === 'skill') {
    detailLines.push(
      `- Source path: \`${capability.workspaceRelativePath}\``,
      `- Implicit invocation: ${capability.implicitInvocation ? 'enabled' : 'disabled'}`,
      capability.openAIDisplayName ? `- OpenAI display name: ${capability.openAIDisplayName}` : '',
      capability.openAIShortDescription ? `- OpenAI short description: ${capability.openAIShortDescription}` : '',
      '',
      '## Compatibility',
      '',
      ...(capability.compatibility.length > 0
        ? capability.compatibility.map((item) => `- ${item}`)
        : ['- No compatibility hints declared.'])
    );
  } else if (capability.kind === 'hook') {
    detailLines.push(
      `- Hook path: \`${capability.workspaceRelativePath}\``,
      `- Manifest: \`${capability.manifestRelativePath}\``,
      `- Selected: ${capability.selected ? 'yes' : 'no'}`,
      capability.category ? `- Category: ${capability.category}` : '',
      capability.executionType ? `- Execution type: ${capability.executionType}` : '',
      `- Declared events: ${capability.events.join(', ') || 'none'}`,
      `- Runnable events: ${capability.runnableEvents.join(', ') || 'none'}`,
      `- Output targets: ${capability.outputTargets.join(', ') || 'none'}`
    );
  } else if (capability.kind === 'command') {
    detailLines.push(
      `- Command type: ${capability.commandType}`,
      `- Enabled: ${capability.enabled ? 'yes' : 'no'}`,
      `- Slash command: /${capability.name}`,
      '',
      '## Template',
      '',
      toMarkdownCodeBlock(capability.template || 'No template configured.')
    );
  } else {
    detailLines.push(
      `- Enabled: ${capability.enabled ? 'yes' : 'no'}`,
      `- Schedule kind: ${capability.scheduleKind}`,
      `- Schedule: ${capability.scheduleLabel}`,
      `- Description: ${capability.description}`,
      `- Target conversation: \`${capability.conversationId}\`${capability.conversationTitle ? ` · ${capability.conversationTitle}` : ''}`,
      `- Agent type: ${capability.agentType}`,
      `- Created by: ${capability.createdBy}`,
      capability.spaceId ? `- Space ID: \`${capability.spaceId}\`` : '',
      '',
      '## Message',
      '',
      toMarkdownCodeBlock(capability.message)
    );
  }

  return {
    title,
    relativePath,
    body: [
      frontmatterBlock,
      GENERATED_MARKER,
      `# ${title}`,
      '',
      `- Project capabilities: ${toWikiLink(
        getProjectCapabilitiesRelativePath(project.folderName),
        getProjectCapabilitiesTitle(project.name)
      )}`,
      `- Project doc: ${toWikiLink(project.relativePath, getProjectNoteTitle(project.name))}`,
      `- Capability kind: ${getCapabilitySectionTitle(capability.kind)}`,
      `- Updated at: ${updatedAt}`,
      capability.description ? `- Description: ${capability.description}` : '',
      '',
      ...detailLines.filter(Boolean),
      '',
    ]
      .filter(Boolean)
      .join('\n'),
  };
};

const buildProjectCapabilityDocuments = (
  project: ProjectContext,
  snapshot: ProjectCapabilitySnapshot,
  updatedAt: string
): { summary: string; items: ProjectCapabilityDoc[] } => {
  return {
    summary: buildProjectCapabilitiesDocument(project, snapshot, updatedAt),
    items: getProjectCapabilityRecords(snapshot).map((capability) =>
      buildProjectCapabilityDocument(project, capability, updatedAt)
    ),
  };
};

const buildProjectDocument = (
  space: TSpace,
  project: ProjectContext,
  sessionRelativePaths: string[],
  capabilitySnapshot: ProjectCapabilitySnapshot,
  updatedAt: string
): string => {
  const sourceLines = project.sourceDocs.length
    ? project.sourceDocs.map(
        (sourceDoc) =>
          `- ${toWikiLink(getProjectSourceRelativePath(project.folderName, sourceDoc.relativePath), sourceDoc.noteTitle)}`
      )
    : ['- No markdown source docs scanned yet.'];
  const graphEdgeCount = project.sourceDocs.reduce((count, sourceDoc) => count + sourceDoc.references.length, 0);
  const sessionLines = sessionRelativePaths.length
    ? sessionRelativePaths.map((relativePath) => `- ${toWikiLink(relativePath)}`)
    : ['- No sessions bound to this project yet.'];
  const agentsDoc = project.sourceDocs.find((sourceDoc) => sourceDoc.relativePath === 'AGENTS.md');
  const sourceDocsWithEdges = project.sourceDocs.filter(
    (sourceDoc) => sourceDoc.references.length > 0 || sourceDoc.backlinks.length > 0
  );
  const orphanSourceDocs = project.sourceDocs.filter(
    (sourceDoc) => sourceDoc.references.length === 0 && sourceDoc.backlinks.length === 0
  );
  const capabilityRecords = getProjectCapabilityRecords(capabilitySnapshot);
  const graphLines = project.sourceDocs.length
    ? project.sourceDocs.flatMap((sourceDoc) => {
        const outbound = sourceDoc.references.length
          ? sourceDoc.references.map((reference) => buildSourceDocLink(project, reference)).join(', ')
          : 'no outbound references';
        const backlinks = sourceDoc.backlinks.length
          ? sourceDoc.backlinks.map((reference) => buildSourceDocLink(project, reference)).join(', ')
          : 'no backlinks';
        return [
          `### ${sourceDoc.noteTitle}`,
          '',
          `- Doc: ${buildSourceDocLink(project, sourceDoc.relativePath)}`,
          `- Source path: \`${sourceDoc.relativePath}\``,
          `- Outbound: ${outbound}`,
          `- Backlinks: ${backlinks}`,
          '',
        ];
      })
    : ['- No source graph available yet.', ''];

  return [
    buildProjectFrontmatter(project, updatedAt),
    GENERATED_MARKER,
    `# ${getProjectNoteTitle(project.name)}`,
    '',
    `- Space: ${toWikiLink(HOME_RELATIVE_PATH, getSpaceNoteTitle(space.name))}`,
    `- Workspace: \`${project.workspacePath}\``,
    `- Project slug: \`${project.slug}\``,
    `- Updated at: ${updatedAt}`,
    agentsDoc
      ? `- Primary instructions: ${toWikiLink(getProjectSourceRelativePath(project.folderName, agentsDoc.relativePath), agentsDoc.noteTitle)}`
      : '',
    '',
    '## Entry Points',
    '',
    `- Space overview: ${toWikiLink(HOME_RELATIVE_PATH, getSpaceNoteTitle(space.name))}`,
    `- Project graph canvas: ${toWikiLink(getProjectGraphRelativePath(project.folderName), `${project.name} Source Graph`)}`,
    `- Project insights: ${toWikiLink(getProjectInsightsRelativePath(project.folderName), getProjectInsightsTitle(project.name))}`,
    `- Project baseline: ${toWikiLink(getProjectBaselineRelativePath(project.folderName), getProjectBaselineTitle(project.name))}`,
    `- Project capabilities: ${toWikiLink(getProjectCapabilitiesRelativePath(project.folderName), getProjectCapabilitiesTitle(project.name))}`,
    `- Space canvas: ${toWikiLink(DEFAULT_SPACE_CANVAS_PATH, 'Space Overview Canvas')}`,
    '',
    '## Source Docs',
    '',
    ...sourceLines,
    '',
    '## Project Capabilities',
    '',
    `- Capability index: ${toWikiLink(getProjectCapabilitiesRelativePath(project.folderName), getProjectCapabilitiesTitle(project.name))}`,
    `- Skills: ${capabilitySnapshot.counts.skill}`,
    `- Hooks: ${capabilitySnapshot.counts.hook}`,
    `- Commands: ${capabilitySnapshot.counts.command}`,
    `- Schedules: ${capabilitySnapshot.counts.schedule}`,
    '',
    ...(capabilityRecords.length > 0
      ? capabilityRecords.map((capability) => `- ${getProjectCapabilityLink(project, capability)}`)
      : ['- No project capabilities mirrored yet.']),
    '',
    '## Source Graph',
    '',
    `- Source docs: ${project.sourceDocs.length}`,
    `- Reference edges: ${graphEdgeCount}`,
    `- Connected docs: ${sourceDocsWithEdges.length}`,
    `- Orphan docs: ${orphanSourceDocs.length}`,
    agentsDoc ? `- Canonical entry: ${buildSourceDocLink(project, agentsDoc.relativePath)}` : '',
    '',
    '### Graph Backbone',
    '',
    ...(sourceDocsWithEdges.length
      ? sourceDocsWithEdges.map((sourceDoc) => `- ${buildSourceDocLink(project, sourceDoc.relativePath)}`)
      : ['- No connected source-doc graph yet.']),
    '',
    '### Orphan Docs',
    '',
    ...(orphanSourceDocs.length
      ? orphanSourceDocs.map((sourceDoc) => `- ${buildSourceDocLink(project, sourceDoc.relativePath)}`)
      : ['- No orphan docs.']),
    '',
    ...graphLines,
    '',
    '## Related Sessions',
    '',
    ...sessionLines,
    '',
    '## Promoted Context',
    '',
    `- Insights doc: ${toWikiLink(getProjectInsightsRelativePath(project.folderName), getProjectInsightsTitle(project.name))}`,
    '',
    '## Notes',
    '',
    '- This file is generated from the bound workspace and mirrored markdown source docs.',
    '- Project-local .contextgo capabilities are mirrored into the vault so they can be linked and graphed.',
    '- AGENTS.md is treated as the project entry document when present.',
    '',
  ]
    .filter(Boolean)
    .join('\n');
};

const buildSessionDocument = (
  conversation: TChatConversation,
  project: ProjectContext | undefined,
  space: TSpace,
  updatedAt: string,
  timelineBody: string
): string => {
  const workspacePath = conversation.extra?.workingDirectory || conversation.extra?.workspace;
  const summaryLines = buildSessionSummaryLines(timelineBody);
  const normalizedTimelineBody = timelineBody.trim();
  const sessionTitle = getSessionNoteTitle(sanitizeSessionTitle(conversation.name, conversation.id), conversation.id);
  const paths = getConversationDocumentPaths(conversation.id, project?.folderName);

  return [
    buildSessionFrontmatter(conversation, project, updatedAt),
    GENERATED_MARKER,
    `# ${sessionTitle}`,
    '',
    `- Conversation ID: \`${conversation.id}\``,
    `- Space doc: ${toWikiLink(HOME_RELATIVE_PATH, getSpaceNoteTitle(space.name))}`,
    `- Type: \`${conversation.type}\``,
    `- Project doc: ${project ? toWikiLink(project.relativePath, getProjectNoteTitle(project.name)) : 'Unbound'}`,
    workspacePath ? `- Workspace: \`${workspacePath}\`` : '- Workspace: Not bound',
    `- Updated at: ${updatedAt}`,
    `- Working set: ${toWikiLink(paths.workingSetRelativePath, getSessionWorkingSetTitle(sanitizeSessionTitle(conversation.name, conversation.id)))}`,
    '',
    '## Rolling Summary',
    '',
    ...summaryLines,
    '',
    '## Timeline',
    '',
    normalizedTimelineBody,
    normalizedTimelineBody ? '' : '- No session activity yet.',
  ].join('\n');
};

const PROJECT_INSIGHTS_MARKER = '\n## Promoted Context\n';

const stripGeneratedDocumentScaffolding = (content: string): string => {
  return content
    .replace(/^---\n[\s\S]*?\n---\n?/, '')
    .replace(/^<!-- contextgo-generated -->\n?/, '')
    .trim();
};

const renderExcerptSection = (title: string, content: string | undefined, fallback: string): string[] => {
  const excerpt = content ? safeExcerpt(content, 900) : '';
  return [`## ${title}`, '', excerpt || fallback, ''];
};

const buildProjectBaselineDocument = async (
  space: TSpace,
  project: ProjectContext,
  updatedAt: string
): Promise<string> => {
  const agentsDoc = project.sourceDocs.find((sourceDoc) => sourceDoc.relativePath === 'AGENTS.md');
  const readmeDoc = project.sourceDocs.find((sourceDoc) => sourceDoc.relativePath.toLowerCase() === 'readme.md');
  const connectedDocs = project.sourceDocs
    .filter((sourceDoc) => sourceDoc !== agentsDoc && sourceDoc !== readmeDoc)
    .toSorted(
      (left, right) =>
        right.references.length + right.backlinks.length - (left.references.length + left.backlinks.length)
    )
    .slice(0, 4);

  const [agentsContent, readmeContent, connectedContent] = await Promise.all([
    agentsDoc ? readUtf8(agentsDoc.sourcePath) : Promise.resolve(undefined),
    readmeDoc ? readUtf8(readmeDoc.sourcePath) : Promise.resolve(undefined),
    Promise.all(
      connectedDocs.map(async (sourceDoc) => ({
        sourceDoc,
        content: await readUtf8(sourceDoc.sourcePath),
      }))
    ),
  ]);

  const keySourceLines = [
    ...(agentsDoc ? [`- Canonical instructions: ${buildSourceDocLink(project, agentsDoc.relativePath)}`] : []),
    ...(readmeDoc ? [`- Project overview: ${buildSourceDocLink(project, readmeDoc.relativePath)}`] : []),
    ...(connectedDocs.length > 0
      ? connectedDocs.map((sourceDoc) => `- Connected doc: ${buildSourceDocLink(project, sourceDoc.relativePath)}`)
      : ['- No additional connected source docs yet.']),
  ];

  const graphFocusLines =
    connectedContent.length > 0
      ? connectedContent.flatMap(({ sourceDoc, content }) => [
          `### ${sourceDoc.noteTitle}`,
          '',
          `- Source path: \`${sourceDoc.relativePath}\``,
          `- Outbound references: ${sourceDoc.references.length}`,
          `- Backlinks: ${sourceDoc.backlinks.length}`,
          '',
          safeExcerpt(content ?? '', 500) || 'No excerpt available.',
          '',
        ])
      : ['- No connected source-doc excerpts yet.', ''];

  return [
    buildProjectBaselineFrontmatter(project, updatedAt),
    GENERATED_MARKER,
    `# ${getProjectBaselineTitle(project.name)}`,
    '',
    `- Space doc: ${toWikiLink(HOME_RELATIVE_PATH, getSpaceNoteTitle(space.name))}`,
    `- Project doc: ${toWikiLink(project.relativePath, getProjectNoteTitle(project.name))}`,
    `- Workspace: \`${project.workspacePath}\``,
    `- Updated at: ${updatedAt}`,
    '',
    '## Role',
    '',
    'This document is the project-level baseline that ContextGo mounts before a new turn. It is derived from AGENTS.md, README.md, and the currently connected markdown graph.',
    '',
    ...renderExcerptSection('Canonical Instructions', agentsContent, 'No AGENTS.md excerpt is available yet.'),
    ...renderExcerptSection('Project Overview', readmeContent, 'No README overview is available yet.'),
    '## Key Sources',
    '',
    ...keySourceLines,
    '',
    '## Graph Focus',
    '',
    ...graphFocusLines,
    '## Notes',
    '',
    '- Prefer this file for project-level baseline context before mounting raw source excerpts.',
    '- Source docs remain mirrored separately so Obsidian graph and backlinks stay intact.',
    '',
  ]
    .filter(Boolean)
    .join('\n');
};

const buildSessionWorkingSetDocument = (input: {
  conversation: TChatConversation;
  project: ProjectContext | undefined;
  space: TSpace;
  updatedAt: string;
  currentTask?: string;
  stableStrategies: readonly string[];
  failureModes: readonly string[];
  pendingConstraints: readonly string[];
  signalKinds: readonly string[];
  pressure: number;
  sourceProfileKey?: string;
}): string => {
  const sessionTitle = sanitizeSessionTitle(input.conversation.name, input.conversation.id);
  const paths = getConversationDocumentPaths(input.conversation.id, input.project?.folderName);

  return [
    buildSessionWorkingSetFrontmatter(input.conversation, input.project, input.updatedAt),
    GENERATED_MARKER,
    `# ${getSessionWorkingSetTitle(sessionTitle)}`,
    '',
    `- Session doc: ${toWikiLink(paths.sessionRelativePath, getSessionNoteTitle(sessionTitle, input.conversation.id))}`,
    `- Space doc: ${toWikiLink(HOME_RELATIVE_PATH, getSpaceNoteTitle(input.space.name))}`,
    `- Project doc: ${input.project ? toWikiLink(input.project.relativePath, getProjectNoteTitle(input.project.name)) : 'Unbound'}`,
    `- Updated at: ${input.updatedAt}`,
    input.sourceProfileKey ? `- Source profile: \`${input.sourceProfileKey}\`` : '',
    '',
    '## Current Task',
    '',
    input.currentTask || 'No active task distilled yet.',
    '',
    '## Stable Strategies',
    '',
    ...(input.stableStrategies.length > 0
      ? input.stableStrategies.map((item) => `- ${item}`)
      : ['- No durable strategy extracted yet.']),
    '',
    '## Failure Modes',
    '',
    ...(input.failureModes.length > 0
      ? input.failureModes.map((item) => `- ${item}`)
      : ['- No recurring failure pattern detected yet.']),
    '',
    '## Pending Constraints',
    '',
    ...(input.pendingConstraints.length > 0
      ? input.pendingConstraints.map((item) => `- ${item}`)
      : ['- No unresolved constraints tracked yet.']),
    '',
    '## Signals',
    '',
    ...(input.signalKinds.length > 0
      ? input.signalKinds.map((kind) => `- ${kind}`)
      : ['- No durable session signals yet.']),
    '',
    '## Compaction State',
    '',
    `- Pressure: ${input.pressure}`,
    `- Stable strategies: ${input.stableStrategies.length}`,
    `- Failure modes: ${input.failureModes.length}`,
    `- Pending constraints: ${input.pendingConstraints.length}`,
    '',
  ]
    .filter(Boolean)
    .join('\n');
};

const buildSessionWorkingContextDocument = (input: {
  conversation: TChatConversation;
  project: ProjectContext | undefined;
  space: TSpace;
  updatedAt: string;
  currentTask?: string;
  stableStrategies: readonly string[];
  failureModes: readonly string[];
  pendingConstraints: readonly string[];
  signalKinds: readonly string[];
  pressure: number;
  sourceProfileKey?: string;
}): string => {
  const sessionTitle = sanitizeSessionTitle(input.conversation.name, input.conversation.id);
  const paths = getConversationDocumentPaths(input.conversation.id, input.project?.folderName);

  return [
    buildSessionWorkingContextFrontmatter(input.conversation, input.project, input.updatedAt),
    GENERATED_MARKER,
    `# ${getSessionWorkingContextTitle(sessionTitle)}`,
    '',
    `- Session doc: ${toWikiLink(paths.sessionRelativePath, getSessionNoteTitle(sessionTitle, input.conversation.id))}`,
    `- Space doc: ${toWikiLink(HOME_RELATIVE_PATH, getSpaceNoteTitle(input.space.name))}`,
    `- Project doc: ${input.project ? toWikiLink(input.project.relativePath, getProjectNoteTitle(input.project.name)) : 'Unbound'}`,
    `- Updated at: ${input.updatedAt}`,
    input.sourceProfileKey ? `- Source profile: \`${input.sourceProfileKey}\`` : '',
    '',
    '## Current Task',
    '',
    input.currentTask || 'No active task distilled yet.',
    '',
    '## Stable Strategies',
    '',
    ...(input.stableStrategies.length > 0
      ? input.stableStrategies.map((item) => `- ${item}`)
      : ['- No durable strategy extracted yet.']),
    '',
    '## Failure Modes',
    '',
    ...(input.failureModes.length > 0
      ? input.failureModes.map((item) => `- ${item}`)
      : ['- No recurring failure pattern detected yet.']),
    '',
    '## Pending Constraints',
    '',
    ...(input.pendingConstraints.length > 0
      ? input.pendingConstraints.map((item) => `- ${item}`)
      : ['- No unresolved constraints tracked yet.']),
    '',
    '## Signals',
    '',
    ...(input.signalKinds.length > 0
      ? input.signalKinds.map((kind) => `- ${kind}`)
      : ['- No durable session signals yet.']),
    '',
    '## Compaction State',
    '',
    `- Pressure: ${input.pressure}`,
    `- Stable strategies: ${input.stableStrategies.length}`,
    `- Failure modes: ${input.failureModes.length}`,
    `- Pending constraints: ${input.pendingConstraints.length}`,
    '',
  ]
    .filter(Boolean)
    .join('\n');
};

const toWorkingSetMountedSection = (conversationId: string, content: string): ContextPackSection | undefined => {
  const body = stripGeneratedDocumentScaffolding(content);
  if (!body) {
    return undefined;
  }

  const summary = safeExcerpt(body, 2000);
  return {
    kind: 'profile',
    id: `session-working-set:${conversationId}`,
    summary,
    priority: 96,
    tokenCount: Math.max(1, Math.ceil(summary.length / 4)),
  };
};

const toWorkingContextMountedSection = (conversationId: string, content: string): ContextPackSection | undefined => {
  const body = stripGeneratedDocumentScaffolding(content);
  if (!body) {
    return undefined;
  }

  const summary = safeExcerpt(body, 2000);
  return {
    kind: 'profile',
    id: `session-working-context:${conversationId}`,
    summary,
    priority: 96,
    tokenCount: Math.max(1, Math.ceil(summary.length / 4)),
  };
};

const formatTimelineHeading = (timestamp: string): string => {
  return `[${timestamp.replace('T', ' ').replace('.000Z', '').replace('Z', '')}]`;
};

const extractProjectInsightsBody = (content: string | undefined): string => {
  if (!content) {
    return '';
  }

  const markerIndex = content.indexOf(PROJECT_INSIGHTS_MARKER);
  if (markerIndex === -1) {
    return '';
  }

  return content.slice(markerIndex + PROJECT_INSIGHTS_MARKER.length).trim();
};

const buildProjectInsightsDocument = (input: {
  space: TSpace;
  project: ProjectBinding;
  updatedAt: string;
  entriesBody: string;
}): string => {
  const sessionLinks = input.entriesBody.match(/\[\[[^[\]|]+\/Sessions\/[^[\]|]+(?:\|[^\]]+)?\]\]/g) ?? [];
  const uniqueSessionLinks = Array.from(new Set(sessionLinks));

  return [
    buildProjectInsightsFrontmatterFromBinding(input.project, input.updatedAt),
    GENERATED_MARKER,
    `# ${getProjectInsightsTitle(input.project.name)}`,
    '',
    `- Space doc: ${toWikiLink(HOME_RELATIVE_PATH, getSpaceNoteTitle(input.space.name))}`,
    `- Project doc: ${toWikiLink(input.project.relativePath, getProjectNoteTitle(input.project.name))}`,
    input.project.workspacePath ? `- Workspace: \`${input.project.workspacePath}\`` : '',
    `- Updated at: ${input.updatedAt}`,
    '',
    '## Source Sessions',
    '',
    ...(uniqueSessionLinks.length > 0
      ? uniqueSessionLinks.map((link) => `- ${link}`)
      : ['- No source sessions promoted yet.']),
    '',
    '## Promoted Context',
    '',
    input.entriesBody || '- No promoted context yet.',
    '',
  ]
    .filter(Boolean)
    .join('\n');
};

const buildHomeDocument = (
  space: TSpace,
  projects: ProjectMeta[],
  sessions: SessionMeta[],
  updatedAt: string
): string => {
  const description = space.description?.replace(/\s+/g, ' ').trim();
  const projectLines = projects.length
    ? projects.map((project) => `- ${toWikiLink(project.relativePath, project.noteTitle)}`)
    : ['- No projects synced yet.'];
  const sessionLines = sessions.length
    ? sessions.slice(0, 12).map((session) => `- ${toWikiLink(session.relativePath, session.title)}`)
    : ['- No sessions synced yet.'];

  return [
    buildHomeFrontmatter(space, updatedAt),
    GENERATED_MARKER,
    `# ${getSpaceNoteTitle(space.name)}`,
    '',
    `- Space ID: \`${space.id}\``,
    `- Engine: \`${space.engine}\``,
    description ? `- Description: ${description}` : '',
    `- Open canvas: ${toWikiLink(DEFAULT_SPACE_CANVAS_PATH, 'Space Overview Canvas')}`,
    `- Updated at: ${updatedAt}`,
    '',
    '## Projects',
    '',
    ...projectLines,
    '',
    '## Sessions',
    '',
    ...sessionLines,
    '',
    '## Context Layers',
    '',
    '- Space docs hold durable memory, profile, and shared context entry points.',
    '- Project docs hold wiki structure derived from AGENTS.md and nearby markdown files.',
    '- Session docs keep append-only timeline events plus a rolling summary layer for compression-ready context.',
    '',
  ].join('\n');
};

const getCapabilityNodeColor = (kind: ProjectCapabilityRecord['kind']): string => {
  if (kind === 'skill') {
    return '1';
  }
  if (kind === 'hook') {
    return '3';
  }
  if (kind === 'command') {
    return '5';
  }
  return '6';
};

const buildProjectSourceGraphCanvas = (
  project: ProjectContext,
  capabilitySnapshot: ProjectCapabilitySnapshot
): JsonCanvasFile => {
  const canvasRelativePath = getProjectGraphRelativePath(project.folderName);
  const nodes: JsonCanvasFile['nodes'] = [
    {
      id: `project-${project.slug}`,
      type: 'file',
      file: toCanvasFileReference(canvasRelativePath, project.relativePath),
      x: 0,
      y: 0,
      width: 360,
      height: 220,
      color: '2',
    },
    {
      id: `project-capabilities-${project.slug}`,
      type: 'file',
      file: toCanvasFileReference(canvasRelativePath, getProjectCapabilitiesRelativePath(project.folderName)),
      x: 520,
      y: 0,
      width: 360,
      height: 220,
      color: '3',
    },
  ];
  const edges: JsonCanvasFile['edges'] = [
    {
      id: `edge-project-capabilities-${project.slug}`,
      fromNode: `project-${project.slug}`,
      fromSide: 'right',
      toNode: `project-capabilities-${project.slug}`,
      toSide: 'left',
      color: '3',
      label: 'capabilities',
    },
  ];

  project.sourceDocs.forEach((sourceDoc, index) => {
    const nodeId = `source-${stableHash(sourceDoc.relativePath)}`;
    const column = index % 3;
    const row = Math.floor(index / 3);
    const x = column * 420;
    const y = row * 260 + 340;
    nodes.push({
      id: nodeId,
      type: 'file',
      file: toCanvasFileReference(
        canvasRelativePath,
        getProjectSourceRelativePath(project.folderName, sourceDoc.relativePath)
      ),
      x,
      y,
      width: 360,
      height: 180,
      color: sourceDoc.relativePath === 'AGENTS.md' ? '4' : sourceDoc.backlinks.length > 0 ? '5' : '6',
    });
    edges.push({
      id: `edge-project-${stableHash(sourceDoc.relativePath)}`,
      fromNode: `project-${project.slug}`,
      fromSide: 'bottom',
      toNode: nodeId,
      toSide: 'top',
      color: '2',
      label: 'source',
    });
  });

  for (const sourceDoc of project.sourceDocs) {
    const fromNode = `source-${stableHash(sourceDoc.relativePath)}`;
    for (const reference of sourceDoc.references) {
      edges.push({
        id: `edge-ref-${stableHash(`${sourceDoc.relativePath}->${reference}`)}`,
        fromNode,
        fromSide: 'right',
        toNode: `source-${stableHash(reference)}`,
        toSide: 'left',
        color: '6',
        label: 'ref',
      });
    }
  }

  getProjectCapabilityRecords(capabilitySnapshot).forEach((capability, index) => {
    const nodeId = `capability-${capability.kind}-${stableHash(capability.id)}`;
    const column = index % 2;
    const row = Math.floor(index / 2);
    nodes.push({
      id: nodeId,
      type: 'file',
      file: toCanvasFileReference(canvasRelativePath, getProjectCapabilityRelativePath(project, capability)),
      x: 1040 + column * 420,
      y: row * 220,
      width: 360,
      height: 180,
      color: getCapabilityNodeColor(capability.kind),
    });
    edges.push({
      id: `edge-capability-${stableHash(`${capability.kind}:${capability.id}`)}`,
      fromNode: `project-capabilities-${project.slug}`,
      fromSide: 'right',
      toNode: nodeId,
      toSide: 'left',
      color: getCapabilityNodeColor(capability.kind),
      label: capability.kind,
    });
  });

  return { nodes, edges };
};

const buildSpaceCanvas = (projects: ProjectMeta[], sessions: SessionMeta[]): JsonCanvasFile => {
  const nodes: JsonCanvasFile['nodes'] = [
    {
      id: 'space-home',
      type: 'file',
      file: toCanvasFileReference(DEFAULT_SPACE_CANVAS_PATH, 'Home.md'),
      x: 0,
      y: 0,
      width: 420,
      height: 260,
      color: '4',
    },
  ];
  const edges: JsonCanvasFile['edges'] = [];
  const projectSessions = new Map<string, SessionMeta[]>();

  for (const session of sessions) {
    const key = session.projectSlug || '__unbound__';
    const bucket = projectSessions.get(key);
    if (bucket) {
      bucket.push(session);
    } else {
      projectSessions.set(key, [session]);
    }
  }

  let projectIndex = 0;
  for (const project of projects) {
    const projectNodeId = `project-${project.slug}`;
    const projectSessionsList = projectSessions.get(project.slug) || [];
    const projectY = projectIndex * Math.max(260, projectSessionsList.length * 220 + 120) + 420;
    nodes.push({
      id: projectNodeId,
      type: 'file',
      file: toCanvasFileReference(DEFAULT_SPACE_CANVAS_PATH, project.relativePath),
      x: 0,
      y: projectY,
      width: 420,
      height: 220,
      color: '2',
    });
    edges.push({
      id: `edge-space-${project.slug}`,
      fromNode: 'space-home',
      fromSide: 'bottom',
      toNode: projectNodeId,
      toSide: 'top',
      color: '4',
      label: 'project',
    });

    projectSessionsList.forEach((session, sessionIndex) => {
      const sessionNodeId = `session-${session.conversationId}`;
      nodes.push({
        id: sessionNodeId,
        type: 'file',
        file: toCanvasFileReference(DEFAULT_SPACE_CANVAS_PATH, session.relativePath),
        x: 560,
        y: projectY + sessionIndex * 220,
        width: 380,
        height: 180,
        color: '6',
      });
      edges.push({
        id: `edge-${project.slug}-${session.conversationId}`,
        fromNode: projectNodeId,
        fromSide: 'right',
        toNode: sessionNodeId,
        toSide: 'left',
        color: '6',
        label: 'session',
      });
    });

    projectIndex += 1;
  }

  const unboundSessions = projectSessions.get('__unbound__') || [];
  unboundSessions.forEach((session, index) => {
    const sessionNodeId = `session-${session.conversationId}`;
    nodes.push({
      id: sessionNodeId,
      type: 'file',
      file: toCanvasFileReference(DEFAULT_SPACE_CANVAS_PATH, session.relativePath),
      x: 560,
      y: index * 220 + 420,
      width: 380,
      height: 180,
      color: '5',
    });
    edges.push({
      id: `edge-space-${session.conversationId}`,
      fromNode: 'space-home',
      fromSide: 'right',
      toNode: sessionNodeId,
      toSide: 'left',
      color: '5',
      label: 'session',
    });
  });

  return { nodes, edges };
};

const replaceFrontmatter = (content: string, nextFrontmatter: string): string => {
  if (!content.startsWith('---\n')) {
    return nextFrontmatter + content;
  }

  const endIndex = content.indexOf('\n---\n', 4);
  if (endIndex === -1) {
    return nextFrontmatter + content;
  }

  return nextFrontmatter + content.slice(endIndex + '\n---\n'.length);
};

const SESSION_TIMELINE_MARKER = '\n## Timeline\n';

const extractSessionTimelineBody = (content: string | undefined): string => {
  if (!content) {
    return '';
  }

  const markerIndex = content.indexOf(SESSION_TIMELINE_MARKER);
  if (markerIndex === -1) {
    return '';
  }

  return content.slice(markerIndex + SESSION_TIMELINE_MARKER.length).trim();
};

const parseSessionTimelineEvents = (timelineBody: string): SessionTimelineEvent[] => {
  const lines = timelineBody.replace(/\r\n/g, '\n').split('\n');
  const events: SessionTimelineEvent[] = [];
  let current: SessionTimelineEvent | undefined;
  let bodyLines: string[] = [];

  const pushCurrent = () => {
    if (!current) {
      return;
    }
    events.push({
      ...current,
      body: bodyLines.join('\n').trim(),
    });
  };

  for (const line of lines) {
    if (line.startsWith('### ')) {
      pushCurrent();
      const heading = line.slice(4).trim();
      const separatorIndex = heading.indexOf(' ');
      current = {
        timestamp: separatorIndex === -1 ? heading : heading.slice(0, separatorIndex),
        title: separatorIndex === -1 ? '' : heading.slice(separatorIndex + 1).trim(),
        body: '',
      };
      bodyLines = [];
      continue;
    }

    if (current) {
      bodyLines.push(line);
    }
  }

  pushCurrent();
  return events;
};

const inlineSummaryText = (value: string, limit = SESSION_SUMMARY_EXCERPT_LIMIT): string => {
  const normalized = value.replace(/\r\n/g, '\n').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, limit).trimEnd()}...`;
};

const extractEventCodeBlock = (event: SessionTimelineEvent): string | undefined => {
  const match = event.body.match(/```md\n([\s\S]*?)\n```/);
  return match?.[1]?.trim();
};

const extractEventBulletValue = (event: SessionTimelineEvent, key: string): string | undefined => {
  const pattern = new RegExp(`^- ${key}: (.+)$`, 'm');
  const match = event.body.match(pattern);
  return match?.[1]?.replace(/`/g, '').trim();
};

const buildSessionSummaryLines = (timelineBody: string): string[] => {
  const events = parseSessionTimelineEvents(timelineBody);
  if (events.length === 0) {
    return ['- No session activity yet.'];
  }

  const userTurns = events.filter((event) => event.title === 'User Query Started');
  const assistantReplies = events.filter((event) => event.title === 'Assistant Reply Completed');
  const interruptions = events.filter((event) => event.title === 'Session Interrupted');
  const latestUser = userTurns.at(-1);
  const latestAssistant = assistantReplies.at(-1);
  const latestInterruption = interruptions.at(-1);
  const latestEvent = events.at(-1);
  const firstEvent = events[0];
  const recentCheckpoint = events
    .slice(-SESSION_RECENT_EVENT_LIMIT)
    .map((event) => `${event.timestamp} ${event.title}`)
    .join(' | ');

  return [
    `- Total timeline events: ${events.length}`,
    `- User turns: ${userTurns.length}`,
    `- Assistant replies: ${assistantReplies.length}`,
    `- Interruptions: ${interruptions.length}`,
    `- Timeline span: ${firstEvent.timestamp} -> ${latestEvent?.timestamp || firstEvent.timestamp}`,
    latestEvent ? `- Latest activity: ${latestEvent.timestamp} ${latestEvent.title}` : '',
    latestUser ? `- Latest user goal: ${inlineSummaryText(extractEventCodeBlock(latestUser) || latestUser.body)}` : '',
    latestAssistant
      ? `- Latest assistant outcome: ${inlineSummaryText(extractEventCodeBlock(latestAssistant) || latestAssistant.body)}`
      : '',
    latestInterruption
      ? `- Latest interruption reason: ${extractEventBulletValue(latestInterruption, 'Reason') || 'unknown'}`
      : '',
    recentCheckpoint ? `- Recent checkpoints: ${recentCheckpoint}` : '',
  ].filter(Boolean);
};

const buildTimelineEventBlock = (input: {
  timestamp: string;
  title: string;
  bullets?: readonly string[];
  body?: string;
}): string => {
  const lines: string[] = ['', `### ${input.timestamp} ${input.title}`, ''];

  const bullets = input.bullets?.filter(Boolean) || [];
  if (bullets.length > 0) {
    lines.push(...bullets.map((bullet) => `- ${bullet}`), '');
  }

  const body = input.body?.trim();
  if (body) {
    lines.push(body, '');
  }

  return lines.join('\n');
};

const appendTimelineEvent = (timelineBody: string, eventBlock: string): string => {
  const normalizedTimeline = timelineBody.trim();
  const normalizedEvent = eventBlock.trim();
  if (!normalizedTimeline) {
    return normalizedEvent;
  }
  return `${normalizedTimeline}\n\n${normalizedEvent}`;
};

const titleFromMarkdown = (content: string | undefined, fallback: string): string => {
  return getMarkdownDisplayTitle(content, fallback);
};

const readSessionTitle = (content: string | undefined, conversationId: string): string => {
  return titleFromMarkdown(content, getSessionNoteTitle(conversationId, conversationId));
};

const normalizeWorkspaceDirectory = async (workspacePath: string): Promise<string | undefined> => {
  try {
    const stat = await fs.stat(workspacePath);
    return stat.isDirectory() ? workspacePath : path.dirname(workspacePath);
  } catch {
    return undefined;
  }
};

const removeFileIfExists = async (absolutePath: string): Promise<void> => {
  await fs.rm(absolutePath, { force: true });
};

const removeDirectoryIfExists = async (absolutePath: string): Promise<void> => {
  await fs.rm(absolutePath, { recursive: true, force: true });
};

const readProjectMetas = async (vaultPath: string): Promise<ProjectMeta[]> => {
  const projectsRoot = path.join(vaultPath, PROJECTS_DIR);
  const directories = await readDirectorySafe(projectsRoot);
  const metas: ProjectMeta[] = [];

  for (const directory of directories) {
    if (!directory.isDirectory()) {
      continue;
    }

    const relativePath = getProjectRelativePath(directory.name);
    const content = await readUtf8(path.join(vaultPath, toPosixRelativePath(relativePath)));
    const meta = parseFrontmatter(content);
    metas.push({
      slug: meta.projectSlug || directory.name,
      title: titleFromMarkdown(content, directory.name),
      noteTitle: titleFromMarkdown(content, getProjectNoteTitle(directory.name)),
      relativePath,
      updatedAt: meta.updatedAt || '',
    });
  }

  metas.sort((left, right) => left.title.localeCompare(right.title));
  return metas;
};

const readSessionMetas = async (vaultPath: string): Promise<SessionMeta[]> => {
  const metas: SessionMeta[] = [];

  const projectDirectories = await readDirectorySafe(path.join(vaultPath, PROJECTS_DIR));
  for (const projectDirectory of projectDirectories) {
    if (!projectDirectory.isDirectory()) {
      continue;
    }

    const sessionEntries = await readDirectorySafe(
      path.join(vaultPath, getProjectSessionsRelativeDir(projectDirectory.name))
    );
    for (const entry of sessionEntries) {
      if (!entry.isFile() || !isMarkdownFile(entry.name)) {
        continue;
      }

      const relativePath = path.posix.join(getProjectSessionsRelativeDir(projectDirectory.name), entry.name);
      const content = await readUtf8(path.join(vaultPath, toPosixRelativePath(relativePath)));
      const meta = parseFrontmatter(content);
      metas.push({
        conversationId: meta.conversationId || stripMarkdownExtension(entry.name),
        title: readSessionTitle(content, stripMarkdownExtension(entry.name)),
        projectSlug: meta.projectSlug,
        relativePath,
        updatedAt: meta.updatedAt || '',
      });
    }
  }

  return metas.toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt));
};

export class SpaceVaultContextSyncService {
  constructor(
    private readonly spaceService: ISpaceService = new SpaceServiceImpl(new SqliteSpaceRepository()),
    private readonly projectCapabilityService: ProjectCapabilityService = new ProjectCapabilityService()
  ) {}

  async syncSpaceOverviewForSpace(space: TSpace): Promise<void> {
    if (!isSpaceVaultProviderRef(space.providerRef)) {
      return;
    }

    await this.ensureBaseStructure(space.providerRef.vaultPath);
    await this.syncSpaceOverview(space, space.providerRef.vaultPath);
  }

  async ensureConversationContext(input: RegisterConversationInput): Promise<void> {
    const target = await this.resolveConversationTarget(input.conversation);
    if (!target) {
      return;
    }

    await this.ensureBaseStructure(target.vaultPath);
    await this.ensureSessionDocument(target, input.conversation);
    await this.ensureSessionWorkingSetDocument(target, input.conversation);
    await this.syncProjectContext(target);
    await this.syncSpaceOverview(target.space, target.vaultPath);
  }

  async appendUserTurnStarted(input: UserTurnEventInput): Promise<void> {
    const target = await this.resolveConversationTarget(input.conversation);
    if (!target) {
      return;
    }

    await this.ensureConversationContext({ conversation: input.conversation });
    const paths = getConversationDocumentPaths(input.conversation.id, target.project?.folderName);
    const timestamp = nowIso(input.preparedAt);
    const eventBlock = buildTimelineEventBlock({
      timestamp,
      title: 'User Query Started',
      bullets: input.msgId ? [`Message ID: \`${input.msgId}\``] : [],
      body: toMarkdownCodeBlock(input.userInput),
    });

    const existing = await readUtf8(path.join(target.vaultPath, toPosixRelativePath(paths.sessionRelativePath)));
    const nextTimelineBody = appendTimelineEvent(extractSessionTimelineBody(existing), eventBlock);
    await this.touchSessionFrontmatter(target, input.conversation, timestamp, nextTimelineBody);
    await this.syncSpaceOverview(target.space, target.vaultPath);
  }

  async appendAssistantTurnCompleted(input: AssistantTurnEventInput): Promise<void> {
    const target = await this.resolveConversationTarget(input.conversation);
    if (!target) {
      return;
    }

    await this.ensureConversationContext({ conversation: input.conversation });
    const paths = getConversationDocumentPaths(input.conversation.id, target.project?.folderName);
    const timestamp = nowIso(input.completedAt);
    const durationMs = input.preparedAt ? Math.max(0, input.completedAt - input.preparedAt) : undefined;
    const bullets = [
      input.assistantMessageId ? `Message ID: \`${input.assistantMessageId}\`` : undefined,
      durationMs !== undefined ? `Turn duration: ${durationMs} ms` : undefined,
    ].filter((value): value is string => Boolean(value));
    const eventBlock = buildTimelineEventBlock({
      timestamp,
      title: 'Assistant Reply Completed',
      bullets,
      body: toMarkdownCodeBlock(input.assistantText),
    });

    const existing = await readUtf8(path.join(target.vaultPath, toPosixRelativePath(paths.sessionRelativePath)));
    const nextTimelineBody = appendTimelineEvent(extractSessionTimelineBody(existing), eventBlock);
    await this.touchSessionFrontmatter(target, input.conversation, timestamp, nextTimelineBody);
    await this.syncProjectContext(target);
    await this.syncSpaceOverview(target.space, target.vaultPath);
  }

  async appendConversationStopped(input: ConversationStopEventInput): Promise<void> {
    const target = await this.resolveConversationTarget(input.conversation);
    if (!target) {
      return;
    }

    await this.ensureConversationContext({ conversation: input.conversation });
    const paths = getConversationDocumentPaths(input.conversation.id, target.project?.folderName);
    const timestamp = nowIso(input.stoppedAt);
    const durationMs = input.preparedAt ? Math.max(0, input.stoppedAt - input.preparedAt) : undefined;
    const bullets = [
      `Reason: \`${input.reason}\``,
      durationMs !== undefined ? `Elapsed since latest user turn: ${durationMs} ms` : undefined,
    ].filter((value): value is string => Boolean(value));
    const eventBlock = buildTimelineEventBlock({
      timestamp,
      title: 'Session Interrupted',
      bullets,
    });

    const existing = await readUtf8(path.join(target.vaultPath, toPosixRelativePath(paths.sessionRelativePath)));
    const nextTimelineBody = appendTimelineEvent(extractSessionTimelineBody(existing), eventBlock);
    await this.touchSessionFrontmatter(target, input.conversation, timestamp, nextTimelineBody);
    await this.syncSpaceOverview(target.space, target.vaultPath);
  }

  async appendContextCheckpoint(input: SessionContextCheckpointInput): Promise<void> {
    const target = await this.resolveConversationTarget(input.conversation);
    if (!target) {
      return;
    }

    await this.ensureConversationContext({ conversation: input.conversation });
    const paths = getConversationDocumentPaths(input.conversation.id, target.project?.folderName);
    const timestamp = nowIso(input.timestamp);
    const eventBlock = buildTimelineEventBlock({
      timestamp,
      title: input.title,
      bullets: input.bullets,
      body: input.body,
    });

    const existing = await readUtf8(path.join(target.vaultPath, toPosixRelativePath(paths.sessionRelativePath)));
    const nextTimelineBody = appendTimelineEvent(extractSessionTimelineBody(existing), eventBlock);
    await this.touchSessionFrontmatter(target, input.conversation, timestamp, nextTimelineBody);
    await this.syncProjectContext(target);
    await this.syncSpaceOverview(target.space, target.vaultPath);
  }

  async appendSessionTimelineEvent(input: SessionTimelineEventInput): Promise<void> {
    const target = await this.resolveConversationTarget(input.conversation);
    if (!target) {
      return;
    }

    await this.ensureConversationContext({ conversation: input.conversation });
    const relativePath = getSessionTimelineRelativePath(input.conversation.id, target.project?.folderName);
    const absolutePath = path.join(target.vaultPath, relativePath);
    const nextBlock = `${formatTimelineHeading(input.timestamp)}\n${input.title}: ${input.body}\n\n`;
    await ensureDirectory(path.dirname(absolutePath));
    await fs.appendFile(absolutePath, nextBlock, 'utf8');
  }

  async readSessionWorkingSetSection(input: {
    conversation: TChatConversation;
  }): Promise<ContextPackSection | undefined> {
    const target = await this.resolveConversationTarget(input.conversation);
    if (!target) {
      return undefined;
    }

    const paths = getConversationDocumentPaths(input.conversation.id, target.project?.folderName);
    const content = await readUtf8(path.join(target.vaultPath, toPosixRelativePath(paths.workingSetRelativePath)));
    return content ? toWorkingSetMountedSection(input.conversation.id, content) : undefined;
  }

  async readSessionWorkingContextSection(input: {
    conversation: TChatConversation;
  }): Promise<ContextPackSection | undefined> {
    const target = await this.resolveConversationTarget(input.conversation);
    if (!target) {
      return undefined;
    }

    const relativePath = getSessionWorkingContextRelativePath(input.conversation.id, target.project?.folderName);
    const content = await readUtf8(path.join(target.vaultPath, toPosixRelativePath(relativePath)));
    return content ? toWorkingContextMountedSection(input.conversation.id, content) : undefined;
  }

  async writeSessionWorkingSet(input: SessionWorkingSetWriteInput): Promise<
    | {
        relativePath: string;
        title: string;
      }
    | undefined
  > {
    const target = await this.resolveConversationTarget(input.conversation);
    if (!target) {
      return undefined;
    }

    await this.ensureBaseStructure(target.vaultPath);
    const paths = getConversationDocumentPaths(input.conversation.id, target.project?.folderName);
    const relativePath = paths.workingSetRelativePath;
    const absolutePath = path.join(target.vaultPath, relativePath);
    const nextDocument = buildSessionWorkingSetDocument({
      conversation: input.conversation,
      project: target.project,
      space: target.space,
      updatedAt: input.timestamp,
      currentTask: input.currentTask,
      stableStrategies: input.stableStrategies,
      failureModes: input.failureModes,
      pendingConstraints: input.pendingConstraints,
      signalKinds: input.signalKinds,
      pressure: input.pressure,
      sourceProfileKey: input.sourceProfileKey,
    });

    await ensureFile(absolutePath, nextDocument);
    return {
      relativePath,
      title: getSessionWorkingSetTitle(sanitizeSessionTitle(input.conversation.name, input.conversation.id)),
    };
  }

  async writeSessionWorkingContext(input: SessionWorkingSetWriteInput): Promise<
    | {
        relativePath: string;
        title: string;
      }
    | undefined
  > {
    const target = await this.resolveConversationTarget(input.conversation);
    if (!target) {
      return undefined;
    }

    await this.ensureBaseStructure(target.vaultPath);
    const relativePath = getSessionWorkingContextRelativePath(input.conversation.id, target.project?.folderName);
    const absolutePath = path.join(target.vaultPath, relativePath);
    const nextDocument = buildSessionWorkingContextDocument({
      conversation: input.conversation,
      project: target.project,
      space: target.space,
      updatedAt: input.timestamp,
      currentTask: input.currentTask,
      stableStrategies: input.stableStrategies,
      failureModes: input.failureModes,
      pendingConstraints: input.pendingConstraints,
      signalKinds: input.signalKinds,
      pressure: input.pressure,
      sourceProfileKey: input.sourceProfileKey,
    });

    await ensureFile(absolutePath, nextDocument);
    return {
      relativePath,
      title: getSessionWorkingContextTitle(sanitizeSessionTitle(input.conversation.name, input.conversation.id)),
    };
  }

  async appendSessionCheckpoint(input: SessionCheckpointWriteInput): Promise<SessionCheckpointArtifact | undefined> {
    const target = await this.resolveConversationTarget(input.conversation);
    if (!target) {
      return undefined;
    }

    await this.ensureConversationContext({ conversation: input.conversation });
    const relativePath = getSessionCheckpointRelativePath(
      input.conversation.id,
      target.project?.folderName,
      input.timestamp,
      input.kind
    );
    const absolutePath = path.join(target.vaultPath, relativePath);
    const content = [
      GENERATED_MARKER,
      '',
      `# ${input.title}`,
      '',
      `- Kind: \`${input.kind}\``,
      `- Timestamp: ${input.timestamp}`,
      '',
      input.summary,
      '',
      input.detail ?? '',
    ]
      .filter(Boolean)
      .join('\n');

    await ensureFile(absolutePath, content);
    return {
      title: input.title,
      relativePath,
      summary: input.summary,
    };
  }

  async appendOperationLogEntry(input: OperationLogEntryInput): Promise<void> {
    const space = await this.spaceService.getSpace(input.spaceId);
    const providerRef = space?.providerRef;
    if (!space || !isSpaceVaultProviderRef(providerRef)) {
      return;
    }

    await this.ensureBaseStructure(providerRef.vaultPath);
    const relativePath = getOperationLogDailyRelativePath(input.timestamp);
    const absolutePath = path.join(providerRef.vaultPath, relativePath);
    const existing =
      (await readUtf8(absolutePath)) ??
      ['<!-- contextgo-generated -->', '', `# Operation Log ${input.timestamp.slice(0, 10)}`, ''].join('\n');
    const entry = buildTimelineEventBlock({
      timestamp: input.timestamp,
      title: input.title,
      bullets: input.bullets,
      body: input.body,
    }).trim();
    const next = `${existing.trimEnd()}\n\n${entry}\n`;
    await ensureFile(absolutePath, next);
  }

  async writeContextRunArtifact(input: ContextRunWriteInput): Promise<
    | {
        title: string;
        relativePath: string;
        summary: string;
      }
    | undefined
  > {
    const space = await this.spaceService.getSpace(input.spaceId);
    const providerRef = space?.providerRef;
    if (!space || !isSpaceVaultProviderRef(providerRef)) {
      return undefined;
    }

    await this.ensureBaseStructure(providerRef.vaultPath);
    const relativePath = getContextRunRelativePath(input.runId);
    const absolutePath = path.join(providerRef.vaultPath, relativePath);
    const content = [
      GENERATED_MARKER,
      '',
      frontmatter({
        title: input.title,
        updatedAt: input.timestamp,
        type: 'context-run',
        runId: input.runId,
      }),
      `# ${input.title}`,
      '',
      `- Updated at: ${input.timestamp}`,
      '',
      '## Summary',
      '',
      input.summary,
      '',
      input.detail ? ['## Detail', '', input.detail, ''].join('\n') : '',
    ]
      .filter(Boolean)
      .join('\n');

    await ensureFile(absolutePath, content);
    return {
      title: input.title,
      relativePath,
      summary: input.summary,
    };
  }

  async writeSpaceMemoryDistillation(input: SpaceMemoryDistillationWriteInput): Promise<
    | {
        title: string;
        relativePath: string;
        summary: string;
        spaceId: string;
      }
    | undefined
  > {
    const space = await this.spaceService.getSpace(input.spaceId);
    const providerRef = space?.providerRef;
    if (!space || !isSpaceVaultProviderRef(providerRef)) {
      return undefined;
    }

    await this.ensureBaseStructure(providerRef.vaultPath);
    const relativePath = getSpaceMemoryRelativePath();
    const absolutePath = path.join(providerRef.vaultPath, relativePath);
    const title = 'Space Memory Distillation';
    const existing = (await readUtf8(absolutePath)) ?? [GENERATED_MARKER, '', `# ${title}`, ''].join('\n');
    const entry = buildTimelineEventBlock({
      timestamp: input.timestamp,
      title,
      bullets: [input.summary],
      body: input.detail,
    });
    const next = `${existing.trimEnd()}\n\n${entry.trim()}\n`;
    await ensureFile(absolutePath, next);

    return {
      title,
      relativePath,
      summary: input.summary,
      spaceId: input.spaceId,
    };
  }

  async writeProfileMemoryDistillation(input: ProfileMemoryDistillationWriteInput): Promise<
    | {
        title: string;
        relativePath: string;
        summary: string;
        spaceId: string;
      }
    | undefined
  > {
    const space = await this.spaceService.getSpace(input.spaceId);
    const providerRef = space?.providerRef;
    if (!space || !isSpaceVaultProviderRef(providerRef)) {
      return undefined;
    }

    await this.ensureBaseStructure(providerRef.vaultPath);
    const title = 'Profile Memory';
    const relativePath = path.posix.join(CONTEXT_ENGINE_SYSTEM_DIR, 'Profile Memory.md');
    const absolutePath = path.join(providerRef.vaultPath, relativePath);
    const body = formatSpaceCuratorProfileMemory({
      title,
      summary: input.summary,
      bullets: input.bullets,
      detail: input.detail,
    });
    await ensureFile(absolutePath, body);

    return {
      title,
      relativePath,
      summary: input.summary,
      spaceId: input.spaceId,
    };
  }

  async writeConnectorDigest(input: ConnectorDigestWriteInput): Promise<
    | {
        title: string;
        relativePath: string;
        summary: string;
        spaceId: string;
      }
    | undefined
  > {
    const space = await this.spaceService.getSpace(input.spaceId);
    const providerRef = space?.providerRef;
    if (!space || !isSpaceVaultProviderRef(providerRef)) {
      return undefined;
    }

    await this.ensureBaseStructure(providerRef.vaultPath);
    const relativePath = getConnectorDigestRelativePath();
    const absolutePath = path.join(providerRef.vaultPath, relativePath);
    const title = 'Connector Digest';
    const existing = (await readUtf8(absolutePath)) ?? [GENERATED_MARKER, '', `# ${title}`, ''].join('\n');
    const entry = formatConnectorDigestEntry({
      title,
      summary: input.summary,
      bullets: [],
      detail: input.detail,
    });
    const next = `${existing.trimEnd()}\n\n${entry.trim()}\n`;
    await ensureFile(absolutePath, next);

    return {
      title,
      relativePath,
      summary: input.summary,
      spaceId: input.spaceId,
    };
  }

  async curateProjectCapabilities(input: ProjectCapabilityCurationWriteInput): Promise<
    | {
        projectSlug: string;
        noteTitle: string;
        relativePath: string;
        summary: string;
      }
    | undefined
  > {
    const space = await this.spaceService.getSpace(input.spaceId);
    const providerRef = space?.providerRef;
    if (!space || !isSpaceVaultProviderRef(providerRef)) {
      return undefined;
    }

    const project = await this.findProjectBindingBySlug(providerRef.vaultPath, input.projectSlug);
    if (!project?.workspacePath) {
      return undefined;
    }

    const refreshedProject = await this.resolveProjectContext(providerRef, project.workspacePath);
    if (!refreshedProject) {
      return undefined;
    }

    await this.syncProjectContext({
      space,
      vaultPath: providerRef.vaultPath,
      project: refreshedProject,
    });
    await this.syncSpaceOverview(space, providerRef.vaultPath);

    return {
      projectSlug: refreshedProject.slug,
      noteTitle: getProjectCapabilitiesTitle(refreshedProject.name),
      relativePath: getProjectCapabilitiesRelativePath(refreshedProject.folderName),
      summary: input.summary,
    };
  }

  async writeProjectCuratorProposal(input: ProjectCuratorProposalWriteInput): Promise<
    | {
        title: string;
        relativePath: string;
        summary: string;
      }
    | undefined
  > {
    const space = await this.spaceService.getSpace(input.spaceId);
    const providerRef = space?.providerRef;
    if (!space || !isSpaceVaultProviderRef(providerRef)) {
      return undefined;
    }

    await this.ensureBaseStructure(providerRef.vaultPath);
    const project = await this.findProjectBindingBySlug(providerRef.vaultPath, input.projectSlug);
    if (!project) {
      return undefined;
    }

    const fileName = `${sanitizeVaultPathSegment(input.title)}.md`;
    const relativePath = path.posix.join(PROJECTS_DIR, project.folderName, PROJECT_CONTEXT_DIR, 'proposals', fileName);
    const absolutePath = path.join(providerRef.vaultPath, relativePath);
    const body = formatProjectCuratorProposal({
      title: input.title,
      targetPath: input.targetPath,
      summary: input.summary,
      evidence: input.evidence,
      additions: input.additions,
    });
    await ensureFile(absolutePath, body);

    return {
      title: input.title,
      relativePath,
      summary: input.summary,
    };
  }

  async writeProjectPromotion(input: ProjectPromotionWriteInput): Promise<
    | {
        projectSlug: string;
        noteTitle: string;
        relativePath: string;
        summary: string;
        sourceThreadIds: readonly string[];
      }
    | undefined
  > {
    const space = await this.spaceService.getSpace(input.spaceId);
    const providerRef = space?.providerRef;
    if (!space || !isSpaceVaultProviderRef(providerRef)) {
      return undefined;
    }

    await this.ensureBaseStructure(providerRef.vaultPath);
    const project = await this.findProjectBindingBySlug(providerRef.vaultPath, input.projectSlug);
    if (!project) {
      return undefined;
    }

    const relativePath = getProjectInsightsRelativePath(project.folderName);
    const absolutePath = path.join(providerRef.vaultPath, relativePath);
    const existing = await readUtf8(absolutePath);
    const sourceSessionLinks = input.sourceThreadIds.map((threadId) => {
      const linkedPaths = getConversationDocumentPaths(threadId, project.folderName);
      return toWikiLink(linkedPaths.sessionRelativePath);
    });
    const entry = buildTimelineEventBlock({
      timestamp: input.timestamp,
      title: 'Project Promotion',
      bullets: [`Summary: ${input.summary}`, ...sourceSessionLinks.map((link) => `Source session: ${link}`)],
      body: input.detail?.trim(),
    });
    const nextEntriesBody = appendTimelineEvent(extractProjectInsightsBody(existing), entry);
    const nextDocument = buildProjectInsightsDocument({
      space,
      project,
      updatedAt: input.timestamp,
      entriesBody: nextEntriesBody,
    });

    await ensureFile(absolutePath, nextDocument);

    if (project.workspacePath) {
      const refreshedProject = await this.resolveProjectContext(providerRef, project.workspacePath);
      if (refreshedProject) {
        await this.syncProjectContext({
          space,
          vaultPath: providerRef.vaultPath,
          project: refreshedProject,
        });
      }
    }

    await this.syncSpaceOverview(space, providerRef.vaultPath);

    return {
      projectSlug: input.projectSlug,
      noteTitle: getProjectInsightsTitle(project.name),
      relativePath,
      summary: input.summary,
      sourceThreadIds: input.sourceThreadIds,
    };
  }

  async removeConversationContext(input: RemoveConversationContextInput): Promise<void> {
    const target = await this.resolveConversationTarget(input.conversation);
    if (!target) {
      return;
    }

    const paths = getConversationDocumentPaths(input.conversation.id, target.project?.folderName);
    const sessionPath = path.join(target.vaultPath, paths.sessionRelativePath);
    const sessionWorkingSetPath = path.join(target.vaultPath, paths.workingSetRelativePath);
    await removeFileIfExists(sessionPath);
    await removeDirectoryIfExists(path.dirname(sessionWorkingSetPath));

    const remainingSpaceConversations = input.remainingConversations.filter(
      (conversation) => conversation.extra?.spaceId === input.conversation.extra?.spaceId
    );

    if (target.project) {
      const remainingProjectConversations = await this.filterProjectConversations(
        remainingSpaceConversations,
        target.project.workspacePath
      );

      if (remainingProjectConversations.length === 0) {
        await removeDirectoryIfExists(target.project.folderPath);
      } else {
        const providerRef = target.space.providerRef;
        if (isSpaceVaultProviderRef(providerRef)) {
          const refreshedProject = await this.resolveProjectContext(providerRef, target.project.workspacePath);
          if (refreshedProject) {
            await this.syncProjectContext({
              ...target,
              project: refreshedProject,
            });
          }
        }
      }
    }

    await this.syncSpaceOverview(target.space, target.vaultPath);
  }

  private async resolveConversationTarget(
    conversation: TChatConversation
  ): Promise<ConversationContextTarget | undefined> {
    const spaceId = conversation.extra?.spaceId;
    if (!spaceId) {
      return undefined;
    }

    const space = await this.spaceService.getSpace(spaceId);
    const providerRef = space?.providerRef;
    if (!space || !isSpaceVaultProviderRef(providerRef)) {
      return undefined;
    }

    const workspacePath = conversation.extra?.workingDirectory || conversation.extra?.workspace;
    const normalizedWorkspacePath = workspacePath?.trim()
      ? await normalizeWorkspaceDirectory(path.resolve(workspacePath))
      : undefined;
    const project = normalizedWorkspacePath
      ? await this.resolveProjectContext(providerRef, normalizedWorkspacePath)
      : undefined;

    return {
      space,
      vaultPath: providerRef.vaultPath,
      project,
    };
  }

  private async resolveProjectContext(
    providerRef: SpaceVaultProviderRef,
    workspacePath: string
  ): Promise<ProjectContext | undefined> {
    if (!(await fileExists(workspacePath))) {
      return undefined;
    }

    const slug = createProjectSlug(workspacePath);
    const folderName = createProjectFolderName(workspacePath);
    const relativePath = getProjectRelativePath(folderName);
    const folderPath = path.join(providerRef.vaultPath, PROJECTS_DIR, folderName);

    return {
      slug,
      name: path.basename(trimTrailingSlash(workspacePath)) || folderName,
      folderName,
      workspacePath,
      folderPath,
      notePath: path.join(providerRef.vaultPath, relativePath),
      relativePath,
      sourceDocs: await scanProjectMarkdownFiles(workspacePath),
    };
  }

  private async findProjectBindingBySlug(vaultPath: string, projectSlug: string): Promise<ProjectBinding | undefined> {
    const projectsRoot = path.join(vaultPath, PROJECTS_DIR);
    const directories = await readDirectorySafe(projectsRoot);

    for (const directory of directories) {
      if (!directory.isDirectory()) {
        continue;
      }

      const relativePath = getProjectRelativePath(directory.name);
      const content = await readUtf8(path.join(vaultPath, toPosixRelativePath(relativePath)));
      const meta = parseFrontmatter(content);
      if (meta.projectSlug !== projectSlug) {
        continue;
      }

      const name = titleFromMarkdown(content, directory.name);
      return {
        slug: projectSlug,
        name,
        folderName: directory.name,
        workspacePath: meta.workspace,
        relativePath,
      };
    }

    return undefined;
  }

  private async ensureBaseStructure(vaultPath: string): Promise<void> {
    await Promise.all([
      ensureDirectory(path.join(vaultPath, PROJECTS_DIR)),
      ensureDirectory(path.join(vaultPath, CANVAS_DIR)),
      ensureDirectory(path.join(vaultPath, SYSTEM_DIR)),
      ensureDirectory(path.join(vaultPath, OPERATIONS_DIR)),
    ]);
  }

  private async ensureSessionDocument(
    target: ConversationContextTarget,
    conversation: TChatConversation
  ): Promise<void> {
    const paths = getConversationDocumentPaths(conversation.id, target.project?.folderName);
    const sessionRelativePath = paths.sessionRelativePath;
    const sessionPath = path.join(target.vaultPath, sessionRelativePath);
    const updatedAt = nowIso();
    const existing = await readUtf8(path.join(target.vaultPath, toPosixRelativePath(paths.sessionRelativePath)));
    const nextDocument = buildSessionDocument(
      conversation,
      target.project,
      target.space,
      updatedAt,
      extractSessionTimelineBody(existing)
    );

    await ensureFile(sessionPath, nextDocument);
  }

  private async ensureSessionWorkingSetDocument(
    target: ConversationContextTarget,
    conversation: TChatConversation
  ): Promise<void> {
    const paths = getConversationDocumentPaths(conversation.id, target.project?.folderName);
    const workingSetRelativePath = paths.workingSetRelativePath;
    const workingSetPath = path.join(target.vaultPath, workingSetRelativePath);
    if (await fileExists(workingSetPath)) {
      return;
    }

    const updatedAt = nowIso();
    const nextDocument = buildSessionWorkingSetDocument({
      conversation,
      project: target.project,
      space: target.space,
      updatedAt,
      stableStrategies: [],
      failureModes: [],
      pendingConstraints: [],
      signalKinds: [],
      pressure: 0,
    });
    await ensureFile(workingSetPath, nextDocument);
  }

  private async syncProjectContext(target: ConversationContextTarget): Promise<void> {
    if (!target.project) {
      return;
    }

    await ensureDirectory(target.project.folderPath);
    await ensureDirectory(path.join(target.project.folderPath, PROJECT_SESSIONS_DIR_NAME));
    await ensureDirectory(path.join(target.project.folderPath, SOURCE_DOCS_DIR));
    await ensureDirectory(path.join(target.project.folderPath, PROJECT_CONTEXT_DIR));
    await ensureDirectory(path.join(target.project.folderPath, PROJECT_CONTEXT_DIR, PROJECT_SESSION_STATE_DIR_NAME));

    const sessionRelativePaths = await this.listProjectSessionLinks(target.vaultPath, target.project.slug);
    const updatedAt = nowIso();
    const capabilitySnapshot = (await this.projectCapabilityService.readSnapshot(target.project.workspacePath)) ?? {
      workspacePath: target.project.workspacePath,
      automationRootRelativePath: '.contextgo',
      counts: { skill: 0, hook: 0, command: 0, schedule: 0 },
      skills: [],
      hooks: [],
      commands: [],
      schedules: [],
    };

    for (const sourceDoc of target.project.sourceDocs) {
      const absoluteTargetPath = path.join(
        target.vaultPath,
        getProjectSourceRelativePath(target.project.folderName, sourceDoc.relativePath)
      );
      const content = await buildSourceDocument(target.space.name, target.project, sourceDoc, updatedAt);
      await ensureFile(absoluteTargetPath, content);
    }

    const capabilityDocs = buildProjectCapabilityDocuments(target.project, capabilitySnapshot, updatedAt);
    await removeDirectoryIfExists(path.join(target.project.folderPath, PROJECT_CONTEXT_DIR, 'capabilities'));
    await ensureFile(
      path.join(target.vaultPath, getProjectCapabilitiesRelativePath(target.project.folderName)),
      capabilityDocs.summary
    );
    for (const capabilityDoc of capabilityDocs.items) {
      await ensureFile(path.join(target.vaultPath, capabilityDoc.relativePath), capabilityDoc.body);
    }

    const projectDocContent = buildProjectDocument(
      target.space,
      target.project,
      sessionRelativePaths,
      capabilitySnapshot,
      updatedAt
    );
    await ensureFile(target.project.notePath, projectDocContent);
    const projectBaselinePath = path.join(target.vaultPath, getProjectBaselineRelativePath(target.project.folderName));
    const projectBaselineContent = await buildProjectBaselineDocument(target.space, target.project, updatedAt);
    await ensureFile(projectBaselinePath, projectBaselineContent);
    const projectInsightsPath = path.join(target.vaultPath, getProjectInsightsRelativePath(target.project.folderName));
    const existingInsights = await readUtf8(projectInsightsPath);
    const nextInsightsDocument = buildProjectInsightsDocument({
      space: target.space,
      project: {
        slug: target.project.slug,
        name: target.project.name,
        folderName: target.project.folderName,
        workspacePath: target.project.workspacePath,
        relativePath: target.project.relativePath,
      },
      updatedAt,
      entriesBody: extractProjectInsightsBody(existingInsights),
    });
    await ensureFile(projectInsightsPath, nextInsightsDocument);
    await ensureFile(
      path.join(target.vaultPath, getProjectGraphRelativePath(target.project.folderName)),
      JSON.stringify(buildProjectSourceGraphCanvas(target.project, capabilitySnapshot), null, 2) + '\n'
    );
  }

  private async syncSpaceOverview(space: TSpace, vaultPath: string): Promise<void> {
    const [projects, sessions] = await Promise.all([readProjectMetas(vaultPath), readSessionMetas(vaultPath)]);
    const updatedAt = nowIso();
    const homeContent = buildHomeDocument(space, projects, sessions, updatedAt);
    await ensureFile(path.join(vaultPath, 'Home.md'), homeContent);

    const canvas = buildSpaceCanvas(projects, sessions);
    await ensureFile(path.join(vaultPath, DEFAULT_SPACE_CANVAS_PATH), JSON.stringify(canvas, null, 2) + '\n');
  }

  private async listProjectSessionLinks(vaultPath: string, projectSlug: string): Promise<string[]> {
    const sessions = await readSessionMetas(vaultPath);
    return sessions.filter((session) => session.projectSlug === projectSlug).map((session) => session.relativePath);
  }

  private async touchSessionFrontmatter(
    target: ConversationContextTarget,
    conversation: TChatConversation,
    updatedAt: string,
    nextTimelineBody?: string
  ): Promise<void> {
    const paths = getConversationDocumentPaths(conversation.id, target.project?.folderName);
    const sessionPath = path.join(target.vaultPath, paths.sessionRelativePath);
    const existing = await readUtf8(path.join(target.vaultPath, toPosixRelativePath(paths.sessionRelativePath)));
    if (!existing) {
      return;
    }

    const record = parseFrontmatter(existing);
    const timelineBody = nextTimelineBody ?? extractSessionTimelineBody(existing);
    const nextDocument = buildSessionDocument(conversation, target.project, target.space, updatedAt, timelineBody);
    const nextFrontmatter = frontmatter({ ...record, updatedAt });
    await ensureFile(sessionPath, replaceFrontmatter(nextDocument, nextFrontmatter));
  }

  private async filterProjectConversations(
    conversations: readonly TChatConversation[],
    workspacePath: string
  ): Promise<TChatConversation[]> {
    const normalizedWorkspacePath = await normalizeWorkspaceDirectory(path.resolve(workspacePath));
    if (!normalizedWorkspacePath) {
      return [];
    }

    const matched = await Promise.all(
      conversations.map(async (conversation) => {
        const conversationWorkspace = conversation.extra?.workingDirectory || conversation.extra?.workspace;
        if (!conversationWorkspace?.trim()) {
          return undefined;
        }

        const normalizedConversationWorkspace = await normalizeWorkspaceDirectory(path.resolve(conversationWorkspace));
        if (normalizedConversationWorkspace !== normalizedWorkspacePath) {
          return undefined;
        }

        return conversation;
      })
    );

    return matched.filter((conversation): conversation is TChatConversation => Boolean(conversation));
  }
}
