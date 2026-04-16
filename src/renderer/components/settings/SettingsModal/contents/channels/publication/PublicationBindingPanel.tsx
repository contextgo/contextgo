/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { channel } from '@/common/adapter/ipcBridge';
import {
  getChannelAccountId,
  type IAgentProfile,
  type IChannelAccount,
  type IChannelActiveSessionEntry,
  type IChannelAudienceEntry,
  type IChannelBinding,
  type IChannelBindingCatalog,
  type IChannelPublicationSnapshot,
} from '@process/channels/types';
import { Button, Empty, Input, Message, Select, Spin, Tag, Tooltip } from '@arco-design/web-react';
import { Delete, Edit, Plus, Refresh, Undo } from '@icon-park/react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import styles from '../ChannelModalContent.module.css';
import {
  buildAgentPublicationObjects,
  buildPublishObjectOptionLabel,
  type AgentPublicationObjectEntry,
} from './agentPublicationViewModel';
import { getPublicationObjectKindLabel } from './objectViewModel';
import { buildPublicationPayload, splitBindingsByLifetime, type DurableBindingScopeType } from './viewModel';

type PublicationIntent = {
  agentProfileId?: string;
  conversationId?: string;
  conversationName?: string;
  backend?: string;
  customAgentId?: string;
  workspace?: string;
  agentName?: string;
};

type PublicationEditorState = {
  open: boolean;
  editingPublicationId: string;
  channelAccountId: string;
  selectedAudienceKey: string;
  useManualScope: boolean;
  manualScopeType: DurableBindingScopeType;
  manualScopeKey: string;
};

type TranslationFn = ReturnType<typeof useTranslation>['t'];

const EMPTY_CATALOG: IChannelBindingCatalog = {
  connectors: [],
  channelAccounts: [],
  agentProfiles: [],
  bindings: [],
  audiences: [],
};

function applyPublicationSnapshot(
  snapshot: IChannelPublicationSnapshot,
  setCatalog: React.Dispatch<React.SetStateAction<IChannelBindingCatalog>>,
  setActiveSessions: React.Dispatch<React.SetStateAction<IChannelActiveSessionEntry[]>>
): void {
  setCatalog(snapshot.catalog);
  setActiveSessions(snapshot.activeSessions);
}

function createPublicationEditorState(): PublicationEditorState {
  return {
    open: false,
    editingPublicationId: '',
    channelAccountId: '',
    selectedAudienceKey: '',
    useManualScope: false,
    manualScopeType: 'remote_chat',
    manualScopeKey: '',
  };
}

function getIntentField(searchParams: URLSearchParams, key: string): string | undefined {
  const value = searchParams.get(key);
  return value && value.trim() ? value : undefined;
}

