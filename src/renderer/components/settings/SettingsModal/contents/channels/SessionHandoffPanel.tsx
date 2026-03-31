/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { channel } from '@/common/adapter/ipcBridge';
import type { IChannelActiveSessionEntry, IChannelBindingCatalog } from '@process/channels/types';
import { Button, Empty, Message, Select, Spin, Tag } from '@arco-design/web-react';
import { Refresh } from '@icon-park/react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

type SessionHandoffIntent = {
  sourceConversationId: string;
  conversationName?: string;
  backend?: string;
  workspace?: string;
  agentName?: string;
};

type SourceOption = {
  label: string;
  value: string;
};

function getAudienceOptionValue(audience: IChannelBindingCatalog['audiences'][number]): string {
  return `${audience.scopeType}:${audience.key}`;
}

const EMPTY_CATALOG: IChannelBindingCatalog = {
  connectors: [],
  agentProfiles: [],
  bindings: [],
  audiences: [],
};

function resolveSessionHandoffIntent(state: unknown): SessionHandoffIntent | null {
  if (!state || typeof state !== 'object' || !('sessionHandoffIntent' in state)) {
    return null;
  }

  const intent = (state as { sessionHandoffIntent?: SessionHandoffIntent }).sessionHandoffIntent;
  if (!intent?.sourceConversationId) {
    return null;
  }

  return intent;
}

function formatRelativeTime(timestamp: number, locale: string): string {
  const deltaMinutes = Math.max(1, Math.floor((Date.now() - timestamp) / 1000 / 60));

  if (deltaMinutes < 60) {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-deltaMinutes, 'minute');
  }

  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 24) {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-deltaHours, 'hour');
  }

  const deltaDays = Math.floor(deltaHours / 24);
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-deltaDays, 'day');
}

