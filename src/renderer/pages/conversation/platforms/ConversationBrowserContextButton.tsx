/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { TBrowserContextAsset, TChatConversation } from '@/common/config/storage';
import { ContextGoModal } from '@/renderer/components/base';
import type { PreviewMetadata } from '@/renderer/pages/conversation/Preview/context/PreviewContext';
import { iconColors } from '@/renderer/styles/colors';
import { Button, Input, Message, Tooltip } from '@arco-design/web-react';
import { Earth } from '@icon-park/react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

type BrowserContextDraft = {
  id?: string;
  label: string;
  metadata?: TBrowserContextAsset['metadata'];
};

type ConversationBrowserContextButtonProps = {
  conversation: TChatConversation;
  onOpenUrl: (url: string, metadata?: PreviewMetadata) => void;
};

const normalizeBrowserUrl = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('empty-url');
  }

  const value = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(value);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('unsupported-protocol');
  }
  return parsed.toString();
};

const getHomeUrl = (asset?: TBrowserContextAsset): string | undefined => {
  const homeUrl = asset?.metadata?.homeUrl;
  return typeof homeUrl === 'string' && homeUrl.trim() ? homeUrl.trim() : undefined;
};

const truncateBrowserLabel = (label: string): string => {
  const trimmed = label.trim();
  if (trimmed.length <= 28) {
    return trimmed;
  }

  return `${trimmed.slice(0, 27).trimEnd()}…`;
};

const getBrowserChipLabel = (assetLabel?: string): string => {
  return assetLabel ? `Browser: ${truncateBrowserLabel(assetLabel)}` : 'Browser';
};

