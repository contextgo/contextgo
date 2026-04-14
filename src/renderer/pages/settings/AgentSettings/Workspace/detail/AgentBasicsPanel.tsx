import type { AssistantListItem } from '@/renderer/pages/settings/AgentSettings/AssistantManagement/types';
import EmojiPicker from '@/renderer/components/chat/EmojiPicker';
import MarkdownView from '@/renderer/components/Markdown';
import { PRODUCT_VISIBLE_PRESET_AGENT_TYPES } from '@/renderer/utils/model/availableAgents';
import { Avatar, Button, Input, Select, Tag } from '@arco-design/web-react';
import { Robot } from '@icon-park/react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../AssistantWorkspace.module.css';

type AgentBasicsPanelProps = {
  mode: 'create' | 'edit';
  activeAssistant: AssistantListItem | null;
  editName: string;
  setEditName: (value: string) => void;
  editDescription: string;
  setEditDescription: (value: string) => void;
  editAvatar: string;
  setEditAvatar: (value: string) => void;
  editAvatarImage?: string;
  editAgent: string;
  setEditAgent: (value: string) => void;
  editContext: string;
  setEditContext: (value: string) => void;
  promptViewMode: 'edit' | 'preview';
  setPromptViewMode: (value: 'edit' | 'preview') => void;
  availableBackends: Set<string>;
  extensionAcpAdapters?: Record<string, unknown>[] | undefined;
  isReadonlyAssistant: boolean;
  onSave: () => Promise<void>;
  onClose?: () => void;
  onDelete?: () => void;
};

