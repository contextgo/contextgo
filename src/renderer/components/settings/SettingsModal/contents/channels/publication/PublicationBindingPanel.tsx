/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { channel } from '@/common/adapter/ipcBridge';
import {
  getChannelAccountId,
  type IAgentProfile,
  type IChannelActiveSessionEntry,
  type IChannelAccount,
  type IChannelAudienceEntry,
  type IChannelBinding,
  type IChannelBindingCatalog,
} from '@process/channels/types';
import { Button, Empty, Input, Message, Select, Spin, Tag, Tooltip } from '@arco-design/web-react';
import { Delete, Edit, Plus, Undo } from '@icon-park/react';
import classNames from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import styles from '../ChannelModalContent.module.css';
import {
  buildPublicationObjects,
  getPublicationObjectKindLabel,
  type PublicationObjectViewModel,
} from './objectViewModel';
import {
  buildBindingPayload,
  splitBindingsByLifetime,
  type BindingDraft,
  type DurableBindingScopeType,
} from './viewModel';

type BindingScopeOption = {
  value: DurableBindingScopeType;
  label: string;
};

type DurableEditorState = {
  editingBindingId: string;
  scopeType: DurableBindingScopeType;
  selectedAudienceKey: string;
  manualScopeKey: string;
  agentProfileId: string;
};

type PublicationIntent = {
  agentProfileId?: string;
  conversationId?: string;
  conversationName?: string;
  backend?: string;
  customAgentId?: string;
  workspace?: string;
  agentName?: string;
};

type TranslationFn = ReturnType<typeof useTranslation>['t'];

const EMPTY_CATALOG: IChannelBindingCatalog = {
  connectors: [],
  channelAccounts: [],
  agentProfiles: [],
  bindings: [],
  audiences: [],
};

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

function getAudienceLabel(audience: IChannelAudienceEntry): string {
  return audience.subtitle ? `${audience.title} · ${audience.subtitle}` : audience.title;
}

function createDurableEditorState(agentProfileId = ''): DurableEditorState {
  return {
    editingBindingId: '',
    scopeType: 'connector_default',
    selectedAudienceKey: '',
    manualScopeKey: '',
    agentProfileId,
  };
}

