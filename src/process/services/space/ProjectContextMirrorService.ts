/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'node:crypto';
import type { Dirent } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { TChatConversation } from '@/common/config/storage';
import type { ContextPackSection, SourceRecord } from '../../../../packages/context-engine/src/domain';
import type { ContextServiceImpl } from '../context/ContextServiceImpl';
import { createWorkspaceProjectSlug } from './SpaceVaultContextSyncService';
import { getProjectRelativePath } from './vaultLayout';

const PROJECTS_DIR = 'Projects';
const SOURCE_DIR = 'Sources';
const PROJECT_DOC_SPECS: ReadonlyArray<{ kind: 'baseline' | 'project' | 'insights'; tags: readonly string[] }> = [
  { kind: 'baseline', tags: ['project', 'baseline'] },
  { kind: 'project', tags: ['project', 'wiki'] },
  { kind: 'insights', tags: ['project', 'wiki'] },
];
const MAX_SOURCE_DOCS = 12;
const MAX_SOURCE_SCAN_DEPTH = 6;
const MAX_SOURCE_DOC_CHARS = 8_000;
const MAX_SECTION_CHARS = 1_200;

type ProjectContextDocument = {
  projectSlug: string;
  title: string;
  relativePath: string;
  absolutePath: string;
  content: string;
  tags: readonly string[];
};

type StableMirrorIds = {
  sourceId: string;
  documentId: string;
  artifactId: string;
  canonicalUri: string;
  checksum: string;
};

export type ProjectContextAssemblyOverlaySource = {
  overlaySource: 'project-context-mirror';
  projectSlug: string;
  projectSections: readonly ContextPackSection[];
  sourceSections: readonly ContextPackSection[];
  mountedSections: readonly ContextPackSection[];
};

export type ProjectContextSnapshot = {
  projectSlug: string;
  projectDocs: readonly ProjectContextDocument[];
  sourceDocs: readonly ProjectContextDocument[];
  assemblyOverlaySource?: ProjectContextAssemblyOverlaySource;
};

function normalizeText(value: string): string {
  return value.replace(/\r\n/g, '\n').trim();
}

function estimateTokenCount(value: string): number {
  const normalized = normalizeText(value);
  return normalized ? Math.max(1, Math.ceil(normalized.length / 4)) : 0;
}

function hashValue(value: string): string {
  return crypto.createHash('sha1').update(value).digest('hex').slice(0, 16);
}

function sanitizePathSegment(value: string): string {
  const normalized = value
    .normalize('NFKC')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/\.+$/g, '');

  return normalized || 'item';
}

function createProjectFolderName(workspacePath: string): string {
  return sanitizePathSegment(path.basename(workspacePath) || 'project');
}

function toTitleFromRelativePath(relativePath: string): string {
  return path.posix.basename(relativePath).replace(/\.(md|canvas)$/i, '');
}

function parseFrontmatter(content: string): Record<string, string> {
  if (!content.startsWith('---\n')) {
    return {};
  }

  const endIndex = content.indexOf('\n---\n', 4);
  if (endIndex === -1) {
    return {};
  }

  const block = content.slice(4, endIndex);
  const record: Record<string, string> = {};
  for (const line of block.split('\n')) {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (key && value) {
      record[key] = value.replace(/^(["'])(.*)\1$/, '$2');
    }
  }

  return record;
}

function extractDocumentTitle(content: string, fallback: string): string {
  const frontmatterTitle = parseFrontmatter(content).title?.trim();
  if (frontmatterTitle) {
    return frontmatterTitle;
  }

  const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return heading || fallback;
}

function createSectionId(prefix: string, relativePath: string): string {
  return `${prefix}:${relativePath.replace(/[^a-z0-9/_-]+/gi, '-').toLowerCase()}`;
}

function excerptMarkdown(content: string, limit: number): string {
  const normalized = normalizeText(content)
    .replace(/^---[\s\S]*?---\n?/m, '')
    .replace(/<!--.*?-->/g, '')
    .trim();

  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, limit).trimEnd()}...`;
}

function toMountedSection(
  doc: ProjectContextDocument,
  kind: 'profile' | 'source',
  priority: number
): ContextPackSection {
  const summary = excerptMarkdown(doc.content, MAX_SECTION_CHARS);
  const content = `${doc.title}\n${summary}`;
  return {
    kind,
    id: createSectionId(kind, doc.relativePath),
    summary: content,
    priority,
    tokenCount: estimateTokenCount(content),
  };
}

function createProjectContextAssemblyOverlaySource(snapshot: {
  projectSlug: string;
  projectDocs: readonly ProjectContextDocument[];
  sourceDocs: readonly ProjectContextDocument[];
}): ProjectContextAssemblyOverlaySource {
  const projectSections = snapshot.projectDocs.map((doc, index) => toMountedSection(doc, 'profile', 98 - index));
  const sourceSections = snapshot.sourceDocs
    .slice(0, 4)
    .map((doc, index) => toMountedSection(doc, 'source', 72 - index));

  return {
    overlaySource: 'project-context-mirror',
    projectSlug: snapshot.projectSlug,
    projectSections,
    sourceSections,
    mountedSections: [...projectSections, ...sourceSections],
  };
}

function createStableMirrorIds(projectSlug: string, relativePath: string, content: string): StableMirrorIds {
  const stableKey = `${projectSlug}:${relativePath}`;
  const hash = hashValue(stableKey);
  return {
    sourceId: `source-project-${hash}`,
    documentId: `doc-project-${hash}`,
    artifactId: stableKey,
    canonicalUri: `contextgo://vault/${relativePath}`,
    checksum: hashValue(content),
  };
}

