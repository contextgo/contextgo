/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { TBrowserContextAsset, TChatConversation } from '@/common/config/storage';
import { usePreviewActions } from '@/renderer/pages/conversation/Preview';
import { iconColors } from '@/renderer/styles/colors';
import { Button, Message, Tooltip } from '@arco-design/web-react';
import { Search } from '@icon-park/react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

const readBrowserContextStartUrl = (asset: TBrowserContextAsset): string | undefined => {
  const candidates = [asset.metadata?.startUrl, asset.metadata?.homeUrl, asset.metadata?.url];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') {
      continue;
    }

    const value = candidate.trim();
    if (!value) {
      continue;
    }

    try {
      const parsed = new URL(value);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return value;
      }
    } catch {
      continue;
    }
  }

  return undefined;
};

const getBrowserContextAssetId = (conversation: TChatConversation): string | undefined => {
  if (!conversation.extra || typeof conversation.extra !== 'object') {
    return undefined;
  }

  const maybeAssetId = (conversation.extra as { browserContextAssetId?: string }).browserContextAssetId;
  return typeof maybeAssetId === 'string' && maybeAssetId.trim() ? maybeAssetId : undefined;
};

const ConversationBrowserContextButton: React.FC<{ conversation: TChatConversation }> = ({ conversation }) => {
  const { t } = useTranslation();
  const { openPreview } = usePreviewActions();
  const [loading, setLoading] = useState(false);
  const browserContextAssetId = useMemo(() => getBrowserContextAssetId(conversation), [conversation]);

  const handleOpenBrowserContext = useCallback(async () => {
    if (!browserContextAssetId) {
      return;
    }

    setLoading(true);
    try {
      const result = await ipcBridge.browserContext.get.invoke({ id: browserContextAssetId });
      if (!result.success || !result.data) {
        throw new Error(result.msg || t('conversation.browser.openFailed'));
      }

      const startUrl = readBrowserContextStartUrl(result.data);
      if (!startUrl) {
        Message.error(t('conversation.browser.missingHomeUrl'));
        return;
      }

      openPreview(startUrl, 'url', {
        title:
          result.data.label ||
          t('conversation.browser.conversationLabel', {
            name: conversation.name || t('conversation.browser.defaultLabel'),
          }),
        browserContextAssetId: result.data.id,
      });
    } catch (error) {
      Message.error(error instanceof Error ? error.message : t('conversation.browser.openFailed'));
    } finally {
      setLoading(false);
    }
  }, [browserContextAssetId, conversation.name, openPreview, t]);

  if (!browserContextAssetId) {
    return null;
  }

  return (
    <Tooltip content={t('conversation.browser.open')}>
      <Button
        type='text'
        size='small'
        className='app-header-pill-button chat-header-publish-pill !h-auto !w-auto !min-w-0'
        loading={loading}
        aria-label={t('conversation.browser.open')}
        onClick={() => void handleOpenBrowserContext()}
      >
        <span className='app-header-pill'>
          <span className='app-header-pill__icon'>
            <Search theme='outline' size={16} fill={iconColors.primary} />
          </span>
          <span className='hidden md:inline text-12px text-t-primary'>{t('conversation.browser.open')}</span>
        </span>
      </Button>
    </Tooltip>
  );
};

export default ConversationBrowserContextButton;
