import MarkdownView from '@/renderer/components/Markdown';
import type { AssistantWorkspaceModel } from '../../types';
import { Tag } from '@arco-design/web-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import OperationalWorkbenchTab from './OperationalWorkbenchTab';
import { toCodeFence } from './workbenchContent';
import styles from '../../AssistantWorkspace.module.css';

type CommandsTabProps = {
  model: AssistantWorkspaceModel;
};

const CommandsTab: React.FC<CommandsTabProps> = ({ model }) => {
  const { t } = useTranslation();

  return (
    <OperationalWorkbenchTab
      queryKey='command'
      title={t('settings.agentWorkspaceCommandsTab', { defaultValue: 'Commands' })}
      description={t('settings.agentWorkspaceCommandsTabDescription', {
        defaultValue: 'Workspace commands seeded by this package automation profile.',
      })}
      items={model.commands}
      emptyText={t('settings.agentWorkspaceCommandsEmpty', {
        defaultValue: 'No commands are available for this agent.',
      })}
      renderItem={(item) => (
        <div className={styles.skillItemLabel}>
          <span className={styles.itemTitle}>{item.label}</span>
        </div>
      )}
      getItemButtonClassName={() => styles.itemButtonIndexed}
      renderDetail={(item) => (
        <div className={styles.contentStack}>
          <div className={styles.contentCard}>
            <div className={styles.sectionTitle}>{item.label}</div>
            <div className={styles.sectionText}>{item.summary}</div>
            <div className={styles.chipRow}>
              <Tag>
                {item.sourceKind === 'builtin'
                  ? t('settings.agentWorkspaceCommandsBuiltinSource', {
                      defaultValue: 'Builtin command seed',
                    })
                  : t('settings.agentWorkspaceCommandsCustomSource', {
                      defaultValue: 'Package custom command',
                    })}
              </Tag>
              <Tag>
                {item.enabled
                  ? t('settings.agentWorkspaceCommandsEnabledValue', {
                      defaultValue: 'Enabled',
                    })
                  : t('settings.agentWorkspaceCommandsDisabledValue', {
                      defaultValue: 'Disabled',
                    })}
              </Tag>
            </div>
          </div>
          <div className={styles.metaGrid}>
            <div className={styles.metaCard}>
              <div className={styles.metaLabel}>
                {t('settings.agentWorkspaceCommandsProfileLabel', {
                  defaultValue: 'Automation profile',
                })}
              </div>
              <div className={styles.metaValueMono}>{item.profile || item.id}</div>
            </div>
            <div className={styles.metaCard}>
              <div className={styles.metaLabel}>
                {t('settings.agentWorkspaceCommandsCommandIdLabel', {
                  defaultValue: 'Command id',
                })}
              </div>
              <div className={styles.metaValueMono}>{item.commandId}</div>
            </div>
            <div className={styles.metaCard}>
              <div className={styles.metaLabel}>
                {t('settings.agentWorkspaceCommandsSurfaceLabel', {
                  defaultValue: 'Install surface',
                })}
              </div>
              <div className={styles.metaValueMono}>{item.installSurface}</div>
            </div>
            <div className={styles.metaCard}>
              <div className={styles.metaLabel}>
                {t('settings.agentWorkspaceCommandsSourceLabel', {
                  defaultValue: 'Source',
                })}
              </div>
              <div className={styles.metaValue}>
                {item.sourceKind === 'builtin'
                  ? t('settings.agentWorkspaceCommandsBuiltinSource', {
                      defaultValue: 'Builtin command seed',
                    })
                  : t('settings.agentWorkspaceCommandsCustomSource', {
                      defaultValue: 'Package custom command',
                    })}
              </div>
            </div>
            <div className={styles.metaCard}>
              <div className={styles.metaLabel}>
                {t('settings.agentWorkspaceCommandsStatusLabel', {
                  defaultValue: 'Status',
                })}
              </div>
              <div className={styles.metaValue}>
                {item.enabled
                  ? t('settings.agentWorkspaceCommandsEnabledValue', {
                      defaultValue: 'Enabled',
                    })
                  : t('settings.agentWorkspaceCommandsDisabledValue', {
                      defaultValue: 'Disabled',
                    })}
              </div>
            </div>
          </div>
          <div className={styles.contentCard}>
            <div className={styles.sectionTitle}>
              {t('settings.agentWorkspaceCommandsTemplateLabel', {
                defaultValue: 'Prompt template',
              })}
            </div>
            <div className={styles.markdownReader}>
              <MarkdownView hiddenCodeCopyButton>{toCodeFence(item.template)}</MarkdownView>
            </div>
          </div>
        </div>
      )}
    />
  );
};

export default CommandsTab;
