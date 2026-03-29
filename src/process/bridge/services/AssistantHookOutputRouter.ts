/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IResponseMessage } from '@/common/adapter/ipcBridge';
import type { IMessageTipsAction } from '@/common/chat/chatLib';
import type { HookManifest, HookOutputTarget } from '@/common/types/hookTypes';
import { getHookOutputTargets } from '@/common/types/hookTypes';
import { uuid } from '@/common/utils';
import { showNotification } from '@process/bridge/notificationBridge';
import i18n from '@process/services/i18n';
import { getSystemDir } from '@process/utils/initStorage';
import { addMessage } from '@process/utils/message';
import fs from 'fs/promises';
import path from 'path';

export type AfterResponseOutputMetadata = {
  conversationId: string;
  conversationName: string;
  workspace: string;
  backend: string;
  sourceMessageId: string;
  userRequest: string;
  finalResponse: string;
  finalResponseExcerpt: string;
  assistantTurnSummary: string;
  toolCount: number;
  toolNames: string[];
  generatedAt: string;
  content: string;
};

export type AfterResponseHookDelivery = {
  hookName: string;
  manifest: HookManifest;
  content: string;
  templateValues: Record<string, string>;
  metadata: AfterResponseOutputMetadata;
};

type AfterResponseRoutingResult = {
  deliveredHooks: string[];
  chatHooks: string[];
  notificationHooks: string[];
  sidecarHooks: string[];
};

type SidecarOutputPaths = {
  markdownPath: string;
  jsonPath: string;
};

const renderTemplate = (template: string, values: Record<string, string>): string => {
  let rendered = template;

  for (const [key, value] of Object.entries(values)) {
    rendered = rendered.split(`{{${key}}}`).join(value);
  }

  return rendered;
};

const sanitizePathSegment = (value: string, fallback: string): string => {
  const normalized = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || fallback;
};