const AgentBasicsPanel: React.FC<AgentBasicsPanelProps> = ({
  mode,
  activeAssistant,
  editName,
  setEditName,
  editDescription,
  setEditDescription,
  editAvatar,
  setEditAvatar,
  editAvatarImage,
  editAgent,
  setEditAgent,
  editContext,
  setEditContext,
  promptViewMode,
  setPromptViewMode,
  availableBackends,
  extensionAcpAdapters,
  isReadonlyAssistant,
  onSave,
  onClose,
  onDelete,
}) => {
  const { t } = useTranslation();
  const identityReadonly = Boolean(activeAssistant?.isBuiltin || isReadonlyAssistant);

  return (
    <div className={styles.surface}>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderMeta}>
          <h2 className={styles.pageTitle}>
            {mode === 'create'
              ? t('settings.agentWorkspaceCreateTitle', { defaultValue: 'Create Agent' })
              : t('settings.agentWorkspaceBasicsTitle', { defaultValue: 'Agent Basics' })}
          </h2>
          <p className={styles.pageDescription}>
            {mode === 'create'
              ? t('settings.agentWorkspaceCreateDescription', {
                  defaultValue: 'Set the agent identity, runtime, and rules before entering the capability workspace.',
                })
              : t('settings.agentWorkspaceBasicsDescription', {
                  defaultValue:
                    'Adjust assistant identity, runtime, and rules without leaving the current detail page.',
                })}
          </p>
        </div>
        <div className={styles.actionRow}>
          {onDelete ? (
            <Button status='danger' onClick={onDelete}>
              {t('common.delete', { defaultValue: 'Delete' })}
            </Button>
          ) : null}
          {onClose ? <Button onClick={onClose}>{t('common.close', { defaultValue: 'Close' })}</Button> : null}
          <Button type='primary' onClick={() => void onSave()} disabled={mode !== 'create' && isReadonlyAssistant}>
            {mode === 'create'
              ? t('common.create', { defaultValue: 'Create' })
              : t('common.save', { defaultValue: 'Save' })}
          </Button>
        </div>
      </div>

      <div className='grid gap-16px px-24px pb-24px xl:grid-cols-[minmax(0,1fr)_320px]'>
        <div className={styles.contentStack}>
          <div className={styles.contentCard}>
            <div className={styles.sectionTitle}>
              {t('settings.assistantNameAvatar', { defaultValue: 'Name & Avatar' })}
            </div>
            <div className='mt-12px flex items-center gap-12px'>
              {identityReadonly ? (
                <Avatar shape='square' size={48} className='bg-bg-1 rounded-8px'>
                  {editAvatarImage ? (
                    <img src={editAvatarImage} alt='' width={28} height={28} style={{ objectFit: 'contain' }} />
                  ) : editAvatar ? (
                    <span className='text-24px'>{editAvatar}</span>
                  ) : (
                    <Robot theme='outline' size={20} />
                  )}
                </Avatar>
              ) : (
                <EmojiPicker value={editAvatar} onChange={(emoji) => setEditAvatar(emoji)} placement='br'>
                  <div className='cursor-pointer'>
                    <Avatar shape='square' size={48} className='bg-bg-1 rounded-8px'>
                      {editAvatarImage ? (
                        <img src={editAvatarImage} alt='' width={28} height={28} style={{ objectFit: 'contain' }} />
                      ) : editAvatar ? (
                        <span className='text-24px'>{editAvatar}</span>
                      ) : (
                        <Robot theme='outline' size={20} />
                      )}
                    </Avatar>
                  </div>
                </EmojiPicker>
              )}
              <Input
                value={editName}
                onChange={setEditName}
                disabled={identityReadonly}
                placeholder={t('settings.agentNamePlaceholder', { defaultValue: 'Enter a name for this agent' })}
              />
            </div>
          </div>

          <div className={styles.contentCard}>
            <div className={styles.sectionTitle}>
              {t('settings.assistantDescription', { defaultValue: 'Assistant Description' })}
            </div>
            <Input
              className='mt-12px'
              value={editDescription}
              onChange={setEditDescription}
              disabled={identityReadonly}
              placeholder={t('settings.assistantDescriptionPlaceholder', {
                defaultValue: 'What can this assistant help with?',
              })}
            />
          </div>

          <div className={styles.contentCard}>
            <div className={styles.sectionTitle}>
              {t('settings.assistantMainAgent', { defaultValue: 'Main Agent' })}
            </div>
            <Select
              className='mt-12px w-full'
              value={editAgent}
              onChange={(value) => setEditAgent(value as string)}
              disabled={isReadonlyAssistant}
            >
              {[
                { value: 'gemini', label: 'Gemini CLI' },
                { value: 'claude', label: 'Claude Code' },
                { value: 'codex', label: 'Codex' },
                { value: 'opencode', label: 'OpenCode' },
              ]
                .filter((option) =>
                  PRODUCT_VISIBLE_PRESET_AGENT_TYPES.includes(
                    option.value as (typeof PRODUCT_VISIBLE_PRESET_AGENT_TYPES)[number]
                  )
                )
                .filter((option) => availableBackends.has(option.value))
                .map((option) => (
                  <Select.Option key={option.value} value={option.value}>
                    {option.label}
                  </Select.Option>
                ))}
              {extensionAcpAdapters?.map((adapter) => {
                const id = adapter.id as string;
                const name = (adapter.name as string) || id;
                return (
                  <Select.Option key={id} value={id}>
                    <span className='flex items-center gap-6px'>
                      {name}
                      <Tag size='small' color='arcoblue'>
                        ext
                      </Tag>
                    </span>
                  </Select.Option>
                );
              })}
            </Select>
          </div>

          <div className={styles.contentCard}>
            <div className='flex items-center justify-between gap-12px'>
              <div>
                <div className={styles.sectionTitle}>{t('settings.assistantRules', { defaultValue: 'Rules' })}</div>
                <div className={styles.sectionText}>
                  {t('settings.agentWorkspaceAgentsEntryDescription', {
                    defaultValue:
                      'AGENTS.md is the packaged rules entry document. ContextGo can project it into runtime-native entry files such as CLAUDE.md or GEMINI.md.',
                  })}
                </div>
              </div>
              {!activeAssistant?.isBuiltin && !isReadonlyAssistant ? (
                <div className={styles.actionRow}>
                  <Button
                    type={promptViewMode === 'edit' ? 'primary' : 'outline'}
                    onClick={() => setPromptViewMode('edit')}
                  >
                    {t('settings.promptEdit', { defaultValue: 'Edit' })}
                  </Button>
                  <Button
                    type={promptViewMode === 'preview' ? 'primary' : 'outline'}
                    onClick={() => setPromptViewMode('preview')}
                  >
                    {t('settings.promptPreview', { defaultValue: 'Preview' })}
                  </Button>
                </div>
              ) : null}
            </div>
            <div className='mt-12px min-h-[320px] overflow-hidden rounded-16px border border-border-2 bg-fill-2'>
              {promptViewMode === 'edit' && !activeAssistant?.isBuiltin && !isReadonlyAssistant ? (
                <Input.TextArea
                  value={editContext}
                  onChange={setEditContext}
                  placeholder={t('settings.assistantRulesPlaceholder', {
                    defaultValue: 'Enter rules in Markdown format...',
                  })}
                  autoSize={false}
                  className='h-[320px] border-none rounded-none bg-transparent'
                />
              ) : (
                <div className='p-16px'>
                  {editContext ? (
                    <MarkdownView hiddenCodeCopyButton>{editContext}</MarkdownView>
                  ) : (
                    <div className={styles.emptyState}>
                      {t('settings.promptPreviewEmpty', { defaultValue: 'No content to preview' })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={styles.contentStack}>
          <div className={styles.contentCard}>
            <div className={styles.sectionTitle}>{t('settings.assistants', { defaultValue: 'Assistants' })}</div>
            <div className='mt-16px flex items-start gap-12px'>
              <Avatar shape='square' size={52} className='bg-bg-1 rounded-10px'>
                {editAvatarImage ? (
                  <img src={editAvatarImage} alt='' width={30} height={30} style={{ objectFit: 'contain' }} />
                ) : editAvatar ? (
                  <span className='text-24px'>{editAvatar}</span>
                ) : (
                  <Robot theme='outline' size={22} />
                )}
              </Avatar>
              <div className='min-w-0 flex-1'>
                <div className={styles.sectionTitle}>
                  {editName || t('settings.assistantUntitled', { defaultValue: 'Untitled Agent' })}
                </div>
                <div className={styles.sectionText}>
                  {editDescription ||
                    t('settings.agentWorkspaceSummaryHint', {
                      defaultValue: 'Add a description so this agent is recognizable in the workspace list.',
                    })}
                </div>
              </div>
            </div>
            <div className={styles.chipRow}>
              <span className={styles.chip}>{editAgent || 'gemini'}</span>
              {activeAssistant?.isBuiltin ? (
                <span className={styles.chip}>{t('settings.assistantSourceBuiltin', { defaultValue: 'Builtin' })}</span>
              ) : isReadonlyAssistant ? (
                <span className={styles.chip}>
                  {t('settings.assistantSourceExtension', { defaultValue: 'Extension' })}
                </span>
              ) : (
                <span className={styles.chip}>{t('settings.assistantSourceCustom', { defaultValue: 'Custom' })}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentBasicsPanel;
