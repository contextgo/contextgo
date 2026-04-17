/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { IResponseMessage } from '@/common/adapter/ipcBridge';
import { ConfigStorage } from '@/common/config/storage';
import type { IProvider } from '@/common/config/storage';
import type { AcpBackend, AcpModelInfo } from '@/common/types/acpTypes';
import { useLayoutContext } from '@/renderer/hooks/context/LayoutContext';
import { usePreviewSurface } from '@/renderer/pages/conversation/Preview';
import { getModelDisplayLabel, getModelLogo } from '@/renderer/utils/model/agentLogo';
import { Button, Dropdown, Menu, Message } from '@arco-design/web-react';
import { Brain } from '@icon-park/react';
import classNames from 'classnames';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

const normalizeModelLookupValue = (value?: string | null) => value?.trim().toLowerCase() || '';

const buildCodexPreservedModelInfo = (
  current: AcpModelInfo | null,
  nextCurrentModelId: string | null,
  nextCurrentModelLabel?: string | null
): AcpModelInfo | null => {
  if (!current || current.availableModels.length === 0) {
    return null;
  }

  const currentModelId = nextCurrentModelId || current.currentModelId || null;
  const matchedModel = current.availableModels.find(
    (model) => normalizeModelLookupValue(model.id) === normalizeModelLookupValue(currentModelId)
  );
  const switchSupported = current.switchSupported ?? true;

  return {
    ...current,
    currentModelId,
    currentModelLabel: nextCurrentModelLabel || matchedModel?.label || current.currentModelLabel || currentModelId,
    availableModels: current.availableModels,
    switchSupported,
    canSwitch:
      switchSupported &&
      current.availableModels.some(
        (model) => normalizeModelLookupValue(model.id) !== normalizeModelLookupValue(currentModelId)
      ),
  };
};

const applyEffectiveCurrentModel = (
  info: AcpModelInfo,
  preferredModelId?: string | null,
  preferredModelLabel?: string | null
): AcpModelInfo => {
  const currentModelId = preferredModelId || info.currentModelId || null;
  const matchedModel = info.availableModels.find(
    (model) => normalizeModelLookupValue(model.id) === normalizeModelLookupValue(currentModelId)
  );

  return {
    ...info,
    currentModelId,
    currentModelLabel: preferredModelLabel || matchedModel?.label || info.currentModelLabel || currentModelId,
  };
};

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
  /** ACP backend name for loading cached models (e.g., 'claude', 'opencode') */
  backend?: string;
  /** Pre-selected model ID from Guid page */
  initialModelId?: string;
}> = ({ conversationId, backend, initialModelId }) => {
  const { t } = useTranslation();
  const { isOpen: isPreviewOpen } = usePreviewSurface();
  const layout = useLayoutContext();
  const [modelInfo, setModelInfo] = useState<AcpModelInfo | null>(null);
  const modelInfoRef = useRef(modelInfo);
  modelInfoRef.current = modelInfo;
  // Track whether user has manually switched model via dropdown
  const hasUserChangedModel = useRef(false);

  // Fetch initial model info on mount, fallback to cached models if manager not ready
  useEffect(() => {
    let cancelled = false;
    setModelInfo(null);
    hasUserChangedModel.current = false;
    const preferredModelId = initialModelId || null;
    ipcBridge.acpConversation.getModelInfo
      .invoke({ conversationId })
      .then((result) => {
        if (cancelled) return;
        if (result.success && result.data?.modelInfo) {
          const info = result.data.modelInfo;
          const effectiveInfo = applyEffectiveCurrentModel(info, preferredModelId);
          if (backend === 'codex') {
            console.log('[AcpModelSelector][codex] Initial model info:', info);
          }
          // When agent is not fully initialized, getModelInfo returns
          // canSwitch=false with empty availableModels. Prefer cached data
          // in that case to keep the dropdown functional.
          if (info.availableModels?.length > 0) {
            setModelInfo(effectiveInfo);
          } else if (backend) {
            setModelInfo(effectiveInfo);
            void loadCachedModelInfo(backend as AcpBackend, cancelled, preferredModelId);
          } else {
            setModelInfo(effectiveInfo);
          }
        } else if (backend) {
          // Manager not yet created — load cached model list from storage
          void loadCachedModelInfo(backend as AcpBackend, cancelled, preferredModelId);
        }
      })
      .catch(() => {
        if (!cancelled && backend) {
          void loadCachedModelInfo(backend as AcpBackend, cancelled, preferredModelId);
        }
      });

    return () => {
      cancelled = true;
    };

    async function loadCachedModelInfo(
      backendKey: AcpBackend,
      isCancelled: boolean,
      preferredCurrentModelId?: string | null
    ) {
      try {
        const cached = await ConfigStorage.get('acp.cachedModels');
        if (isCancelled) return;
        const cachedInfo = cached?.[backendKey];
        if (cachedInfo?.availableModels?.length > 0) {
          if (backendKey === 'codex') {
            console.log('[AcpModelSelector][codex] Loaded cached model info:', cachedInfo);
          }
          setModelInfo(applyEffectiveCurrentModel(cachedInfo, preferredCurrentModelId));
          return;
        }

        const probed = await ipcBridge.acpConversation.probeModelInfo.invoke({ backend: backendKey });
        if (isCancelled) return;
        const probedInfo = probed.success ? probed.data?.modelInfo : null;
        if (probedInfo?.availableModels?.length) {
          if (backendKey === 'codex') {
            console.log('[AcpModelSelector][codex] Probed model info:', probedInfo);
          }
          setModelInfo(applyEffectiveCurrentModel(probedInfo, preferredCurrentModelId));
        }
      } catch {
        // Silently ignore
      }
    }
  }, [conversationId, backend, initialModelId]);

  // Listen for acp_model_info / codex_model_info events from responseStream
  useEffect(() => {
    const handler = (message: IResponseMessage) => {
      if (message.conversation_id !== conversationId) return;
      if (message.type === 'acp_model_info' && message.data) {
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
        if (backend === 'codex' && incoming.availableModels.length === 0) {
          const preserved = buildCodexPreservedModelInfo(
            modelInfoRef.current,
            incoming.currentModelId,
            incoming.currentModelLabel
          );
          if (preserved) {
            setModelInfo({
              ...incoming,
              ...preserved,
            });
            return;
          }
        }
        setModelInfo(incoming);
      } else if (message.type === 'codex_model_info' && message.data) {
        const data = message.data as { model: string };
        if (data.model) {
          const preserved = buildCodexPreservedModelInfo(modelInfoRef.current, data.model, data.model);
          if (preserved) {
            setModelInfo(preserved);
            return;
          }
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
    return ipcBridge.acpConversation.responseStream.on(handler);
  }, [backend, conversationId, initialModelId]);

  const handleSelectModel = useCallback(
    (modelId: string) => {
      ipcBridge.acpConversation.setModel
        .invoke({ conversationId, modelId })
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
    [conversationId, t]
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
  const normalizeLookupValue = React.useCallback(normalizeModelLookupValue, []);
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
  const effectiveModelInfo = modelInfo;
  const resolveProviderConfig = React.useCallback(
    (modelId?: string | null) => {
      if (!modelConfig) return undefined;
      return modelConfig.find((provider) => provider.platform?.includes(backend || ''));
    },
    [backend, modelConfig]
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
  const canSwitchModel = Boolean(effectiveModelInfo?.canSwitch);
  const readOnlyTooltipLabel = tooltipLabel;
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
      <span title={t('conversation.welcome.useCliModel')}>
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