function resolveScopeKey(selectedAudienceKey: string, manualScopeKey: string): string {
  return manualScopeKey.trim() || selectedAudienceKey;
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

function getChannelAccountGuide(platform: string, t: TranslationFn): string {
  if (platform === 'weixin') {
    return t('settings.channels.publication.connectorGuide.weixin');
  }

  return t('settings.channels.publication.connectorGuide.multiSession');
}

function getScopeHint(scopeType: DurableBindingScopeType, t: TranslationFn): string {
  if (scopeType === 'connector_default') {
    return t('settings.channels.publication.targetTypeHint.connectorDefault');
  }

  if (scopeType === 'remote_user') {
    return t('settings.channels.publication.targetTypeHint.remoteUser');
  }

  return t('settings.channels.publication.targetTypeHint.remoteChat');
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

function getBindingTargetSummary(params: {
  binding: IChannelBinding;
  selectedObject?: PublicationObjectViewModel;
  audienceMap: Map<string, IChannelAudienceEntry>;
  t: TranslationFn;
}): {
  title: string;
  detail?: string;
} {
  const audience = getBindingAudience(params.binding, params.audienceMap);
  const title =
    audience?.objectTitle ??
    audience?.title ??
    params.selectedObject?.title ??
    params.t('settings.channels.publication.connectorDefaultAudience');
  const detailParts: string[] = [];
  const parentTitle = audience?.parentObjectTitle ?? params.selectedObject?.parentTitle;
  const subtitle =
    audience?.objectSubtitle ??
    audience?.subtitle ??
    (params.selectedObject?.subtitle !== params.selectedObject?.title ? params.selectedObject?.subtitle : undefined);

  if (parentTitle) {
    detailParts.push(`${params.t('settings.channels.publication.objectParentLabel')}: ${parentTitle}`);
  }
  if (subtitle && subtitle !== title) {
    detailParts.push(subtitle);
  }

  return {
    title,
    detail: detailParts.length > 0 ? detailParts.join(' · ') : undefined,
  };
}

function resolveObjectEditorState(
  object: PublicationObjectViewModel,
  audienceMap: Map<string, IChannelAudienceEntry>,
  currentAgentProfileId: string
): Partial<DurableEditorState> {
  const primaryAudience = object.primaryAudience;
  if (primaryAudience) {
    return {
      editingBindingId: '',
      scopeType: primaryAudience.scopeType === 'remote_user' ? 'remote_user' : 'remote_chat',
      selectedAudienceKey: primaryAudience.key,
      manualScopeKey: '',
      agentProfileId: currentAgentProfileId,
    };
  }

  const existingBinding = object.bindings.find(
    (binding) => binding.scopeType !== 'connector_default' && binding.scopeKey
  );
  if (!existingBinding?.scopeKey) {
    return {
      editingBindingId: '',
      agentProfileId: currentAgentProfileId,
    };
  }

  const discovered = audienceMap.has(existingBinding.scopeKey);
  return {
    editingBindingId: '',
    scopeType: existingBinding.scopeType === 'remote_user' ? 'remote_user' : 'remote_chat',
    selectedAudienceKey: discovered ? existingBinding.scopeKey : '',
    manualScopeKey: discovered ? '' : existingBinding.scopeKey,
    agentProfileId: currentAgentProfileId,
  };
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

const PublicationBindingPanel: React.FC = () => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const [catalog, setCatalog] = useState<IChannelBindingCatalog>(EMPTY_CATALOG);
  const [activeSessions, setActiveSessions] = useState<IChannelActiveSessionEntry[]>([]);
  const [selectedChannelAccountId, setSelectedChannelAccountId] = useState('');
  const [selectedObjectKey, setSelectedObjectKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingBindingId, setDeletingBindingId] = useState('');
  const [durableEditor, setDurableEditor] = useState<DurableEditorState>(createDurableEditorState());
  const [showDurableManualScope, setShowDurableManualScope] = useState(false);
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

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const [catalogResult, sessionResult] = await Promise.all([
        channel.getBindingCatalog.invoke({}),
        channel.getActiveSessionCatalog.invoke(),
      ]);

      if (!catalogResult.success || !catalogResult.data) {
        throw new Error(catalogResult.msg || t('settings.channels.publication.loadFailed'));
      }
      if (!sessionResult.success || !sessionResult.data) {
        throw new Error(sessionResult.msg || t('settings.channels.publication.loadFailed'));
      }

      const firstAgentProfileId = catalogResult.data.agentProfiles[0]?.id || '';
      const nextChannelAccounts = catalogResult.data.channelAccounts ?? catalogResult.data.connectors;

      setCatalog(catalogResult.data);
      setActiveSessions(sessionResult.data);
      setSelectedChannelAccountId((current) => {
        if (current && nextChannelAccounts.some((channelAccount) => channelAccount.id === current)) {
          return current;
        }
        return nextChannelAccounts[0]?.id ?? '';
      });
      setDurableEditor((editor) => ({
        ...editor,
        agentProfileId: editor.agentProfileId || firstAgentProfileId,
      }));
    } catch (error) {
      Message.error(error instanceof Error ? error.message : t('settings.channels.publication.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const profileOptions = useMemo(
    () =>
      catalog.agentProfiles.map((profile) => ({
        label: getProfileLabel(profile),
        value: profile.id,
      })),
    [catalog.agentProfiles]
  );

  const profileMap = useMemo(
    () => new Map(catalog.agentProfiles.map((profile) => [profile.id, profile] as const)),
    [catalog.agentProfiles]
  );
  const audienceMap = useMemo(
    () => new Map(catalog.audiences.map((audience) => [audience.key, audience] as const)),
    [catalog.audiences]
  );

  const preferredProfileId = useMemo(
    () => resolvePreferredProfileId(catalog.agentProfiles, publicationIntent),
    [catalog.agentProfiles, publicationIntent]
  );
  const intentProfile = useMemo(
    () =>
      (preferredProfileId ? profileMap.get(preferredProfileId) : undefined) ||
      (publicationIntent?.agentProfileId ? profileMap.get(publicationIntent.agentProfileId) : undefined),
    [preferredProfileId, profileMap, publicationIntent?.agentProfileId]
  );

  const selectedChannelAccount = useMemo<IChannelAccount | undefined>(
    () => catalogChannelAccounts.find((channelAccount) => channelAccount.id === selectedChannelAccountId),
    [catalogChannelAccounts, selectedChannelAccountId]
  );

  const selectedBindings = useMemo(
    () => catalog.bindings.filter((binding) => getChannelAccountId(binding) === selectedChannelAccountId),
    [catalog.bindings, selectedChannelAccountId]
  );
  const { durableBindings } = useMemo(() => splitBindingsByLifetime(selectedBindings), [selectedBindings]);
  const selectedAudiences = useMemo(
    () => catalog.audiences.filter((audience) => getChannelAccountId(audience) === selectedChannelAccountId),
    [catalog.audiences, selectedChannelAccountId]
  );
  const selectedSessions = useMemo(
    () => activeSessions.filter((session) => getChannelAccountId(session) === selectedChannelAccountId),
    [activeSessions, selectedChannelAccountId]
  );

  const publicationObjects = useMemo(() => {
    if (!selectedChannelAccount) {
      return [];
    }

    return buildPublicationObjects({
      platform: selectedChannelAccount.platform,
      audiences: selectedAudiences,
      bindings: durableBindings.filter((binding) => binding.scopeType !== 'connector_default'),
      sessions: selectedSessions,
      resolveBindingAudience: (binding) => getBindingAudience(binding, audienceMap),
    });
  }, [audienceMap, durableBindings, selectedAudiences, selectedChannelAccount, selectedSessions]);

  const selectedObject = useMemo(
    () => publicationObjects.find((object) => object.key === selectedObjectKey),
    [publicationObjects, selectedObjectKey]
  );
  const selectedPublishedCount = useMemo(
    () => publicationObjects.filter((object) => object.bindings.length > 0).length,
    [publicationObjects]
  );

  const durableScopeOptions = useMemo<BindingScopeOption[]>(
    () => [
      { value: 'connector_default', label: t('settings.channels.publication.scope.connectorDefault') },
      { value: 'remote_user', label: t('settings.channels.publication.scope.remoteUser') },
      { value: 'remote_chat', label: t('settings.channels.publication.scope.remoteChat') },
    ],
    [t]
  );

  const durableAudienceOptions = useMemo(
    () =>
      selectedAudiences
        .filter((audience) => audience.scopeType === durableEditor.scopeType)
        .map((audience) => ({
          label: getAudienceLabel(audience),
          value: audience.key,
        })),
    [durableEditor.scopeType, selectedAudiences]
  );

  const durableScopeHint = useMemo(() => getScopeHint(durableEditor.scopeType, t), [durableEditor.scopeType, t]);
  const channelAccountGuide = useMemo(
    () =>
      selectedChannelAccount
        ? getChannelAccountGuide(selectedChannelAccount.platform, t)
        : t('settings.channels.publication.connectorGuide'),
    [selectedChannelAccount, t]
  );

  const resetDurableEditor = useCallback(
    (
      nextState?: Partial<
        Pick<DurableEditorState, 'scopeType' | 'selectedAudienceKey' | 'manualScopeKey' | 'agentProfileId'>
      >
    ) => {
      setShowDurableManualScope(Boolean(nextState?.manualScopeKey));
      setDurableEditor({
        ...createDurableEditorState(nextState?.agentProfileId ?? durableEditor.agentProfileId),
        scopeType: nextState?.scopeType ?? 'connector_default',
        selectedAudienceKey: nextState?.selectedAudienceKey ?? '',
        manualScopeKey: nextState?.manualScopeKey ?? '',
      });
    },
    [durableEditor.agentProfileId]
  );

  useEffect(() => {
    if (!selectedChannelAccountId) {
      return;
    }

    setDurableEditor((editor) => {
      const audienceStillValid =
        !editor.selectedAudienceKey ||
        selectedAudiences.some((audience) => audience.key === editor.selectedAudienceKey);
      if (audienceStillValid) {
        return editor;
      }
      return {
        ...editor,
        selectedAudienceKey: '',
      };
    });
  }, [selectedAudiences, selectedChannelAccountId]);

  useEffect(() => {
    if (!preferredProfileId || appliedIntentKey === publicationIntentKey) {
      return;
    }

    setDurableEditor((editor) =>
      editor.editingBindingId ? editor : { ...editor, agentProfileId: preferredProfileId }
    );
    setAppliedIntentKey(publicationIntentKey);
  }, [appliedIntentKey, preferredProfileId, publicationIntentKey]);

  useEffect(() => {
    setSelectedObjectKey((current) => {
      if (current && publicationObjects.some((object) => object.key === current)) {
        return current;
      }

      return publicationObjects[0]?.key ?? '';
    });
  }, [publicationObjects]);

  const validateDraft = useCallback(
    (draft: BindingDraft) => {
      if (!draft.channelAccountId) {
        throw new Error(t('settings.channels.publication.connectorRequired'));
      }
      if (!draft.agentProfileId) {
        throw new Error(t('settings.channels.publication.agentRequired'));
      }
      if (draft.scopeType !== 'connector_default' && !draft.scopeKey.trim()) {
        throw new Error(t('settings.channels.publication.scopeKeyRequired'));
      }
    },
    [t]
  );

  const saveBinding = useCallback(
    async (draft: BindingDraft) => {
      validateDraft(draft);
      setSaving(true);
      try {
        const binding = buildBindingPayload(catalog.bindings, draft);
        const result = await channel.upsertBinding.invoke({ binding });
        if (!result.success) {
          throw new Error(result.msg || t('settings.channels.publication.saveFailed'));
        }
        Message.success(t('settings.channels.publication.durableSaved'));
        await loadCatalog();
      } finally {
        setSaving(false);
      }
    },
    [catalog.bindings, loadCatalog, t, validateDraft]
  );

  const handleDeleteBinding = useCallback(
    async (bindingId: string) => {
      setDeletingBindingId(bindingId);
      try {
        const result = await channel.deleteBinding.invoke({ bindingId });
        if (!result.success) {
          throw new Error(result.msg || t('settings.channels.publication.deleteFailed'));
        }
        Message.success(t('settings.channels.publication.deleted'));
        await loadCatalog();
      } catch (error) {
        Message.error(error instanceof Error ? error.message : t('settings.channels.publication.deleteFailed'));
      } finally {
        setDeletingBindingId('');
      }
    },
    [loadCatalog, t]
  );

  const handleObjectSelect = useCallback(
    (object: PublicationObjectViewModel) => {
      setSelectedObjectKey(object.key);
      const nextEditorState = resolveObjectEditorState(object, audienceMap, durableEditor.agentProfileId);
      setShowDurableManualScope(Boolean(nextEditorState.manualScopeKey));
      setDurableEditor((editor) => ({
        ...editor,
        ...nextEditorState,
      }));
    },
    [audienceMap, durableEditor.agentProfileId]
  );

  const handleEditBinding = useCallback(
    (binding: IChannelBinding) => {
      const targetObject = publicationObjects.find((object) => object.bindings.some((item) => item.id === binding.id));
      if (targetObject) {
        setSelectedObjectKey(targetObject.key);
      }

      const discovered = Boolean(binding.scopeKey && audienceMap.has(binding.scopeKey));
      setShowDurableManualScope(Boolean(binding.scopeKey && !discovered));
      setDurableEditor({
        editingBindingId: binding.id,
        scopeType: binding.scopeType as DurableBindingScopeType,
        selectedAudienceKey: discovered ? (binding.scopeKey ?? '') : '',
        manualScopeKey: discovered ? '' : (binding.scopeKey ?? ''),
        agentProfileId: binding.agentProfileId,
      });
    },
    [audienceMap, publicationObjects]
  );

  const handleSaveDurableBinding = useCallback(async () => {
    const resolvedScopeKey =
      durableEditor.scopeType === 'connector_default'
        ? ''
        : resolveScopeKey(durableEditor.selectedAudienceKey, durableEditor.manualScopeKey);
    const publishObject =
      durableEditor.scopeType !== 'connector_default' && selectedObject
        ? {
            nativeObjectType: selectedObject.kind,
            nativeObjectId: selectedObject.key,
            parentNativeObjectId: selectedObject.parentKey,
            displayName: selectedObject.title,
            discoverySource: 'inbound-learned' as const,
          }
        : undefined;

    await saveBinding({
      channelAccountId: selectedChannelAccountId,
      scopeType: durableEditor.scopeType,
      scopeKey: resolvedScopeKey,
      agentProfileId: durableEditor.agentProfileId,
      temporary: false,
      priority: 0,
      publishObject,
    });

    resetDurableEditor({
      scopeType: durableEditor.scopeType,
      selectedAudienceKey: durableEditor.manualScopeKey ? '' : resolvedScopeKey,
      manualScopeKey: durableEditor.manualScopeKey ? resolvedScopeKey : '',
      agentProfileId: durableEditor.agentProfileId,
    });
  }, [
    durableEditor.agentProfileId,
    durableEditor.manualScopeKey,
    durableEditor.scopeType,
    durableEditor.selectedAudienceKey,
    resetDurableEditor,
    saveBinding,
    selectedObject,
    selectedChannelAccountId,
  ]);

  const durableScopeKeyPlaceholder = useMemo(() => {
    if (durableEditor.scopeType === 'remote_user') {
      return t('settings.channels.publication.scopeKeyRemoteUserPlaceholder');
    }
    if (durableEditor.scopeType === 'remote_chat') {
      return t('settings.channels.publication.scopeKeyRemoteChatPlaceholder');
    }
    return '';
  }, [durableEditor.scopeType, t]);

  const hasChannelAccounts = catalogChannelAccounts.length > 0;
  const showCatalogLoading = loading && !hasChannelAccounts;
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

          <div className='grid grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)] gap-12px items-start'>
            <div className='border border-[var(--color-border-2)] rd-12px p-12px space-y-10px xl:sticky xl:top-0'>
              <div className='space-y-4px'>
                <div className='text-13px font-600 text-t-primary'>
                  {t('settings.channels.publication.connectorLabel')}
                </div>
                <div className='text-12px text-t-secondary leading-relaxed'>
                  {t('settings.channels.publication.connectorGuide')}
                </div>
              </div>
              <div className='space-y-8px'>
                {catalogChannelAccounts.map((channelAccount) => {
                  const accountSelected = channelAccount.id === selectedChannelAccountId;
                  const accountBindings = catalog.bindings.filter(
                    (binding) => getChannelAccountId(binding) === channelAccount.id
                  );
                  const { durableBindings: accountDurableBindings } = splitBindingsByLifetime(accountBindings);
                  const accountObjects = buildPublicationObjects({
                    platform: channelAccount.platform,
                    audiences: catalog.audiences.filter(
                      (audience) => getChannelAccountId(audience) === channelAccount.id
                    ),
                    bindings: accountDurableBindings.filter((binding) => binding.scopeType !== 'connector_default'),
                    sessions: activeSessions.filter((session) => getChannelAccountId(session) === channelAccount.id),
                    resolveBindingAudience: (binding) => getBindingAudience(binding, audienceMap),
                  });
                  const accountSessions = activeSessions.filter(
                    (session) => getChannelAccountId(session) === channelAccount.id
                  );

                  return (
                    <Button
                      key={channelAccount.id}
                      type='text'
                      className={classNames(styles.instanceButton, accountSelected && styles.instanceButtonActive)}
                      onClick={() => setSelectedChannelAccountId(channelAccount.id)}
                    >
                      <div className={styles.instanceButtonInner}>
                        <div className={styles.selectorCardBody}>
                          <div className={styles.selectorHeading}>
                            <span className={styles.selectorTitle} title={channelAccount.name}>
                              {channelAccount.name}
                            </span>
                            <Tag className={styles.platformTag}>{channelAccount.platform}</Tag>
                          </div>
                          <div className={styles.selectorStats}>
                            <Tag className={styles.pillTag}>
                              {t('settings.channels.publication.summaryPublished')}:{' '}
                              {accountObjects.filter((item) => item.bindings.length > 0).length}
                            </Tag>
                            <Tag className={styles.pillTag}>
                              {t('settings.channels.publication.summaryObjects')}: {accountObjects.length}
                            </Tag>
                            <Tag className={styles.pillTag}>
                              {t('settings.channels.publication.summarySessions')}: {accountSessions.length}
                            </Tag>
                          </div>
                        </div>
                      </div>
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className='space-y-12px'>
              {selectedChannelAccount ? (
                <div className='border border-[var(--color-border-2)] rd-12px p-12px space-y-12px'>
                  <div className='space-y-4px'>
                    <div className='flex flex-wrap items-center gap-8px'>
                      <div className={styles.selectorTitle} title={selectedChannelAccount.name}>
                        {selectedChannelAccount.name}
                      </div>
                      <Tag className={styles.platformTag}>{selectedChannelAccount.platform}</Tag>
                    </div>
                    <div className='text-13px text-t-primary leading-relaxed'>
                      {t('settings.channels.publication.accountOverview')}
                    </div>
                    <div className='flex flex-wrap gap-8px'>
                      <Tag className={styles.pillTag}>
                        {t('settings.channels.publication.summaryPublished')}: {selectedPublishedCount}
                      </Tag>
                      <Tag className={styles.pillTag}>
                        {t('settings.channels.publication.summaryObjects')}: {publicationObjects.length}
                      </Tag>
                      <Tag className={styles.pillTag}>
                        {t('settings.channels.publication.summarySessions')}: {selectedSessions.length}
                      </Tag>
                    </div>
                  </div>
                  <div className='text-12px text-t-secondary leading-relaxed'>{channelAccountGuide}</div>
                </div>
              ) : null}

              <div className='grid grid-cols-1 2xl:grid-cols-[320px_minmax(0,1fr)] gap-12px items-start'>
                <div className='border border-[var(--color-border-2)] rd-12px p-12px space-y-10px'>
                  <div className='space-y-4px'>
                    <div className='text-14px font-600 text-t-primary'>
                      {t('settings.channels.publication.objectListTitle')}
                    </div>
                    <div className='text-12px text-t-secondary leading-relaxed'>
                      {t('settings.channels.publication.objectListDescription')}
                    </div>
                  </div>
                  {publicationObjects.length > 0 ? (
                    <div className='space-y-8px'>
                      {publicationObjects.map((object) => {
                        const objectSelected = object.key === selectedObjectKey;
                        const objectKindLabel = getPublicationObjectKindLabel(
                          selectedChannelAccount?.platform ?? 'telegram',
                          object.kind,
                          t
                        );

                        return (
                          <Button
                            key={object.key}
                            type='text'
                            className={classNames(styles.instanceButton, objectSelected && styles.instanceButtonActive)}
                            onClick={() => handleObjectSelect(object)}
                          >
                            <div className={styles.instanceButtonInner}>
                              <div className={styles.selectorCardBody}>
                                <div className={styles.selectorHeading}>
                                  <span className={styles.selectorTitle} title={object.title}>
                                    {object.title}
                                  </span>
                                  <Tag className={styles.pillTag}>{objectKindLabel}</Tag>
                                  {object.bindings.length > 0 ? (
                                    <Tag className={styles.metricTag}>
                                      {t('settings.channels.publication.durableTag')}
                                    </Tag>
                                  ) : null}
                                </div>
                                {object.subtitle && object.subtitle !== object.title ? (
                                  <div className={styles.selectorDescription} title={object.subtitle}>
                                    {object.subtitle}
                                  </div>
                                ) : null}
                                {object.parentTitle ? (
                                  <div className={styles.selectorMetaHint}>
                                    {t('settings.channels.publication.objectParentLabel')}: {object.parentTitle}
                                  </div>
                                ) : null}
                                <div className='flex flex-wrap gap-8px'>
                                  <Tag className={styles.pillTag}>
                                    {t('settings.channels.publication.summaryPublished')}: {object.bindings.length}
                                  </Tag>
                                  <Tag className={styles.pillTag}>
                                    {t('settings.channels.publication.summarySessions')}: {object.sessions.length}
                                  </Tag>
                                </div>
                              </div>
                            </div>
                          </Button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className='min-h-160px flex items-center justify-center'>
                      <Empty description={t('settings.channels.publication.emptyObjects')} className='w-full py-16px' />
                    </div>
                  )}
                </div>

                <div className='space-y-12px'>
                  {selectedObject ? (
                    <div className='border border-[var(--color-border-2)] rd-12px p-12px space-y-12px'>
                      <div className='space-y-4px'>
                        <div className='text-14px font-600 text-t-primary'>
                          {t('settings.channels.publication.objectDetailTitle')}
                        </div>
                        <div className='text-12px text-t-secondary leading-relaxed'>
                          {t('settings.channels.publication.objectDetailDescription')}
                        </div>
                      </div>

                      <div className={styles.bindingCard}>
                        <div className={styles.bindingMain}>
                          <div className={styles.bindingTitleBlock}>
                            <div className='flex flex-wrap items-center gap-6px'>
                              <Tag className={styles.pillTag}>
                                {getPublicationObjectKindLabel(
                                  selectedChannelAccount?.platform ?? 'telegram',
                                  selectedObject.kind,
                                  t
                                )}
                              </Tag>
                              {selectedObject.parentTitle ? (
                                <Tag className={styles.platformTag}>
                                  {t('settings.channels.publication.objectParentLabel')}: {selectedObject.parentTitle}
                                </Tag>
                              ) : null}
                            </div>
                            <div className={styles.bindingTitleRow}>
                              <div className={styles.bindingTitleText}>
                                <div className={styles.selectorTitle} title={selectedObject.title}>
                                  {selectedObject.title}
                                </div>
                              </div>
                            </div>
                            {selectedObject.subtitle && selectedObject.subtitle !== selectedObject.title ? (
                              <div className={styles.bindingDetail}>{selectedObject.subtitle}</div>
                            ) : null}
                            <div className='flex flex-wrap gap-8px'>
                              <Tag className={styles.pillTag}>
                                {t('settings.channels.publication.summaryPublished')}: {selectedObject.bindings.length}
                              </Tag>
                              <Tag className={styles.pillTag}>
                                {t('settings.channels.publication.summarySessions')}: {selectedObject.sessions.length}
                              </Tag>
                              <Tag className={styles.pillTag}>
                                {t('settings.channels.publication.summaryAudiences')}: {selectedObject.audiences.length}
                              </Tag>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className='space-y-8px'>
                        <div className='space-y-2px'>
                          <div className='text-13px font-600 text-t-primary'>
                            {t('settings.channels.publication.objectPublishedTitle')}
                          </div>
                          <div className='text-12px text-t-secondary leading-relaxed'>
                            {t('settings.channels.publication.objectPublishedDescription')}
                          </div>
                        </div>
                        {selectedObject.bindings.length > 0 ? (
                          <div className='space-y-8px'>
                            {selectedObject.bindings.map((binding) => {
                              const profile = profileMap.get(binding.agentProfileId);
                              const bindingTarget = getBindingTargetSummary({
                                binding,
                                selectedObject,
                                audienceMap,
                                t,
                              });

                              return (
                                <div key={binding.id} className={styles.bindingCard}>
                                  <div className={styles.bindingMain}>
                                    <div className={styles.bindingHeader}>
                                      <div className={styles.bindingTitleBlock}>
                                        <div className='flex flex-wrap items-center gap-6px'>
                                          <Tag className={styles.pillTag}>
                                            {t(`settings.channels.publication.scope.${binding.scopeType}`)}
                                          </Tag>
                                          {!binding.enabled ? (
                                            <Tag className={styles.statusTag}>
                                              {t('settings.channels.publication.disabled')}
                                            </Tag>
                                          ) : null}
                                        </div>
                                        <div className={styles.selectorTitle} title={bindingTarget.title}>
                                          {bindingTarget.title}
                                        </div>
                                        {bindingTarget.detail ? (
                                          <div className={styles.bindingDetail}>{bindingTarget.detail}</div>
                                        ) : null}
                                      </div>
                                      <div className={styles.bindingActions}>
                                        <Tooltip content={t('common.edit')}>
                                          <Button
                                            size='mini'
                                            type='text'
                                            shape='circle'
                                            className={styles.bindingIconButton}
                                            icon={<Edit theme='outline' size='16' />}
                                            onClick={() => handleEditBinding(binding)}
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
                                            loading={deletingBindingId === binding.id}
                                            onClick={() => void handleDeleteBinding(binding.id)}
                                          />
                                        </Tooltip>
                                      </div>
                                    </div>

                                    <div className={styles.bindingProfileCard}>
                                      <div className='grid grid-cols-1 md:grid-cols-3 gap-8px w-full'>
                                        <div className={styles.bindingProfileMeta}>
                                          <div className={styles.bindingProfileLabel}>
                                            {t('settings.channels.publication.intentProfile')}
                                          </div>
                                          <div
                                            className={styles.bindingProfileValue}
                                            title={profile ? getProfileDisplayName(profile) : binding.agentProfileId}
                                          >
                                            {profile ? getProfileDisplayName(profile) : binding.agentProfileId}
                                          </div>
                                        </div>
                                        <div className={styles.bindingProfileMeta}>
                                          <div className={styles.bindingProfileLabel}>
                                            {t('settings.channels.publication.intentWorkspace')}
                                          </div>
                                          <div
                                            className={styles.bindingProfileValue}
                                            title={profile ? getProfileWorkspaceLabel(profile) : '-'}
                                          >
                                            {profile ? getProfileWorkspaceLabel(profile) : '-'}
                                          </div>
                                        </div>
                                        <div className={styles.bindingProfileMeta}>
                                          <div className={styles.bindingProfileLabel}>
                                            {t('settings.channels.publication.intentBackend')}
                                          </div>
                                          <div
                                            className={styles.bindingProfileValue}
                                            title={profile ? getProfileRuntimeLabel(profile) : binding.agentProfileId}
                                          >
                                            {profile ? getProfileRuntimeLabel(profile) : binding.agentProfileId}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className='min-h-120px flex items-center justify-center'>
                            <Empty
                              description={t('settings.channels.publication.objectPublishedEmpty')}
                              className='w-full py-16px text-center'
                            />
                          </div>
                        )}
                      </div>

                      <div className='space-y-8px'>
                        <div className='space-y-2px'>
                          <div className='text-13px font-600 text-t-primary'>
                            {t('settings.channels.publication.objectSessionsTitle')}
                          </div>
                          <div className='text-12px text-t-secondary leading-relaxed'>
                            {t('settings.channels.publication.objectSessionsDescription')}
                          </div>
                        </div>
                        {selectedObject.sessions.length > 0 ? (
                          <div className='space-y-8px'>
                            {selectedObject.sessions
                              .toSorted((left, right) => right.lastActivity - left.lastActivity)
                              .map((session) => {
                                const lastActiveLabel = formatOptionalRelativeTime(session.lastActivity, i18n.language);

                                return (
                                  <div key={session.id} className={styles.bindingConversationRow}>
                                    <div className={styles.bindingConversationMeta}>
                                      <div
                                        className={styles.bindingConversationValue}
                                        title={session.conversationId || session.id}
                                      >
                                        {session.conversationId || session.id}
                                      </div>
                                      <div className={styles.bindingConversationLabel}>
                                        {t('settings.channels.publication.sessionWorkspaceLabel')}:{' '}
                                        {session.workspace || '-'}
                                      </div>
                                      <div className={styles.bindingConversationLabel}>
                                        {t('settings.channels.publication.sessionLastActiveLabel')}:{' '}
                                        {lastActiveLabel || '-'}
                                      </div>
                                      <div className={styles.bindingConversationLabel}>
                                        {t('settings.channels.publication.sessionAgentTypeLabel')}: {session.agentType}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        ) : (
                          <div className='min-h-120px flex items-center justify-center'>
                            <Empty
                              description={t('settings.channels.publication.objectSessionsEmpty')}
                              className='w-full py-16px text-center'
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className='border border-[var(--color-border-2)] rd-12px p-12px min-h-220px flex items-center justify-center'>
                      <Empty description={t('settings.channels.publication.emptyObjects')} className='w-full py-16px' />
                    </div>
                  )}
                </div>
              </div>

              <div className='border border-[var(--color-border-2)] rd-12px p-12px space-y-10px'>
                <div className='space-y-4px'>
                  <div className='text-14px font-600 text-t-primary'>
                    {t('settings.channels.publication.addTargetTitle')}
                  </div>
                  <div className='text-12px text-t-secondary leading-relaxed'>
                    {t('settings.channels.publication.addTargetDescription')}
                  </div>
                  {durableEditor.editingBindingId ? (
                    <Tag color='arcoblue'>{t('settings.channels.publication.editingDurable')}</Tag>
                  ) : null}
                </div>
                <div className='space-y-8px'>
                  <div className='text-12px font-500 text-t-primary'>
                    {t('settings.channels.publication.targetTypeLabel')}
                  </div>
                  <Select
                    value={durableEditor.scopeType}
                    options={durableScopeOptions}
                    onChange={(value) =>
                      setDurableEditor((editor) => ({
                        ...editor,
                        scopeType: value as DurableBindingScopeType,
                        selectedAudienceKey: '',
                        manualScopeKey: '',
                      }))
                    }
                  />
                  <div className='text-12px text-t-secondary leading-relaxed'>{durableScopeHint}</div>
                  {durableEditor.scopeType !== 'connector_default' ? (
                    <>
                      <Select
                        showSearch
                        value={durableEditor.selectedAudienceKey || undefined}
                        options={durableAudienceOptions}
                        placeholder={t('settings.channels.publication.audiencePlaceholder')}
                        onChange={(value) =>
                          setDurableEditor((editor) => ({
                            ...editor,
                            selectedAudienceKey: String(value),
                            manualScopeKey: '',
                          }))
                        }
                        allowClear
                      />
                      <Button
                        type='text'
                        className='!justify-start !px-0'
                        onClick={() => setShowDurableManualScope((current) => !current)}
                      >
                        {t('settings.channels.publication.manualScopeToggle')}
                      </Button>
                      {showDurableManualScope ? (
                        <>
                          <Input
                            value={durableEditor.manualScopeKey}
                            onChange={(value) => setDurableEditor((editor) => ({ ...editor, manualScopeKey: value }))}
                            placeholder={durableScopeKeyPlaceholder}
                          />
                          <div className='text-12px text-t-secondary'>
                            {t('settings.channels.publication.manualKeyHint')}
                          </div>
                        </>
                      ) : null}
                    </>
                  ) : null}
                  <Select
                    value={durableEditor.agentProfileId || undefined}
                    options={profileOptions}
                    placeholder={t('settings.channels.publication.agentPlaceholder')}
                    onChange={(value) => setDurableEditor((editor) => ({ ...editor, agentProfileId: String(value) }))}
                  />
                  <div className='flex flex-wrap gap-8px'>
                    <Button
                      type='primary'
                      icon={<Plus theme='outline' size='16' />}
                      loading={saving}
                      onClick={() =>
                        void handleSaveDurableBinding().catch((error) =>
                          Message.error(
                            error instanceof Error ? error.message : t('settings.channels.publication.saveFailed')
                          )
                        )
                      }
                    >
                      {durableEditor.editingBindingId
                        ? t('settings.channels.publication.updateDurable')
                        : t('settings.channels.publication.saveDurable')}
                    </Button>
                    {durableEditor.editingBindingId ? (
                      <Button
                        icon={<Undo theme='outline' size='16' />}
                        onClick={() => resetDurableEditor({ agentProfileId: catalog.agentProfiles[0]?.id })}
                      >
                        {t('common.cancel')}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
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
