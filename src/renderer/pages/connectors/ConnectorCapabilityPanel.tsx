import React from 'react';
import type { ExternalConnectorCatalogDetails } from '@/common/types/connectors/externalConnectorCatalog';
import { Tag } from '@arco-design/web-react';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import styles from './ConnectorsPage.module.css';

type ConnectorCapabilityPanelProps = {
  details: ExternalConnectorCatalogDetails;
};

const getWorkflowStatusColor = (status: string): 'green' | 'orange' | 'gray' => {
  if (status === 'ready') {
    return 'green';
  }
  if (status === 'partial') {
    return 'orange';
  }
  return 'gray';
};

export default function ConnectorCapabilityPanel({ details }: ConnectorCapabilityPanelProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className={classNames(styles.detailCard, styles.detailCardWide)}>
        <h3 className={styles.detailCardTitle}>{t('settings.connectors.externalCatalog.platformAccess')}</h3>
        <div className={styles.detailCardText}>{details.platform_access}</div>
      </div>

      <div className={classNames(styles.detailCard, styles.detailCardWide)}>
        <h3 className={styles.detailCardTitle}>{t('settings.connectors.externalCatalog.runtimeBoundary')}</h3>
        <div className={styles.detailCardText}>{details.runtime_boundary}</div>
      </div>

      <div className={styles.detailCard}>
        <h3 className={styles.detailCardTitle}>{t('settings.connectors.externalCatalog.nativeSurface')}</h3>
        <div className={styles.chipWrap}>
          {details.native_surface.map((item) => (
            <Tag key={item} size='small' color='arcoblue'>
              {item}
            </Tag>
          ))}
        </div>
      </div>

      <div className={styles.detailCard}>
        <h3 className={styles.detailCardTitle}>{t('settings.connectors.externalCatalog.commandEntrypoints')}</h3>
        <div className={styles.commandList}>
          {details.implemented_workflows.flatMap((workflow) => workflow.entrypoints).length > 0 ? (
            [...new Set(details.implemented_workflows.flatMap((workflow) => workflow.entrypoints))].map((entrypoint) => (
              <code key={entrypoint} className={styles.commandPill}>
                {entrypoint}
              </code>
            ))
          ) : (
            <div className={styles.detailCardText}>{t('settings.connectors.externalCatalog.noneYet')}</div>
          )}
        </div>
      </div>

      <div className={classNames(styles.detailCard, styles.detailCardWide)}>
        <h3 className={styles.detailCardTitle}>{t('settings.connectors.externalCatalog.workflows')}</h3>
        <div className={styles.workflowList}>
          {details.implemented_workflows.map((workflow) => (
            <div key={workflow.id} className={styles.workflowCard}>
              <div className={styles.workflowHeader}>
                <div>
                  <div className={styles.workflowTitle}>{workflow.label}</div>
                  <div className={styles.workflowMeta}>
                    {t('settings.connectors.externalCatalog.workflowSurface', { surface: workflow.surface })}
                  </div>
                </div>
                <Tag color={getWorkflowStatusColor(workflow.status)}>
                  {t(`settings.connectors.externalCatalog.workflowStatus.${workflow.status}`)}
                </Tag>
              </div>
              <div className={styles.workflowSection}>
                <div className={styles.workflowSectionLabel}>{t('settings.connectors.externalCatalog.nativeObjects')}</div>
                <div className={styles.chipWrap}>
                  {workflow.native_objects.map((item) => (
                    <Tag key={item} size='small' color='gray'>
                      {item}
                    </Tag>
                  ))}
                </div>
              </div>
              <div className={styles.workflowSection}>
                <div className={styles.workflowSectionLabel}>{t('settings.connectors.externalCatalog.entrypoints')}</div>
                <div className={styles.commandList}>
                  {workflow.entrypoints.length > 0 ? (
                    workflow.entrypoints.map((entrypoint) => (
                      <code key={entrypoint} className={styles.commandPill}>
                        {entrypoint}
                      </code>
                    ))
                  ) : (
                    <div className={styles.detailCardText}>{t('settings.connectors.externalCatalog.noneYet')}</div>
                  )}
                </div>
              </div>
              <div className={styles.workflowFooter}>
                <Tag color={workflow.writes_store ? 'green' : 'gray'}>
                  {workflow.writes_store
                    ? t('settings.connectors.externalCatalog.writesStore')
                    : t('settings.connectors.externalCatalog.noStoreWrite')}
                </Tag>
              </div>
              {workflow.notes.length > 0 ? (
                <div className={styles.workflowNotes}>
                  {workflow.notes.map((note) => (
                    <div key={note} className={styles.detailCardText}>
                      {note}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
