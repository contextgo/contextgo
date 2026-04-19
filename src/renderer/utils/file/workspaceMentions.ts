/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { FileOrFolderItem } from '@/renderer/utils/file/fileTypes';

export type WorkspaceMentionItem = FileOrFolderItem & {
  isFile: true;
  relativePath: string;
};

export type ActiveWorkspaceMention = {
  start: number;
  end: number;
  rawQuery: string;
};

const ACTIVE_MENTION_REGEX = /(^|\s)@([^\s@]*)$/;
const TYPED_WORKSPACE_MENTION_REGEX = /(?:^|\s)@workspace\/([^\s]+)/g;

const normalizeSlashes = (value: string): string => value.replaceAll('\\', '/');

export const normalizeWorkspaceMentionQuery = (value: string): string => {
  const normalized = normalizeSlashes(value.trim())
    .replace(/^workspace\//i, '')
    .replace(/^\/+/, '');
  return normalized.toLowerCase();
};

const normalizeRelativePath = (value?: string): string =>
  normalizeSlashes(value || '')
    .replace(/^\/+/, '')
    .toLowerCase();

const getRelativePath = (item: WorkspaceMentionItem): string => normalizeRelativePath(item.relativePath);

const getBasename = (item: WorkspaceMentionItem): string => item.name.trim().toLowerCase();

export const findActiveWorkspaceMention = (input: string, cursor: number): ActiveWorkspaceMention | null => {
  const safeCursor = Math.max(0, Math.min(cursor, input.length));
  const beforeCursor = input.slice(0, safeCursor);
  const match = beforeCursor.match(ACTIVE_MENTION_REGEX);

  if (!match) {
    return null;
  }

  const rawQuery = match[2] ?? '';
  const start = beforeCursor.length - rawQuery.length - 1;

  return {
    start,
    end: safeCursor,
    rawQuery,
  };
};

export const formatWorkspaceMention = (item: WorkspaceMentionItem): string => `@workspace/${item.relativePath}`;

export const replaceActiveWorkspaceMention = (
  input: string,
  mention: ActiveWorkspaceMention,
  item: WorkspaceMentionItem
): {
  value: string;
  selectionStart: number;
} => {
  const mentionText = formatWorkspaceMention(item);
  const suffix = input.slice(mention.end);
  const separator = suffix.startsWith(' ') ? '' : ' ';
  const value = `${input.slice(0, mention.start)}${mentionText}${separator}${suffix}`;
  const selectionStart = mention.start + mentionText.length + separator.length;

  return {
    value,
    selectionStart,
  };
};

export const matchWorkspaceMentionItems = (
  items: WorkspaceMentionItem[],
  rawQuery: string,
  limit = 8
): WorkspaceMentionItem[] => {
  const normalizedQuery = normalizeWorkspaceMentionQuery(rawQuery);
  const hasDirectoryHint = normalizedQuery.includes('/');
  const lastSegment = normalizedQuery.split('/').pop() || normalizedQuery;

  const ranked = items
    .map((item) => {
      const relativePath = getRelativePath(item);
      const basename = getBasename(item);

      let score = 0;

      if (!normalizedQuery) {
        score = 1;
      } else if (hasDirectoryHint) {
        if (relativePath === normalizedQuery) {
          score = 600;
        } else if (relativePath.startsWith(`${normalizedQuery}/`)) {
          score = 500;
        } else if (relativePath.includes(normalizedQuery)) {
          score = 400;
        } else if (basename === lastSegment) {
          score = 300;
        } else if (basename.includes(lastSegment)) {
          score = 200;
        }
      } else if (basename === normalizedQuery) {
        score = 500;
      } else if (basename.startsWith(normalizedQuery)) {
        score = 450;
      } else if (basename.includes(normalizedQuery)) {
        score = 400;
      } else if (relativePath === normalizedQuery) {
        score = 350;
      } else if (relativePath.includes(normalizedQuery)) {
        score = 250;
      }

      return {
        item,
        score,
        relativePath,
      };
    })
    .filter((entry) => entry.score > 0)
    .toSorted((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }
      if (left.relativePath.length !== right.relativePath.length) {
        return left.relativePath.length - right.relativePath.length;
      }
      return left.relativePath.localeCompare(right.relativePath);
    });

  return ranked.slice(0, limit).map((entry) => entry.item);
};

export const resolveExactWorkspaceMentionItems = (
  input: string,
  items: WorkspaceMentionItem[]
): WorkspaceMentionItem[] => {
  const seenPaths = new Set<string>();
  const resolved: WorkspaceMentionItem[] = [];

  let match: RegExpExecArray | null;
  while ((match = TYPED_WORKSPACE_MENTION_REGEX.exec(input)) !== null) {
    const normalizedTarget = normalizeWorkspaceMentionQuery(match[1] ?? '');
    if (!normalizedTarget) {
      continue;
    }

    let resolvedItem: WorkspaceMentionItem | undefined;

    const exactRelativePathMatch = items.find((item) => getRelativePath(item) === normalizedTarget);
    if (exactRelativePathMatch) {
      resolvedItem = exactRelativePathMatch;
    } else if (!normalizedTarget.includes('/')) {
      const basenameMatches = items.filter((item) => getBasename(item) === normalizedTarget);
      if (basenameMatches.length === 1) {
        resolvedItem = basenameMatches[0];
      }
    }

    if (!resolvedItem || seenPaths.has(resolvedItem.path)) {
      continue;
    }

    seenPaths.add(resolvedItem.path);
    resolved.push(resolvedItem);
  }

  return resolved;
};
