import MarkdownView from '@/renderer/components/Markdown';
import { getHookOutputTargets } from '@/common/types/hookTypes';
import type { AssistantWorkspaceModel } from '../../types';
import { Tag } from '@arco-design/web-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import OperationalWorkbenchTab from './OperationalWorkbenchTab';
import { formatInlineList, toCodeFence, toPrettyJson } from './workbenchContent';
import styles from '../../AssistantWorkspace.module.css';

type HooksTabProps = {
  model: AssistantWorkspaceModel;
};

const HooksTab: React.FC<HooksTabProps> = ({ model }) => {
  const { t } = useTranslation();

  return (
    <OperationalWorkbenchTab
      queryKey='hook'
      title={t('settings.agentWorkspaceHooksTab', { defaultValue: 'Hooks' })}
      description={t('settings.agentWorkspaceHooksTabDescription', {
        defaultValue: 'Hook automations active for this agent package.',
      })}
      items={model.relevantHooks.map((hook) => ({
        id: hook.name,
        label: hook.name,
        summary: hook.description,
        hookEntry: hook,
      }))}
      emptyText={t('settings.agentWorkspaceHooksEmpty', {
        defaultValue: 'No hooks are attached to this agent yet.',
      })}
      renderItem={(item) => (
        <div className={styles.skillItemLabel}>
          <span className={styles.itemTitle}>{item.label}</span>
        </div>
      )}
      getItemButtonClassName={() => styles.itemButtonIndexed}
      renderDetail={(item) => {
        const hook = item.hookEntry.hook;
        const allRuntimesLabel = t('settings.agentWorkspaceHooksAllBackends', {
          defaultValue: 'All runtimes',
        });
        const noDescriptionLabel = t('settings.agentWorkspaceNoDescription', {
          defaultValue: 'No description available.',
        });
        const eventList = formatInlineList(hook?.events, 'after_response');
        const backendList = formatInlineList(hook?.supportedBackends, allRuntimesLabel);
        const outputTargets = getHookOutputTargets(hook || {});
        const outputTargetList = formatInlineList(outputTargets, allRuntimesLabel);
        const runnableEventList = formatInlineList(hook?.runnableEvents, noDescriptionLabel);
        const tagList = formatInlineList(hook?.tags, noDescriptionLabel);
        const hookPreview = toPrettyJson({
          name: hook?.name || item.label,
          description: hook?.description,
          version: hook?.version,
          executionType: hook?.executionType,
          events: hook?.events ?? [],
          runnableEvents: hook?.runnableEvents ?? [],
          category: hook?.category,
          tags: hook?.tags ?? [],
          supportedBackends: hook?.supportedBackends ?? [],
          outputTargets,
          notification: hook?.notification,
          outputFile: hook?.outputFile,
          location: hook?.location,
        });

        return (
          <div className={styles.contentStack}>
            <div className={styles.contentCard}>
              <div className={styles.sectionTitle}>{item.label}</div>
              <div className={styles.sectionText}>{item.summary || noDescriptionLabel}</div>
              <div className={styles.chipRow}>
                {hook?.category ? <Tag>{hook.category}</Tag> : null}
                {hook?.executionType ? <Tag>{hook.executionType}</Tag> : null}
              </div>
            </div>
            <div className={styles.metaGrid}>
              <div className={styles.metaCard}>
                <div className={styles.metaLabel}>
                  {t('settings.agentWorkspaceHooksExecutionLabel', {
                    defaultValue: 'Execution',
                  })}
                </div>
                <div className={styles.metaValue}>{hook?.executionType || noDescriptionLabel}</div>
              </div>
              <div className={styles.metaCard}>
                <div className={styles.metaLabel}>
                  {t('settings.agentWorkspaceHooksEventsLabel', {
                    defaultValue: 'Events',
                  })}
                </div>
                <div className={styles.metaValue}>{eventList}</div>
              </div>
              <div className={styles.metaCard}>
                <div className={styles.metaLabel}>
                  {t('settings.agentWorkspaceHooksBackendsLabel', {
                    defaultValue: 'Backends',
                  })}
                </div>
                <div className={styles.metaValue}>{backendList}</div>
              </div>
              <div className={styles.metaCard}>
                <div className={styles.metaLabel}>
                  {t('settings.agentWorkspaceHooksLocationLabel', {
                    defaultValue: 'Manifest path',
                  })}
                </div>
                <div className={styles.metaValueMono}>{hook?.location || item.label}</div>
              </div>
              <div className={styles.metaCard}>
                <div className={styles.metaLabel}>
                  {t('settings.agentWorkspaceHooksOutputTargetsLabel', {
                    defaultValue: 'Output targets',
                  })}
                </div>
                <div className={styles.metaValue}>{outputTargetList}</div>
              </div>
              <div className={styles.metaCard}>
                <div className={styles.metaLabel}>
                  {t('settings.agentWorkspaceHooksRunnableEventsLabel', {
                    defaultValue: 'Runnable events',
                  })}
                </div>
                <div className={styles.metaValue}>{runnableEventList}</div>
              </div>
              <div className={styles.metaCard}>
                <div className={styles.metaLabel}>
                  {t('settings.agentWorkspaceHooksVersionLabel', {
                    defaultValue: 'Version',
                  })}
                </div>
                <div className={styles.metaValue}>{hook?.version || noDescriptionLabel}</div>
              </div>
              <div className={styles.metaCard}>
                <div className={styles.metaLabel}>
                  {t('settings.agentWorkspaceHooksTagsLabel', {
                    defaultValue: 'Tags',
                  })}
                </div>
                <div className={styles.metaValue}>{tagList}</div>
              </div>
            </div>
            <div className={styles.contentCard}>
              <div className={styles.sectionTitle}>
                {t('settings.agentWorkspaceHooksConfigLabel', {
                  defaultValue: 'Configuration',
                })}
              </div>
              <div className={styles.markdownReader}>
                <MarkdownView hiddenCodeCopyButton>{toCodeFence(hookPreview, 'json')}</MarkdownView>
              </div>
            </div>
          </div>
        );
      }}
    />
  );
};

export default HooksTab;
