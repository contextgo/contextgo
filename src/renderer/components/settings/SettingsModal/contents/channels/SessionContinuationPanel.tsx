/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { channel } from '@/common/adapter/ipcBridge';
import type {
  IChannelActiveSessionEntry,
  IChannelBindingCatalog,
  IChannelPublicationCatalogRefreshResult,
} from '@process/channels/types';
import { Button, Empty, Message, Select, Spin, Tag } from '@arco-design/web-react';
import { Refresh } from '@icon-park/react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

type SessionContinuationIntent = {
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

function resolveSessionContinuationIntent(state: unknown): SessionContinuationIntent | null {
  if (!state || typeof state !== 'object' || !('sessionContinuationIntent' in state)) {
    return null;
  }

  const intent = (state as { sessionContinuationIntent?: SessionContinuationIntent }).sessionContinuationIntent;
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

function formatOptionalRelativeTime(timestamp: number | undefined, locale: string): string | null {
  return typeof timestamp === 'number' ? formatRelativeTime(timestamp, locale) : null;
}

function applyPublicationSnapshot(
  snapshot: IChannelPublicationCatalogRefreshResult,
  setCatalog: React.Dispatch<React.SetStateAction<IChannelBindingCatalog>>,
  setSessions: React.Dispatch<React.SetStateAction<IChannelActiveSessionEntry[]>>
): void {
  setCatalog(snapshot.bindingCatalog);
  setSessions(snapshot.activeSessions);
}

const SessionContinuationPanel: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const sessionContinuationIntent = useMemo(() => resolveSessionContinuationIntent(location.state), [location.state]);

  const [sessions, setSessions] = useState<IChannelActiveSessionEntry[]>([]);
  const [catalog, setCatalog] = useState<IChannelBindingCatalog>(EMPTY_CATALOG);
  const [selectedSource, setSelectedSource] = useState('');
  const [selectedConnectorId, setSelectedConnectorId] = useState('');
  const [selectedAudienceKey, setSelectedAudienceKey] = useState('');
  const [continuationMode, setContinuationMode] = useState<'resume' | 'new_thread'>('resume');
  const [controlMode, setControlMode] = useState<'im_owner' | 'im_observer'>('im_owner');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [endingSessionId, setEndingSessionId] = useState('');
  const [updatingControlSessionId, setUpdatingControlSessionId] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const snapshotResult = await channel.refreshPublicationCatalog.invoke(undefined);

      if (!snapshotResult.success || !snapshotResult.data) {
        throw new Error(snapshotResult.msg || t('settings.activeSessions.loadFailed'));
      }

      applyPublicationSnapshot(snapshotResult.data, setCatalog, setSessions);
      setSelectedConnectorId((current) => {
        if (current && snapshotResult.data.bindingCatalog.connectors.some((connector) => connector.id === current)) {
          return current;
        }
        return snapshotResult.data.bindingCatalog.connectors[0]?.id ?? '';
      });
      setSelectedSource((current) => {
        if (current) {
          return current;
        }
        if (sessionContinuationIntent?.sourceConversationId) {
          return `conversation:${sessionContinuationIntent.sourceConversationId}`;
        }
        return snapshotResult.data.activeSessions[0] ? `session:${snapshotResult.data.activeSessions[0].id}` : '';
      });
    } catch (error) {
      Message.error(error instanceof Error ? error.message : t('settings.activeSessions.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [sessionContinuationIntent?.sourceConversationId, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const targetAudiences = useMemo(
    () => catalog.audiences.filter((audience) => audience.channelAccountId === selectedConnectorId),
    [catalog.audiences, selectedConnectorId]
  );

  useEffect(() => {
    setSelectedAudienceKey((current) =>
      targetAudiences.some((audience) => getAudienceOptionValue(audience) === current)
        ? current
        : targetAudiences[0]
          ? getAudienceOptionValue(targetAudiences[0])
          : ''
    );
  }, [targetAudiences]);

  const sourceOptions = useMemo<SourceOption[]>(() => {
    const options: SourceOption[] = [];

    if (sessionContinuationIntent) {
      options.push({
        value: `conversation:${sessionContinuationIntent.sourceConversationId}`,
        label:
          sessionContinuationIntent.conversationName ||
          sessionContinuationIntent.agentName ||
          sessionContinuationIntent.sourceConversationId,
      });
    }

    options.push(
      ...sessions.map((session) => ({
        value: `session:${session.id}`,
        label: session.channelAccountName
          ? `${session.channelAccountName} · ${session.audienceTitle}`
          : `${session.audienceTitle} · ${session.conversationId || session.id}`,
      }))
    );

    return options;
  }, [sessionContinuationIntent, sessions]);

  const selectedAudience = useMemo(
    () => targetAudiences.find((audience) => getAudienceOptionValue(audience) === selectedAudienceKey),
    [selectedAudienceKey, targetAudiences]
  );
  const matchedContinuationSession = useMemo(
    () =>
      sessionContinuationIntent?.sourceConversationId
        ? sessions.find(
            (session) =>
              session.bindingTemporary &&
              session.continuationSourceConversationId === sessionContinuationIntent.sourceConversationId
          )
        : undefined,
    [sessionContinuationIntent?.sourceConversationId, sessions]
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

  const effectiveContinuationMode = embedded ? 'resume' : continuationMode;
  const effectiveControlMode = embedded ? 'im_owner' : controlMode;

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
        targetChannelAccountId: selectedConnectorId,
        targetChatId: selectedAudience.remoteChatId || selectedAudience.key,
        targetPlatformChatId: selectedAudience.platformChatId,
        targetPlatformUserId: selectedAudience.remoteUserId,
        targetDisplayName: selectedAudience.displayName || selectedAudience.title,
        targetChatType: selectedAudience.remoteChatType,
        mode: effectiveContinuationMode,
        controlMode: effectiveControlMode,
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

      const result = await channel.continuationSession.invoke(params);
      if (!result.success || !result.data) {
        throw new Error(result.msg || t('settings.activeSessions.handoffFailed'));
      }

      Message.success(
        effectiveContinuationMode === 'resume'
          ? t('settings.activeSessions.handoffSuccessResume')
          : t('settings.activeSessions.handoffSuccessNewThread')
      );
      await loadData();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : t('settings.activeSessions.handoffFailed'));
    } finally {
      setSubmitting(false);
    }
  }, [
    effectiveControlMode,
    effectiveContinuationMode,
    loadData,
    selectedAudience,
    selectedConnectorId,
    selectedSource,
    t,
  ]);

  const handleEndContinuation = useCallback(
    async (targetExternalSessionId: string) => {
      setEndingSessionId(targetExternalSessionId);
      try {
        const result = await channel.endContinuationSession.invoke({ targetExternalSessionId });
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

  const handleSetControlMode = useCallback(
    async (targetExternalSessionId: string, nextControlMode: 'im_owner' | 'im_observer') => {
      setUpdatingControlSessionId(targetExternalSessionId);
      try {
        const result = await channel.setContinuationControlMode.invoke({
          targetExternalSessionId,
          controlMode: nextControlMode,
        });
        if (!result.success || !result.data) {
          throw new Error(result.msg || t('settings.activeSessions.updateControlFailed'));
        }
        Message.success(
          nextControlMode === 'im_owner'
            ? t('settings.activeSessions.switchToImOwnerSuccess')
            : t('settings.activeSessions.switchToObserverSuccess')
        );
        await loadData();
      } catch (error) {
        Message.error(error instanceof Error ? error.message : t('settings.activeSessions.updateControlFailed'));
      } finally {
        setUpdatingControlSessionId('');
      }
    },
    [loadData, t]
  );

  return (
    <div
      className={
        embedded
          ? 'border border-[var(--color-border-2)] rd-14px px-14px py-14px space-y-14px'
          : 'mt-16px border border-[var(--color-border-2)] rd-14px px-14px py-14px space-y-14px'
      }
    >
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
          {sessionContinuationIntent ? (
            <div className='border border-[rgba(var(--primary-6),0.22)] bg-[rgba(var(--primary-6),0.06)] rd-12px p-12px space-y-8px'>
              <div className='text-14px font-600 text-t-primary'>{t('settings.activeSessions.intentTitle')}</div>
              <div className='text-12px text-t-secondary leading-relaxed'>
                {t('settings.activeSessions.intentDescription')}
              </div>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-8px'>
                <div className='text-12px text-t-secondary'>
                  {t('settings.activeSessions.intentConversation')}:
                  <span className='ml-6px text-t-primary'>
                    {sessionContinuationIntent.conversationName || sessionContinuationIntent.sourceConversationId}
                  </span>
                </div>
                <div className='text-12px text-t-secondary'>
                  {t('settings.activeSessions.intentBackend')}:
                  <span className='ml-6px text-t-primary'>{sessionContinuationIntent.backend || '-'}</span>
                </div>
                <div className='text-12px text-t-secondary'>
                  {t('settings.activeSessions.intentWorkspace')}:
                  <span className='ml-6px text-t-primary break-all'>{sessionContinuationIntent.workspace || '-'}</span>
                </div>
              </div>
              {matchedContinuationSession ? (
                <div className='border border-[rgba(var(--orange-6),0.24)] bg-[rgba(var(--orange-6),0.08)] rd-10px p-10px space-y-6px'>
                  <div className='text-13px font-600 text-t-primary'>
                    {t('settings.activeSessions.currentHandoffTitle')}
                  </div>
                  <div className='text-12px text-t-secondary leading-relaxed'>
                    {t('settings.activeSessions.currentHandoffDescription', {
                      audience: matchedContinuationSession.audienceTitle,
                      connector:
                        matchedContinuationSession.channelAccountName ||
                        matchedContinuationSession.channelAccountPlatform ||
                        '-',
                    })}
                  </div>
                  {matchedContinuationSession.ownerKey ? (
                    <div className='text-12px text-t-secondary break-all'>
                      {t('settings.activeSessions.currentControllerLabel')}: {matchedContinuationSession.ownerKey}
                    </div>
                  ) : null}
                  {matchedContinuationSession.controlMode ? (
                    <div className='text-12px text-t-secondary'>
                      {t('settings.activeSessions.currentControlModeLabel')}:{' '}
                      {matchedContinuationSession.controlMode === 'im_owner'
                        ? t('settings.activeSessions.controlMode.imOwner')
                        : matchedContinuationSession.controlMode === 'im_observer'
                          ? t('settings.activeSessions.controlMode.imObserver')
                          : t('settings.activeSessions.controlMode.desktopOwner')}
                    </div>
                  ) : null}
                  {formatOptionalRelativeTime(matchedContinuationSession.leaseUpdatedAt, i18n.language) ? (
                    <div className='text-12px text-t-secondary'>
                      {t('settings.activeSessions.lastLeaseChangeLabel')}:{' '}
                      {formatOptionalRelativeTime(matchedContinuationSession.leaseUpdatedAt, i18n.language)}
                    </div>
                  ) : null}
                  <div className='flex flex-wrap gap-8px'>
                    <Button
                      status='warning'
                      type='primary'
                      loading={endingSessionId === matchedContinuationSession.id}
                      onClick={() => void handleEndContinuation(matchedContinuationSession.id)}
                    >
                      {t('settings.activeSessions.reclaimControl')}
                    </Button>
                    <Button
                      type='secondary'
                      onClick={() => setSelectedSource(`session:${matchedContinuationSession.id}`)}
                    >
                      {t('settings.activeSessions.inspectHandoff')}
                    </Button>
                    {matchedContinuationSession.controlMode === 'im_owner' ? (
                      <Button
                        type='secondary'
                        loading={updatingControlSessionId === matchedContinuationSession.id}
                        onClick={() => void handleSetControlMode(matchedContinuationSession.id, 'im_observer')}
                      >
                        {t('settings.activeSessions.switchToObserver')}
                      </Button>
                    ) : (
                      <Button
                        type='secondary'
                        loading={updatingControlSessionId === matchedContinuationSession.id}
                        onClick={() => void handleSetControlMode(matchedContinuationSession.id, 'im_owner')}
                      >
                        {t('settings.activeSessions.switchToImOwner')}
                      </Button>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className='grid grid-cols-1 xl:grid-cols-2 gap-12px'>
            <div className='border border-[var(--color-border-2)] rd-12px p-12px space-y-8px'>
              <div className='text-14px font-600 text-t-primary'>{t('settings.activeSessions.sourceTitle')}</div>
              <div className='text-12px text-t-secondary leading-relaxed'>
                {t('settings.activeSessions.sourceDescription')}
              </div>
              <Select
                value={selectedSource || undefined}
                options={sourceOptions}
                placeholder={t('settings.activeSessions.sourcePlaceholder')}
                onChange={(value) => setSelectedSource(String(value))}
              />

              {!embedded && sessions.length > 0 ? (
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
                            {selected
                              ? t('settings.activeSessions.selectedTag')
                              : t('settings.activeSessions.activeTag')}
                          </Tag>
                          <Tag>{session.agentType}</Tag>
                          {session.channelAccountPlatform ? <Tag>{session.channelAccountPlatform}</Tag> : null}
                          {session.bindingTemporary ? (
                            <Tag color='orangered'>{t('settings.activeSessions.handoffTag')}</Tag>
                          ) : null}
                        </div>
                        <div className='text-13px text-t-primary break-all'>
                          {session.channelAccountName
                            ? `${session.channelAccountName} · ${session.audienceTitle}`
                            : session.audienceTitle}
                        </div>
                        <div className='text-12px text-t-secondary break-all'>
                          {session.workspace || session.conversationId || t('settings.activeSessions.noConversation')}
                        </div>
                        {session.bindingTemporary &&
                        (session.continuationSourceConversationId || session.continuationSourceExternalSessionId) ? (
                          <div className='text-12px text-t-secondary break-all'>
                            {t('settings.activeSessions.handoffSourceLabel')}:{' '}
                            {session.continuationSourceConversationId || session.continuationSourceExternalSessionId}
                          </div>
                        ) : null}
                        {session.ownerKey ? (
                          <div className='text-12px text-t-secondary break-all'>
                            {t('settings.activeSessions.currentControllerLabel')}: {session.ownerKey}
                          </div>
                        ) : null}
                        {formatOptionalRelativeTime(session.leaseUpdatedAt, i18n.language) ? (
                          <div className='text-12px text-t-secondary'>
                            {t('settings.activeSessions.lastLeaseChangeLabel')}:{' '}
                            {formatOptionalRelativeTime(session.leaseUpdatedAt, i18n.language)}
                          </div>
                        ) : null}
                        {formatOptionalRelativeTime(session.leaseReleasedAt, i18n.language) ? (
                          <div className='text-12px text-t-secondary'>
                            {t('settings.activeSessions.lastLeaseReleaseLabel')}:{' '}
                            {formatOptionalRelativeTime(session.leaseReleasedAt, i18n.language)}
                          </div>
                        ) : null}
                        {session.controlMode ? (
                          <div className='text-12px text-t-secondary'>
                            {t('settings.activeSessions.currentControlModeLabel')}:{' '}
                            {session.controlMode === 'im_owner'
                              ? t('settings.activeSessions.controlMode.imOwner')
                              : session.controlMode === 'im_observer'
                                ? t('settings.activeSessions.controlMode.imObserver')
                                : t('settings.activeSessions.controlMode.desktopOwner')}
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
                                onClick={() => void handleEndContinuation(session.id)}
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
              ) : !embedded && !sessionContinuationIntent ? (
                <Empty description={t('settings.activeSessions.empty')} className='py-16px' />
              ) : null}
            </div>

            <div className='border border-[var(--color-border-2)] rd-12px p-12px space-y-8px'>
              <div className='text-14px font-600 text-t-primary'>{t('settings.activeSessions.targetTitle')}</div>
              <div className='text-12px text-t-secondary leading-relaxed'>
                {t('settings.activeSessions.targetDescription')}
              </div>
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
              {!embedded ? (
                <>
                  <Select
                    value={continuationMode}
                    options={[
                      { value: 'resume', label: t('settings.activeSessions.mode.resume') },
                      { value: 'new_thread', label: t('settings.activeSessions.mode.newThread') },
                    ]}
                    onChange={(value) => setContinuationMode(value as 'resume' | 'new_thread')}
                  />
                  <Select
                    value={controlMode}
                    options={[
                      { value: 'im_owner', label: t('settings.activeSessions.controlMode.imOwner') },
                      { value: 'im_observer', label: t('settings.activeSessions.controlMode.imObserver') },
                    ]}
                    onChange={(value) => setControlMode(value as 'im_owner' | 'im_observer')}
                  />
                  <div className='text-12px text-t-secondary leading-relaxed'>
                    {continuationMode === 'resume'
                      ? t('settings.activeSessions.mode.resumeHint')
                      : t('settings.activeSessions.mode.newThreadHint')}
                  </div>
                  <div className='text-12px text-t-secondary leading-relaxed'>
                    {controlMode === 'im_owner'
                      ? t('settings.activeSessions.controlMode.imOwnerHint')
                      : t('settings.activeSessions.controlMode.imObserverHint')}
                  </div>
                </>
              ) : (
                <div className='text-12px text-t-secondary leading-relaxed'>
                  {t('settings.activeSessions.mode.resumeHint')}
                </div>
              )}
              <Button type='primary' loading={submitting} onClick={() => void handleSubmit()}>
                {embedded
                  ? t('settings.activeSessions.submitResume')
                  : continuationMode === 'resume'
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

export default SessionContinuationPanel;