const stripMarkdown = (content: string): string => {
  return content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_`>|-]/g, ' ')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
};

const escapeHtml = (content: string): string => {
  return content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

const isPathWithinRoot = (rootDir: string, targetDir: string): boolean => {
  const relativePath = path.relative(rootDir, targetDir);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
};

export class AssistantHookOutputRouter {
  async routeAfterResponseHooks(
    deliveries: AfterResponseHookDelivery[],
    onEmit: (message: IResponseMessage) => void = () => {}
  ): Promise<AfterResponseRoutingResult> {
    const result: AfterResponseRoutingResult = {
      deliveredHooks: [],
      chatHooks: [],
      notificationHooks: [],
      sidecarHooks: [],
    };

    for (const delivery of deliveries) {
      const targets = this.getOutputTargets(delivery.manifest);
      let delivered = false;

      if (targets.includes('chat-message')) {
        try {
          this.emitChatMessage(delivery, onEmit);
          result.chatHooks.push(delivery.hookName);
          delivered = true;
        } catch (error) {
          console.warn('[AssistantHookOutputRouter] Failed chat-message delivery:', delivery.hookName, error);
        }
      }

      if (targets.includes('system-notification')) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await this.sendSystemNotification(delivery);
          result.notificationHooks.push(delivery.hookName);
          delivered = true;
        } catch (error) {
          console.warn('[AssistantHookOutputRouter] Failed system-notification delivery:', delivery.hookName, error);
        }
      }

      if (targets.includes('sidecar-file')) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const sidecarPaths = await this.writeSidecarFiles(delivery);
          result.sidecarHooks.push(delivery.hookName);
          delivered = true;
          this.emitSidecarExportTip(delivery, sidecarPaths, onEmit);
        } catch (error) {
          console.warn('[AssistantHookOutputRouter] Failed sidecar-file delivery:', delivery.hookName, error);
        }
      }

      if (delivered) {
        result.deliveredHooks.push(delivery.hookName);
      }
    }

    return result;
  }

  private getOutputTargets(manifest: HookManifest): HookOutputTarget[] {
    return getHookOutputTargets(manifest);
  }

  private emitChatMessage(delivery: AfterResponseHookDelivery, onEmit: (message: IResponseMessage) => void): void {
    const msgId = uuid();
    addMessage(delivery.metadata.conversationId, {
      id: msgId,
      msg_id: msgId,
      type: 'text',
      position: 'left',
      conversation_id: delivery.metadata.conversationId,
      content: { content: delivery.content },
      createdAt: Date.now(),
    });

    onEmit({
      type: 'content',
      conversation_id: delivery.metadata.conversationId,
      msg_id: msgId,
      data: { content: delivery.content },
    });
  }

  private emitSidecarExportTip(
    delivery: AfterResponseHookDelivery,
    sidecarPaths: SidecarOutputPaths,
    onEmit: (message: IResponseMessage) => void
  ): void {
    const msgId = uuid();
    const actions: IMessageTipsAction[] = [
      {
        label: i18n.t('agent.hooks.openMarkdown', {
          defaultValue: 'Open Markdown',
        }),
        action: 'open-file',
        path: sidecarPaths.markdownPath,
      },
      {
        label: i18n.t('agent.hooks.showInFolder', {
          defaultValue: 'Show In Folder',
        }),
        action: 'show-item-in-folder',
        path: sidecarPaths.markdownPath,
      },
    ];
    const content = [
      `${escapeHtml(
        i18n.t('agent.hooks.sidecarExported', {
          hookName: delivery.hookName,
          defaultValue: 'Sidecar files exported for {{hookName}}.',
        })
      )}`,
      `${escapeHtml(
        i18n.t('agent.hooks.markdownPath', {
          defaultValue: 'Markdown',
        })
      )}: <code>${escapeHtml(sidecarPaths.markdownPath)}</code>`,
      `${escapeHtml(
        i18n.t('agent.hooks.metadataPath', {
          defaultValue: 'Metadata',
        })
      )}: <code>${escapeHtml(sidecarPaths.jsonPath)}</code>`,
    ].join('<br/>');

    addMessage(delivery.metadata.conversationId, {
      id: msgId,
      msg_id: msgId,
      type: 'tips',
      position: 'center',
      conversation_id: delivery.metadata.conversationId,
      content: {
        content,
        type: 'success',
        actions,
      },
      createdAt: Date.now(),
      status: 'finish',
    });

    onEmit({
      type: 'tips',
      conversation_id: delivery.metadata.conversationId,
      msg_id: msgId,
      data: {
        content,
        type: 'success',
        actions,
      },
    });
  }

  private async sendSystemNotification(delivery: AfterResponseHookDelivery): Promise<void> {
    const defaultTitle = delivery.metadata.conversationName || delivery.hookName;
    const defaultBody = delivery.metadata.finalResponseExcerpt || stripMarkdown(delivery.content).slice(0, 240);

    const titleTemplate = delivery.manifest.notification?.title?.trim();
    const bodyTemplate = delivery.manifest.notification?.body?.trim();

    const title = titleTemplate ? renderTemplate(titleTemplate, delivery.templateValues).trim() : defaultTitle;
    const body = bodyTemplate ? renderTemplate(bodyTemplate, delivery.templateValues).trim() : defaultBody;

    if (!title || !body) {
      return;
    }

    await showNotification({
      title,
      body,
      conversationId: delivery.metadata.conversationId,
    });
  }

  private async writeSidecarFiles(delivery: AfterResponseHookDelivery): Promise<SidecarOutputPaths> {
    const baseDir = this.resolveOutputBaseDir(delivery);
    const relativeDirTemplate = delivery.manifest.outputFile?.relativeDir?.trim();
    const fileBaseNameTemplate = delivery.manifest.outputFile?.fileBaseName?.trim();

    const fallbackRelativeDir = path.join(
      'hook-outputs',
      sanitizePathSegment(delivery.metadata.conversationId, 'conversation'),
      sanitizePathSegment(delivery.hookName, 'hook')
    );
    const relativeDir = relativeDirTemplate
      ? renderTemplate(relativeDirTemplate, delivery.templateValues).trim()
      : fallbackRelativeDir;
    const targetDir = path.resolve(baseDir, relativeDir || fallbackRelativeDir);
    if (!isPathWithinRoot(baseDir, targetDir)) {
      throw new Error(`[AssistantHookOutputRouter] Unsafe sidecar output path for hook "${delivery.hookName}"`);
    }

    const fileBaseName = sanitizePathSegment(
      fileBaseNameTemplate ? renderTemplate(fileBaseNameTemplate, delivery.templateValues).trim() : 'latest',
      'latest'
    );
    const markdownPath = path.join(targetDir, `${fileBaseName}.md`);
    const jsonPath = path.join(targetDir, `${fileBaseName}.json`);

    await fs.mkdir(targetDir, { recursive: true });
    await Promise.all([
      fs.writeFile(markdownPath, delivery.content, 'utf-8'),
      fs.writeFile(jsonPath, JSON.stringify(delivery.metadata, null, 2), 'utf-8'),
    ]);

    return {
      markdownPath,
      jsonPath,
    };
  }

  private resolveOutputBaseDir(delivery: AfterResponseHookDelivery): string {
    const configuredBaseDir = delivery.manifest.outputFile?.baseDir;
    const workspace = delivery.metadata.workspace.trim();

    if (configuredBaseDir === 'conversation-workspace' && workspace) {
      return workspace;
    }

    return getSystemDir().workDir;
  }
}
