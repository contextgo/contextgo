/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { channel } from '@/common/adapter/ipcBridge';
import type {
  IAgentProfile,
  IChannelAudienceEntry,
  IChannelBinding,
  IChannelBindingCatalog,
  IConnectorInstance,
} from '@process/channels/types';
import { Button, Empty, Input, InputNumber, Message, Select, Spin, Tag } from '@arco-design/web-react';
import { Delete, Edit, Plus, Refresh, Undo } from '@icon-park/react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
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
  priority: number;
};

type TemporaryEditorState = {
  editingBindingId: string;
  selectedAudienceKey: string;
  manualScopeKey: string;
  agentProfileId: string;
  priority: number;
};

type PublicationIntent = {
  agentProfileId?: string;
  conversationId?: string;
  backend?: string;
  customAgentId?: string;
  workspace?: string;
  agentName?: string;
};

const EMPTY_CATALOG: IChannelBindingCatalog = {
  connectors: [],
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
    priority: 0,
  };
}

function createTemporaryEditorState(agentProfileId = ''): TemporaryEditorState {
  return {
    editingBindingId: '',
    selectedAudienceKey: '',
    manualScopeKey: '',
    agentProfileId,
    priority: 100,
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

const PublicationBindingPanel: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const [catalog, setCatalog] = useState<IChannelBindingCatalog>(EMPTY_CATALOG);
  const [selectedConnectorId, setSelectedConnectorId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingBindingId, setDeletingBindingId] = useState('');
  const [durableEditor, setDurableEditor] = useState<DurableEditorState>(createDurableEditorState());
  const [temporaryEditor, setTemporaryEditor] = useState<TemporaryEditorState>(createTemporaryEditorState());
  const [appliedIntentKey, setAppliedIntentKey] = useState('');

  const publicationIntent = useMemo(
    () => resolvePublicationIntent(location.state, new URLSearchParams(location.search)),
    [location.search, location.state]
  );
  const publicationIntentKey = useMemo(() => JSON.stringify(publicationIntent ?? null), [publicationIntent]);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const result = await channel.getBindingCatalog.invoke({});
      if (!result.success || !result.data) {
        throw new Error(result.msg || t('settings.channels.publication.loadFailed'));
      }

      const firstAgentProfileId = result.data.agentProfiles[0]?.id || '';
      setCatalog(result.data);
      setSelectedConnectorId((currentConnectorId) => {
        if (currentConnectorId && result.data.connectors.some((connector) => connector.id === currentConnectorId)) {
          return currentConnectorId;
        }
        return result.data.connectors[0]?.id ?? '';
      });
      setDurableEditor((editor) => ({
        ...editor,
        agentProfileId: editor.agentProfileId || firstAgentProfileId,
      }));
      setTemporaryEditor((editor) => ({
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

  const connectorOptions = useMemo(
    () =>
      catalog.connectors.map((connector) => ({
        label: `${connector.name} · ${connector.platform}`,
        value: connector.id,
      })),
    [catalog.connectors]
  );

  const profileOptions = useMemo(
    () =>
      catalog.agentProfiles.map((profile) => ({
        label: getProfileLabel(profile),
        value: profile.id,
      })),
    [catalog.agentProfiles]
  );

  const profileMap = useMemo(
    () => new Map(catalog.agentProfiles.map((profile) => [profile.id, profile])),
    [catalog.agentProfiles]
  );
  const audienceMap = useMemo(
    () => new Map(catalog.audiences.map((audience) => [audience.key, audience])),
    [catalog.audiences]
  );
  const preferredProfileId = useMemo(
    () => resolvePreferredProfileId(catalog.agentProfiles, publicationIntent),
    [catalog.agentProfiles, publicationIntent]
  );

  const selectedConnector = useMemo<IConnectorInstance | undefined>(
    () => catalog.connectors.find((connector) => connector.id === selectedConnectorId),
    [catalog.connectors, selectedConnectorId]
  );

  const selectedBindings = useMemo(
    () => catalog.bindings.filter((binding) => binding.connectorId === selectedConnectorId),
    [catalog.bindings, selectedConnectorId]
  );

  const selectedAudiences = useMemo(
    () => catalog.audiences.filter((audience) => audience.connectorId === selectedConnectorId),
    [catalog.audiences, selectedConnectorId]
  );

  const { durableBindings, temporaryBindings } = useMemo(
    () => splitBindingsByLifetime(selectedBindings),
    [selectedBindings]
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

  const temporaryAudienceOptions = useMemo(
    () =>
      selectedAudiences
        .filter((audience) => audience.scopeType === 'remote_chat')
        .map((audience) => ({
          label: getAudienceLabel(audience),
          value: audience.key,
        })),
    [selectedAudiences]
  );

  const resetDurableEditor = useCallback(
    (nextAgentProfileId?: string) => {
      setDurableEditor(createDurableEditorState(nextAgentProfileId ?? durableEditor.agentProfileId));
    },
    [durableEditor.agentProfileId]
  );

  const resetTemporaryEditor = useCallback(
    (nextAgentProfileId?: string) => {
      setTemporaryEditor(createTemporaryEditorState(nextAgentProfileId ?? temporaryEditor.agentProfileId));
    },
    [temporaryEditor.agentProfileId]
  );

  useEffect(() => {
    if (!selectedConnectorId) {
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

    setTemporaryEditor((editor) => {
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
  }, [selectedAudiences, selectedConnectorId]);

  useEffect(() => {
    if (!preferredProfileId || appliedIntentKey === publicationIntentKey) {
      return;
    }

    setDurableEditor((editor) =>
      editor.editingBindingId ? editor : { ...editor, agentProfileId: preferredProfileId }
    );
    setTemporaryEditor((editor) =>
      editor.editingBindingId ? editor : { ...editor, agentProfileId: preferredProfileId }
    );
    setAppliedIntentKey(publicationIntentKey);
  }, [appliedIntentKey, preferredProfileId, publicationIntentKey]);

  const validateDraft = useCallback(
    (draft: BindingDraft) => {
      if (!draft.connectorId) {
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
        Message.success(
          draft.temporary
            ? t('settings.channels.publication.temporarySaved')
            : t('settings.channels.publication.durableSaved')
        );
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
    if (binding.temporary) {
      setTemporaryEditor({
        editingBindingId: binding.id,
        selectedAudienceKey: binding.scopeKey ?? '',
        manualScopeKey: binding.scopeKey ?? '',
        agentProfileId: binding.agentProfileId,
        priority: binding.priority,
      });
      return;
    }

    setDurableEditor({
      editingBindingId: binding.id,
      scopeType: binding.scopeType as DurableBindingScopeType,
      selectedAudienceKey: binding.scopeKey ?? '',
      manualScopeKey: binding.scopeKey ?? '',
      agentProfileId: binding.agentProfileId,
      priority: binding.priority,
    });
  }, []);

  const renderBindingList = useCallback(
    (bindings: IChannelBinding[], emptyText: string) => {
      if (bindings.length === 0) {
        return <Empty description={emptyText} className='py-16px' />;
      }

      return (
        <div className='space-y-8px'>
          {bindings.map((binding) => {
            const profile = profileMap.get(binding.agentProfileId);
            const audience = binding.scopeKey ? audienceMap.get(binding.scopeKey) : undefined;
            return (
              <div
                key={binding.id}
                className='border border-[var(--color-border-2)] rd-10px px-12px py-10px flex items-start justify-between gap-12px'
              >
                <div className='min-w-0 space-y-6px'>
                  <div className='flex flex-wrap items-center gap-6px'>
                    <Tag color={binding.temporary ? 'orangered' : 'arcoblue'}>
                      {binding.temporary
                        ? t('settings.channels.publication.temporaryTag')
                        : t('settings.channels.publication.durableTag')}
                    </Tag>
                    <Tag>{t(`settings.channels.publication.scope.${binding.scopeType}`)}</Tag>
                    <Tag color={binding.enabled ? 'green' : 'gray'}>
                      {binding.enabled
                        ? t('settings.channels.publication.enabled')
                        : t('settings.channels.publication.disabled')}
                    </Tag>
                  </div>
                  <div className='text-13px text-t-primary break-all'>
                    {profile ? getProfileLabel(profile) : binding.agentProfileId}
                  </div>
                  <div className='text-12px text-t-secondary break-all'>
                    {audience
                      ? getAudienceLabel(audience)
                      : binding.scopeKey || t('settings.channels.publication.connectorDefaultAudience')}
                  </div>
                </div>
                <div className='flex items-center gap-4px shrink-0'>
                  <Button
                    type='text'
                    icon={<Edit theme='outline' size='16' />}
                    onClick={() => handleEditBinding(binding)}
                  >
                    {t('common.edit')}
                  </Button>
                  <Button
                    status='danger'
                    type='text'
                    icon={<Delete theme='outline' size='16' />}
                    loading={deletingBindingId === binding.id}
                    onClick={() => void handleDeleteBinding(binding.id)}
                  >
                    {t('common.delete')}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      );
    },
    [audienceMap, deletingBindingId, handleDeleteBinding, handleEditBinding, profileMap, t]
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

  return (
    <div className='mt-16px border border-[var(--color-border-2)] rd-14px px-14px py-14px space-y-14px'>
      <div className='flex flex-wrap items-center justify-between gap-12px'>
        <div className='space-y-4px'>
          <div className='text-15px font-600 text-t-primary'>{t('settings.channels.publication.title')}</div>
          <div className='text-12px text-t-secondary leading-relaxed'>
            {t('settings.channels.publication.description')}
          </div>
        </div>
        <Button icon={<Refresh theme='outline' size='16' />} onClick={() => void loadCatalog()} loading={loading}>
          {t('common.refresh')}
        </Button>
      </div>

      <Spin loading={loading}>
        <div className='space-y-12px'>
          <div className='space-y-6px'>
            <div className='text-12px font-500 text-t-primary'>{t('settings.channels.publication.connectorLabel')}</div>
            <Select
              value={selectedConnectorId || undefined}
              options={connectorOptions}
              placeholder={t('settings.channels.publication.connectorPlaceholder')}
              onChange={(value) => setSelectedConnectorId(String(value))}
              allowClear={false}
            />
            {selectedConnector ? (
              <div className='text-12px text-t-secondary'>
                {t('settings.channels.publication.connectorHint', {
                  platform: selectedConnector.platform,
                  name: selectedConnector.name,
                })}
              </div>
            ) : null}
          </div>

          {selectedConnectorId ? (
            <>
              <div className='grid grid-cols-1 xl:grid-cols-2 gap-12px'>
                <div className='border border-[var(--color-border-2)] rd-12px p-12px space-y-10px'>
                  <div className='space-y-4px'>
                    <div className='text-14px font-600 text-t-primary'>
                      {t('settings.channels.publication.durableTitle')}
                    </div>
                    <div className='text-12px text-t-secondary leading-relaxed'>
                      {t('settings.channels.publication.durableDescription')}
                    </div>
                    {durableEditor.editingBindingId ? (
                      <Tag color='arcoblue'>{t('settings.channels.publication.editingDurable')}</Tag>
                    ) : null}
                  </div>
                  <div className='space-y-8px'>
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
                    <Select
                      value={durableEditor.agentProfileId || undefined}
                      options={profileOptions}
                      placeholder={t('settings.channels.publication.agentPlaceholder')}
                      onChange={(value) => setDurableEditor((editor) => ({ ...editor, agentProfileId: String(value) }))}
                    />
                    <InputNumber
                      value={durableEditor.priority}
                      min={0}
                      onChange={(value) => setDurableEditor((editor) => ({ ...editor, priority: Number(value || 0) }))}
                      placeholder={t('settings.channels.publication.priorityLabel')}
                      className='w-full'
                    />
                    <div className='flex flex-wrap gap-8px'>
                      <Button
                        type='primary'
                        icon={<Plus theme='outline' size='16' />}
                        loading={saving}
                        onClick={() =>
                          void saveBinding({
                            connectorId: selectedConnectorId,
                            scopeType: durableEditor.scopeType,
                            scopeKey:
                              durableEditor.scopeType === 'connector_default'
                                ? ''
                                : resolveScopeKey(durableEditor.selectedAudienceKey, durableEditor.manualScopeKey),
                            agentProfileId: durableEditor.agentProfileId,
                            temporary: false,
                            priority: durableEditor.priority,
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

                <div className='border border-[var(--color-border-2)] rd-12px p-12px space-y-10px'>
                  <div className='space-y-4px'>
                    <div className='text-14px font-600 text-t-primary'>
                      {t('settings.channels.publication.temporaryTitle')}
                    </div>
                    <div className='text-12px text-t-secondary leading-relaxed'>
                      {t('settings.channels.publication.temporaryDescription')}
                    </div>
                    {temporaryEditor.editingBindingId ? (
                      <Tag color='orangered'>{t('settings.channels.publication.editingTemporary')}</Tag>
                    ) : null}
                  </div>
                  <div className='space-y-8px'>
                    <Select
                      showSearch
                      value={temporaryEditor.selectedAudienceKey || undefined}
                      options={temporaryAudienceOptions}
                      placeholder={t('settings.channels.publication.audiencePlaceholder')}
                      onChange={(value) =>
                        setTemporaryEditor((editor) => ({
                          ...editor,
                          selectedAudienceKey: String(value),
                          manualScopeKey: '',
                        }))
                      }
                      allowClear
                    />
                    <Input
                      value={temporaryEditor.manualScopeKey}
                      onChange={(value) => setTemporaryEditor((editor) => ({ ...editor, manualScopeKey: value }))}
                      placeholder={t('settings.channels.publication.scopeKeyRemoteChatPlaceholder')}
                    />
                    <div className='text-12px text-t-secondary'>{t('settings.channels.publication.manualKeyHint')}</div>
                    <Select
                      value={temporaryEditor.agentProfileId || undefined}
                      options={profileOptions}
                      placeholder={t('settings.channels.publication.agentPlaceholder')}
                      onChange={(value) =>
                        setTemporaryEditor((editor) => ({ ...editor, agentProfileId: String(value) }))
                      }
                    />
                    <InputNumber
                      value={temporaryEditor.priority}
                      min={1}
                      onChange={(value) =>
                        setTemporaryEditor((editor) => ({ ...editor, priority: Number(value || 100) }))
                      }
                      placeholder={t('settings.channels.publication.priorityLabel')}
                      className='w-full'
                    />
                    <div className='flex flex-wrap gap-8px'>
                      <Button
                        type='primary'
                        status='warning'
                        icon={<Plus theme='outline' size='16' />}
                        loading={saving}
                        onClick={() =>
                          void saveBinding({
                            connectorId: selectedConnectorId,
                            scopeType: 'temporary_override',
                            scopeKey: resolveScopeKey(
                              temporaryEditor.selectedAudienceKey,
                              temporaryEditor.manualScopeKey
                            ),
                            agentProfileId: temporaryEditor.agentProfileId,
                            temporary: true,
                            priority: temporaryEditor.priority,
                          })
                            .then(() => resetTemporaryEditor())
                            .catch((error) =>
                              Message.error(
                                error instanceof Error ? error.message : t('settings.channels.publication.saveFailed')
                              )
                            )
                        }
                      >
                        {temporaryEditor.editingBindingId
                          ? t('settings.channels.publication.updateTemporary')
                          : t('settings.channels.publication.saveTemporary')}
                      </Button>
                      {temporaryEditor.editingBindingId ? (
                        <Button
                          icon={<Undo theme='outline' size='16' />}
                          onClick={() => resetTemporaryEditor(catalog.agentProfiles[0]?.id)}
                        >
                          {t('common.cancel')}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              <div className='space-y-10px'>
                <div className='space-y-4px'>
                  <div className='text-14px font-600 text-t-primary'>
                    {t('settings.channels.publication.existingTitle')}
                  </div>
                  <div className='text-12px text-t-secondary leading-relaxed'>
                    {t('settings.channels.publication.existingDescription')}
                  </div>
                </div>
                <div className='grid grid-cols-1 xl:grid-cols-2 gap-12px'>
                  <div className='space-y-8px'>
                    <div className='text-13px font-500 text-t-primary'>
                      {t('settings.channels.publication.durableListTitle')}
                    </div>
                    {renderBindingList(durableBindings, t('settings.channels.publication.emptyDurable'))}
                  </div>
                  <div className='space-y-8px'>
                    <div className='text-13px font-500 text-t-primary'>
                      {t('settings.channels.publication.temporaryListTitle')}
                    </div>
                    {renderBindingList(temporaryBindings, t('settings.channels.publication.emptyTemporary'))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <Empty description={t('settings.channels.publication.noConnector')} className='py-20px' />
          )}
        </div>
      </Spin>
    </div>
  );
};

export default PublicationBindingPanel;
