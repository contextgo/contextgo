import MarkdownView from '@/renderer/components/Markdown';
import type { AssistantWorkspaceModel } from '../../types';
import React from 'react';
import { useTranslation } from 'react-i18next';
import OperationalWorkbenchTab from './OperationalWorkbenchTab';
import { toCodeFence } from './workbenchContent';
import styles from '../../AssistantWorkspace.module.css';

type SchedulesTabProps = {
  model: AssistantWorkspaceModel;
};

const SchedulesTab: React.FC<SchedulesTabProps> = ({ model }) => {
  const { t } = useTranslation();

  return (
    <OperationalWorkbenchTab
      queryKey='schedule'
      title={t('settings.agentWorkspaceSchedulesTab', { defaultValue: 'Schedules' })}
      description={t('settings.agentWorkspaceSchedulesTabDescription', {
        defaultValue: 'ContextGo-native schedules seeded by this package.',
      })}
      items={model.schedules}
      emptyText={t('settings.agentWorkspaceSchedulesEmpty', {
        defaultValue: 'No schedules are available for this agent.',
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
          </div>
          <div className={styles.metaGrid}>
            <div className={styles.metaCard}>
              <div className={styles.metaLabel}>
                {t('settings.agentWorkspaceSchedulesProfileLabel', {
                  defaultValue: 'Automation profile',
                })}
              </div>
              <div className={styles.metaValueMono}>{item.profile || item.id}</div>
            </div>
            <div className={styles.metaCard}>
              <div className={styles.metaLabel}>
                {t('settings.agentWorkspaceSchedulesSurfaceLabel', {
                  defaultValue: 'Install surface',
                })}
              </div>
              <div className={styles.metaValueMono}>{item.installSurface}</div>
            </div>
            <div className={styles.metaCard}>
              <div className={styles.metaLabel}>
                {t('settings.agentWorkspaceSchedulesRuntimeSurfaceLabel', {
                  defaultValue: 'Runtime surface',
                })}
              </div>
              <div className={styles.metaValueMono}>{item.runtimeSurface}</div>
            </div>
            <div className={styles.metaCard}>
              <div className={styles.metaLabel}>
                {t('settings.agentWorkspaceSchedulesEntryCountLabel', {
                  defaultValue: 'Seed count',
                })}
              </div>
              <div className={styles.metaValue}>{item.entryCount}</div>
            </div>
          </div>
          <div className={styles.contentCard}>
            <div className={styles.sectionTitle}>
              {t('settings.agentWorkspaceSchedulesPayloadLabel', {
                defaultValue: 'Seed payload',
              })}
            </div>
            <div className={styles.sectionText}>
              {item.entryCount === 0
                ? t('settings.agentWorkspaceSchedulesEmptySeedNote', {
                    defaultValue:
                      'This profile currently seeds the schedule container without bundled conversation schedule entries.',
                  })
                : null}
            </div>
            <div className={styles.markdownReader}>
              <MarkdownView hiddenCodeCopyButton>{toCodeFence(item.payloadPreview, 'json')}</MarkdownView>
            </div>
          </div>
        </div>
      )}
    />
  );
};

export default SchedulesTab;