const ConversationBrowserContextButton: React.FC<ConversationBrowserContextButtonProps> = ({
  conversation,
  onOpenUrl,
}) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [startUrl, setStartUrl] = useState('https://');
  const [draft, setDraft] = useState<BrowserContextDraft | null>(null);
  const [boundAssetId, setBoundAssetId] = useState(conversation.extra?.browserContextAssetId);
  const [boundAssetLabel, setBoundAssetLabel] = useState<string | null>(null);

  useEffect(() => {
    setBoundAssetId(conversation.extra?.browserContextAssetId);
  }, [conversation.extra?.browserContextAssetId]);

  useEffect(() => {
    if (!boundAssetId) {
      setBoundAssetLabel(null);
      return;
    }

    let cancelled = false;

    void ipcBridge.browserContext.get
      .invoke({ id: boundAssetId })
      .then((result) => {
        if (cancelled) {
          return;
        }

        setBoundAssetLabel(result.success && result.data?.label ? result.data.label : null);
      })
      .catch(() => {
        if (!cancelled) {
          setBoundAssetLabel(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [boundAssetId]);

  const defaultAssetLabel = useMemo(() => {
    const normalizedName = conversation.name.trim();
    if (!normalizedName) {
      return t('conversation.browser.defaultLabel');
    }
    return t('conversation.browser.conversationLabel', { name: normalizedName });
  }, [conversation.name, t]);

  const closeModal = useCallback(() => {
    setVisible(false);
    setStartUrl('https://');
    setDraft(null);
    setSubmitting(false);
  }, []);

  const openBrowserPreview = useCallback(
    (asset: TBrowserContextAsset, url: string, updateUsage = true) => {
      onOpenUrl(url, {
        title: asset.label,
        browserContextAssetId: asset.id,
      });

      if (!updateUsage) {
        return;
      }

      void ipcBridge.browserContext.update.invoke({
        id: asset.id,
        lastUsedAt: Date.now(),
      });
    },
    [onOpenUrl]
  );

  const handleOpenBrowser = useCallback(async () => {
    const spaceId = conversation.extra?.spaceId;
    if (!spaceId) {
      Message.warning(t('conversation.browser.missingSpace'));
      return;
    }

    if (!boundAssetId) {
      setDraft({
        label: defaultAssetLabel,
      });
      setStartUrl('https://');
      setVisible(true);
      return;
    }

    try {
      const bindableResponse = await ipcBridge.browserContext.assertBindable.invoke({
        id: boundAssetId,
        spaceId,
      });
      if (!bindableResponse.success || !bindableResponse.data) {
        Message.warning(bindableResponse.msg || t('conversation.browser.openFailed'));
        return;
      }

      const asset = bindableResponse.data;
      const homeUrl = getHomeUrl(asset);

      if (!homeUrl) {
        setDraft({
          id: asset.id,
          label: asset.label,
          metadata: asset.metadata,
        });
        setStartUrl('https://');
        setVisible(true);
        Message.warning(t('conversation.browser.missingHomeUrl'));
        return;
      }

      openBrowserPreview(asset, homeUrl);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : t('conversation.browser.openFailed'));
    }
  }, [boundAssetId, conversation.extra?.spaceId, defaultAssetLabel, openBrowserPreview, t]);

  const handleConfigureBrowser = useCallback(async () => {
    const spaceId = conversation.extra?.spaceId;
    if (!spaceId || !boundAssetId) {
      return;
    }

    try {
      const bindableResponse = await ipcBridge.browserContext.assertBindable.invoke({
        id: boundAssetId,
        spaceId,
      });
      if (!bindableResponse.success || !bindableResponse.data) {
        Message.warning(bindableResponse.msg || t('conversation.browser.openFailed'));
        return;
      }

      const asset = bindableResponse.data;
      setDraft({
        id: asset.id,
        label: asset.label,
        metadata: asset.metadata,
      });
      setStartUrl(getHomeUrl(asset) || 'https://');
      setVisible(true);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : t('conversation.browser.openFailed'));
    }
  }, [boundAssetId, conversation.extra?.spaceId, t]);

  const handleConfirm = useCallback(async () => {
    const spaceId = conversation.extra?.spaceId;
    if (!spaceId) {
      Message.warning(t('conversation.browser.missingSpace'));
      return;
    }

    let normalizedUrl = '';
    try {
      normalizedUrl = normalizeBrowserUrl(startUrl);
    } catch {
      Message.warning(t('conversation.browser.invalidUrl'));
      return;
    }

    setSubmitting(true);
    try {
      const confirmedAt = Date.now();

      if (draft?.id) {
        const updateResponse = await ipcBridge.browserContext.update.invoke({
          id: draft.id,
          metadata: {
            ...draft.metadata,
            homeUrl: normalizedUrl,
          },
          lastUsedAt: confirmedAt,
        });

        if (!updateResponse.success || !updateResponse.data) {
          Message.error(updateResponse.msg || t('conversation.browser.updateFailed'));
          return;
        }

        openBrowserPreview(updateResponse.data, normalizedUrl, false);
        closeModal();
        return;
      }

      const createResponse = await ipcBridge.browserContext.create.invoke({
        spaceId,
        label: draft?.label || defaultAssetLabel,
        kind: 'managed',
        consentStatus: 'granted',
        grantedAt: confirmedAt,
        metadata: {
          homeUrl: normalizedUrl,
          sourceConversationId: conversation.id,
        },
      });

      if (!createResponse.success || !createResponse.data) {
        Message.error(createResponse.msg || t('conversation.browser.createFailed'));
        return;
      }

      const createdAsset = createResponse.data;
      const bindSuccess = await ipcBridge.conversation.update.invoke({
        id: conversation.id,
        updates: {
          extra: {
            browserContextAssetId: createdAsset.id,
          },
        } as Partial<TChatConversation>,
        mergeExtra: true,
      });

      if (!bindSuccess) {
        Message.error(t('conversation.browser.bindFailed'));
        return;
      }

      setBoundAssetId(createdAsset.id);
      openBrowserPreview(createdAsset, normalizedUrl);
      closeModal();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : t('conversation.browser.createFailed'));
    } finally {
      setSubmitting(false);
    }
  }, [
    closeModal,
    conversation.extra?.spaceId,
    conversation.id,
    defaultAssetLabel,
    draft,
    openBrowserPreview,
    startUrl,
    t,
  ]);

  const isBound = Boolean(boundAssetId);
  const chipLabel = getBrowserChipLabel(boundAssetLabel ?? undefined);

  return (
    <>
      <div className='app-icon-row gap-6px'>
        <Tooltip content={t('conversation.browser.open')}>
          <Button
            size='mini'
            className='app-icon-row'
            aria-label={chipLabel}
            onClick={() => {
              void handleOpenBrowser();
            }}
          >
            <Earth
              theme='outline'
              size='14'
              fill={iconColors.primary}
              strokeWidth={2}
              strokeLinejoin='miter'
              strokeLinecap='square'
            />
            <span title={chipLabel}>{chipLabel}</span>
          </Button>
        </Tooltip>

        {isBound ? (
          <Tooltip content={t('conversation.browser.configureTitle')}>
            <Button
              size='mini'
              aria-label='configure browser'
              onClick={() => {
                void handleConfigureBrowser();
              }}
            >
              <span>{t('common.configure', { defaultValue: 'Configure' })}</span>
            </Button>
          </Tooltip>
        ) : null}
      </div>

      <ContextGoModal
        visible={visible}
        onCancel={closeModal}
        header={{
          title: draft?.id ? t('conversation.browser.configureTitle') : t('conversation.browser.createTitle'),
          showClose: true,
          className: 'px-24px pt-20px',
        }}
        footer={{
          className: 'px-24px pb-20px',
          render: () => (
            <div className='flex justify-end gap-10px pt-4px'>
              <Button onClick={closeModal} className='min-w-88px px-18px'>
                {t('common.cancel')}
              </Button>
              <Button
                type='primary'
                onClick={() => {
                  void handleConfirm();
                }}
                loading={submitting}
                className='min-w-104px px-18px'
              >
                {draft?.id ? t('common.confirm') : t('common.create')}
              </Button>
            </div>
          ),
        }}
        style={{ width: 'min(460px, calc(100vw - 32px))' }}
        contentStyle={{ padding: '12px 24px 24px' }}
      >
        <div className='flex flex-col gap-8px'>
          <div className='text-14px text-t-secondary'>{t('conversation.browser.startUrlLabel')}</div>
          <Input
            autoFocus
            value={startUrl}
            onChange={setStartUrl}
            onPressEnter={() => {
              void handleConfirm();
            }}
            placeholder={t('conversation.browser.startUrlPlaceholder')}
          />
        </div>
      </ContextGoModal>
    </>
  );
};

export default ConversationBrowserContextButton;