async function readMarkdownDocument(
  absolutePath: string,
  relativePath: string,
  tags: readonly string[]
): Promise<ProjectContextDocument | undefined> {
  const content = await fs.readFile(absolutePath, 'utf8').catch((): undefined => undefined);
  if (!content) {
    return undefined;
  }

  return {
    projectSlug: '',
    title: extractDocumentTitle(content, toTitleFromRelativePath(relativePath)),
    relativePath,
    absolutePath,
    content,
    tags,
  };
}

async function readSourceDocuments(
  sourceFolder: string,
  projectFolderName: string,
  maxDocs = MAX_SOURCE_DOCS
): Promise<ProjectContextDocument[]> {
  const queue: Array<{ absolutePath: string; relativePath: string; depth: number }> = [
    { absolutePath: sourceFolder, relativePath: '', depth: 0 },
  ];
  const docs: ProjectContextDocument[] = [];

  while (queue.length > 0 && docs.length < maxDocs) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    const entries = await fs.readdir(current.absolutePath, { withFileTypes: true }).catch((): Dirent[] => []);
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      if (docs.length >= maxDocs) {
        break;
      }

      const nextRelativePath = current.relativePath ? path.posix.join(current.relativePath, entry.name) : entry.name;
      const nextAbsolutePath = path.join(current.absolutePath, entry.name);

      if (entry.isDirectory()) {
        if (current.depth + 1 > MAX_SOURCE_SCAN_DEPTH) {
          continue;
        }

        queue.push({
          absolutePath: nextAbsolutePath,
          relativePath: nextRelativePath,
          depth: current.depth + 1,
        });
        continue;
      }

      if (!entry.isFile() || !/\.md$/i.test(entry.name)) {
        continue;
      }

      const relativePath = path.posix.join(PROJECTS_DIR, projectFolderName, SOURCE_DIR, nextRelativePath);
      const doc = await readMarkdownDocument(nextAbsolutePath, relativePath, ['project', 'source']);
      if (!doc) {
        continue;
      }

      docs.push({
        ...doc,
        content: excerptMarkdown(doc.content, MAX_SOURCE_DOC_CHARS),
      });
    }
  }

  return docs;
}

export class ProjectContextMirrorService {
  constructor(
    private readonly contextService: Pick<
      ContextServiceImpl,
      'archiveSource' | 'indexTextDocument' | 'ingestSource' | 'listSources'
    >
  ) {}

