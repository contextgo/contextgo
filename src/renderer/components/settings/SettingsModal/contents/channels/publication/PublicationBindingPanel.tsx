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
} from '@process/channels/types';
import { Button, Empty, Input, Message, Select, Spin, Tag, Tooltip } from '@arco-design/web-react';
import { Delete, Edit, Plus, Refresh, Undo } from '@icon-park/react';
import classNames from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import styles from '../ChannelModalContent.module.css';
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

type TranslationFn = ReturnType<typeof useTranslation>['t'];
type AudienceKind = 'connector' | 'direct' | 'group' | 'channel' | 'topic' | 'thread' | 'chat';

type PublicationIntent = {
  agentProfileId?: string;
  conversationId?: string;
  backend?: string;
  customAgentId?: string;
  workspace?: string;
  agentName?: string;
};

type PublishedTargetCard = {
  binding: IChannelBinding;
  profile?: IAgentProfile;
  title: string;
  detail: string;
  kindLabel: string;
  recentConversation?: IChannelActiveSessionEntry;
  conversationCount: number;
};

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

function inferAudienceKindFromKey(key: string): Exclude<AudienceKind, 'connector'> {
  const normalized = key.toLowerCase();

  if (normalized.includes('/topic/')) {
    return 'topic';
  }
  if (normalized.includes(':thread:') || normalized.includes('/thread/')) {
    return 'thread';
  }
  if (
    normalized.startsWith('user:') ||
    normalized.includes('/user/') ||
    normalized.includes('/friend/') ||
    normalized.includes('/dm/') ||
    normalized.includes('/p2p/')
  ) {
    return 'direct';
  }
  if (normalized.startsWith('group:') || normalized.includes('/group/')) {
    return 'group';
  }
  if (normalized.includes('/channel/')) {
    return 'channel';
  }

  return 'chat';
}

function getAudienceKind(
  audience: Pick<IChannelAudienceEntry, 'key' | 'scopeType' | 'remoteChatType' | 'peerScope'>
): Exclude<AudienceKind, 'connector'> {
  if (audience.scopeType === 'remote_user') {
    return 'direct';
  }

  const normalizedChatType = audience.remoteChatType?.toLowerCase();
  if (normalizedChatType === 'topic') {
    return 'topic';
  }
  if (normalizedChatType === 'thread') {
    return 'thread';
  }
  if (normalizedChatType === 'channel') {
    return 'channel';
  }
  if (normalizedChatType === 'group' || normalizedChatType === 'supergroup') {
    return 'group';
  }
  if (normalizedChatType === 'direct' || normalizedChatType === 'dm' || normalizedChatType === 'private') {
    return 'direct';
  }
  if (audience.peerScope === 'thread') {
    return inferAudienceKindFromKey(audience.key) === 'topic' ? 'topic' : 'thread';
  }

  return inferAudienceKindFromKey(audience.key);
}

function getAudienceKindLabel(
  audience: Pick<IChannelAudienceEntry, 'key' | 'scopeType' | 'remoteChatType' | 'peerScope'>,
  t: TranslationFn
): string {
  return t(`settings.channels.publication.audienceKind.${getAudienceKind(audience)}`);
}

function looksTechnicalAudienceText(value?: string): boolean {
  if (!value) {
    return false;
  }

  return (
    value.includes('://') ||
    value.includes('peer ') ||
    value.includes('transport ') ||
    value.includes('parent ') ||
    value.startsWith('user:') ||
    value.startsWith('group:') ||
    value.includes(':thread:')
  );
}

