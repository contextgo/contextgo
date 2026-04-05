/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IResponseMessage } from '@/common/adapter/ipcBridge';
import type { IMessageText, TMessage } from '@/common/chat/chatLib';
import type { TChatConversation } from '@/common/config/storage';
import type { HookManifest } from '@/common/types/hookTypes';
import {
  AssistantHookOutputRouter,
  type AfterResponseHookDelivery,
} from '@process/bridge/services/AssistantHookOutputRouter';
import { getWorkspaceHookDir, resolveWorkspacePath } from '@process/bridge/services/workspaceAutomation';
import { getDatabase } from '@process/services/database';
import { getBuiltinHooksCopyDir, getHooksDir } from '@process/utils/initStorage';
import fs from 'fs/promises';
import path from 'path';

type HookRuntimeResult = {
  content: string;
  appliedHooks: string[];
};

type AfterResponseProjectionResult = {
  deliveries: AfterResponseHookDelivery[];
  appliedHooks: string[];
  sourceMessageId?: string;
};

type AfterResponseEmitResult = {
  appliedHooks: string[];
  emittedHooks: string[];
  sourceMessageId?: string;
};

type AfterResponseContext = {
  conversation: TChatConversation;
  sourceMessageId: string;
  backend: string;
  workspace: string;
  generatedAt: string;
  timestampCompact: string;
  userRequest: string;
  finalResponse: string;
  finalResponseExcerpt: string;
  assistantTurnSummary: string;
  toolCount: string;
  toolCountValue: number;
  toolNames: string;
  toolNamesList: string;
  toolNamesValue: string[];
};

const BEFORE_USER_PROMPT_EVENT = 'before_user_prompt';
const AFTER_RESPONSE_EVENT = 'after_response';
const SYSTEM_RESPONSE_PREFIX = '[System Response]';
const AFTER_RESPONSE_MESSAGE_LIMIT = 200;
const FINAL_RESPONSE_EXCERPT_LIMIT = 600;
const TIMESTAMP_COMPACT_PATTERN = /[-:.]/g;

const renderTemplate = (template: string, values: Record<string, string>): string => {
  let rendered = template;

  for (const [key, value] of Object.entries(values)) {
    rendered = rendered.split(`{{${key}}}`).join(value);
  }

  return rendered;
};

const getConversationExtra = (conversation: TChatConversation): Record<string, unknown> => {
  return (conversation.extra || {}) as Record<string, unknown>;
};

const getConversationWorkspace = (conversation: TChatConversation): string | undefined => {
  const extra = getConversationExtra(conversation);
  const workingDirectory = typeof extra.workingDirectory === 'string' ? extra.workingDirectory : undefined;
  const workspace = typeof extra.workspace === 'string' ? extra.workspace : undefined;
  return resolveWorkspacePath(workingDirectory || workspace);
};

const getEnabledHooks = (conversation: TChatConversation): string[] => {
  const enabledHooks = getConversationExtra(conversation).enabledHooks;
  if (!Array.isArray(enabledHooks)) return [];

  return enabledHooks
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);
};

const isSafeHookName = (hookName: string): boolean => {
  const trimmed = hookName.trim();
  return trimmed.length > 0 && path.basename(trimmed) === trimmed;
};

const resolveBackend = (conversation: TChatConversation): string => {
  const extra = getConversationExtra(conversation);

  switch (conversation.type) {
    case 'acp':
      return typeof extra.backend === 'string' ? extra.backend : 'acp';
    case 'openclaw-gateway':
      return typeof extra.backend === 'string' ? extra.backend : 'openclaw-gateway';
    default:
      return conversation.type;
  }
};

const isTextMessage = (message: TMessage): message is IMessageText => message.type === 'text';

const isAssistantTextMessage = (message: TMessage): message is IMessageText => {
  return isTextMessage(message) && message.position === 'left' && Boolean(message.content.content?.trim());
};

const isSyntheticUserInput = (message: IMessageText): boolean => {
  return message.position === 'right' && message.content.content.trimStart().startsWith(SYSTEM_RESPONSE_PREFIX);
};