  async syncProjectContext(input: {
    conversation: TChatConversation;
    spaceId: string;
    vaultPath: string;
  }): Promise<ProjectContextSnapshot | undefined> {
    const workspacePath = input.conversation.extra?.workingDirectory || input.conversation.extra?.workspace;
    if (!workspacePath?.trim()) {
      return undefined;
    }

    const projectSlug = createWorkspaceProjectSlug(workspacePath);
    const projectFolderName = createProjectFolderName(workspacePath);
    const projectFolder = path.join(input.vaultPath, PROJECTS_DIR, projectFolderName);
    const sourceFolder = path.join(projectFolder, SOURCE_DIR);

    const projectDocRelativePath = getProjectRelativePath(projectFolderName);
    const projectDocs = (
      await Promise.all(
        PROJECT_DOC_SPECS.map(async (spec): Promise<ProjectContextDocument | undefined> => {
          const relativePath =
            spec.kind === 'baseline'
              ? path.posix.join(PROJECTS_DIR, projectFolderName, '_context/baseline.md')
              : spec.kind === 'project'
                ? projectDocRelativePath
                : path.posix.join(PROJECTS_DIR, projectFolderName, 'Project Insights.md');
          const absolutePath = path.join(input.vaultPath, relativePath);
          const doc = await readMarkdownDocument(absolutePath, relativePath, spec.tags);
          return doc ? { ...doc, projectSlug } : undefined;
        })
      )
    )
      .filter((doc): doc is ProjectContextDocument => Boolean(doc))
      .toSorted((left, right) => {
        const leftScore = left.tags.includes('baseline') ? 0 : left.relativePath === projectDocRelativePath ? 1 : 2;
        const rightScore = right.tags.includes('baseline') ? 0 : right.relativePath === projectDocRelativePath ? 1 : 2;
        if (leftScore !== rightScore) {
          return leftScore - rightScore;
        }
        return left.relativePath.localeCompare(right.relativePath);
      });

    const sourceDocs = (await readSourceDocuments(sourceFolder, projectFolderName)).map((doc) => ({
      ...doc,
      projectSlug,
    }));

    const snapshot: ProjectContextSnapshot = {
      projectSlug,
      projectDocs,
      sourceDocs,
      assemblyOverlaySource: createProjectContextAssemblyOverlaySource({
        projectSlug,
        projectDocs,
        sourceDocs,
      }),
    };

    await this.persistSnapshot({
      spaceId: input.spaceId,
      projectSlug,
      docs: [...projectDocs, ...sourceDocs],
    });

    return snapshot;
  }

  buildAssemblyOverlaySource(
    snapshot: ProjectContextSnapshot | undefined
  ): ProjectContextAssemblyOverlaySource | undefined {
    if (!snapshot) {
      return undefined;
    }

    return (
      snapshot.assemblyOverlaySource ??
      createProjectContextAssemblyOverlaySource({
        projectSlug: snapshot.projectSlug,
        projectDocs: snapshot.projectDocs,
        sourceDocs: snapshot.sourceDocs,
      })
    );
  }

  buildMountedSections(snapshot: ProjectContextSnapshot | undefined): ContextPackSection[] {
    return (this.buildAssemblyOverlaySource(snapshot)?.mountedSections ?? []).map((section) => ({
      ...section,
    }));
  }

  private async persistSnapshot(input: {
    spaceId: string;
    projectSlug: string;
    docs: readonly ProjectContextDocument[];
  }): Promise<void> {
    const existingSources = await this.contextService.listSources(input.spaceId);
    const projectTag = `project:${input.projectSlug}`;
    const expectedArtifactIds = new Set(
      input.docs.map((doc) => createStableMirrorIds(input.projectSlug, doc.relativePath, doc.content).artifactId)
    );

    await this.archiveRemovedProjectSources(existingSources, projectTag, expectedArtifactIds);

    const existingById = new Map(existingSources.map((source) => [source.id, source]));
    for (const doc of input.docs) {
      const stableIds = createStableMirrorIds(input.projectSlug, doc.relativePath, doc.content);
      const existingSource = existingById.get(stableIds.sourceId);
      const createdAt = existingSource?.createdAt ?? new Date().toISOString();

      const source = await this.contextService.ingestSource({
        sourceId: stableIds.sourceId,
        spaceId: input.spaceId,
        kind: 'artifact',
        artifactId: stableIds.artifactId,
        title: doc.title,
        canonicalUri: stableIds.canonicalUri,
        checksum: stableIds.checksum,
        tags: [...doc.tags, projectTag],
        createdAt,
      });

      await this.contextService.indexTextDocument({
        documentId: stableIds.documentId,
        spaceId: input.spaceId,
        sourceId: source.source.id,
        title: doc.title,
        content: doc.content,
        tier: 'source',
        storageUri: stableIds.canonicalUri,
        checksum: stableIds.checksum,
        chunking: {
          targetTokens: 180,
          overlapTokens: 24,
          minTokens: 24,
        },
        vectorMetadata: {
          projectSlug: input.projectSlug,
          artifactId: stableIds.artifactId,
          canonicalUri: stableIds.canonicalUri,
          docRole: doc.tags.includes('source') ? 'source' : 'project',
        },
      });
    }
  }

  private async archiveRemovedProjectSources(
    existingSources: readonly SourceRecord[],
    projectTag: string,
    expectedArtifactIds: ReadonlySet<string>
  ): Promise<void> {
    const removableSources = existingSources.filter((source) => {
      if (!source.tags.includes(projectTag) || source.status === 'archived') {
        return false;
      }

      if (!source.artifactId) {
        return false;
      }

      return !expectedArtifactIds.has(source.artifactId);
    });

    for (const source of removableSources) {
      await this.contextService.archiveSource(source.id);
    }
  }
}
