/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TMessage } from '@/common/chat/chatLib';
import { hasThinkTags, stripThinkTags } from './ThinkTagDetector';

/**
 * Result of processing an agent response
 */
export interface ProcessResult {
  /** Original message - save to database */
  message: TMessage;
  /** Cleaned message with schedule commands stripped - emit to UI */
  displayMessage?: TMessage;
  /** System response messages to append after agent response */
  systemResponses: string[];
}

/**
 * Process agent response before emitting to UI
 *
 * This middleware:
 * 1. Strips think tags from messages (e.g., <think>...</think>)
 * 2. Strips any model-only transport tags before the renderer sees the message
 * 4. Returns cleaned message for UI display
 *
 * @param conversationId - The conversation ID
 * @param agentType - The agent type (gemini, claude, codex, etc.)
 * @param message - The message to process
 * @returns ProcessResult with original message, display message, and system responses
 */
export async function processAgentResponse(
  _conversationId: string,
  _agentType: string,
  message: TMessage
): Promise<ProcessResult> {
  const systemResponses: string[] = [];

  // Only process completed messages
  // Skip if message is still streaming or pending
  if (message.status !== 'finish') {
    return { message, systemResponses };
  }

  // Extract text content from message
  const textContent = extractTextContent(message);
  if (!textContent) {
    return { message, systemResponses };
  }

  let displayContent = textContent;
  let needsDisplayMessage = false;

  // Strip think tags first (internal reasoning tags from models like MiniMax, DeepSeek, etc.)
  if (hasThinkTags(displayContent)) {
    displayContent = stripThinkTags(displayContent);
    needsDisplayMessage = true;
  }

  // Return cleaned message if any processing was done
  if (needsDisplayMessage) {
    const displayMessage = createDisplayMessage(message, displayContent);
    return {
      message, // Original for database
      displayMessage, // Cleaned for UI
      systemResponses,
    };
  }

  return { message, systemResponses };
}

/**
 * Extract text content from a TMessage for middleware processing
 * Exported for use by AgentManagers
 *
 * @param message - The message to extract text from
 * @returns The text content or empty string if not found
 */
export function extractTextFromMessage(message: TMessage): string {
  if (!message.content) {
    return '';
  }

  // Handle direct string content
  if (typeof message.content === 'string') {
    return message.content;
  }

  // Handle object content with 'content' property (most common case)
  if (typeof message.content === 'object' && 'content' in message.content) {
    const contentObj = message.content as { content?: string };
    return contentObj.content ?? '';
  }

  return '';
}

/**
 * Extract text content from a message (internal use)
 * Returns null for empty content to distinguish from empty string
 */
function extractTextContent(message: TMessage): string | null {
  const text = extractTextFromMessage(message);
  return text || null;
}

/**
 * Create a display message with modified content
 * Only modifies messages with { content: string } structure
 */
function createDisplayMessage(original: TMessage, newContent: string): TMessage {
  const content = original.content;

  // Only handle the common case: content is { content: string }
  if (typeof content === 'object' && content !== null && 'content' in content) {
    const contentObj = content as { content: string };
    if (typeof contentObj.content === 'string') {
      // Use type assertion to avoid complex union type issues
      const newContentObj = { ...content, content: newContent };
      return {
        ...original,
        content: newContentObj,
      } as TMessage;
    }
  }

  // For other content types, return original unchanged
  return original;
}

/**
 */
