/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PlanUpdate } from '@/common/types/acpTypes';

export type CodexRuntimePlanEntry = PlanUpdate['update']['entries'][number];

const PLAN_TOOL_NAME_PATTERN = /^(?:update[_-]?plan|todo(?:[_-]?write)?|todowrite)$/i;
const PLAN_CONTAINER_KEYS = ['entries', 'steps', 'plan', 'items', 'todos', 'tasks'] as const;
const WRAPPER_KEYS = ['arguments', 'args', 'input', 'result', 'data', 'payload', 'value', 'Ok', 'ok'] as const;
const CONTENT_KEYS = ['content', 'title', 'step', 'task', 'description', 'name', 'label', 'summary'] as const;
const STATUS_KEYS = ['status', 'state'] as const;

const STATUS_ALIASES: Record<string, CodexRuntimePlanEntry['status']> = {
  pending: 'pending',
  todo: 'pending',
  planned: 'pending',
  open: 'pending',
  queued: 'pending',
  in_progress: 'in_progress',
  'in-progress': 'in_progress',
  'in progress': 'in_progress',
  active: 'in_progress',
  current: 'in_progress',
  running: 'in_progress',
  working: 'in_progress',
  completed: 'completed',
  complete: 'completed',
  done: 'completed',
  finished: 'completed',
  success: 'completed',
  successful: 'completed',
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const getStringField = (source: Record<string, unknown>, keys: readonly string[]): string | null => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
};

const normalizeStatus = (source: Record<string, unknown>): CodexRuntimePlanEntry['status'] => {
  for (const key of STATUS_KEYS) {
    const rawStatus = source[key];
    if (typeof rawStatus !== 'string') {
      continue;
    }

    const normalized = rawStatus.trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (normalized in STATUS_ALIASES) {
      return STATUS_ALIASES[normalized];
    }
  }

  if (source.completed === true || source.done === true || source.checked === true) {
    return 'completed';
  }

  if (
    source.current === true ||
    source.active === true ||
    source.in_progress === true ||
    source.inProgress === true ||
    source.executing === true
  ) {
    return 'in_progress';
  }

  return 'pending';
};

const isPlanEntryLike = (value: unknown): value is Record<string, unknown> => {
  if (!isRecord(value) || Array.isArray(value)) {
    return false;
  }

  return (
    CONTENT_KEYS.some((key) => typeof value[key] === 'string' && value[key].trim()) ||
    STATUS_KEYS.some((key) => typeof value[key] === 'string' && value[key].trim()) ||
    value.completed === true ||
    value.done === true ||
    value.checked === true ||
    value.current === true ||
    value.active === true ||
    value.in_progress === true ||
    value.inProgress === true ||
    value.executing === true
  );
};

const toPlanEntry = (value: unknown, allowStringEntry: boolean): CodexRuntimePlanEntry | null => {
  if (typeof value === 'string') {
    const content = value.trim();
    return allowStringEntry && content ? { content, status: 'pending' } : null;
  }

  if (!isPlanEntryLike(value)) {
    return null;
  }

  const content = getStringField(value, CONTENT_KEYS);
  if (!content) {
    return null;
  }

  return {
    content,
    status: normalizeStatus(value),
  };
};

const extractFromArray = (value: unknown[], allowStringEntry: boolean): CodexRuntimePlanEntry[] => {
  const entries = value
    .map((item) => toPlanEntry(item, allowStringEntry))
    .filter((item): item is CodexRuntimePlanEntry => item !== null);

  if (!entries.length) {
    return [];
  }

  if (!allowStringEntry && entries.length !== value.length) {
    return [];
  }

  return entries;
};

const extractFromValue = (value: unknown, depth = 0, allowStringEntry = false): CodexRuntimePlanEntry[] => {
  if (depth > 4 || value == null) {
    return [];
  }

  if (Array.isArray(value)) {
    return extractFromArray(value, allowStringEntry);
  }

  if (!isRecord(value)) {
    return [];
  }

  for (const key of PLAN_CONTAINER_KEYS) {
    if (!(key in value)) {
      continue;
    }

    const entries = extractFromValue(value[key], depth + 1, true);
    if (entries.length) {
      return entries;
    }
  }

  for (const key of WRAPPER_KEYS) {
    if (!(key in value)) {
      continue;
    }

    const entries = extractFromValue(value[key], depth + 1, false);
    if (entries.length) {
      return entries;
    }
  }

  return [];
};

export const isCodexRuntimePlanTool = (toolName?: string | null): boolean => {
  return PLAN_TOOL_NAME_PATTERN.test((toolName || '').trim());
};

export const extractCodexRuntimePlanEntries = (value: unknown): CodexRuntimePlanEntry[] => {
  return extractFromValue(value);
};
