import type { GeminiModelSelection } from '@/renderer/pages/conversation/platforms/gemini/useGeminiModelSelection';
import { usePreviewContext } from '@/renderer/pages/conversation/Preview/context';
import { useLayoutContext } from '@/renderer/hooks/context/LayoutContext';
import { getModelDisplayLabel, getModelLogo } from '@/renderer/utils/model/agentLogo';
import { Button, Dropdown, Menu, Tooltip } from '@arco-design/web-react';
import { Brain, Down } from '@icon-park/react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import classNames from 'classnames';
import useSWR from 'swr';
import { ipcBridge } from '@/common';
import type { IProvider } from '@/common/config/storage';

// Unified model dropdown for chat header, send box, and channel settings
const GeminiModelSelector: React.FC<{
  selection?: GeminiModelSelection;
  disabled?: boolean;
  label?: string;
  variant?: 'header' | 'settings';
  readOnlyModel?: {
    modelId?: string;
    providerId?: string;
    providerName?: string;
    providerPlatform?: string;
  };
}> = ({ selection, disabled = false, label: customLabel, variant = 'header', readOnlyModel }) => {
  const { t } = useTranslation();
  const { isOpen: isPreviewOpen } = usePreviewContext();
  const layout = useLayoutContext();
  const compact = variant === 'header' && (isPreviewOpen || layout?.isMobile);
  const isMobileHeaderCompact = variant === 'header' && Boolean(layout?.isMobile);
  const defaultModelLabel = t('common.defaultModel');
  const headerButtonClassName = classNames(
    'sendbox-model-btn header-model-btn !flex !items-center !justify-center !px-0 !w-40px !min-w-40px !h-32px !min-h-32px',
    compact && '!w-36px !min-w-36px !h-30px !min-h-30px',
    isMobileHeaderCompact && '!w-40px !min-w-40px !h-32px !min-h-32px'
  );

  // 获取模型配置数据（包含健康状态）
  const { data: modelConfig } = useSWR<IProvider[]>('model.config', () => ipcBridge.mode.getModelConfig.invoke());

  // 获取当前模型的健康状态 (must be called before any early return to keep hooks count stable)
  const currentModel = selection?.currentModel;
  const currentModelHealth = React.useMemo(() => {
    if (!currentModel || !modelConfig) return { status: 'unknown', color: 'bg-gray-400' };
    const matchedProvider = modelConfig.find((p) => p.id === currentModel.id);
    const healthStatus = matchedProvider?.modelHealth?.[currentModel.useModel]?.status || 'unknown';
    const healthColor =
      healthStatus === 'healthy' ? 'bg-green-500' : healthStatus === 'unhealthy' ? 'bg-red-500' : 'bg-gray-400';
    return { status: healthStatus, color: healthColor };
  }, [currentModel, modelConfig]);
  const currentModelLogo = React.useMemo(
    () =>
      getModelLogo({
        modelId: currentModel?.useModel,
        providerId: currentModel?.id,
        providerName: currentModel?.name,
        providerPlatform: currentModel?.platform,
      }),
    [currentModel?.id, currentModel?.name, currentModel?.platform, currentModel?.useModel]
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

  // Disabled state (non-Gemini Agent): render a simple Tooltip + Button, no Dropdown needed
  if (disabled || !selection) {
    const displayLabel = customLabel || t('conversation.welcome.useCliModel');
    const readOnlyLogo = getModelLogo({
      modelId: readOnlyModel?.modelId || displayLabel,
      providerId: readOnlyModel?.providerId,
      providerName: readOnlyModel?.providerName,
      providerPlatform: readOnlyModel?.providerPlatform,
    });
    const hasReadOnlyModel = Boolean(
      readOnlyModel?.modelId ||
      readOnlyModel?.providerId ||
      readOnlyModel?.providerName ||
      readOnlyModel?.providerPlatform
    );

    if (variant === 'settings') {
      return <div className='text-14px text-t-secondary min-w-160px'>{displayLabel}</div>;
    }

    return (
      <span title={displayLabel}>
        <Button
          className={headerButtonClassName}
          shape='round'
          size='small'
          style={{ cursor: 'default' }}
          disabled={!hasReadOnlyModel}
        >
          {renderHeaderIcon(readOnlyLogo, { status: 'unknown', color: 'bg-gray-400' })}
        </Button>
      </span>
    );
  }

  const { providers, geminiModeLookup, getAvailableModels, handleSelectModel, formatModelLabel } = selection;

  // formatModelLabel returns the friendly label for known modes (e.g. 'Auto (Gemini 3)')
  // and falls back to the raw model name for manual sub-model selections.
  const rawLabel = currentModel ? formatModelLabel(currentModel, currentModel.useModel) : '';
  const label =
    customLabel ||
    getModelDisplayLabel({
      selectedValue: currentModel?.useModel,
      selectedLabel: rawLabel,
      defaultModelLabel,
      fallbackLabel: t('conversation.welcome.selectModel'),
    });

  const triggerButton =
    variant === 'settings' ? (
      <Button type='secondary' className='min-w-160px flex items-center justify-between gap-8px'>
        <div className='flex items-center gap-8px min-w-0'>
          {currentModelHealth.status !== 'unknown' && (
            <div className={`w-6px h-6px rounded-full shrink-0 ${currentModelHealth.color}`} />
          )}
          <span className='truncate'>{label}</span>
        </div>
        <Down theme='outline' size={14} />
      </Button>
    ) : (
      <Button className={headerButtonClassName} shape='round' size='small' title={currentModel?.useModel || label}>
        {renderHeaderIcon(currentModelLogo, currentModelHealth)}
      </Button>
    );

  const dropdownNode = (
    <Dropdown
      trigger='click'
      position={variant === 'settings' ? 'br' : undefined}
      droplist={
        <Menu>
          {providers.map((provider) => {
            const models = getAvailableModels(provider);
            if (!models.length) return null;

            return (
              <Menu.ItemGroup title={provider.name} key={provider.id}>
                {models.map((modelName) => {
                  const isGoogleProvider = provider.platform?.toLowerCase().includes('gemini-with-google-auth');
                  const option = isGoogleProvider ? geminiModeLookup.get(modelName) : undefined;

                  // Manual mode: show submenu with specific models
                  if (option?.subModels && option.subModels.length > 0) {
                    return (
                      <Menu.SubMenu
                        key={`${provider.id}-${modelName}`}
                        title={
                          <div className='flex items-center justify-between gap-12px w-full'>
                            <span>{option.label}</span>
                          </div>
                        }
                      >
                        {option.subModels.map((subModel) => (
                          <Menu.Item
                            key={`${provider.id}-${subModel.value}`}
                            className={
                              currentModel?.id + currentModel?.useModel === provider.id + subModel.value ? '!bg-2' : ''
                            }
                            onClick={() => void handleSelectModel(provider, subModel.value)}
                          >
                            {subModel.label}
                          </Menu.Item>
                        ))}
                      </Menu.SubMenu>
                    );
                  }

                  // Normal mode: show single item
                  return (
                    <Menu.Item
                      key={`${provider.id}-${modelName}`}
                      onClick={() => void handleSelectModel(provider, modelName)}
                    >
                      {(() => {
                        const matchedProvider = modelConfig?.find((p) => p.id === provider.id);
                        const healthStatus = matchedProvider?.modelHealth?.[modelName]?.status || 'unknown';
                        const healthColor =
                          healthStatus === 'healthy'
                            ? 'bg-green-500'
                            : healthStatus === 'unhealthy'
                              ? 'bg-red-500'
                              : 'bg-gray-400';

                        if (!option) {
                          return (
                            <div className='flex items-center gap-8px w-full'>
                              {healthStatus !== 'unknown' && (
                                <div className={`w-6px h-6px rounded-full shrink-0 ${healthColor}`} />
                              )}
                              <span>{modelName}</span>
                            </div>
                          );
                        }
                        return (
                          <Tooltip
                            position='right'
                            trigger='hover'
                            content={
                              <div className='max-w-240px space-y-6px'>
                                <div className='text-12px text-t-tertiary leading-5'>{option.description}</div>
                                {option.modelHint && (
                                  <div className='text-11px text-t-tertiary'>{option.modelHint}</div>
                                )}
                              </div>
                            }
                          >
                            <div className='flex items-center gap-8px w-full'>
                              {healthStatus !== 'unknown' && (
                                <div className={`w-6px h-6px rounded-full shrink-0 ${healthColor}`} />
                              )}
                              <span>{option.label}</span>
                            </div>
                          </Tooltip>
                        );
                      })()}
                    </Menu.Item>
                  );
                })}
              </Menu.ItemGroup>
            );
          })}
        </Menu>
      }
    >
      {triggerButton}
    </Dropdown>
  );

  if (variant === 'settings') {
    return dropdownNode;
  }

  return dropdownNode;
};

export default GeminiModelSelector;