const truncateText = (input: string, maxLength: number): string => {
  const trimmed = input.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength).trimEnd()}...`;
};

const collectToolUsage = (messages: TMessage[]): { count: number; names: string[] } => {
  const names: string[] = [];
  let count = 0;

  const pushToolName = (rawName?: string): void => {
    const normalized = rawName?.trim();
    if (!normalized) return;
    if (!names.includes(normalized)) {
      names.push(normalized);
    }
  };

  for (const message of messages) {
    switch (message.type) {
      case 'tool_call': {
        count += 1;
        pushToolName(message.content.name);
        break;
      }
      case 'tool_group': {
        for (const toolCall of message.content) {
          count += 1;
          pushToolName(toolCall.name);
        }
        break;
      }
      case 'acp_tool_call': {
        count += 1;
        pushToolName(message.content.update.title || message.content.update.kind);
        break;
      }
      case 'codex_tool_call': {
        count += 1;
        pushToolName(message.content.title || message.content.kind || message.content.subtype);
        break;
      }
      default:
        break;
    }
  }

  return { count, names };
};

const buildAssistantTurnSummary = (toolCount: number, toolNames: string[]): string => {
  if (toolCount === 0) {
    return 'Completed without tool calls.';
  }

  const toolLabel = toolCount === 1 ? 'tool call' : 'tool calls';
  const toolList = toolNames.length > 0 ? toolNames.join(', ') : 'unspecified tools';
  return `Completed after ${toolCount} ${toolLabel}. Tools used: ${toolList}.`;
};

const toCompactTimestamp = (isoString: string): string => {
  return isoString.replace(TIMESTAMP_COMPACT_PATTERN, '').replace(/\d{3}Z$/, 'Z');
};

export class AssistantHookRuntime {
  private readonly outputRouter = new AssistantHookOutputRouter();

  async applyBeforeUserPrompt(conversation: TChatConversation, input: string): Promise<HookRuntimeResult> {
    const enabledHooks = [...new Set(getEnabledHooks(conversation))];
    if (enabledHooks.length === 0) {
      return { content: input, appliedHooks: [] };
    }

    let content = input;
    const appliedHooks: string[] = [];

    for (const hookName of enabledHooks) {
      // Hooks execute in selection order so each transform can build on the previous output.
      // eslint-disable-next-line no-await-in-loop
      const transformed = await this.applyPromptTransformHook(conversation, hookName, content);
      if (!transformed) continue;

      content = transformed;
      appliedHooks.push(hookName);
    }

    return { content, appliedHooks };
  }

  async buildAfterResponseProjections(conversationId: string): Promise<AfterResponseProjectionResult> {
    const conversation = await this.readConversation(conversationId);
    if (!conversation) {
      return { deliveries: [], appliedHooks: [] };
    }

    const enabledHooks = [...new Set(getEnabledHooks(conversation))];
    if (enabledHooks.length === 0) {
      return { deliveries: [], appliedHooks: [] };
    }

    const context = await this.buildAfterResponseContext(conversation);
    if (!context) {
      return { deliveries: [], appliedHooks: [] };
    }

    const deliveries: AfterResponseHookDelivery[] = [];
    const appliedHooks: string[] = [];

    for (const hookName of enabledHooks) {
      // Hooks execute in selection order so the output order stays predictable for operators.
      // eslint-disable-next-line no-await-in-loop
      const delivery = await this.buildAfterResponseDelivery(context, hookName);
      if (!delivery) continue;

      deliveries.push(delivery);
      appliedHooks.push(hookName);
    }

    return {
      deliveries,
      appliedHooks,
      sourceMessageId: context.sourceMessageId,
    };
  }

  async emitAfterResponse(
    conversationId: string,
    onEmit: (message: IResponseMessage) => void = () => {}
  ): Promise<AfterResponseEmitResult> {
    const result = await this.buildAfterResponseProjections(conversationId);
    const routed = await this.outputRouter.routeAfterResponseHooks(result.deliveries, onEmit);

    return {
      appliedHooks: result.appliedHooks,
      emittedHooks: routed.deliveredHooks,
      sourceMessageId: result.sourceMessageId,
    };
  }

  private async applyPromptTransformHook(
    conversation: TChatConversation,
    hookName: string,
    input: string
  ): Promise<string | null> {
    if (!isSafeHookName(hookName)) {
      console.warn(`[AssistantHookRuntime] Skip unsafe hook name: ${hookName}`);
      return null;
    }

    const hookDir = await this.resolveHookDir(conversation, hookName);
    if (!hookDir) return null;

    const manifest = await this.readHookManifest(hookDir);
    if (!manifest) return null;

    if (manifest.executionType !== 'prompt-transform') return null;
    if (!manifest.events?.includes(BEFORE_USER_PROMPT_EVENT)) return null;

    const backend = resolveBackend(conversation);
    if (
      Array.isArray(manifest.supportedBackends) &&
      manifest.supportedBackends.length > 0 &&
      !manifest.supportedBackends.includes(backend)
    ) {
      return null;
    }

    const template = await this.readEventTemplate(hookDir, BEFORE_USER_PROMPT_EVENT);
    if (!template) {
      console.warn(`[AssistantHookRuntime] Missing prompt template for hook: ${hookName}`);
      return null;
    }

    const extra = getConversationExtra(conversation);
    const rendered = renderTemplate(template, {
      userPrompt: input,
      conversationId: conversation.id,
      workspace: typeof extra.workspace === 'string' ? extra.workspace : '',
      agentType: backend,
      backend,
      hookName,
      timestamp: new Date().toISOString(),
    }).trim();

    if (!rendered) return null;

    if (template.includes('{{userPrompt}}')) {
      return rendered;
    }

    return `${rendered}\n\n[User Request]\n${input}`;
  }

  private async buildAfterResponseDelivery(
    context: AfterResponseContext,
    hookName: string
  ): Promise<AfterResponseHookDelivery | null> {
    if (!isSafeHookName(hookName)) {
      console.warn(`[AssistantHookRuntime] Skip unsafe hook name: ${hookName}`);
      return null;
    }

    const hookDir = await this.resolveHookDir(context.conversation, hookName);
    if (!hookDir) return null;

    const manifest = await this.readHookManifest(hookDir);
    if (!manifest) return null;

    if (manifest.executionType !== 'native-projection') return null;
    if (!manifest.events?.includes(AFTER_RESPONSE_EVENT)) return null;

    if (
      Array.isArray(manifest.supportedBackends) &&
      manifest.supportedBackends.length > 0 &&
      !manifest.supportedBackends.includes(context.backend)
    ) {
      return null;
    }

    const template = await this.readEventTemplate(hookDir, AFTER_RESPONSE_EVENT);
    if (!template) {
      console.warn(`[AssistantHookRuntime] Missing after_response template for hook: ${hookName}`);
      return null;
    }

    const templateValues = this.buildAfterResponseTemplateValues(context, hookName);
    const rendered = renderTemplate(template, templateValues).trim();

    if (!rendered) {
      return null;
    }

    return {
      hookName,
      manifest,
      content: rendered,
      templateValues,
      metadata: {
        conversationId: context.conversation.id,
        conversationName: context.conversation.name,
        workspace: context.workspace,
        backend: context.backend,
        sourceMessageId: context.sourceMessageId,
        userRequest: context.userRequest,
        finalResponse: context.finalResponse,
        finalResponseExcerpt: context.finalResponseExcerpt,
        assistantTurnSummary: context.assistantTurnSummary,
        toolCount: context.toolCountValue,
        toolNames: context.toolNamesValue,
        generatedAt: context.generatedAt,
        content: rendered,
      },
    };
  }

  private buildAfterResponseTemplateValues(context: AfterResponseContext, hookName: string): Record<string, string> {
    return {
      userRequest: context.userRequest,
      finalResponse: context.finalResponse,
      finalResponseExcerpt: context.finalResponseExcerpt,
      assistantTurnSummary: context.assistantTurnSummary,
      toolCount: context.toolCount,
      toolNames: context.toolNames,
      toolNamesList: context.toolNamesList,
      conversationId: context.conversation.id,
      conversationName: context.conversation.name,
      sourceMessageId: context.sourceMessageId,
      workspace: context.workspace,
      backend: context.backend,
      agentType: context.backend,
      hookName,
      timestamp: context.generatedAt,
      timestampCompact: context.timestampCompact,
    };
  }

  private async readConversation(conversationId: string): Promise<TChatConversation | null> {
    try {
      const db = await getDatabase();
      const result = db.getConversation(conversationId);
      if (!result.success || !result.data) {
        return null;
      }

      return result.data;
    } catch {
      return null;
    }
  }

  private async buildAfterResponseContext(conversation: TChatConversation): Promise<AfterResponseContext | null> {
    try {
      const db = await getDatabase();
      const messages = db.getConversationMessages(conversation.id, 0, AFTER_RESPONSE_MESSAGE_LIMIT, 'ASC').data;

      let latestAssistantIndex = -1;
      for (let i = messages.length - 1; i >= 0; i -= 1) {
        if (isAssistantTextMessage(messages[i])) {
          latestAssistantIndex = i;
          break;
        }
      }

      if (latestAssistantIndex === -1) {
        return null;
      }

      const assistantMessage = messages[latestAssistantIndex] as IMessageText;
      const finalResponse = assistantMessage.content.content.trim();
      if (!finalResponse) {
        return null;
      }

      let userRequestIndex = -1;
      for (let i = latestAssistantIndex - 1; i >= 0; i -= 1) {
        const message = messages[i];
        if (!isTextMessage(message) || message.position !== 'right') {
          continue;
        }

        if (isSyntheticUserInput(message)) {
          continue;
        }

        userRequestIndex = i;
        break;
      }

      const userRequestMessage = userRequestIndex >= 0 ? messages[userRequestIndex] : null;
      const userRequest =
        userRequestMessage && isTextMessage(userRequestMessage) ? userRequestMessage.content.content.trim() : '';
      const turnStartIndex = userRequestIndex >= 0 ? userRequestIndex + 1 : 0;
      const turnMessages = messages.slice(turnStartIndex, latestAssistantIndex + 1);
      const { count, names } = collectToolUsage(turnMessages);
      const generatedAt = new Date().toISOString();
      const extra = getConversationExtra(conversation);
      const workspace = typeof extra.workspace === 'string' ? extra.workspace : '';
      const backend = resolveBackend(conversation);

      return {
        conversation,
        sourceMessageId: assistantMessage.msg_id || assistantMessage.id,
        backend,
        workspace,
        generatedAt,
        timestampCompact: toCompactTimestamp(generatedAt),
        userRequest,
        finalResponse,
        finalResponseExcerpt: truncateText(finalResponse, FINAL_RESPONSE_EXCERPT_LIMIT),
        assistantTurnSummary: buildAssistantTurnSummary(count, names),
        toolCount: String(count),
        toolCountValue: count,
        toolNames: names.length > 0 ? names.join(', ') : 'none',
        toolNamesList: names.length > 0 ? names.map((name) => `- ${name}`).join('\n') : '- none',
        toolNamesValue: names,
      };
    } catch {
      return null;
    }
  }

  private async resolveHookDir(conversation: TChatConversation, hookName: string): Promise<string | null> {
    const workspaceHookDir = getWorkspaceHookDir(getConversationWorkspace(conversation), hookName);
    const candidates = [
      workspaceHookDir,
      path.join(getHooksDir(), hookName),
      path.join(getBuiltinHooksCopyDir(), hookName),
    ].filter((candidate): candidate is string => typeof candidate === 'string');
    const results = await Promise.allSettled(
      candidates.map(async (candidate) => fs.access(candidate).then(() => candidate))
    );
    const matched = results.find((result): result is PromiseFulfilledResult<string> => result.status === 'fulfilled');
    return matched?.value || null;
  }

  private async readHookManifest(hookDir: string): Promise<HookManifest | null> {
    try {
      const content = await fs.readFile(path.join(hookDir, 'manifest.json'), 'utf-8');
      return JSON.parse(content) as HookManifest;
    } catch {
      return null;
    }
  }

  private async readEventTemplate(hookDir: string, eventName: string): Promise<string | null> {
    const [eventTemplate, defaultTemplate] = await Promise.allSettled([
      fs.readFile(path.join(hookDir, `${eventName}.md`), 'utf-8'),
      fs.readFile(path.join(hookDir, 'prompt.md'), 'utf-8'),
    ]);

    if (eventTemplate.status === 'fulfilled') {
      return eventTemplate.value;
    }

    if (defaultTemplate.status === 'fulfilled') {
      return defaultTemplate.value;
    }

    return null;
  }
}
