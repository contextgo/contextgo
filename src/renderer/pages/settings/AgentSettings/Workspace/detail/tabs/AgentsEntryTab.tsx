import MarkdownView from '@/renderer/components/Markdown';
import type { AssistantPackageDocument, AssistantWorkspaceModel } from '../../types';
import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../../AssistantWorkspace.module.css';

type AgentsEntryTabProps = {
  model: AssistantWorkspaceModel;
  agentsDocument?: AssistantPackageDocument | null;
};

const AgentsEntryTab: React.FC<AgentsEntryTabProps> = ({ model, agentsDocument }) => {
  const { t } = useTranslation();
  const resolvedAgentsDocument = agentsDocument ?? model.agentsDocument;

  if (!resolvedAgentsDocument) {
    return (
      <div className={styles.emptyState}>
        {t('settings.agentWorkspaceAgentsEntryEmpty', {
          defaultValue: 'This package does not expose an AGENTS.md rules entry document.',
        })}
      </div>
    );
  }

  return (
    <div className={styles.contentStack}>
      <div className={styles.contentCard}>
        <div className={styles.sectionTitle}>{resolvedAgentsDocument.title}</div>
        <div className={styles.sectionText}>
          {t('settings.agentWorkspaceAgentsEntryDescription', {
            defaultValue:
              'AGENTS.md is the packaged rules entry document. ContextGo can project it into runtime-native entry files such as CLAUDE.md or GEMINI.md.',
          })}
        </div>
      </div>
      <div className={styles.markdownReader}>
        <MarkdownView hiddenCodeCopyButton>{resolvedAgentsDocument.content}</MarkdownView>
      </div>
    </div>
  );
};

export default AgentsEntryTab;
