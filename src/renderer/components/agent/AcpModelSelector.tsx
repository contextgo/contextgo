/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { IResponseMessage } from '@/common/adapter/ipcBridge';
import { ConfigStorage } from '@/common/config/storage';
import type { IProvider } from '@/common/config/storage';
import type { AcpModelInfo } from '@/common/types/acpTypes';
import { useLayoutContext } from '@/renderer/hooks/context/LayoutContext';
import { usePreviewContext } from '@/renderer/pages/conversation/Preview';
import { getModelDisplayLabel, getModelLogo } from '@/renderer/utils/model/agentLogo';
import { Button, Dropdown, Menu, Message } from '@arco-design/web-react';
import { Brain } from '@icon-park/react';
import classNames from 'classnames';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

/**
 * Model selector for ACP-based agents.
 * Fetches model info via IPC and listens for real-time updates via responseStream.
 * Renders three states:
 * - null model info: disabled "Use CLI model" button (backward compatible)
 * - canSwitch=false: read-only display of current model name
 * - canSwitch=true: clickable dropdown selector
 *
 * When backend and initialModelId are provided, the component can show
 * cached model info before the agent manager is created (pre-first-message).
 * When preview panel is open, shows compact version (truncated label).
 */
const AcpModelSelector: React.FC<{
  conversationId: string;
  /** ACP backend name for loading cached models (e.g., 'claude', 'qwen') */
  backend?: string;
  /** Pre-selected model ID from Guid page */
  initialModelId?: string;
}> = ({ conversationId, backend, initialModelId }) => {
  const { t } = useTranslation();
  const { isOpen: isPreviewOpen } = usePreviewContext();
  const layout = useLayoutContext();
  const isOpenClaw = backend === 'openclaw-gateway';
  const [modelInfo, setModelInfo] = useState<AcpModelInfo | null>(null);
  const modelInfoRef = useRef(modelInfo);
  modelInfoRef.current = modelInfo;
  // Track whether user has manually switched model via dropdown
  const hasUserChangedModel = useRef(false);

  // Fetch initial model info on mount, fallback to cached models if manager not ready
  useEffect(() => {
    let cancelled = false;
    const loadModelInfo = isOpenClaw
      ? ipcBridge.openclawConversation.getModelInfo.invoke({ conversation_id: conversationId })
      : ipcBridge.acpConversation.getModelInfo.invoke({ conversationId });
    loadModelInfo
      .then((result) => {
        if (cancelled) return;
        if (result.success && result.data?.modelInfo) {
          const info = result.data.modelInfo;
          if (backend === 'codex') {
            console.log('[AcpModelSelector][codex] Initial model info:', info);
          }
          // When agent is not fully initialized, getModelInfo returns
          // canSwitch=false with empty availableModels. Prefer cached data
          // in that case to keep the dropdown functional.
          if (info.availableModels?.length > 0) {
            setModelInfo(info);
          } else if (backend) {
            void loadCachedModelInfo(backend, cancelled);
          } else {
            setModelInfo(info);
          }
        } else if (backend) {
          // Manager not yet created — load cached model list from storage
          void loadCachedModelInfo(backend, cancelled);
        }
      })
      .catch(() => {
        if (!cancelled && backend) {
          void loadCachedModelInfo(backend, cancelled);
        }
      });

    return () => {
      cancelled = true;
    };

    async function loadCachedModelInfo(backendKey: string, isCancelled: boolean) {
      try {
        const cached = await ConfigStorage.get('acp.cachedModels');
        if (isCancelled) return;
        const cachedInfo = cached?.[backendKey];
        if (cachedInfo?.availableModels?.length > 0) {
          if (backendKey === 'codex') {
            console.log('[AcpModelSelector][codex] Loaded cached model info:', cachedInfo);
          }
          const effectiveModelId = initialModelId || cachedInfo.currentModelId || null;
          setModelInfo({
            ...cachedInfo,
            currentModelId: effectiveModelId,
            currentModelLabel:
              (effectiveModelId && cachedInfo.availableModels.find((m) => m.id === effectiveModelId)?.label) ||
              effectiveModelId,
          });
        }
      } catch {
        // Silently ignore
      }
    }
  }, [conversationId, backend, initialModelId, isOpenClaw]);

  const { data: openclawRuntime } = useSWR(
    isOpenClaw ? ['openclaw.runtime.selector', conversationId] : null,
    ([, currentConversationId]: [string, string]) =>
      ipcBridge.openclawConversation.getRuntime.invoke({ conversation_id: currentConversationId })
  );

  // Listen for acp_model_info / codex_model_info events from responseStream
  useEffect(() => {
    const handler = (message: IResponseMessage) => {
      if (message.conversation_id !== conversationId) return;
      if ((message.type === 'acp_model_info' || message.type === 'openclaw_model_info') && message.data) {
        const incoming = message.data as AcpModelInfo;
        if (backend === 'codex') {
          console.log('[AcpModelSelector][codex] Stream model info:', incoming);
        }
        // Preserve pre-selected model from Guid page until user manually switches.
        // The agent emits its default model during start (before re-apply), which
        // would otherwise overwrite the user's Guid page selection.
        if (initialModelId && !hasUserChangedModel.current && incoming.availableModels?.length > 0) {
          const match = incoming.availableModels.find((m) => m.id === initialModelId);
          if (match && incoming.currentModelId !== initialModelId) {
            setModelInfo({
              ...incoming,
              currentModelId: initialModelId,
              currentModelLabel: match.label || initialModelId,
            });
            return;
          }
        }
        setModelInfo(incoming);
      } else if (message.type === 'codex_model_info' && message.data) {
        // Codex model info: always read-only display
        const data = message.data as { model: string };
        if (data.model) {
          setModelInfo({
            source: 'models',
            currentModelId: data.model,
            currentModelLabel: data.model,
            canSwitch: false,
            availableModels: [],
          });
        }
      }
    };
    const stream = isOpenClaw
      ? ipcBridge.openclawConversation.responseStream
      : ipcBridge.acpConversation.responseStream;
    return stream.on(handler);
  }, [backend, conversationId, initialModelId, isOpenClaw]);

  const handleSelectModel = useCallback(
    (modelId: string) => {
      const request = isOpenClaw
        ? ipcBridge.openclawConversation.setModel.invoke({ conversation_id: conversationId, modelId })
        : ipcBridge.acpConversation.setModel.invoke({ conversationId, modelId });
      request
        .then((result) => {
          if (!result.success) {
            Message.error(result.msg || t('conversation.chat.modelSwitchFailed'));
            return;
          }

          hasUserChangedModel.current = true;
          if (result.data?.modelInfo) {
            setModelInfo(result.data.modelInfo);
          }
        })
        .catch((error) => {
          console.error('[AcpModelSelector] Failed to set model:', error);
          Message.error(error instanceof Error ? error.message : t('conversation.chat.modelSwitchFailed'));
        });
    },
    [conversationId, isOpenClaw, t]
  );

  const compact = isPreviewOpen || layout?.isMobile;
  const isMobileCompact = Boolean(layout?.isMobile);
  const headerButtonClassName = classNames(
    'sendbox-model-btn header-model-btn !flex !items-center !justify-center !px-0 !w-40px !min-w-40px !h-32px !min-h-32px',
    compact && '!w-36px !min-w-36px !h-30px !min-h-30px',
    isMobileCompact && '!w-40px !min-w-40px !h-32px !min-h-32px'
  );

  // 获取模型配置数据（包含健康状态）
  const { data: modelConfig } = useSWR<IProvider[]>('model.config', () => ipcBridge.mode.getModelConfig.invoke());
  const normalizeLookupValue = React.useCallback((value?: string | null) => value?.trim().toLowerCase() || '', []);
  const openclawFallbackModelInfo = React.useMemo(() => {
    if (!isOpenClaw) {
      return null;
    }

    const runtime = openclawRuntime?.success ? openclawRuntime.data : undefined;
    const currentModelId =
      modelInfo?.currentModelId || runtime?.runtime.model || runtime?.expected?.expectedModel || initialModelId || null;
    if (!currentModelId) {
      return null;
    }

    return {
      source: 'models' as const,
      currentModelId,
      currentModelLabel: currentModelId,
      availableModels: [{ id: currentModelId, label: currentModelId }],
      switchSupported: modelInfo?.switchSupported ?? false,
      canSwitch: false,
    };
  }, [
    initialModelId,
    isOpenClaw,
    modelInfo?.currentModelId,
    modelInfo?.switchSupported,
    normalizeLookupValue,
    openclawRuntime,
  ]);
  const mergeAvailableModels = React.useCallback(
    (
      primaryModels: Array<{ id: string; label: string }> = [],
      fallbackModels: Array<{ id: string; label: string }> = []
    ): Array<{ id: string; label: string }> => {
      const merged = new Map<string, { id: string; label: string }>();

      fallbackModels.forEach((model) => {
        const key = normalizeLookupValue(model.id);
        if (!key) {
          return;
        }
        merged.set(key, model);
      });

      primaryModels.forEach((model) => {
        const key = normalizeLookupValue(model.id);
        if (!key) {
          return;
        }
        merged.set(key, model);
      });

      return Array.from(merged.values());
    },
    [normalizeLookupValue]
  );
  const effectiveModelInfo = React.useMemo(() => {
    if (!isOpenClaw) {
      return modelInfo;
    }

    if (!modelInfo) {
      return openclawFallbackModelInfo;
    }

    const mergedAvailableModels = mergeAvailableModels(
      modelInfo.availableModels,
      openclawFallbackModelInfo?.availableModels
    );
    const currentModelId = modelInfo.currentModelId || openclawFallbackModelInfo?.currentModelId || null;
    const mergedCurrentModel =
      mergedAvailableModels.find((model) => normalizeLookupValue(model.id) === normalizeLookupValue(currentModelId)) ||
      null;
    const switchSupported =
      modelInfo.switchSupported ??
      openclawFallbackModelInfo?.switchSupported ??
      modelInfo.canSwitch ??
      openclawFallbackModelInfo?.canSwitch ??
      false;

    return {
      ...openclawFallbackModelInfo,
      ...modelInfo,
      currentModelId,
      currentModelLabel:
        modelInfo.currentModelLabel ||
        mergedCurrentModel?.label ||
        openclawFallbackModelInfo?.currentModelLabel ||
        currentModelId,
      availableModels: mergedAvailableModels,
      switchSupported,
      canSwitch:
        switchSupported &&
        mergedAvailableModels.some((model) => normalizeLookupValue(model.id) !== normalizeLookupValue(currentModelId)),
    };
  }, [isOpenClaw, mergeAvailableModels, modelInfo, normalizeLookupValue, openclawFallbackModelInfo]);
  const resolveProviderConfig = React.useCallback(
    (modelId?: string | null) => {
      if (!modelConfig) return undefined;
      if (isOpenClaw) {
        return modelConfig.find(
          (provider) =>
            provider.enabled !== false &&
            typeof modelId === 'string' &&
            provider.modelEnabled?.[modelId] !== false &&
            Array.isArray(provider.model) &&
            provider.model.includes(modelId)
        );
      }
      return modelConfig.find((provider) => provider.platform?.includes(backend || ''));
    },
    [backend, isOpenClaw, modelConfig]
  );
  const effectiveCurrentModelId = effectiveModelInfo?.currentModelId;
  const effectiveCurrentModelLabel = effectiveModelInfo?.currentModelLabel;
  const defaultModelLabel = t('common.defaultModel');
  const rawDisplayLabel = effectiveCurrentModelLabel || effectiveCurrentModelId || '';
  const displayLabel = getModelDisplayLabel({
    selectedValue: effectiveCurrentModelId,
    selectedLabel: rawDisplayLabel,
    defaultModelLabel,
    fallbackLabel: t('conversation.welcome.useCliModel'),
  });
  const tooltipLabel = effectiveCurrentModelId || displayLabel || t('conversation.welcome.useCliModel');
  const openClawDisplayName = t('guid.externalSessions.providers.openclaw-gateway');
  const isOpenClawDisconnected =
    isOpenClaw && openclawRuntime?.success === true && openclawRuntime.data?.runtime?.isConnected === false;
  const canSwitchModel = Boolean(effectiveModelInfo?.canSwitch) && !isOpenClawDisconnected;
  const readOnlyTooltipLabel = isOpenClawDisconnected
    ? t('acp.status.disconnected', { agent: openClawDisplayName })
    : isOpenClaw && effectiveModelInfo?.switchSupported === false
      ? t('conversation.chat.modelSwitchNotSupported')
      : tooltipLabel;
  const currentProviderConfig = React.useMemo(
    () => resolveProviderConfig(effectiveCurrentModelId),
    [effectiveCurrentModelId, resolveProviderConfig]
  );

  // 获取当前模型的健康状态
  const currentModelHealth = React.useMemo(() => {
    if (!effectiveCurrentModelId || !modelConfig) return { status: 'unknown', color: 'bg-gray-400' };
    const healthStatus = currentProviderConfig?.modelHealth?.[effectiveCurrentModelId]?.status || 'unknown';
    const healthColor =
      healthStatus === 'healthy' ? 'bg-green-500' : healthStatus === 'unhealthy' ? 'bg-red-500' : 'bg-gray-400';
    return { status: healthStatus, color: healthColor };
  }, [currentProviderConfig, effectiveCurrentModelId, modelConfig]);
  const currentModelLogo = React.useMemo(
    () =>
      getModelLogo({
        modelId: effectiveCurrentModelId,
        providerId: currentProviderConfig?.id,
        providerName: currentProviderConfig?.name,
        providerPlatform: currentProviderConfig?.platform,
        backend,
      }),
    [
      backend,
      currentProviderConfig?.id,
      currentProviderConfig?.name,
      currentProviderConfig?.platform,
      effectiveCurrentModelId,
    ]
  );
  const renderHeaderIcon = (logo: string | null, health: { status: string; color: string }) => (
    <span className='relative flex items-center justify-center w-full'>
      {logo ? (
        <img src={logo} alt='' className='h-14px w-14px shrink-0 rounded-5px object-contain' />
      ) : (
        <Brain theme='outline' size='14' className='text-t-secondary' />
      )}
      {health.status !== 'unknown' && (
        <span
          className={classNames(
            'absolute bottom-0 right-2px h-6px w-6px rounded-full border border-[var(--bg-1)]',
            health.color
          )}
        />
      )}
    </span>
  );

  // State 1: No model info — show disabled "Use CLI model" button
  if (!effectiveModelInfo) {
    return (
      <span
        title={
          isOpenClawDisconnected
            ? t('acp.status.disconnected', { agent: openClawDisplayName })
            : t('conversation.welcome.useCliModel')
        }
      >
        <Button className={headerButtonClassName} shape='round' size='small' style={{ cursor: 'default' }} disabled>
          {renderHeaderIcon(null, { status: 'unknown', color: 'bg-gray-400' })}
        </Button>
      </span>
    );
  }

  // State 2: Has model info but cannot switch — read-only display
  if (!canSwitchModel) {
    return (
      <span title={readOnlyTooltipLabel}>
        <Button className={headerButtonClassName} shape='round' size='small' style={{ cursor: 'default' }} disabled>
          {renderHeaderIcon(currentModelLogo, currentModelHealth)}
        </Button>
      </span>
    );
  }

  // State 3: Can switch — dropdown selector
  return (
    <Dropdown
      trigger='click'
      droplist={
        <Menu>
          {effectiveModelInfo.availableModels.map((model) => {
            const providerConfig = resolveProviderConfig(model.id);
            const healthStatus = providerConfig?.modelHealth?.[model.id]?.status || 'unknown';
            const healthColor =
              healthStatus === 'healthy' ? 'bg-green-500' : healthStatus === 'unhealthy' ? 'bg-red-500' : 'bg-gray-400';

            return (
              <Menu.Item
                key={model.id}
                className={model.id === effectiveModelInfo.currentModelId ? 'bg-2!' : ''}
                onClick={() => handleSelectModel(model.id)}
              >
                <div className='flex items-center gap-8px w-full'>
                  {healthStatus !== 'unknown' && <div className={`w-6px h-6px rounded-full shrink-0 ${healthColor}`} />}
                  <span>{model.label}</span>
                </div>
              </Menu.Item>
            );
          })}
        </Menu>
      }
    >
      <Button className={headerButtonClassName} shape='round' size='small' title={tooltipLabel}>
        {renderHeaderIcon(currentModelLogo, currentModelHealth)}
      </Button>
    </Dropdown>
  );
};

export default AcpModelSelector;
