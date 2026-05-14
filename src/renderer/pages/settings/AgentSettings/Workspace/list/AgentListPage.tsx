import type { AssistantListItem } from '@/renderer/pages/settings/AgentSettings/AssistantManagement/types';
import AssistantListPanel from '@/renderer/pages/settings/AgentSettings/AssistantManagement/AssistantListPanel';
import { Button } from '@arco-design/web-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../AssistantWorkspace.module.css';

type AgentListPageProps = {
  assistants: AssistantListItem[];
  systemAssistants: AssistantListItem[];
  activeAssistantId: string | null;
  localeKey: string;
  avatarImageMap: Record<string, string>;
  isExtensionAssistant: (assistant: AssistantListItem | null | undefined) => boolean;
  onCreate: () => void;
  onOpenAssistant: (assistant: AssistantListItem) => void;
  onDuplicateAssistant: (assistant: AssistantListItem) => void;
  onToggleEnabled: (assistant: AssistantListItem, enabled: boolean) => void;
  setActiveAssistantId: (id: string) => void;
};

const AgentListPage: React.FC<AgentListPageProps> = ({
  assistants,
  systemAssistants,
  activeAssistantId,
  localeKey,
  avatarImageMap,
  isExtensionAssistant,
  onCreate,
  onOpenAssistant,
  onDuplicateAssistant,
  onToggleEnabled,
  setActiveAssistantId,
}) => {
  const { t } = useTranslation();

  return (
    <div className={styles.pageStack}>
      <div className={styles.surface}>
        <div className={styles.pageHeader}>
          <div className={styles.pageHeaderMeta}>
            <h1 className={styles.pageTitle}>{t('settings.assistants', { defaultValue: 'Assistants' })}</h1>
            <p className={styles.pageDescription}>
              {t('settings.assistantsPageDescription', {
                defaultValue: 'Create and edit agents here for direct work in this workspace.',
              })}
            </p>
          </div>
          <div className={styles.actionRow}>
            <Button type='primary' className={styles.primaryActionButton} onClick={onCreate}>
              {t('settings.createAssistant', { defaultValue: 'Create Assistant' })}
            </Button>
          </div>
        </div>
      </div>

      <AssistantListPanel
        assistants={assistants}
        systemAssistants={systemAssistants}
        showSystemAssistants={false}
        activeAssistantId={activeAssistantId}
        localeKey={localeKey}
        avatarImageMap={avatarImageMap}
        isExtensionAssistant={isExtensionAssistant}
        onEdit={onOpenAssistant}
        onDuplicate={onDuplicateAssistant}
        onCreate={onCreate}
        onToggleEnabled={onToggleEnabled}
        setActiveAssistantId={setActiveAssistantId}
        presentation='embedded'
      />
    </div>
  );
};

export default AgentListPage;
