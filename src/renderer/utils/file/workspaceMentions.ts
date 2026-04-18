/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { FileOrFolderItem } from '@/renderer/utils/file/fileTypes';

const WORKSPACE_MENTION_BOUNDARY_RE = /[\s,;!?()[\]{}]/;
const WORKSPACE_MENTION_PREFIX = 'workspace/';

export type WorkspaceMentionQuery = {
  start: number;
  end: number;
  query: string;
  rawQuery: string;
  token: string;
};

const isBoundaryChar = (char: string): boolean => WORKSPACE_MENTION_BOUNDARY_RE.test(char);

const isEscaped = (value: string, index: number): boolean => {
  let backslashCount = 0;
  let cursor = index - 1;
  while (cursor >= 0 && value[cursor] === '\\') {
    backslashCount += 1;
    cursor -= 1;
  }
  return backslashCount % 2 === 1;
};

const unescapeWorkspaceMentionQuery = (value: string): string => value.replace(/\\(.)/g, '$1');

const normalizeWorkspaceMentionPath = (value: string): string => {
  return value.replace(/\\/g, '/').replace(/^\/+/, '');
};

const stripWorkspacePrefix = (value: string): string => {
  if (value.toLowerCase().startsWith(WORKSPACE_MENTION_PREFIX)) {
    return value.slice(WORKSPACE_MENTION_PREFIX.length);
  }
  if (value.toLowerCase() === 'workspace') {
    return '';
  }
  return value;
};

export const escapeWorkspaceMentionPath = (path: string): string => {
  return path.replace(/([\\\s,;!?()[\]{}])/g, '\\$1');
};

export const getActiveWorkspaceMentionQuery = (value: string, caretPosition: number): WorkspaceMentionQuery | null => {
  if (!value) {
    return null;
  }

  const safeCaret = Math.max(0, Math.min(caretPosition, value.length));
  let atIndex = -1;

  for (let index = safeCaret - 1; index >= 0; index -= 1) {
    const char = value[index];
    if (char === '@' && !isEscaped(value, index)) {
      const previousChar = index > 0 ? value[index - 1] : '';
      if (!previousChar || isBoundaryChar(previousChar)) {
        atIndex = index;
        break;
      }
    }

    if (isBoundaryChar(char) && !isEscaped(value, index)) {
      return null;
    }
  }

  if (atIndex === -1) {
    return null;
  }

  let tokenEnd = value.length;
  for (let index = atIndex + 1; index < value.length; index += 1) {
    const char = value[index];
    if (isBoundaryChar(char) && !isEscaped(value, index)) {
      tokenEnd = index;
      break;
    }
  }

  if (safeCaret < atIndex || safeCaret > tokenEnd) {
    return null;
  }

  const rawQuery = value.slice(atIndex + 1, tokenEnd);
  return {
    start: atIndex,
    end: tokenEnd,
    query: unescapeWorkspaceMentionQuery(rawQuery),
    rawQuery,
    token: value.slice(atIndex, tokenEnd),
  };
};

export const getAllWorkspaceMentionQueries = (value: string): WorkspaceMentionQuery[] => {
  if (!value) {
    return [];
  }

  const queries: WorkspaceMentionQuery[] = [];

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char !== '@' || isEscaped(value, index)) {
      continue;
    }

    const previousChar = index > 0 ? value[index - 1] : '';
    if (previousChar && !isBoundaryChar(previousChar)) {
      continue;
    }

    let tokenEnd = value.length;
    for (let cursor = index + 1; cursor < value.length; cursor += 1) {
      const nextChar = value[cursor];
      if (isBoundaryChar(nextChar) && !isEscaped(value, cursor)) {
        tokenEnd = cursor;
        break;
      }
    }

    const rawQuery = value.slice(index + 1, tokenEnd);
    queries.push({
      start: index,
      end: tokenEnd,
      query: unescapeWorkspaceMentionQuery(rawQuery),
      rawQuery,
      token: value.slice(index, tokenEnd),
    });

    index = tokenEnd - 1;
  }

  return queries;
};

export const buildWorkspaceMentionReference = (item: FileOrFolderItem): string => {
  const relativePath = normalizeWorkspaceMentionPath(item.relativePath?.trim() ? item.relativePath : item.name);
  return `${WORKSPACE_MENTION_PREFIX}${relativePath}`;
};

export const buildWorkspaceMentionInsertion = (item: FileOrFolderItem): string => {
  return `@${escapeWorkspaceMentionPath(buildWorkspaceMentionReference(item))}`;
};

export const getWorkspaceMentionOwnershipKeys = (item: string | FileOrFolderItem): string[] => {
  if (typeof item === 'string') {
    return [normalizeWorkspaceMentionPath(stripWorkspacePrefix(item).toLowerCase())];
  }

  const relativePath = normalizeWorkspaceMentionPath(
    item.relativePath?.trim() ? item.relativePath : item.name
  ).toLowerCase();
  return [buildWorkspaceMentionReference(item).toLowerCase(), relativePath];
};

const getWorkspaceMentionMatchScore = (item: FileOrFolderItem, query: string): number | null => {
  const relativePath = normalizeWorkspaceMentionPath(item.relativePath || item.name).toLowerCase();
  const name = item.name.toLowerCase();

  if (name === query) {
    return 0;
  }

  if (name.startsWith(query)) {
    return 1;
  }

  if (relativePath === query) {
    return 2;
  }

  if (relativePath.startsWith(query)) {
    return 3;
  }

  if (name.includes(query)) {
    return 4;
  }

  if (relativePath.includes(query)) {
    return 5;
  }

  return null;
};

export const filterWorkspaceMentionItems = (
  items: FileOrFolderItem[],
  query: string,
  limit = 50
): FileOrFolderItem[] => {
  const normalizedQuery = normalizeWorkspaceMentionPath(stripWorkspacePrefix(query).toLowerCase());

  const filtered = normalizedQuery
    ? items
        .map((item) => {
          const score = getWorkspaceMentionMatchScore(item, normalizedQuery);
          if (score === null) {
            return null;
          }

          return {
            item,
            score,
            relativePath: normalizeWorkspaceMentionPath(item.relativePath || item.name).toLowerCase(),
          };
        })
        .filter((entry): entry is { item: FileOrFolderItem; score: number; relativePath: string } => entry !== null)
        .toSorted((left, right) => {
          if (left.score !== right.score) {
            return left.score - right.score;
          }

          if (left.relativePath.length !== right.relativePath.length) {
            return left.relativePath.length - right.relativePath.length;
          }

          return left.relativePath.localeCompare(right.relativePath);
        })
        .map((entry) => entry.item)
    : items;

  return filtered.slice(0, limit);
};
