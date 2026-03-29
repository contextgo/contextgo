/**
 * AssistantListPanel — Renders the collapsible list of assistants
 * with avatar, name, enabled switch, and edit/duplicate actions.
 */
import classNames from 'classnames';
import { useSettingsViewMode } from '@/renderer/components/settings/SettingsModal/settingsViewContext';
import type { AssistantListItem } from './types';
import AssistantAvatar from './AssistantAvatar';
import { Button, Collapse, Switch } from '@arco-design/web-react';
import { Plus, SettingOne } from '@icon-park/react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../AgentSettingsPage.module.css';

type AssistantListPanelProps = {
  assistants: AssistantListItem[];
  activeAssistantId: string | null;
  localeKey: string;
  avatarImageMap: Record<string, string>;
  isExtensionAssistant: (assistant: AssistantListItem | null | undefined) => boolean;
  onEdit: (assistant: AssistantListItem) => void;
  onDuplicate: (assistant: AssistantListItem) => void;
  onCreate: () => void;
  onToggleEnabled: (assistant: AssistantListItem, checked: boolean) => void;
  setActiveAssistantId: (id: string) => void;
};

const AssistantListPanel: React.FC<AssistantListPanelProps> = ({
  assistants,
  activeAssistantId,
  localeKey,
  avatarImageMap,
  isExtensionAssistant,
  onEdit,
  onDuplicate,
  onCreate,
  onToggleEnabled,
  setActiveAssistantId,
}) => {
  const { t } = useTranslation();
  const viewMode = useSettingsViewMode();
  const isPageMode = viewMode === 'page';

  const listContent =
    assistants.length > 0 ? (
      <div className={styles.assistantList}>
        {assistants.map((assistant) => {
          const assistantIsExtension = isExtensionAssistant(assistant);
          const isActive = activeAssistantId === assistant.id;
          return (
            <div
              key={assistant.id}
              className={classNames(styles.assistantCard, isActive && styles.assistantCardActive)}
              onClick={() => {
                setActiveAssistantId(assistant.id);
                onEdit(assistant);
              }}
            >
              <div className={styles.assistantCardMain}>
                <AssistantAvatar assistant={assistant} size={isPageMode ? 34 : 28} avatarImageMap={avatarImageMap} />
                <div className={styles.assistantMeta}>
                  <span className={styles.assistantName}>{assistant.nameI18n?.[localeKey] || assistant.name}</span>
                  {(assistant.descriptionI18n?.[localeKey] || assistant.description) && (
                    <div className={styles.assistantDescription}>
                      {assistant.descriptionI18n?.[localeKey] || assistant.description}
                    </div>
                  )}
                </div>
              </div>
              <div className={styles.assistantActions}>
                <Button
                  type='text'
                  size='mini'
                  className={styles.assistantDuplicateButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate(assistant);
                  }}
                >
                  {t('settings.duplicateAssistant', { defaultValue: 'Duplicate' })}
                </Button>
                <Switch
                  size='small'
                  checked={assistantIsExtension ? true : assistant.enabled !== false}
                  disabled={assistantIsExtension}
                  onChange={(checked) => {
                    onToggleEnabled(assistant, checked);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <Button
                  type='text'
                  size='small'
                  className={styles.assistantSettingsButton}
                  icon={<SettingOne size={16} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(assistant);
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    ) : (
      <div className={styles.emptyState}>
        {t('settings.assistantsEmpty', { defaultValue: 'No assistants configured.' })}
      </div>
    );

  if (isPageMode) {
    return (
      <div className={styles.pageStack}>
        <div className={styles.heroSurface}>
          <div className={styles.heroRow}>
            <div className={styles.heroMeta}>
              <div className={styles.titleRow}>
                <h1 className={styles.pageTitle}>{t('settings.assistants', { defaultValue: 'Assistants' })}</h1>
                <span className={styles.countBadge}>{assistants.length}</span>
              </div>
              <p className={styles.pageDescription}>
                {t('settings.assistantsList', { defaultValue: 'Available assistants' })}
              </p>
            </div>
            <div className={styles.actions}>
              <Button
                type='primary'
                className={styles.primaryPillButton}
                icon={<Plus size={14} />}
                onClick={() => onCreate()}
              >
                {t('settings.createAssistant', { defaultValue: 'Create' })}
              </Button>
            </div>
          </div>
        </div>

        <div className={styles.surface}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>
              {t('settings.assistantsList', { defaultValue: 'Available assistants' })}
            </div>
            <span className={styles.sectionMeta}>{assistants.length}</span>
          </div>
          {listContent}
        </div>
      </div>
    );
  }

  return (
    <Collapse.Item
      header={
        <div className='flex items-center justify-between w-full'>
          <span>{t('settings.assistants', { defaultValue: 'Assistants' })}</span>
        </div>
      }
      name='smart-assistants'
      extra={
        <Button
          type='outline'
          size='small'
          className={styles.secondaryPillButton}
          icon={<Plus size={14} fill='currentColor' />}
          onClick={(e) => {
            e.stopPropagation();
            onCreate();
          }}
        >
          {t('settings.createAssistant', { defaultValue: 'Create' })}
        </Button>
      }
    >
      <div className='py-2'>
        <div className={styles.surface}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>
              {t('settings.assistantsList', { defaultValue: 'Available assistants' })}
            </div>
            <span className={styles.sectionMeta}>{assistants.length}</span>
          </div>
          {listContent}
        </div>
      </div>
    </Collapse.Item>
  );
};

export default AssistantListPanel;
