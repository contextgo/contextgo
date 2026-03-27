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
import { Button, Dropdown, Menu } from '@arco-design/web-react';
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
  const [modelInfo, setModelInfo] = useState<AcpModelInfo | null>(null);
  const modelInfoRef = useRef(modelInfo);
  modelInfoRef.current = modelInfo;
  // Track whether user has manually switched model via dropdown
  const hasUserChangedModel = useRef(false);

  // Fetch initial model info on mount, fallback to cached models if manager not ready
  useEffect(() => {
    let cancelled = false;
    ipcBridge.acpConversation.getModelInfo
      .invoke({ conversationId })
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
    return ipcBridge.acpConversation.responseStream.on(handler);
  }, [conversationId, initialModelId]);

  const handleSelectModel = useCallback(
    (modelId: string) => {
      hasUserChangedModel.current = true;
      ipcBridge.acpConversation.setModel
        .invoke({ conversationId, modelId })
        .then((result) => {
          if (result.success && result.data?.modelInfo) {
            setModelInfo(result.data.modelInfo);
          }
        })
        .catch((error) => {
          console.error('[AcpModelSelector] Failed to set model:', error);
        });
    },
    [conversationId]
  );

  const defaultModelLabel = t('common.defaultModel');
  const rawDisplayLabel = modelInfo?.currentModelLabel || modelInfo?.currentModelId || '';
  const displayLabel = getModelDisplayLabel({
    selectedValue: modelInfo?.currentModelId,
    selectedLabel: rawDisplayLabel,
    defaultModelLabel,
    fallbackLabel: t('conversation.welcome.useCliModel'),
  });
  const compact = isPreviewOpen || layout?.isMobile;
  const isMobileCompact = Boolean(layout?.isMobile);
  const headerButtonClassName = classNames(
    'sendbox-model-btn header-model-btn !px-0 !w-44px !min-w-44px justify-center',
    compact && '!w-40px !min-w-40px',
    isMobileCompact && '!w-44px !min-w-44px'
  );

  // 获取模型配置数据（包含健康状态）
  const { data: modelConfig } = useSWR<IProvider[]>('model.config', () => ipcBridge.mode.getModelConfig.invoke());

  // 获取当前模型的健康状态
  const currentModelHealth = React.useMemo(() => {
    if (!modelInfo?.currentModelId || !modelConfig) return { status: 'unknown', color: 'bg-gray-400' };
    const providerConfig = modelConfig.find((p) => p.platform?.includes(backend || ''));
    const healthStatus = providerConfig?.modelHealth?.[modelInfo.currentModelId]?.status || 'unknown';
    const healthColor =
      healthStatus === 'healthy' ? 'bg-green-500' : healthStatus === 'unhealthy' ? 'bg-red-500' : 'bg-gray-400';
    return { status: healthStatus, color: healthColor };
  }, [modelInfo?.currentModelId, modelConfig, backend]);
  const currentModelLogo = React.useMemo(
    () =>
      getModelLogo({
        modelId: modelInfo?.currentModelId,
        providerName: modelInfo?.currentModelLabel,
        backend,
      }),
    [backend, modelInfo?.currentModelId, modelInfo?.currentModelLabel]
  );
  const renderHeaderIcon = (logo: string | null, health: { status: string; color: string }) => (
    <span className='relative flex items-center justify-center w-full'>
      {logo ? (
        <img src={logo} alt='' className='h-16px w-16px shrink-0 rounded-6px object-contain' />
      ) : (
        <Brain theme='outline' size='16' className='text-t-secondary' />
      )}
      {health.status !== 'unknown' && (
        <span
          className={classNames(
            'absolute bottom-0 right-1px h-7px w-7px rounded-full border border-[var(--bg-1)]',
            health.color
          )}
        />
      )}
    </span>
  );

  // State 1: No model info — show disabled "Use CLI model" button
  if (!modelInfo) {
    return (
      <Button
        className={headerButtonClassName}
        shape='round'
        size='small'
        style={{ cursor: 'default' }}
        title={t('conversation.welcome.useCliModel')}
      >
        {renderHeaderIcon(null, { status: 'unknown', color: 'bg-gray-400' })}
      </Button>
    );
  }

  // State 2: Has model info but cannot switch — read-only display
  if (!modelInfo.canSwitch) {
    return (
      <Button
        className={headerButtonClassName}
        shape='round'
        size='small'
        style={{ cursor: 'default' }}
        title={displayLabel}
      >
        {renderHeaderIcon(currentModelLogo, currentModelHealth)}
      </Button>
    );
  }

  // State 3: Can switch — dropdown selector
  return (
    <Dropdown
      trigger='click'
      droplist={
        <Menu>
          {modelInfo.availableModels.map((model) => {
            const providerConfig = modelConfig?.find((p) => p.platform?.includes(backend || ''));
            const healthStatus = providerConfig?.modelHealth?.[model.id]?.status || 'unknown';
            const healthColor =
              healthStatus === 'healthy' ? 'bg-green-500' : healthStatus === 'unhealthy' ? 'bg-red-500' : 'bg-gray-400';

            return (
              <Menu.Item
                key={model.id}
                className={model.id === modelInfo.currentModelId ? 'bg-2!' : ''}
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
      <Button className={headerButtonClassName} shape='round' size='small' title={displayLabel}>
        {renderHeaderIcon(currentModelLogo, currentModelHealth)}
      </Button>
    </Dropdown>
  );
};

export default AcpModelSelector;
