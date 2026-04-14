import { ipcBridge } from '@/common';
import MarkdownView from '@/renderer/components/Markdown';
import type { RelevantAssistantSkill } from '@/renderer/pages/settings/AgentSettings/AssistantManagement/types';
import type { AssistantWorkspaceModel } from '../../types';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import OperationalWorkbenchTab from './OperationalWorkbenchTab';
import styles from '../../AssistantWorkspace.module.css';

type SkillsTabProps = {
  model: AssistantWorkspaceModel;
};

type SkillWorkbenchItem = {
  id: string;
  label: string;
  summary?: string;
  skill: RelevantAssistantSkill;
};

const extractSkillBody = (content: string): string => {
  return content.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n?/, '').trim();
};

const SkillDetailPane: React.FC<{ item: SkillWorkbenchItem }> = ({ item }) => {
  const { t } = useTranslation();
  const [skillDocument, setSkillDocument] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setSkillDocument(null);

    if (!item.skill.location) {
      return () => {
        cancelled = true;
      };
    }

    void ipcBridge.fs.readSkillContent
      .invoke({ skillPath: item.skill.location })
      .then((result) => {
        if (!result.success || cancelled) {
          return;
        }

        const nextBody = extractSkillBody(result.data?.content || '');
        setSkillDocument(nextBody || null);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          console.error('[SkillsTab] Failed to load SKILL.md content:', error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [item.skill.location]);

  return (
    <div className={styles.contentStack}>
      <div className={styles.contentCard}>
        <div className={styles.sectionTitle}>{item.label}</div>
        <div className={styles.sectionText}>
          {item.summary ||
            t('settings.agentWorkspaceNoDescription', {
              defaultValue: 'No description available.',
            })}
        </div>
      </div>
      {skillDocument ? (
        <div className={styles.markdownReader}>
          <MarkdownView hiddenCodeCopyButton allowHtml>
            {skillDocument}
          </MarkdownView>
        </div>
      ) : null}
    </div>
  );
};

const SkillsTab: React.FC<SkillsTabProps> = ({ model }) => {
  const { t } = useTranslation();
  const items = useMemo<SkillWorkbenchItem[]>(() => {
    return model.relevantSkills.map((skill) => ({
      id: skill.name,
      label: skill.name,
      summary: skill.description,
      skill,
    }));
  }, [model.relevantSkills]);

  return (
    <OperationalWorkbenchTab
      queryKey='skill'
      title={t('settings.agentWorkspaceSkillsTab', { defaultValue: 'Skills' })}
      description={t('settings.agentWorkspaceSkillsTabDescription', {
        defaultValue: 'Skills bundled with or attached to this agent package.',
      })}
      items={items}
      emptyText={t('settings.agentWorkspaceSkillsEmpty', {
        defaultValue: 'No skills are attached to this agent yet.',
      })}
      renderItem={(item) => (
        <div className={styles.skillItemLabel}>
          <span className={styles.itemTitle}>{item.label}</span>
        </div>
      )}
      getItemButtonClassName={() => styles.itemButtonCompact}
      renderDetail={(item) => <SkillDetailPane item={item} />}
    />
  );
};

export default SkillsTab;