function getAudienceDetailText(audience: IChannelAudienceEntry, t: TranslationFn): string {
  if (audience.subtitle && !looksTechnicalAudienceText(audience.subtitle)) {
    return audience.subtitle;
  }

  return getAudienceKindLabel(audience, t);
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

function getSessionChannelAccountId(session: IChannelActiveSessionEntry): string {
  return session.connectorId ?? session.channelAccountId ?? '';
}

function matchesBindingSession(binding: IChannelBinding, session: IChannelActiveSessionEntry): boolean {
  if (session.bindingId && session.bindingId === binding.id) {
    return true;
  }

  if (getSessionChannelAccountId(session) !== getChannelAccountId(binding)) {
    return false;
  }

  if (!binding.scopeKey || binding.scopeType === 'connector_default') {
    return false;
  }

  return session.audienceKey === binding.scopeKey;
}

function collectPublishedSessions(
  bindings: IChannelBinding[],
  sessions: IChannelActiveSessionEntry[]
): IChannelActiveSessionEntry[] {
  if (bindings.length === 0 || sessions.length === 0) {
    return [];
  }

  const seenSessionIds = new Set<string>();

  return sessions.filter((session) => {
    if (seenSessionIds.has(session.id)) {
      return false;
    }

    const matched = bindings.some((binding) => matchesBindingSession(binding, session));
    if (matched) {
      seenSessionIds.add(session.id);
    }
    return matched;
  });
}

function buildFallbackAudience(binding: IChannelBinding, t: TranslationFn): IChannelAudienceEntry {
  return {
    key: binding.scopeKey || `${binding.connectorId}:default`,
    connectorId: binding.connectorId,
    channelAccountId: getChannelAccountId(binding),
    scopeType: binding.scopeType === 'remote_user' ? 'remote_user' : 'remote_chat',
    remoteUserId: binding.scopeType === 'remote_user' ? binding.scopeKey : undefined,
    remoteChatId: binding.scopeType === 'remote_chat' ? binding.scopeKey : undefined,
    platformChatId: binding.scopeType === 'remote_chat' ? binding.scopeKey : undefined,
    title: binding.scopeKey || t('settings.channels.publication.connectorDefaultAudience'),
  };
}

const PublicationBindingPanel: React.FC = () => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<IChannelBindingCatalog>(EMPTY_CATALOG);
  const [sessions, setSessions] = useState<IChannelActiveSessionEntry[]>([]);
  const [selectedChannelAccountId, setSelectedChannelAccountId] = useState('');
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
      setSessions(sessionResult.data);
      setSelectedChannelAccountId((currentChannelAccountId) => {
        if (
          currentChannelAccountId &&
          nextChannelAccounts.some((channelAccount) => channelAccount.id === currentChannelAccountId)
        ) {
          return currentChannelAccountId;
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

  const selectedAudiences = useMemo(
    () => catalog.audiences.filter((audience) => getChannelAccountId(audience) === selectedChannelAccountId),
    [catalog.audiences, selectedChannelAccountId]
  );

  const selectedSessions = useMemo(
    () =>
      sessions
        .filter((session) => getSessionChannelAccountId(session) === selectedChannelAccountId)
        .toSorted((left, right) => right.lastActivity - left.lastActivity),
    [selectedChannelAccountId, sessions]
  );

  const { durableBindings } = useMemo(() => splitBindingsByLifetime(selectedBindings), [selectedBindings]);
  const selectedPublishedCount = durableBindings.length;
  const selectedPublishedSessions = useMemo(
    () => collectPublishedSessions(durableBindings, selectedSessions),
    [durableBindings, selectedSessions]
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

  const publishedTargetCards = useMemo<PublishedTargetCard[]>(() => {
    return durableBindings
      .map((binding) => {
        const profile = profileMap.get(binding.agentProfileId);
        const audience = binding.scopeKey ? audienceMap.get(binding.scopeKey) : undefined;
        const resolvedAudience = audience ?? buildFallbackAudience(binding, t);
        const title =
          binding.scopeType === 'connector_default'
            ? t('settings.channels.publication.connectorDefaultAudience')
            : resolvedAudience.title;
        const detail =
          binding.scopeType === 'connector_default'
            ? t('settings.channels.publication.scope.connectorDefault')
            : getAudienceDetailText(resolvedAudience, t);
        const kindLabel =
          binding.scopeType === 'connector_default'
            ? t('settings.channels.publication.audienceKind.connector')
            : getAudienceKindLabel(resolvedAudience, t);
        const bindingSessions = selectedSessions
          .filter((session) => matchesBindingSession(binding, session))
          .toSorted((left, right) => right.lastActivity - left.lastActivity);

        return {
          binding,
          profile,
          title,
          detail,
          kindLabel,
          recentConversation: bindingSessions[0],
          conversationCount: bindingSessions.length,
        };
      })
      .toSorted((left, right) => {
        if (left.conversationCount !== right.conversationCount) {
          return right.conversationCount - left.conversationCount;
        }
        return (right.recentConversation?.lastActivity ?? 0) - (left.recentConversation?.lastActivity ?? 0);
      });
  }, [audienceMap, durableBindings, profileMap, selectedSessions, t]);

  const resetDurableEditor = useCallback(
    (nextAgentProfileId?: string) => {
      setShowDurableManualScope(false);
      setDurableEditor(createDurableEditorState(nextAgentProfileId ?? durableEditor.agentProfileId));
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

  const handleEditBinding = useCallback((binding: IChannelBinding) => {
    setShowDurableManualScope(true);
    setDurableEditor({
      editingBindingId: binding.id,
      scopeType: binding.scopeType as DurableBindingScopeType,
      selectedAudienceKey: binding.scopeKey ?? '',
      manualScopeKey: binding.scopeKey ?? '',
      agentProfileId: binding.agentProfileId,
    });
  }, []);

  const handleAudienceShortcut = useCallback((audience: IChannelAudienceEntry) => {
    setShowDurableManualScope(false);

    if (audience.scopeType === 'remote_user') {
      setDurableEditor((editor) => ({
        ...editor,
        editingBindingId: '',
        scopeType: 'remote_user',
        selectedAudienceKey: audience.key,
        manualScopeKey: '',
      }));
      return;
    }

    setDurableEditor((editor) => ({
      ...editor,
      editingBindingId: '',
      scopeType: 'remote_chat',
      selectedAudienceKey: audience.key,
      manualScopeKey: '',
    }));
  }, []);

  const openConversation = useCallback(
    (conversationId?: string) => {
      if (!conversationId) {
        return;
      }
      void navigate(`/conversation/${conversationId}`);
    },
    [navigate]
  );

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
                  <span className='ml-6px text-t-primary'>
                    {intentProfile ? getProfileLabel(intentProfile) : publicationIntent.agentProfileId || '-'}
                  </span>
                </div>
                <div className='text-12px text-t-secondary'>
                  {t('settings.channels.publication.intentConversation')}:
                  <span className='ml-6px text-t-primary'>{publicationIntent.conversationId || '-'}</span>
                </div>
                <div className='text-12px text-t-secondary'>
                  {t('settings.channels.publication.intentBackend')}:
                  <span className='ml-6px text-t-primary'>{publicationIntent.backend || '-'}</span>
                </div>
                <div className='text-12px text-t-secondary'>
                  {t('settings.channels.publication.intentWorkspace')}:
                  <span className='ml-6px text-t-primary break-all'>{publicationIntent.workspace || '-'}</span>
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
                  const channelAccountSelected = channelAccount.id === selectedChannelAccountId;
                  const channelAccountAudiences = catalog.audiences.filter(
                    (audience) => getChannelAccountId(audience) === channelAccount.id
                  );
                  const channelAccountBindings = catalog.bindings.filter(
                    (binding) => getChannelAccountId(binding) === channelAccount.id
                  );
                  const channelAccountBindingSummary = splitBindingsByLifetime(channelAccountBindings);
                  const channelAccountSessions = sessions.filter(
                    (session) => getSessionChannelAccountId(session) === channelAccount.id
                  );
                  const channelAccountPublishedSessions = collectPublishedSessions(
                    channelAccountBindingSummary.durableBindings,
                    channelAccountSessions
                  );

                  return (
                    <Button
                      key={channelAccount.id}
                      type='text'
                      className={classNames(styles.instanceButton, channelAccountSelected && styles.instanceButtonActive)}
                      onClick={() => setSelectedChannelAccountId(channelAccount.id)}
                    >
                      <div className={styles.instanceButtonInner}>
                        <div className={styles.selectorCardBody}>
                          <div className={styles.selectorHeading}>
                            <span className={styles.selectorTitle} title={channelAccount.name}>
                              {channelAccount.name}
                            </span>
                            <Tag className={styles.platformTag} title={channelAccount.platform}>
                              {channelAccount.platform}
                            </Tag>
                          </div>
                          <div className={styles.selectorStats}>
                            <Tag className={styles.pillTag}>
                              {t('settings.channels.publication.summaryPublished')}: {channelAccountBindingSummary.durableBindings.length}
                            </Tag>
                            <Tag className={styles.pillTag}>
                              {t('settings.channels.publication.summaryAudiences')}: {channelAccountAudiences.length}
                            </Tag>
                            <Tag className={styles.pillTag}>
                              {t('settings.channels.publication.summaryConversations')}: {channelAccountPublishedSessions.length}
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
                      <Tag className={styles.platformTag} title={selectedChannelAccount.platform}>
                        {selectedChannelAccount.platform}
                      </Tag>
                    </div>
                    <div className='text-13px text-t-primary leading-relaxed'>
                      {t('settings.channels.publication.accountOverview')}
                    </div>
                    <div className='flex flex-wrap gap-8px'>
                      <Tag className={styles.pillTag}>
                        {t('settings.channels.publication.summaryPublished')}: {selectedPublishedCount}
                      </Tag>
                      <Tag className={styles.pillTag}>
                        {t('settings.channels.publication.summaryAudiences')}: {selectedAudiences.length}
                      </Tag>
                      <Tag className={styles.pillTag}>
                        {t('settings.channels.publication.summaryConversations')}: {selectedPublishedSessions.length}
                      </Tag>
                    </div>
                  </div>
                  <div className='text-12px text-t-secondary leading-relaxed'>{channelAccountGuide}</div>
                </div>
              ) : null}

              <div className='border border-[var(--color-border-2)] rd-12px p-12px space-y-10px'>
                <div className='space-y-4px'>
                  <div className='text-14px font-600 text-t-primary'>
                    {t('settings.channels.publication.publishedTargetsTitle')}
                  </div>
                  <div className='text-12px text-t-secondary leading-relaxed'>
                    {t('settings.channels.publication.publishedTargetsDescription')}
                  </div>
                </div>
                {publishedTargetCards.length > 0 ? (
                  <div className='space-y-8px'>
                    {publishedTargetCards.map((card) => {
                      const conversationSummary = card.recentConversation
                        ? formatRelativeTime(card.recentConversation.lastActivity, i18n.language)
                        : t('settings.channels.publication.noConversationYet');
                      const profileLabel = card.profile ? getProfileLabel(card.profile) : card.binding.agentProfileId;

                      return (
                        <div key={card.binding.id} className={styles.bindingCard}>
                          <div className={styles.bindingMain}>
                            <div className={styles.bindingHeader}>
                              <div className={styles.bindingTitleBlock}>
                                <div className='flex flex-wrap items-center gap-6px'>
                                  <Tag className={styles.pillTag}>{card.kindLabel}</Tag>
                                  {!card.binding.enabled ? (
                                    <Tag className={styles.statusTag}>{t('settings.channels.publication.disabled')}</Tag>
                                  ) : null}
                                </div>
                                <div className={styles.bindingTitleRow}>
                                  <div className={styles.bindingTitleText}>
                                    <div className={styles.selectorTitle} title={card.title}>
                                      {card.title}
                                    </div>
                                  </div>
                                  {card.conversationCount > 0 ? (
                                    <div
                                      className={styles.bindingCountBadge}
                                      title={`${t('settings.channels.publication.summaryConversations')}: ${card.conversationCount}`}
                                    >
                                      {card.conversationCount}
                                    </div>
                                  ) : null}
                                </div>
                                <div className={styles.bindingDetail}>{card.detail}</div>
                              </div>
                              <div className={styles.bindingActions}>
                                <Tooltip content={t('common.edit')}>
                                  <Button
                                    size='mini'
                                    type='text'
                                    shape='circle'
                                    className={styles.bindingIconButton}
                                    icon={<Edit theme='outline' size='16' />}
                                    onClick={() => handleEditBinding(card.binding)}
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
                                    loading={deletingBindingId === card.binding.id}
                                    onClick={() => void handleDeleteBinding(card.binding.id)}
                                  />
                                </Tooltip>
                              </div>
                            </div>

                            <div className={styles.bindingProfileCard}>
                              <div className={styles.bindingProfileMeta}>
                                <div className={styles.bindingProfileLabel}>
                                  {t('settings.channels.publication.intentProfile')}
                                </div>
                                <div className={styles.bindingProfileValue} title={profileLabel}>
                                  {profileLabel}
                                </div>
                              </div>
                            </div>

                            <div className={styles.bindingConversationRow}>
                              <div className={styles.bindingConversationMeta}>
                                <div className={styles.bindingConversationLabel}>
                                  {t('settings.channels.publication.recentConversation')}
                                </div>
                                <div className={styles.bindingConversationValue}>{conversationSummary}</div>
                              </div>
                              {card.recentConversation?.conversationId ? (
                                <Button
                                  type='primary'
                                  size='small'
                                  className={styles.bindingPrimaryAction}
                                  onClick={() => openConversation(card.recentConversation?.conversationId)}
                                >
                                  {t('settings.channels.publication.openConversation')}
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className='min-h-120px flex items-center justify-center'>
                    <Empty
                      description={t('settings.channels.publication.emptyPublishedTargets')}
                      className='w-full py-16px text-center'
                    />
                  </div>
                )}
              </div>

              <div className='border border-[var(--color-border-2)] rd-12px p-12px space-y-10px'>
                <div className='space-y-4px'>
                  <div className='text-14px font-600 text-t-primary'>
                    {t('settings.channels.publication.discoveryTitle')}
                  </div>
                  <div className='text-12px text-t-secondary leading-relaxed'>
                    {t('settings.channels.publication.discoveryDescription')}
                  </div>
                </div>
                {selectedAudiences.length > 0 ? (
                  <div className='grid grid-cols-1 lg:grid-cols-2 gap-8px'>
                    {selectedAudiences.map((audience) => {
                      const durableSelected =
                        durableEditor.scopeType === audience.scopeType &&
                        durableEditor.selectedAudienceKey === audience.key &&
                        !durableEditor.manualScopeKey;
                      const audienceDetail = getAudienceDetailText(audience, t);

                      return (
                        <Button
                          key={audience.key}
                          type='text'
                          className={classNames(styles.instanceButton, durableSelected && styles.instanceButtonActive)}
                          onClick={() => handleAudienceShortcut(audience)}
                        >
                          <div className={styles.instanceButtonInner}>
                            <div className={styles.selectorCardBody}>
                              <div className={styles.selectorHeading}>
                                <span className={styles.selectorTitle} title={audience.title}>
                                  {audience.title}
                                </span>
                                <Tag className={styles.pillTag}>{getAudienceKindLabel(audience, t)}</Tag>
                                {durableSelected ? (
                                  <Tag className={styles.metricTag}>{t('settings.channels.publication.durableTag')}</Tag>
                                ) : null}
                              </div>
                              {audienceDetail !== audience.title ? (
                                <div className={styles.selectorDescription} title={audienceDetail}>
                                  {audienceDetail}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </Button>
                      );
                    })}
                  </div>
                ) : (
                  <div className='min-h-120px flex items-center justify-center'>
                    <Empty
                      description={t('settings.channels.publication.discoveryEmpty')}
                      className='w-full py-16px text-center'
                    />
                  </div>
                )}
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
                        void saveBinding({
                          channelAccountId: selectedChannelAccountId,
                          scopeType: durableEditor.scopeType,
                          scopeKey:
                            durableEditor.scopeType === 'connector_default'
                              ? ''
                              : resolveScopeKey(durableEditor.selectedAudienceKey, durableEditor.manualScopeKey),
                          agentProfileId: durableEditor.agentProfileId,
                          temporary: false,
                          priority: 0,
                        })
                          .then(() => resetDurableEditor())
                          .catch((error) =>
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
                        onClick={() => resetDurableEditor(catalog.agentProfiles[0]?.id)}
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
