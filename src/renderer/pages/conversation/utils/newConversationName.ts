/**
 * @license
 * Copyright 2026 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Force new-session entry points to start from the localized default title.
 */
export function applyDefaultConversationName<T extends object>(
  conversation: T,
  defaultName: string
): Omit<T, 'name'> & { name: string } {
  return {
    ...conversation,
    name: defaultName,
  };
}

const DEFAULT_CONVERSATION_TITLE_MAX_LENGTH = 50;

const RUNTIME_NAME_PATTERN = /^(claude|codex|gemini|opencode)$/i;
const DURATION_LINE_PATTERN =
  /^(?:\d+\s*(?:ms|s|sec|secs|m|min|mins|h|hr|hrs|d))(?:\s+\d+\s*(?:ms|s|sec|secs|m|min|mins|h|hr|hrs|d))*$/i;
const CONTROL_MARKER_PATTERN = /^\[[A-Z0-9_/-]+\]$/;
const STATUS_LINE_PATTERN =
  /^(preparing|ready|running|thinking|waiting|queued|starting|loading|done|completed|stopped|idle|准备中|已就绪|运行中|执行中|思考中|等待中|排队中|启动中|加载中|已完成|已停止|空闲)$/i;

const normalizeLine = (value: string): string =>
  value
    .trim()
    .replace(/^#{1,6}\s+/, '')
    .replace(/^>\s+/, '')
    .replace(/^[-*+]\s+/, '')
    .replace(/^\d+\.\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();

const isTechnicalTitleLine = (value: string): boolean => {
  if (!value) {
    return true;
  }

  return (
    CONTROL_MARKER_PATTERN.test(value) ||
    RUNTIME_NAME_PATTERN.test(value) ||
    DURATION_LINE_PATTERN.test(value) ||
    STATUS_LINE_PATTERN.test(value)
  );
};

const truncateTitle = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
};

/**
 * Normalize raw prompt-like text into a compact, human-readable conversation title.
 */
export function normalizeConversationTitle(
  rawTitle: string | null | undefined,
  options?: {
    fallbackTitle?: string;
    maxLength?: number;
  }
): string {
  const fallbackTitle = options?.fallbackTitle?.trim() || '';
  const maxLength = options?.maxLength ?? DEFAULT_CONVERSATION_TITLE_MAX_LENGTH;
  const source = typeof rawTitle === 'string' ? rawTitle : '';

  const normalizedLines = source
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => normalizeLine(line))
    .filter(Boolean);

  if (normalizedLines.length === 0) {
    return fallbackTitle;
  }

  const preferredLines = [...normalizedLines];
  while (preferredLines.length > 1 && isTechnicalTitleLine(preferredLines[0])) {
    preferredLines.shift();
  }

  const primaryLine =
    preferredLines.find((line) => !isTechnicalTitleLine(line)) ||
    normalizedLines.find((line) => !isTechnicalTitleLine(line)) ||
    (fallbackTitle ? '' : preferredLines[0] || normalizedLines[0] || '');

  const normalizedTitle = normalizeLine(primaryLine);
  if (!normalizedTitle) {
    return fallbackTitle;
  }

  return truncateTitle(normalizedTitle, maxLength);
}
