/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

export const HOOK_EVENT_TYPES = [
  'session_start',
  'before_user_prompt',
  'after_user_prompt',
  'before_tool_use',
  'after_tool_use',
  'before_response',
  'after_response',
  'session_end',
  'notification',
] as const;

export type HookEventType = (typeof HOOK_EVENT_TYPES)[number];

export const HOOK_CATEGORIES = ['clarity', 'quality', 'safety', 'continuity', 'operations'] as const;

export type HookCategory = (typeof HOOK_CATEGORIES)[number];

export const HOOK_EXECUTION_TYPES = ['native-projection', 'shell', 'js', 'prompt-transform', 'notify'] as const;

export type HookExecutionType = (typeof HOOK_EXECUTION_TYPES)[number];

export const HOOK_OUTPUT_TARGETS = ['chat-message', 'system-notification', 'sidecar-file'] as const;

export type HookOutputTarget = (typeof HOOK_OUTPUT_TARGETS)[number];

export const HOOK_OUTPUT_BASE_DIRS = ['system-workdir', 'conversation-workspace'] as const;

export type HookOutputBaseDir = (typeof HOOK_OUTPUT_BASE_DIRS)[number];

export type HookOutputRoutingConfig = Pick<HookManifest, 'outputTargets' | 'notification' | 'outputFile'>;

const DEFAULT_HOOK_OUTPUT_TARGETS_BY_EXECUTION_TYPE: Partial<Record<HookExecutionType, HookOutputTarget[]>> = {
  'native-projection': ['chat-message'],
  notify: ['system-notification'],
};

const HOOK_RUNTIME_EVENT_SUPPORT: Partial<Record<HookExecutionType, HookEventType[]>> = {
  'native-projection': ['after_response'],
  'prompt-transform': ['before_user_prompt'],
};

export const isHookEventType = (value: string): value is HookEventType => {
  return HOOK_EVENT_TYPES.includes(value as HookEventType);
};

export const isHookOutputTarget = (value: string): value is HookOutputTarget => {
  return HOOK_OUTPUT_TARGETS.includes(value as HookOutputTarget);
};

export const isHookOutputBaseDir = (value: string): value is HookOutputBaseDir => {
  return HOOK_OUTPUT_BASE_DIRS.includes(value as HookOutputBaseDir);
};

export const supportsHookOutputRouting = (hook: Pick<HookManifest, 'executionType'>): boolean => {
  if (!hook.executionType) {
    return false;
  }

  return hook.executionType in DEFAULT_HOOK_OUTPUT_TARGETS_BY_EXECUTION_TYPE;
};

export const getHookOutputTargets = (
  hook: Pick<HookManifest, 'executionType' | 'outputTargets'>
): HookOutputTarget[] => {
  const configuredTargets = Array.isArray(hook.outputTargets)
    ? hook.outputTargets.map((value) => `${value}`.trim()).filter(isHookOutputTarget)
    : [];

  if (configuredTargets.length > 0) {
    return [...new Set(configuredTargets)];
  }

  if (!hook.executionType) {
    return [];
  }

  return [...(DEFAULT_HOOK_OUTPUT_TARGETS_BY_EXECUTION_TYPE[hook.executionType] || [])];
};

export const getRunnableHookEvents = (hook: Pick<HookManifest, 'executionType' | 'events'>): HookEventType[] => {
  const configuredEvents = Array.isArray(hook.events) ? hook.events.filter(isHookEventType) : [];
  if (configuredEvents.length === 0 || !hook.executionType) {
    return [];
  }

  const supportedEvents = HOOK_RUNTIME_EVENT_SUPPORT[hook.executionType] || [];
  if (supportedEvents.length === 0) {
    return [];
  }

  return [...new Set(configuredEvents.filter((eventName) => supportedEvents.includes(eventName)))];
};

export type HookManifest = {
  name: string;
  description?: string;
  version?: string;
  executionType?: HookExecutionType;
  events?: HookEventType[];
  category?: HookCategory;
  tags?: string[];
  supportedBackends?: string[];
  outputTargets?: HookOutputTarget[];
  notification?: {
    title?: string;
    body?: string;
  };
  outputFile?: {
    baseDir?: HookOutputBaseDir;
    relativeDir?: string;
    fileBaseName?: string;
  };
};

export type HookInfo = HookManifest & {
  location: string;
  isCustom: boolean;
  isBuiltinInstalled?: boolean;
  runnableEvents?: HookEventType[];
};
