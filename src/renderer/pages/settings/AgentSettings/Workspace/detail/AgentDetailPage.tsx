import type { AssistantListItem } from '@/renderer/pages/settings/AgentSettings/AssistantManagement/types';
import type { useAssistantEditor } from '@/renderer/hooks/assistant';
import type { AssistantWorkspaceModel } from '../types';
import { Avatar, Button, Tabs, Tag } from '@arco-design/web-react';
import { Left } from '@icon-park/react';
import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AgentsEntryTab from './tabs/AgentsEntryTab';
import CommandsTab from './tabs/CommandsTab';
import DocsTab from './tabs/DocsTab';
import HooksTab from './tabs/HooksTab';
import SchedulesTab from './tabs/SchedulesTab';
import SkillsTab from './tabs/SkillsTab';
import { useBundledAgentPackageContent } from './tabs/useBundledAgentPackageContent';
import styles from '../AssistantWorkspace.module.css';
import { getVisibleAgentWorkspaceTabs } from '../viewModel';

type AssistantEditorState = ReturnType<typeof useAssistantEditor>;

type AgentDetailPageProps = {
  assistant: AssistantListItem;
  model: AssistantWorkspaceModel;
  tabId: string;
  localeKey: string;
  editAvatarImage?: string;
  editor: AssistantEditorState;
  onInitializeAssistant: (assistant: AssistantListItem) => Promise<void> | void;
};

const AgentDetailPage: React.FC<AgentDetailPageProps> = ({
  assistant,
  model,
  tabId,
  localeKey,
  editAvatarImage,
  editor,
  onInitializeAssistant,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }

    initializedRef.current = true;
    void onInitializeAssistant(assistant);
  }, [assistant, onInitializeAssistant]);

  const assistantName = assistant.nameI18n?.[localeKey] || assistant.name;
  const assistantDescription = assistant.descriptionI18n?.[localeKey] || assistant.description;
  const packageContent = useBundledAgentPackageContent(assistant.id, model);
  const visibleTabs = getVisibleAgentWorkspaceTabs(model);
  const tabLabels: Record<string, string> = {
    skills: t('settings.agentWorkspaceSkillsTab', { defaultValue: 'Skills' }),
    hooks: t('settings.agentWorkspaceHooksTab', { defaultValue: 'Hooks' }),
    schedules: t('settings.agentWorkspaceSchedulesTab', { defaultValue: 'Schedules' }),
    commands: t('settings.agentWorkspaceCommandsTab', { defaultValue: 'Commands' }),
    agents: 'AGENTS.md',
    docs: t('settings.agentWorkspaceDocsTab', { defaultValue: 'Docs' }),
  };

  const renderTabContent = () => {
    switch (tabId) {
      case 'skills':
        return <SkillsTab model={model} />;
      case 'hooks':
        return <HooksTab model={model} />;
      case 'schedules':
        return <SchedulesTab model={model} />;
      case 'commands':
        return <CommandsTab model={model} />;
      case 'agents':
        return <AgentsEntryTab model={model} agentsDocument={packageContent.agentsDocument} />;
      case 'docs':
        return <DocsTab model={model} docs={packageContent.docs} docsTree={packageContent.docsTree} />;
      default:
        return null;
    }
  };

  return (
    <div className={`${styles.surface} ${styles.surfaceFill}`}>
      <div className={styles.detailHeader}>
        <div className={styles.detailHero}>
          <div className={styles.detailIdentity}>
            <Avatar shape='square' size={56}>
              {editAvatarImage ? (
                <img src={editAvatarImage} alt='' width={32} height={32} style={{ objectFit: 'contain' }} />
              ) : (
                editor.editAvatar || assistant.avatar || '\u{1F916}'
              )}
            </Avatar>
            <div>
              <h1 className={styles.detailTitle}>{assistantName}</h1>
              {assistantDescription ? <p className={styles.detailDescription}>{assistantDescription}</p> : null}
              <div className={styles.chipRow}>
                <Tag>{tabLabels[tabId] || tabId}</Tag>
                {model.isEditable ? (
                  <Tag>{t('settings.agentWorkspaceEditable', { defaultValue: 'Editable' })}</Tag>
                ) : (
                  <Tag>{t('settings.agentWorkspaceReadOnly', { defaultValue: 'Read-only' })}</Tag>
                )}
              </div>
            </div>
          </div>

          <div className={styles.actionRow}>
            <Button icon={<Left />} onClick={() => navigate('/agents')}>
              {t('settings.agentWorkspaceBack', { defaultValue: 'Back' })}
            </Button>
          </div>
        </div>

        <Tabs
          activeTab={tabId}
          onChange={(value) => navigate(`/agents/${assistant.id}/${value}`)}
          type='line'
          className={styles.detailTabs}
        >
          {visibleTabs.map((availableTab) => (
            <Tabs.TabPane key={availableTab} title={tabLabels[availableTab] || availableTab} />
          ))}
        </Tabs>
      </div>

      <div className={styles.detailContentShell} data-testid='agent-detail-content-shell'>
        {renderTabContent()}
      </div>
    </div>
  );
};

export default AgentDetailPage;