function getPromptProfileField(profile: IAgentProfile, key: string): string | undefined {
  const promptProfile = profile.promptProfile;
  if (!promptProfile || typeof promptProfile !== 'object') {
    return undefined;
  }

  const value = (promptProfile as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function resolvePublicationIntent(state: unknown, searchParams: URLSearchParams): PublicationIntent | null {
  const fromState =
    state && typeof state === 'object' && 'publicationIntent' in state
      ? (state as { publicationIntent?: PublicationIntent }).publicationIntent
      : undefined;

  const publicationIntent: PublicationIntent = {
    agentProfileId: fromState?.agentProfileId ?? getIntentField(searchParams, 'agentProfileId'),
    conversationId: fromState?.conversationId ?? getIntentField(searchParams, 'conversationId'),
    conversationName: fromState?.conversationName ?? getIntentField(searchParams, 'conversationName'),
    backend: fromState?.backend ?? getIntentField(searchParams, 'backend'),
    customAgentId: fromState?.customAgentId ?? getIntentField(searchParams, 'customAgentId'),
    workspace: fromState?.workspace ?? getIntentField(searchParams, 'workspace'),
    agentName: fromState?.agentName ?? getIntentField(searchParams, 'agentName'),
  };

  return Object.values(publicationIntent).some(Boolean) ? publicationIntent : null;
}

function resolvePreferredProfileId(
  agentProfiles: IAgentProfile[],
  publicationIntent: PublicationIntent | null
): string | null {
  if (!publicationIntent) {
    return null;
  }

  if (
    publicationIntent.agentProfileId &&
    agentProfiles.some((profile) => profile.id === publicationIntent.agentProfileId)
  ) {
    return publicationIntent.agentProfileId;
  }

  let bestProfileId: string | null = null;
  let bestScore = 0;

  for (const profile of agentProfiles) {
    let score = 0;

    if (publicationIntent.conversationId && profile.publishedFromConversationId === publicationIntent.conversationId) {
      score += 1000;
    }
    if (publicationIntent.backend && profile.backend === publicationIntent.backend) {
      score += 200;
    }
    if (
      publicationIntent.customAgentId &&
      getPromptProfileField(profile, 'customAgentId') === publicationIntent.customAgentId
    ) {
      score += 400;
    }
    if (publicationIntent.workspace && profile.workspaceRef === publicationIntent.workspace) {
      score += 80;
    }
    if (publicationIntent.agentName && profile.name === publicationIntent.agentName) {
      score += 40;
    }

    if (score > bestScore) {
      bestScore = score;
      bestProfileId = profile.id;
    }
  }

  return bestProfileId;
}

function getProfileLabel(profile: IAgentProfile): string {
  return `${profile.name} · ${profile.backend}`;
}

function getProfileDisplayName(profile: IAgentProfile): string {
  return profile.name || profile.id;
}

function getProfileRuntimeLabel(profile: IAgentProfile): string {
  const modelLabel = profile.modelRef?.useModel || profile.modelRef?.name;
  return modelLabel ? `${profile.backend} · ${modelLabel}` : profile.backend;
}

function getProfileWorkspaceLabel(profile: IAgentProfile): string {
  return profile.workspaceRef || '-';
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

function getSessionConversationPointer(session: IChannelActiveSessionEntry): string | undefined {
  return session.activeConversationId ?? session.conversationId;
}

function getManualScopePlaceholder(scopeType: DurableBindingScopeType, t: TranslationFn): string {
  if (scopeType === 'remote_user') {
    return t('settings.channels.publication.scopeKeyRemoteUserPlaceholder');
  }

  return t('settings.channels.publication.scopeKeyRemoteChatPlaceholder');
}

function resolveAudienceScopeType(audience: IChannelAudienceEntry | undefined): DurableBindingScopeType {
  return audience?.scopeType === 'remote_user' ? 'remote_user' : 'remote_chat';
}

function getBindingAudience(
  binding: IChannelBinding,
  audienceMap: Map<string, IChannelAudienceEntry>
): IChannelAudienceEntry | undefined {
  if (!binding.scopeKey || binding.scopeType === 'connector_default') {
    return undefined;
  }

  return audienceMap.get(binding.scopeKey);
}

function getPublicationAudience(
  entry: AgentPublicationObjectEntry,
  audiences: IChannelAudienceEntry[]
): IChannelAudienceEntry | undefined {
  const primaryBinding = entry.object.bindings[0];
  const publishObjectCatalogEntryId = entry.object.publishObjectCatalogEntryId;

  return audiences.find((audience) => {
    if (getChannelAccountId(audience) !== entry.channelAccount.id) {
      return false;
    }

    if (publishObjectCatalogEntryId && audience.publishObjectCatalogEntryId === publishObjectCatalogEntryId) {
      return true;
    }

    if (primaryBinding?.scopeKey && audience.key === primaryBinding.scopeKey) {
      return true;
    }

    if (primaryBinding?.scopeKey && audience.objectKey === primaryBinding.scopeKey) {
      return true;
    }

    return false;
  });
}

function getObjectRefreshBadgeLabel(entry: AgentPublicationObjectEntry, t: TranslationFn): string | null {
  const refreshState = entry.object.refreshState;
  if (refreshState?.status === 'needs-refresh') {
    return t('settings.channels.publication.objectQualityFallback');
  }

  if (refreshState?.status === 'ready' && refreshState.backfilledAt) {
    return t('settings.channels.publication.objectRefreshBackfilled');
  }

  if (!refreshState && entry.object.objectQuality === 'fallback') {
    return t('settings.channels.publication.objectQualityFallback');
  }

  return null;
}

type DiscoveryStatus = {
  kind: 'official' | 'learned' | 'empty';
  count: number;
};

const PublicationBindingPanel: React.FC = () => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const [catalog, setCatalog] = useState<IChannelBindingCatalog>(EMPTY_CATALOG);
  const [activeSessions, setActiveSessions] = useState<IChannelActiveSessionEntry[]>([]);
  const [selectedAgentProfileId, setSelectedAgentProfileId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingBindingId, setDeletingBindingId] = useState('');
  const [editor, setEditor] = useState<PublicationEditorState>(createPublicationEditorState());
  const [appliedIntentKey, setAppliedIntentKey] = useState('');

  const publicationIntent = useMemo(
    () => resolvePublicationIntent(location.state, new URLSearchParams(location.search)),
    [location.search, location.state]
  );
  const publicationIntentKey = useMemo(() => JSON.stringify(publicationIntent ?? null), [publicationIntent]);
  const catalogChannelAccounts = useMemo(
    () => catalog.channelAccounts ?? catalog.connectors,
    [catalog.channelAccounts, catalog.connectors]
  );

  const loadPublicationSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      const snapshotResult = await channel.refreshPublicationSnapshot.invoke(undefined);
      if (!snapshotResult.success || !snapshotResult.data) {
        throw new Error(snapshotResult.msg || t('settings.channels.publication.loadFailed'));
      }

      applyPublicationSnapshot(snapshotResult.data, setCatalog, setActiveSessions);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : t('settings.channels.publication.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadPublicationSnapshot();
  }, [loadPublicationSnapshot]);

  const profileMap = useMemo(
    () => new Map(catalog.agentProfiles.map((profile) => [profile.id, profile] as const)),
    [catalog.agentProfiles]
  );
  const preferredProfileId = useMemo(
    () => resolvePreferredProfileId(catalog.agentProfiles, publicationIntent),
    [catalog.agentProfiles, publicationIntent]
  );

  useEffect(() => {
    if (catalog.agentProfiles.length === 0) {
      setSelectedAgentProfileId('');
      return;
    }

    setSelectedAgentProfileId((current) => {
      if (current && profileMap.has(current)) {
        return current;
      }

      return catalog.agentProfiles[0]?.id ?? '';
    });
  }, [catalog.agentProfiles, profileMap]);

  useEffect(() => {
    if (!preferredProfileId || appliedIntentKey === publicationIntentKey) {
      return;
    }

    setSelectedAgentProfileId(preferredProfileId);
    setEditor(createPublicationEditorState());
    setAppliedIntentKey(publicationIntentKey);
  }, [appliedIntentKey, preferredProfileId, publicationIntentKey]);

  const selectedAgentProfile = selectedAgentProfileId ? profileMap.get(selectedAgentProfileId) : undefined;
  const audienceMap = useMemo(
    () => new Map(catalog.audiences.map((audience) => [audience.key, audience] as const)),
    [catalog.audiences]
  );
  const allDurableBindings = useMemo(
    () => splitBindingsByLifetime(catalog.bindings).durableBindings,
    [catalog.bindings]
  );
  const selectedAgentBindings = useMemo(
    () => allDurableBindings.filter((binding) => binding.agentProfileId === selectedAgentProfileId),
    [allDurableBindings, selectedAgentProfileId]
  );

  const publishedObjects = useMemo(
    () =>
      buildAgentPublicationObjects({
        channelAccounts: catalogChannelAccounts,
        audiences: catalog.audiences,
        bindings: selectedAgentBindings,
        publications: catalog.publications?.filter(
          (publication) => publication.agentProfileId === selectedAgentProfileId
        ),
        publishObjects: catalog.publishObjects,
        sessions: activeSessions,
      }),
    [
      activeSessions,
      catalog.audiences,
      catalog.publications,
      catalog.publishObjects,
      catalogChannelAccounts,
      selectedAgentBindings,
      selectedAgentProfileId,
    ]
  );

  const publishedBindingCount = useMemo(
    () => publishedObjects.reduce((count, entry) => count + entry.object.bindings.length, 0),
    [publishedObjects]
  );
  const publishedSessionCount = useMemo(
    () => publishedObjects.reduce((count, entry) => count + entry.object.sessions.length, 0),
    [publishedObjects]
  );

  const profileOptions = useMemo(
    () =>
      catalog.agentProfiles.map((profile) => ({
        label: getProfileLabel(profile),
        value: profile.id,
      })),
    [catalog.agentProfiles]
  );

  const channelAccountOptions = useMemo(
    () =>
      catalogChannelAccounts.map((channelAccount) => ({
        label: channelAccount.name,
        value: channelAccount.id,
      })),
    [catalogChannelAccounts]
  );

  const selectedEditorChannelAccount = useMemo<IChannelAccount | undefined>(
    () => catalogChannelAccounts.find((channelAccount) => channelAccount.id === editor.channelAccountId),
    [catalogChannelAccounts, editor.channelAccountId]
  );

  const availableAudiences = useMemo(
    () =>
      catalog.audiences
        .filter((audience) => {
          if (getChannelAccountId(audience) !== editor.channelAccountId) {
            return false;
          }

          return audience.scopeType === 'remote_chat' || audience.scopeType === 'remote_user';
        })
        .toSorted((left, right) => (right.lastActive ?? 0) - (left.lastActive ?? 0)),
    [catalog.audiences, editor.channelAccountId]
  );

  const publishObjectOptions = useMemo(() => {
    if (!selectedEditorChannelAccount) {
      return [];
    }

    return availableAudiences.map((audience) => ({
      label: buildPublishObjectOptionLabel({
        channelAccount: selectedEditorChannelAccount,
        audience,
        t,
      }),
      value: audience.key,
    }));
  }, [availableAudiences, selectedEditorChannelAccount, t]);

  const discoverySummaryMap = useMemo(
    () => new Map((catalog.discoverySummaries ?? []).map((summary) => [summary.channelAccountId, summary] as const)),
    [catalog.discoverySummaries]
  );

  const discoveryStatus = useMemo<DiscoveryStatus | null>(() => {
    if (!selectedEditorChannelAccount || !editor.channelAccountId) {
      return null;
    }

    const explicitSummary = discoverySummaryMap.get(editor.channelAccountId);
    if (explicitSummary) {
      return {
        kind: explicitSummary.state,
        count: explicitSummary.discoveredCount,
      };
    }

    if (availableAudiences.length === 0) {
      return {
        kind: 'empty',
        count: 0,
      };
    }

    const hasOfficialDiscovery = availableAudiences.some(
      (audience) => audience.objectSource === 'official-pull' || audience.objectSource === 'runtime-resolved'
    );

    return {
      kind: hasOfficialDiscovery ? 'official' : 'learned',
      count: availableAudiences.length,
    };
  }, [availableAudiences, discoverySummaryMap, editor.channelAccountId, selectedEditorChannelAccount]);

  useEffect(() => {
    if (!editor.selectedAudienceKey) {
      return;
    }

    const audienceStillExists = availableAudiences.some((audience) => audience.key === editor.selectedAudienceKey);
    if (!audienceStillExists) {
      setEditor((current) => ({
        ...current,
        selectedAudienceKey: '',
      }));
    }
  }, [availableAudiences, editor.selectedAudienceKey]);

  const openAddEditor = useCallback(() => {
    setEditor({
      ...createPublicationEditorState(),
      open: true,
    });
  }, []);

  const resetEditor = useCallback(() => {
    setEditor(createPublicationEditorState());
  }, []);

  const handleEditPublication = useCallback(
    (entry: AgentPublicationObjectEntry) => {
      const primaryBinding = entry.object.bindings[0];
      if (!primaryBinding) {
        return;
      }

      const audience =
        getPublicationAudience(entry, catalog.audiences) ?? getBindingAudience(primaryBinding, audienceMap);
      const channelAccountId = entry.channelAccount.id;

      setEditor({
        open: true,
        editingPublicationId: primaryBinding.id,
        channelAccountId,
        selectedAudienceKey: audience ? audience.key : '',
        useManualScope: !audience,
        manualScopeType: primaryBinding.scopeType === 'remote_user' ? 'remote_user' : 'remote_chat',
        manualScopeKey: audience ? '' : (primaryBinding.scopeKey ?? ''),
      });
    },
    [audienceMap, catalog.audiences]
  );

  const handleDeletePublication = useCallback(
    async (entry: AgentPublicationObjectEntry) => {
      const primaryBinding = entry.object.bindings[0];
      if (!primaryBinding) {
        return;
      }

      setDeletingBindingId(primaryBinding.id);
      try {
        const result = await channel.deletePublication.invoke({ publicationId: primaryBinding.id });
        if (!result.success) {
          throw new Error(result.msg || t('settings.channels.publication.deleteFailed'));
        }
        Message.success(t('settings.channels.publication.deleted'));
        await loadPublicationSnapshot();
      } catch (error) {
        Message.error(error instanceof Error ? error.message : t('settings.channels.publication.deleteFailed'));
      } finally {
        setDeletingBindingId('');
      }
    },
    [loadPublicationSnapshot, t]
  );

  const handleSaveBinding = useCallback(async () => {
    if (!editor.channelAccountId) {
      throw new Error(t('settings.channels.publication.connectorRequired'));
    }
    if (!selectedAgentProfileId) {
      throw new Error(t('settings.channels.publication.agentRequired'));
    }

    const selectedAudience = editor.selectedAudienceKey ? audienceMap.get(editor.selectedAudienceKey) : undefined;
    const scopeType = editor.useManualScope ? editor.manualScopeType : resolveAudienceScopeType(selectedAudience);
    const scopeKey = editor.useManualScope ? editor.manualScopeKey.trim() : editor.selectedAudienceKey;

    if (!scopeKey) {
      throw new Error(
        editor.useManualScope
          ? t('settings.channels.publication.scopeKeyRequired')
          : t('settings.channels.publication.publishObjectRequired')
      );
    }

    setSaving(true);
    try {
      const publishObject =
        !editor.useManualScope && selectedAudience
          ? {
              nativeObjectType: selectedAudience.objectKind ?? selectedAudience.scopeType,
              nativeObjectId: selectedAudience.objectKey ?? selectedAudience.key,
              parentNativeObjectId: selectedAudience.parentObjectKey,
              displayName: selectedAudience.objectTitle ?? selectedAudience.title,
              discoverySource: 'inbound-learned' as const,
            }
          : undefined;
      const publication = buildPublicationPayload(catalog.bindings, {
        existingPublicationId: editor.editingPublicationId || undefined,
        channelAccountId: editor.channelAccountId,
        scopeType,
        scopeKey,
        agentProfileId: selectedAgentProfileId,
        priority: 0,
        publishObject,
      });
      const result = await channel.upsertPublication.invoke({ publication });
      if (!result.success) {
        throw new Error(result.msg || t('settings.channels.publication.saveFailed'));
      }

      Message.success(t('settings.channels.publication.durableSaved'));
      resetEditor();
      await loadPublicationSnapshot();
    } finally {
      setSaving(false);
    }
  }, [audienceMap, catalog.bindings, editor, loadPublicationSnapshot, resetEditor, selectedAgentProfileId, t]);

  const showCatalogLoading = loading && catalogChannelAccounts.length === 0;
  const hasChannelAccounts = catalogChannelAccounts.length > 0;
  const intentProfile =
    (preferredProfileId ? profileMap.get(preferredProfileId) : undefined) ||
    (publicationIntent?.agentProfileId ? profileMap.get(publicationIntent.agentProfileId) : undefined);
  const intentProfileName = intentProfile
    ? getProfileDisplayName(intentProfile)
    : publicationIntent?.agentName || publicationIntent?.agentProfileId || '-';
  const intentConversationLabel = publicationIntent?.conversationName || publicationIntent?.conversationId || '-';
  const intentWorkspaceLabel = intentProfile?.workspaceRef || publicationIntent?.workspace || '-';
  const intentRuntimeLabel = intentProfile ? getProfileRuntimeLabel(intentProfile) : publicationIntent?.backend || '-';

  return (
    <div className='mt-16px border border-[var(--color-border-2)] rd-14px px-14px py-14px'>
      {showCatalogLoading ? (
        <div className='min-h-[460px] flex items-center justify-center'>
          <Spin loading />
        </div>
      ) : hasChannelAccounts ? (
        <div className='space-y-12px'>
          {publicationIntent ? (
            <div className='border border-[rgba(var(--primary-6),0.22)] bg-[rgba(var(--primary-6),0.06)] rd-12px p-12px space-y-8px'>
              <div className='text-14px font-600 text-t-primary'>{t('settings.channels.publication.intentTitle')}</div>
              <div className='text-12px text-t-secondary leading-relaxed'>
                {t('settings.channels.publication.intentDescription')}
              </div>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-8px'>
                <div className='text-12px text-t-secondary'>
                  {t('settings.channels.publication.intentProfile')}:
                  <span className='ml-6px text-t-primary'>{intentProfileName}</span>
                </div>
                <div className='text-12px text-t-secondary'>
                  {t('settings.channels.publication.intentConversation')}:
                  <span className='ml-6px text-t-primary break-all'>{intentConversationLabel}</span>
                </div>
                <div className='text-12px text-t-secondary'>
                  {t('settings.channels.publication.intentWorkspace')}:
                  <span className='ml-6px text-t-primary break-all'>{intentWorkspaceLabel}</span>
                </div>
                <div className='text-12px text-t-secondary'>
                  {t('settings.channels.publication.intentBackend')}:
                  <span className='ml-6px text-t-primary'>{intentRuntimeLabel}</span>
                </div>
              </div>
            </div>
          ) : null}

          <div className='border border-[var(--color-border-2)] rd-12px p-12px space-y-12px'>
            <div className='space-y-4px'>
              <div className='text-14px font-600 text-t-primary'>
                {t('settings.channels.publication.agentSummaryTitle')}
              </div>
              <div className='text-12px text-t-secondary leading-relaxed'>
                {t('settings.channels.publication.agentSummaryDescription')}
              </div>
            </div>
            <div className='grid grid-cols-1 xl:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] gap-12px items-start'>
              <div className='space-y-6px'>
                <div className='text-12px font-500 text-t-primary'>
                  {t('settings.channels.publication.agentSelectorLabel')}
                </div>
                <Select
                  value={selectedAgentProfileId || undefined}
                  options={profileOptions}
                  onChange={(value) => {
                    setSelectedAgentProfileId(String(value));
                    resetEditor();
                  }}
                />
                <div className='hidden'>
                  <Input value={selectedAgentProfileId} onChange={() => undefined} />
                </div>
              </div>
              <div className='space-y-8px'>
                <div className='flex flex-wrap gap-8px'>
                  <Tag className={styles.metricTag}>
                    {t('settings.channels.publication.summaryPublished')}: {publishedBindingCount}
                  </Tag>
                  <Tag className={styles.pillTag}>
                    {t('settings.channels.publication.summaryObjects')}: {publishedObjects.length}
                  </Tag>
                  <Tag className={styles.pillTag}>
                    {t('settings.channels.publication.summarySessions')}: {publishedSessionCount}
                  </Tag>
                </div>
                <div className='grid grid-cols-1 md:grid-cols-3 gap-8px'>
                  <div className={styles.bindingProfileCard}>
                    <div className={styles.bindingProfileMeta}>
                      <div className={styles.bindingProfileLabel}>
                        {t('settings.channels.publication.intentProfile')}
                      </div>
                      <div
                        className={styles.bindingProfileValue}
                        title={selectedAgentProfile ? getProfileDisplayName(selectedAgentProfile) : '-'}
                      >
                        {selectedAgentProfile ? getProfileDisplayName(selectedAgentProfile) : '-'}
                      </div>
                    </div>
                  </div>
                  <div className={styles.bindingProfileCard}>
                    <div className={styles.bindingProfileMeta}>
                      <div className={styles.bindingProfileLabel}>
                        {t('settings.channels.publication.intentBackend')}
                      </div>
                      <div
                        className={styles.bindingProfileValue}
                        title={selectedAgentProfile ? getProfileRuntimeLabel(selectedAgentProfile) : '-'}
                      >
                        {selectedAgentProfile ? getProfileRuntimeLabel(selectedAgentProfile) : '-'}
                      </div>
                    </div>
                  </div>
                  <div className={styles.bindingProfileCard}>
                    <div className={styles.bindingProfileMeta}>
                      <div className={styles.bindingProfileLabel}>
                        {t('settings.channels.publication.intentWorkspace')}
                      </div>
                      <div
                        className={styles.bindingProfileValue}
                        title={selectedAgentProfile ? getProfileWorkspaceLabel(selectedAgentProfile) : '-'}
                      >
                        {selectedAgentProfile ? getProfileWorkspaceLabel(selectedAgentProfile) : '-'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className='border border-[var(--color-border-2)] rd-12px p-12px space-y-12px'>
            <div className='flex flex-wrap items-start justify-between gap-12px'>
              <div className='space-y-4px'>
                <div className='text-14px font-600 text-t-primary'>
                  {t('settings.channels.publication.objectListTitle')}
                </div>
                <div className='text-12px text-t-secondary leading-relaxed'>
                  {t('settings.channels.publication.objectListDescription')}
                </div>
              </div>
              <div className='flex flex-wrap items-center gap-8px'>
                <Button
                  type='secondary'
                  icon={<Refresh theme='outline' size='16' />}
                  loading={loading}
                  onClick={() => void loadPublicationSnapshot()}
                >
                  {t('common.refresh')}
                </Button>
                {!editor.open ? (
                  <Button type='primary' icon={<Plus theme='outline' size='16' />} onClick={openAddEditor}>
                    {t('settings.channels.publication.addObjectButton')}
                  </Button>
                ) : null}
              </div>
            </div>

            {publishedObjects.length > 0 ? (
              <div className='space-y-8px'>
                {publishedObjects.map((entry) => {
                  const primaryBinding = entry.object.bindings[0];
                  const objectKindLabel = getPublicationObjectKindLabel(
                    entry.channelAccount.platform,
                    entry.object.kind,
                    t
                  );
                  const objectRefreshBadgeLabel = getObjectRefreshBadgeLabel(entry, t);
                  const lastActiveLabel = formatOptionalRelativeTime(entry.currentSession?.lastActivity, i18n.language);
                  const relatedSessions = entry.object.sessions.toSorted(
                    (left, right) => right.lastActivity - left.lastActivity
                  );

                  return (
                    <div key={entry.key} className={styles.bindingCard}>
                      <div className={styles.bindingMain}>
                        <div className={styles.bindingHeader}>
                          <div className={styles.bindingTitleBlock}>
                            <div className='flex flex-wrap items-center gap-6px'>
                              <Tag className={styles.pillTag}>{objectKindLabel}</Tag>
                              <Tag className={styles.metricTag}>{t('settings.channels.publication.durableTag')}</Tag>
                              {objectRefreshBadgeLabel ? (
                                <Tag className={styles.statusTag}>{objectRefreshBadgeLabel}</Tag>
                              ) : null}
                              {!primaryBinding?.enabled ? (
                                <Tag className={styles.statusTag}>{t('settings.channels.publication.disabled')}</Tag>
                              ) : null}
                            </div>
                            <div className={styles.bindingTitleRow}>
                              <div className={styles.selectorTitle} title={entry.object.title}>
                                {entry.object.title}
                              </div>
                            </div>
                            {entry.object.subtitle && entry.object.subtitle !== entry.object.title ? (
                              <div className={styles.bindingDetail}>{entry.object.subtitle}</div>
                            ) : null}
                            <div className='grid grid-cols-1 md:grid-cols-2 gap-6px text-12px text-t-secondary'>
                              <div>{`${t('settings.channels.publication.channelAccountInstanceLabel')}: ${entry.channelAccount.name}`}</div>
                              <div>
                                {`${t('settings.channels.publication.sessionStatusLabel')}: ${
                                  entry.currentSession
                                    ? t('settings.channels.publication.currentSessionActive')
                                    : t('settings.channels.publication.noActiveSession')
                                }`}
                              </div>
                              {entry.object.parentTitle ? (
                                <div>
                                  {t('settings.channels.publication.objectParentLabel')}:
                                  <span className='ml-6px text-t-primary'>{entry.object.parentTitle}</span>
                                </div>
                              ) : null}
                              {entry.currentSession?.workspace ? (
                                <div>
                                  {t('settings.channels.publication.sessionWorkspaceLabel')}:
                                  <span className='ml-6px text-t-primary break-all'>
                                    {entry.currentSession.workspace}
                                  </span>
                                </div>
                              ) : null}
                              {lastActiveLabel ? (
                                <div>
                                  {t('settings.channels.publication.sessionLastActiveLabel')}:
                                  <span className='ml-6px text-t-primary'>{lastActiveLabel}</span>
                                </div>
                              ) : null}
                            </div>
                            <div className='space-y-6px border border-[var(--color-border-2)] rd-12px p-10px bg-[var(--color-fill-1)]/40'>
                              <div className='space-y-2px'>
                                <div className='text-12px font-600 text-t-primary'>
                                  {t('settings.channels.publication.objectSessionsTitle')}
                                </div>
                                <div className='text-12px text-t-secondary leading-relaxed'>
                                  {t('settings.channels.publication.objectSessionsDescription')}
                                </div>
                              </div>
                              {relatedSessions.length > 0 ? (
                                <div className='space-y-6px'>
                                  {relatedSessions.map((session) => {
                                    const sessionLastActiveLabel = formatOptionalRelativeTime(
                                      session.lastActivity,
                                      i18n.language
                                    );

                                    return (
                                      <div key={session.id} className={styles.bindingConversationRow}>
                                        <div className={styles.bindingConversationMeta}>
                                          <div
                                            className={styles.bindingConversationLabel}
                                            title={
                                              getSessionConversationPointer(session) ??
                                              session.externalSessionId ??
                                              session.id
                                            }
                                          >
                                            {getSessionConversationPointer(session) ??
                                              session.externalSessionId ??
                                              session.id}
                                          </div>
                                          <div
                                            className={styles.bindingConversationValue}
                                            title={session.workspace ?? session.audienceTitle}
                                          >
                                            {session.workspace ?? session.audienceTitle}
                                          </div>
                                          <div className='text-12px text-t-secondary leading-relaxed'>
                                            {sessionLastActiveLabel
                                              ? `${t('settings.channels.publication.sessionLastActiveLabel')}: ${sessionLastActiveLabel}`
                                              : t('settings.channels.publication.currentSessionActive')}
                                          </div>
                                        </div>
                                        {entry.currentSession?.id === session.id ? (
                                          <Tag className={styles.metricTag}>
                                            {t('settings.channels.publication.currentSessionActive')}
                                          </Tag>
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className='text-12px text-t-secondary leading-relaxed'>
                                  {t('settings.channels.publication.objectSessionsEmpty')}
                                </div>
                              )}
                            </div>
                          </div>
                          {primaryBinding ? (
                            <div className={styles.bindingActions}>
                              <Tooltip content={t('common.edit')}>
                                <Button
                                  size='mini'
                                  type='text'
                                  shape='circle'
                                  className={styles.bindingIconButton}
                                  icon={<Edit theme='outline' size='16' />}
                                  onClick={() => handleEditPublication(entry)}
                                />
                              </Tooltip>
                              <Tooltip content={t('common.delete')}>
                                <Button
                                  size='mini'
                                  status='danger'
                                  type='text'
                                  shape='circle'
                                  className={styles.bindingIconButton}
                                  icon={<Delete theme='outline' size='16' />}
                                  loading={deletingBindingId === primaryBinding.id}
                                  onClick={() => void handleDeletePublication(entry)}
                                />
                              </Tooltip>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className='min-h-160px flex items-center justify-center'>
                <Empty
                  description={t('settings.channels.publication.emptyPublishedObjects')}
                  className='w-full py-16px'
                />
              </div>
            )}
          </div>

          {editor.open ? (
            <div className='border border-[var(--color-border-2)] rd-12px p-12px space-y-10px'>
              <div className='flex flex-wrap items-start justify-between gap-12px'>
                <div className='space-y-4px'>
                  <div className='text-14px font-600 text-t-primary'>
                    {t('settings.channels.publication.addObjectTitle')}
                  </div>
                  <div className='text-12px text-t-secondary leading-relaxed'>
                    {t('settings.channels.publication.addObjectDescription')}
                  </div>
                </div>
                {editor.editingPublicationId ? (
                  <Tag className={styles.metricTag}>{t('settings.channels.publication.updateDurable')}</Tag>
                ) : null}
              </div>

              <div className='grid grid-cols-1 xl:grid-cols-[minmax(220px,280px)_minmax(0,1fr)] gap-12px'>
                <div className='space-y-6px'>
                  <div className='text-12px font-500 text-t-primary'>
                    {t('settings.channels.publication.connectorLabel')}
                  </div>
                  <Select
                    value={editor.channelAccountId || undefined}
                    options={channelAccountOptions}
                    placeholder={t('settings.channels.publication.connectorPlaceholder')}
                    onChange={(value) =>
                      setEditor((current) => ({
                        ...current,
                        channelAccountId: String(value),
                        selectedAudienceKey: '',
                      }))
                    }
                    allowClear
                  />
                </div>

                <div className='space-y-6px'>
                  <div className='text-12px font-500 text-t-primary'>
                    {t('settings.channels.publication.publishObjectLabel')}
                  </div>
                  <Select
                    value={editor.selectedAudienceKey || undefined}
                    options={publishObjectOptions}
                    placeholder={t('settings.channels.publication.publishObjectPlaceholder')}
                    onChange={(value) =>
                      setEditor((current) => ({
                        ...current,
                        selectedAudienceKey: String(value),
                        useManualScope: false,
                        manualScopeKey: '',
                      }))
                    }
                    disabled={!editor.channelAccountId || editor.useManualScope}
                    allowClear
                  />
                  {discoveryStatus ? (
                    <div className='space-y-6px border border-[var(--color-border-2)] rd-12px p-10px bg-[var(--color-fill-1)]/40'>
                      <div className='text-12px font-600 text-t-primary'>
                        {t('settings.channels.publication.discoveryStatusLabel')}
                      </div>
                      <div className='text-12px text-t-secondary leading-relaxed'>
                        {discoveryStatus.kind === 'official'
                          ? t('settings.channels.publication.discoveryHintOfficial', {
                              count: discoveryStatus.count,
                            })
                          : discoveryStatus.kind === 'learned'
                            ? t('settings.channels.publication.discoveryHintLearned', {
                                count: discoveryStatus.count,
                              })
                            : t('settings.channels.publication.discoveryHintEmpty')}
                      </div>
                      {discoveryStatus.kind === 'empty' ? (
                        <div className='space-y-6px'>
                          <Button
                            type='text'
                            className='!justify-start !px-0'
                            onClick={() =>
                              setEditor((current) => ({
                                ...current,
                                useManualScope: true,
                                selectedAudienceKey: '',
                              }))
                            }
                          >
                            {t('settings.channels.publication.discoveryHintEmptyAction')}
                          </Button>
                          <div className='text-12px text-t-secondary leading-relaxed'>
                            {t('settings.channels.publication.discoveryHintEmptyHelp')}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <Button
                    type='text'
                    className='!justify-start !px-0'
                    onClick={() =>
                      setEditor((current) => ({
                        ...current,
                        useManualScope: !current.useManualScope,
                        selectedAudienceKey: current.useManualScope ? current.selectedAudienceKey : '',
                      }))
                    }
                  >
                    {t('settings.channels.publication.manualScopeToggle')}
                  </Button>
                  {editor.useManualScope ? (
                    <div className='space-y-6px'>
                      <Select
                        value={editor.manualScopeType}
                        options={[
                          {
                            label: t('settings.channels.publication.scope.remoteUser'),
                            value: 'remote_user',
                          },
                          {
                            label: t('settings.channels.publication.scope.remoteChat'),
                            value: 'remote_chat',
                          },
                        ]}
                        onChange={(value) =>
                          setEditor((current) => ({
                            ...current,
                            manualScopeType: value as DurableBindingScopeType,
                          }))
                        }
                      />
                      <Input
                        value={editor.manualScopeKey}
                        onChange={(value) =>
                          setEditor((current) => ({
                            ...current,
                            manualScopeKey: value,
                          }))
                        }
                        placeholder={getManualScopePlaceholder(editor.manualScopeType, t)}
                      />
                      <div className='text-12px text-t-secondary'>
                        {t('settings.channels.publication.manualKeyHint')}
                      </div>
                    </div>
                  ) : null}
                  {!editor.useManualScope && editor.selectedAudienceKey ? (
                    <div className='text-12px text-t-secondary'>
                      {selectedEditorChannelAccount && audienceMap.get(editor.selectedAudienceKey)
                        ? buildPublishObjectOptionLabel({
                            channelAccount: selectedEditorChannelAccount,
                            audience: audienceMap.get(editor.selectedAudienceKey)!,
                            t,
                          })
                        : ''}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className='flex flex-wrap gap-8px'>
                <Button
                  type='primary'
                  icon={<Plus theme='outline' size='16' />}
                  loading={saving}
                  onClick={() =>
                    void handleSaveBinding().catch((error) =>
                      Message.error(
                        error instanceof Error ? error.message : t('settings.channels.publication.saveFailed')
                      )
                    )
                  }
                >
                  {editor.editingPublicationId
                    ? t('settings.channels.publication.updateDurable')
                    : t('settings.channels.publication.saveDurable')}
                </Button>
                <Button icon={<Undo theme='outline' size='16' />} onClick={resetEditor}>
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className='min-h-[460px] flex items-center justify-center px-16px'>
          <div className='w-full max-w-480px flex flex-col items-center justify-center gap-16px text-center mx-auto'>
            <Empty description={t('settings.channels.publication.noConnector')} className='mx-auto' />
            <Button
              type='primary'
              onClick={() => {
                void navigate('/settings/channels');
              }}
            >
              {t('settings.channels.publication.goToAccounts')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicationBindingPanel;
