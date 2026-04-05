/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useLayoutContext } from '@/renderer/hooks/context/LayoutContext';
import { resolveExtensionAssetUrl } from '@/renderer/utils/platform';
import { Button, Tag, Tooltip } from '@arco-design/web-react';
import { Down, Plus, Robot } from '@icon-park/react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CUSTOM_AVATAR_IMAGE_MAP } from '../constants';
import type { AcpBackendConfig, AvailableAgent, EffectiveAgentInfo } from '../types';
import styles from '../index.module.css';

type AssistantSelectionAreaProps = {
  isPresetAgent: boolean;
  selectedAssistantInfo: AvailableAgent | undefined;
  customAgents: AcpBackendConfig[];
  localeKey: string;
  currentEffectiveAgentInfo: EffectiveAgentInfo;
  onSelectAssistant: (assistantId: string) => void;
  onSetInput: (text: string) => void;
  onFocusInput: () => void;
};

const AssistantSelectionArea: React.FC<AssistantSelectionAreaProps> = ({
  isPresetAgent,
  selectedAssistantInfo,
  customAgents,
  localeKey,
  currentEffectiveAgentInfo,
  onSelectAssistant,
  onSetInput,
  onFocusInput,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  if (!customAgents || !customAgents.some((assistant) => assistant.isPreset)) return null;

  if (isPresetAgent && selectedAssistantInfo) {
    const selectedAssistant = customAgents.find((assistant) => assistant.id === selectedAssistantInfo.customAgentId);
    const harnessLabel =
      selectedAssistant?.harnessTagI18n?.[localeKey] || selectedAssistant?.harnessTagI18n?.['en-US'];
    const workspaceHint =
      selectedAssistant?.workspaceBootstrapHintI18n?.[localeKey] ||
      selectedAssistant?.workspaceBootstrapHintI18n?.['en-US'];

    return (
      <div className={`mt-16px w-full ${styles.assistantSection}`}>
        <div className='flex flex-col w-full animate-fade-in'>
          {(harnessLabel || workspaceHint) && (
            <div className='mb-10px flex flex-wrap gap-8px'>
              {harnessLabel ? (
                <Tag size='small' color='arcoblue'>
                  {harnessLabel}
                </Tag>
              ) : null}
              {workspaceHint ? (
                <Tooltip content={workspaceHint}>
                  <Tag size='small' color='gold'>
                    {t('settings.assistantWorkspaceRecommended', { defaultValue: 'Workspace Recommended' })}
                  </Tag>
                </Tooltip>
              ) : null}
            </div>
          )}

          {currentEffectiveAgentInfo.isFallback && (
            <div
              className={`${styles.assistantFallbackNotice} mb-12px px-12px py-8px rd-8px text-12px flex items-center gap-8px`}
              style={{
                background: 'rgb(var(--warning-1))',
                border: '1px solid rgb(var(--warning-3))',
                color: 'rgb(var(--warning-6))',
              }}
            >
              <span>
                {t('guid.agentFallbackNotice', {
                  original:
                    currentEffectiveAgentInfo.originalType.charAt(0).toUpperCase() +
                    currentEffectiveAgentInfo.originalType.slice(1),
                  fallback:
                    currentEffectiveAgentInfo.agentType.charAt(0).toUpperCase() +
                    currentEffectiveAgentInfo.agentType.slice(1),
                  defaultValue: `${currentEffectiveAgentInfo.originalType.charAt(0).toUpperCase() + currentEffectiveAgentInfo.originalType.slice(1)} is unavailable, using ${currentEffectiveAgentInfo.agentType.charAt(0).toUpperCase() + currentEffectiveAgentInfo.agentType.slice(1)} instead.`,
                })}
              </span>
            </div>
          )}

          <div className='w-full'>
            <Button
              type='text'
              className={styles.assistantSectionHeader}
              onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
            >
              <span className='text-13px text-[rgb(var(--primary-6))] opacity-80'>
                {t('settings.assistantDescription', { defaultValue: 'Assistant Description' })}
              </span>
              <Down
                theme='outline'
                size={14}
                fill='rgb(var(--primary-6))'
                className={`transition-transform duration-300 ${isDescriptionExpanded ? 'rotate-180' : ''}`}
              />
            </Button>
            <div
              className={`overflow-hidden transition-all duration-300 ${isDescriptionExpanded ? 'max-h-240px mt-4px opacity-100' : 'max-h-0 opacity-0'}`}
            >
              <div
                className={`${styles.assistantDescriptionPanel} p-12px rd-14px text-13px text-3 text-t-secondary whitespace-pre-wrap leading-relaxed`}
                style={{
                  border: '1px solid var(--color-border-2)',
                  background: 'var(--color-fill-1)',
                }}
              >
                {selectedAssistant?.descriptionI18n?.[localeKey] ||
                  selectedAssistant?.description ||
                  t('settings.assistantDescriptionPlaceholder', { defaultValue: 'No description' })}
              </div>
            </div>
          </div>

          {(() => {
            const prompts =
              selectedAssistant?.promptsI18n?.[localeKey] ||
              selectedAssistant?.promptsI18n?.['en-US'] ||
              selectedAssistant?.prompts;
            if (!prompts || prompts.length === 0) {
              return null;
            }
            return (
              <div className={`${styles.assistantPromptList} flex flex-wrap gap-8px mt-16px`}>
                {prompts.map((prompt: string, index: number) => (
                  <Button
                    key={index}
                    type='text'
                    className={styles.assistantPromptButton}
                    onClick={() => {
                      onSetInput(prompt);
                      onFocusInput();
                    }}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            );
          })()}
        </div>
      </div>
    );
  }

  return (
    <div className={`mt-16px w-full ${styles.assistantSection}`}>
      <div className={`${styles.assistantPresetGrid} flex flex-wrap gap-8px ${isMobile ? 'justify-start' : 'justify-center'}`}>
        {customAgents
          .filter((assistant) => assistant.isPreset && assistant.enabled !== false)
          .toSorted((a, b) => {
            if (a.id === 'cowork') return -1;
            if (b.id === 'cowork') return 1;
            return 0;
          })
          .map((assistant) => {
            const avatarValue = assistant.avatar?.trim();
            const mappedAvatar = avatarValue ? CUSTOM_AVATAR_IMAGE_MAP[avatarValue] : undefined;
            const resolvedAvatar = avatarValue ? resolveExtensionAssetUrl(avatarValue) : undefined;
            const avatarImage = mappedAvatar || resolvedAvatar;
            const isImageAvatar = Boolean(
              avatarImage &&
                (/\.(svg|png|jpe?g|webp|gif)$/i.test(avatarImage) ||
                  /^(https?:|contextgo-asset:\/\/|file:\/\/|data:)/i.test(avatarImage))
            );
            return (
              <Button
                key={assistant.id}
                type='text'
                className={styles.assistantPresetButton}
                style={{
                  borderWidth: '1px',
                  borderColor: 'color-mix(in srgb, var(--color-border-2) 70%, transparent)',
                }}
                onClick={() => onSelectAssistant(`custom:${assistant.id}`)}
              >
                {isImageAvatar ? (
                  <img src={avatarImage} alt='' width={16} height={16} style={{ objectFit: 'contain' }} />
                ) : avatarValue ? (
                  <span style={{ fontSize: 16, lineHeight: '18px' }}>{avatarValue}</span>
                ) : (
                  <Robot theme='outline' size={16} />
                )}
                <span className={styles.assistantPresetLabel}>
                  {assistant.nameI18n?.[localeKey] || assistant.name}
                </span>
              </Button>
            );
          })}
        <Button
          type='text'
          className={styles.assistantManageButton}
          style={{ borderWidth: '1px', borderColor: 'color-mix(in srgb, var(--color-border-2) 70%, transparent)' }}
          onClick={() => navigate('/settings/agent')}
        >
          <Plus theme='outline' size={14} className='line-height-0 text-[var(--color-text-3)]' />
          {isMobile ? (
            <span className={styles.assistantManageLabel}>{t('settings.assistants', { defaultValue: 'AI Agent' })}</span>
          ) : null}
        </Button>
      </div>
    </div>
  );
};

export default AssistantSelectionArea;