const SessionHandoffPanel: React.FC = () => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const sessionHandoffIntent = useMemo(() => resolveSessionHandoffIntent(location.state), [location.state]);

  const [sessions, setSessions] = useState<IChannelActiveSessionEntry[]>([]);
  const [catalog, setCatalog] = useState<IChannelBindingCatalog>(EMPTY_CATALOG);
  const [selectedSource, setSelectedSource] = useState('');
  const [selectedConnectorId, setSelectedConnectorId] = useState('');
  const [selectedAudienceKey, setSelectedAudienceKey] = useState('');
  const [handoffMode, setHandoffMode] = useState<'resume' | 'new_thread'>('resume');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [endingSessionId, setEndingSessionId] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sessionResult, catalogResult] = await Promise.all([
        channel.getActiveSessionCatalog.invoke(),
        channel.getBindingCatalog.invoke({}),
      ]);

      if (!sessionResult.success || !sessionResult.data) {
        throw new Error(sessionResult.msg || t('settings.activeSessions.loadFailed'));
      }
      if (!catalogResult.success || !catalogResult.data) {
        throw new Error(catalogResult.msg || t('settings.activeSessions.loadFailed'));
      }

      setSessions(sessionResult.data);
      setCatalog(catalogResult.data);
      setSelectedConnectorId((current) => {
        if (current && catalogResult.data.connectors.some((connector) => connector.id === current)) {
          return current;
        }
        return catalogResult.data.connectors[0]?.id ?? '';
      });
      setSelectedSource((current) => {
        if (current) {
          return current;
        }
        if (sessionHandoffIntent?.sourceConversationId) {
          return `conversation:${sessionHandoffIntent.sourceConversationId}`;
        }
        return sessionResult.data[0] ? `session:${sessionResult.data[0].id}` : '';
      });
    } catch (error) {
      Message.error(error instanceof Error ? error.message : t('settings.activeSessions.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [sessionHandoffIntent?.sourceConversationId, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const targetAudiences = useMemo(
    () => catalog.audiences.filter((audience) => audience.connectorId === selectedConnectorId),
    [catalog.audiences, selectedConnectorId]
  );

  useEffect(() => {
    setSelectedAudienceKey((current) =>
      targetAudiences.some((audience) => getAudienceOptionValue(audience) === current)
        ? current
        : (targetAudiences[0] ? getAudienceOptionValue(targetAudiences[0]) : '')
    );
  }, [targetAudiences]);

  const sourceOptions = useMemo<SourceOption[]>(() => {
    const options: SourceOption[] = [];

    if (sessionHandoffIntent) {
      options.push({
        value: `conversation:${sessionHandoffIntent.sourceConversationId}`,
        label:
          sessionHandoffIntent.conversationName ||
          sessionHandoffIntent.agentName ||
          sessionHandoffIntent.sourceConversationId,
      });
    }

    options.push(
      ...sessions.map((session) => ({
        value: `session:${session.id}`,
        label: session.connectorName
          ? `${session.connectorName} · ${session.audienceTitle}`
          : `${session.audienceTitle} · ${session.conversationId || session.id}`,
      }))
    );

    return options;
  }, [sessionHandoffIntent, sessions]);

  const selectedAudience = useMemo(
    () => targetAudiences.find((audience) => getAudienceOptionValue(audience) === selectedAudienceKey),
    [selectedAudienceKey, targetAudiences]
  );

  const connectorOptions = useMemo(
    () =>
      catalog.connectors.map((connector) => ({
        value: connector.id,
        label: `${connector.name} · ${connector.platform}`,
      })),
    [catalog.connectors]
  );

  const audienceOptions = useMemo(
    () =>
      targetAudiences.map((audience) => ({
        value: getAudienceOptionValue(audience),
        label: audience.subtitle ? `${audience.title} · ${audience.subtitle}` : audience.title,
      })),
    [targetAudiences]
  );

  const handleSubmit = useCallback(async () => {
    if (!selectedSource) {
      Message.warning(t('settings.activeSessions.sourceRequired'));
      return;
    }
    if (!selectedConnectorId) {
      Message.warning(t('settings.activeSessions.connectorRequired'));
      return;
    }
    if (!selectedAudience) {
      Message.warning(t('settings.activeSessions.targetRequired'));
      return;
    }

    setSubmitting(true);
    try {
      const params = {
        targetConnectorId: selectedConnectorId,
        targetChatId: selectedAudience.remoteChatId || selectedAudience.key,
        targetPlatformUserId: selectedAudience.remoteUserId,
        targetDisplayName: selectedAudience.displayName || selectedAudience.title,
        targetChatType: selectedAudience.remoteChatType,
        mode: handoffMode,
        temporary: true,
        priority: 150,
        ...(selectedSource.startsWith('conversation:')
          ? {
              sourceConversationId: selectedSource.slice('conversation:'.length),
            }
          : {
              sourceExternalSessionId: selectedSource.slice('session:'.length),
            }),
      } as const;

      const result = await channel.handoffSession.invoke(params);
      if (!result.success || !result.data) {
        throw new Error(result.msg || t('settings.activeSessions.handoffFailed'));
      }

      Message.success(
        handoffMode === 'resume'
          ? t('settings.activeSessions.handoffSuccessResume')
          : t('settings.activeSessions.handoffSuccessNewThread')
      );
      await loadData();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : t('settings.activeSessions.handoffFailed'));
    } finally {
      setSubmitting(false);
    }
  }, [handoffMode, loadData, selectedAudience, selectedConnectorId, selectedSource, t]);

  const handleEndHandoff = useCallback(
    async (targetExternalSessionId: string) => {
      setEndingSessionId(targetExternalSessionId);
      try {
        const result = await channel.endHandoffSession.invoke({ targetExternalSessionId });
        if (!result.success || !result.data) {
          throw new Error(result.msg || t('settings.activeSessions.endHandoffFailed'));
        }
        Message.success(t('settings.activeSessions.endHandoffSuccess'));
        await loadData();
      } catch (error) {
        Message.error(error instanceof Error ? error.message : t('settings.activeSessions.endHandoffFailed'));
      } finally {
        setEndingSessionId('');
      }
    },
    [loadData, t]
  );

  return (
    <div className='mt-16px border border-[var(--color-border-2)] rd-14px px-14px py-14px space-y-14px'>
      <div className='flex flex-wrap items-center justify-between gap-12px'>
        <div className='space-y-4px'>
          <div className='text-15px font-600 text-t-primary'>{t('settings.activeSessions.handoffTitle')}</div>
          <div className='text-12px text-t-secondary leading-relaxed'>
            {t('settings.activeSessions.handoffDescription')}
          </div>
        </div>
        <Button icon={<Refresh theme='outline' size='16' />} onClick={() => void loadData()} loading={loading}>
          {t('common.refresh')}
        </Button>
      </div>

      <Spin loading={loading}>
        <div className='space-y-12px'>
          {sessionHandoffIntent ? (
            <div className='border border-[rgba(var(--primary-6),0.22)] bg-[rgba(var(--primary-6),0.06)] rd-12px p-12px space-y-8px'>
              <div className='text-14px font-600 text-t-primary'>{t('settings.activeSessions.intentTitle')}</div>
              <div className='text-12px text-t-secondary leading-relaxed'>{t('settings.activeSessions.intentDescription')}</div>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-8px'>
                <div className='text-12px text-t-secondary'>
                  {t('settings.activeSessions.intentConversation')}:
                  <span className='ml-6px text-t-primary'>
                    {sessionHandoffIntent.conversationName || sessionHandoffIntent.sourceConversationId}
                  </span>
                </div>
                <div className='text-12px text-t-secondary'>
                  {t('settings.activeSessions.intentBackend')}:
                  <span className='ml-6px text-t-primary'>{sessionHandoffIntent.backend || '-'}</span>
                </div>
                <div className='text-12px text-t-secondary'>
                  {t('settings.activeSessions.intentWorkspace')}:
                  <span className='ml-6px text-t-primary break-all'>{sessionHandoffIntent.workspace || '-'}</span>
                </div>
              </div>
            </div>
          ) : null}

          <div className='grid grid-cols-1 xl:grid-cols-2 gap-12px'>
            <div className='border border-[var(--color-border-2)] rd-12px p-12px space-y-8px'>
              <div className='text-14px font-600 text-t-primary'>{t('settings.activeSessions.sourceTitle')}</div>
              <div className='text-12px text-t-secondary leading-relaxed'>{t('settings.activeSessions.sourceDescription')}</div>
              <Select
                value={selectedSource || undefined}
                options={sourceOptions}
                placeholder={t('settings.activeSessions.sourcePlaceholder')}
                onChange={(value) => setSelectedSource(String(value))}
              />

              {sessions.length > 0 ? (
                <div className='space-y-8px'>
                  {sessions.map((session) => {
                    const selected = selectedSource === `session:${session.id}`;
                    return (
                      <div
                        key={session.id}
                        className='border border-[var(--color-border-2)] rd-10px px-12px py-10px space-y-6px'
                      >
                        <div className='flex flex-wrap items-center gap-6px'>
                          <Tag color={selected ? 'arcoblue' : 'gray'}>
                            {selected ? t('settings.activeSessions.selectedTag') : t('settings.activeSessions.activeTag')}
                          </Tag>
                          <Tag>{session.agentType}</Tag>
                          {session.connectorPlatform ? <Tag>{session.connectorPlatform}</Tag> : null}
                          {session.bindingTemporary ? (
                            <Tag color='orangered'>{t('settings.activeSessions.handoffTag')}</Tag>
                          ) : null}
                        </div>
                        <div className='text-13px text-t-primary break-all'>
                          {session.connectorName
                            ? `${session.connectorName} · ${session.audienceTitle}`
                            : session.audienceTitle}
                        </div>
                        <div className='text-12px text-t-secondary break-all'>
                          {session.workspace || session.conversationId || t('settings.activeSessions.noConversation')}
                        </div>
                        {session.bindingTemporary && (session.handoffSourceConversationId || session.handoffSourceExternalSessionId) ? (
                          <div className='text-12px text-t-secondary break-all'>
                            {t('settings.activeSessions.handoffSourceLabel')}:{' '}
                            {session.handoffSourceConversationId || session.handoffSourceExternalSessionId}
                          </div>
                        ) : null}
                        <div className='flex items-center justify-between gap-8px'>
                          <span className='text-12px text-t-secondary'>
                            {formatRelativeTime(session.lastActivity, i18n.language)}
                          </span>
                          <div className='flex items-center gap-8px'>
                            <Button type='text' onClick={() => setSelectedSource(`session:${session.id}`)}>
                              {t('settings.activeSessions.useAsSource')}
                            </Button>
                            {session.bindingTemporary ? (
                              <Button
                                type='text'
                                status='danger'
                                loading={endingSessionId === session.id}
                                onClick={() => void handleEndHandoff(session.id)}
                              >
                                {t('settings.activeSessions.endHandoff')}
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : !sessionHandoffIntent ? (
                <Empty description={t('settings.activeSessions.empty')} className='py-16px' />
              ) : null}
            </div>

            <div className='border border-[var(--color-border-2)] rd-12px p-12px space-y-8px'>
              <div className='text-14px font-600 text-t-primary'>{t('settings.activeSessions.targetTitle')}</div>
              <div className='text-12px text-t-secondary leading-relaxed'>{t('settings.activeSessions.targetDescription')}</div>
              <Select
                value={selectedConnectorId || undefined}
                options={connectorOptions}
                placeholder={t('settings.activeSessions.connectorPlaceholder')}
                onChange={(value) => setSelectedConnectorId(String(value))}
              />
              <Select
                value={selectedAudienceKey || undefined}
                options={audienceOptions}
                placeholder={t('settings.activeSessions.targetPlaceholder')}
                onChange={(value) => setSelectedAudienceKey(String(value))}
              />
              <Select
                value={handoffMode}
                options={[
                  { value: 'resume', label: t('settings.activeSessions.mode.resume') },
                  { value: 'new_thread', label: t('settings.activeSessions.mode.newThread') },
                ]}
                onChange={(value) => setHandoffMode(value as 'resume' | 'new_thread')}
              />
              <div className='text-12px text-t-secondary leading-relaxed'>
                {handoffMode === 'resume'
                  ? t('settings.activeSessions.mode.resumeHint')
                  : t('settings.activeSessions.mode.newThreadHint')}
              </div>
              <Button type='primary' loading={submitting} onClick={() => void handleSubmit()}>
                {handoffMode === 'resume'
                  ? t('settings.activeSessions.submitResume')
                  : t('settings.activeSessions.submitNewThread')}
              </Button>
            </div>
          </div>
        </div>
      </Spin>
    </div>
  );
};

export default SessionHandoffPanel;
