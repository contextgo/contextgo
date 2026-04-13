import React from 'react';
import type { ExternalConnectorCatalogDetails } from '@/common/types/connectors/externalConnectorCatalog';
import { Tag } from '@arco-design/web-react';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import styles from './ConnectorsPage.module.css';

type ConnectorCapabilitySection = 'capabilities' | 'workflows' | 'boundary';

type ConnectorCapabilityPanelProps = {
  details: ExternalConnectorCatalogDetails;
  section: ConnectorCapabilitySection;
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

const getCapabilityModeLabelKey = (mode: string): string => {
  switch (mode) {
    case 'user':
      return 'settings.connectors.externalCatalog.authModes.user';
    case 'bot':
      return 'settings.connectors.externalCatalog.authModes.bot';
    case 'service':
      return 'settings.connectors.externalCatalog.authModes.service';
    default:
      return '';
  }
};

const getWorkflowSurfaceLabelKey = (surface: string): string =>
  `settings.connectors.externalCatalog.workflowSurfaces.${surface}`;

const getWorkflowDisplayLabel = (
  connector: string,
  workflowId: string,
  fallbackLabel: string,
  t: (key: string) => string
): string => {
  if (connector === 'feishu' && workflowId === 'official-cli-runtime') {
    return t('settings.connectors.workflowCatalog.feishu.officialCliRuntime.label');
  }

  return fallbackLabel;
};

const getWorkflowDisplayNotes = (
  connector: string,
  workflowId: string,
  fallbackNotes: string[],
  t: (key: string) => string
): string[] => {
  if (connector === 'feishu' && workflowId === 'official-cli-runtime') {
    return [
      t('settings.connectors.workflowCatalog.feishu.officialCliRuntime.notes.0'),
      t('settings.connectors.workflowCatalog.feishu.officialCliRuntime.notes.1'),
    ];
  }

  return fallbackNotes;
};

const getWorkflowDisplayNativeObjects = (
  connector: string,
  workflowId: string,
  fallbackObjects: string[],
  t: (key: string) => string
): string[] => {
  if (connector === 'feishu' && workflowId === 'official-cli-runtime') {
    return [
      t('settings.connectors.workflowCatalog.feishu.officialCliRuntime.nativeObjects.0'),
      t('settings.connectors.workflowCatalog.feishu.officialCliRuntime.nativeObjects.1'),
      t('settings.connectors.workflowCatalog.feishu.officialCliRuntime.nativeObjects.2'),
    ];
  }

  return fallbackObjects;
};

export default function ConnectorCapabilityPanel({ details, section }: ConnectorCapabilityPanelProps) {
  const { t } = useTranslation();
  const capabilityGroups = details.capabilities?.groups ?? [];

  if (section === 'capabilities') {
    if (!details.capabilities) {
      return null;
    }

    return (
      <>
        <div className={classNames(styles.detailCard, styles.detailCardWide)}>
          <div className={styles.capabilityHeader}>
            <div>
              <h3 className={styles.detailCardTitle}>{t('settings.connectors.externalCatalog.capabilities')}</h3>
              <div className={styles.detailCardText}>{t('settings.connectors.externalCatalog.capabilitySummary')}</div>
            </div>
            <Tag color='arcoblue'>
              {t(`settings.connectors.externalCatalog.extractionModes.${details.capabilities.extraction_mode}`)}
            </Tag>
          </div>

          <div className={styles.capabilityMetaGrid}>
            <div className={styles.workflowSection}>
              <div className={styles.workflowSectionLabel}>
                {t('settings.connectors.externalCatalog.extractionMode')}
              </div>
              <div className={styles.detailCardText}>
                {t(`settings.connectors.externalCatalog.extractionModes.${details.capabilities.extraction_mode}`)}
              </div>
            </div>

            <div className={styles.workflowSection}>
              <div className={styles.workflowSectionLabel}>
                {t('settings.connectors.externalCatalog.discoveryCommands')}
              </div>
              <div className={styles.commandList}>
                {details.capabilities.discovery_commands.length > 0 ? (
                  details.capabilities.discovery_commands.map((command) => (
                    <code key={command} className={styles.commandPill}>
                      {command}
                    </code>
                  ))
                ) : (
                  <div className={styles.detailCardText}>{t('settings.connectors.externalCatalog.noneYet')}</div>
                )}
              </div>
            </div>
          </div>

          {details.capabilities.notes.length > 0 ? (
            <div className={styles.capabilityNotes}>
              {details.capabilities.notes.map((note) => (
                <div key={note} className={styles.detailCardText}>
                  {note}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {capabilityGroups.length > 0 ? (
          <div className={classNames(styles.detailCard, styles.detailCardWide)}>
            <div className={styles.capabilityHeader}>
              <div>
                <h3 className={styles.detailCardTitle}>{t('settings.connectors.externalCatalog.capabilityGroups')}</h3>
                <div className={styles.detailCardText}>{t('settings.connectors.groupNavigator')}</div>
              </div>
              <Tag color='cyan'>{capabilityGroups.length}</Tag>
            </div>

            <div className={styles.capabilityGroupOverview}>
              {capabilityGroups.map((group) => (
                <div key={group.id} className={styles.capabilityGroupOverviewItem}>
                  <span className={styles.capabilityGroupOverviewLabel}>{group.label}</span>
                  <Tag size='small' color='gray'>
                    {group.actions.length}
                  </Tag>
                </div>
              ))}
            </div>

            <div className={styles.capabilityGroupList}>
              {capabilityGroups.map((group) => (
                <div key={group.id} className={styles.capabilityGroupCard}>
                  <div className={styles.capabilityGroupHeader}>
                    <div>
                      <div className={styles.workflowTitle}>{group.label}</div>
                      <div className={styles.detailCardText}>{group.summary}</div>
                    </div>
                    <Tag color='cyan'>{group.actions.length}</Tag>
                  </div>

                  <div className={styles.workflowSection}>
                    <div className={styles.workflowSectionLabel}>
                      {t('settings.connectors.externalCatalog.nativeObjects')}
                    </div>
                    <div className={styles.chipWrap}>
                      {group.native_objects.map((item) => (
                        <Tag key={item} size='small' color='gray'>
                          {item}
                        </Tag>
                      ))}
                    </div>
                  </div>

                  <div className={styles.workflowSection}>
                    <div className={styles.workflowSectionLabel}>
                      {t('settings.connectors.externalCatalog.discoveryCommands')}
                    </div>
                    <div className={styles.commandList}>
                      {group.discovery_commands.length > 0 ? (
                        group.discovery_commands.map((command) => (
                          <code key={command} className={styles.commandPill}>
                            {command}
                          </code>
                        ))
                      ) : (
                        <div className={styles.detailCardText}>{t('settings.connectors.externalCatalog.noneYet')}</div>
                      )}
                    </div>
                  </div>

                  <div className={styles.workflowSection}>
                    <div className={styles.workflowSectionLabel}>
                      {t('settings.connectors.externalCatalog.actions')}
                    </div>
                    <div className={styles.capabilityActionList}>
                      {group.actions.map((action) => (
                        <div key={action.id} className={styles.capabilityActionCard}>
                          <div className={styles.capabilityActionTitle}>{action.label}</div>
                          <div className={styles.detailCardText}>{action.summary}</div>

                          <div className={styles.capabilityActionMeta}>
                            <div className={styles.workflowSection}>
                              <div className={styles.workflowSectionLabel}>
                                {t('settings.connectors.externalCatalog.authModesTitle')}
                              </div>
                              <div className={styles.chipWrap}>
                                {action.auth_modes.map((mode) => {
                                  const key = getCapabilityModeLabelKey(mode);
                                  return (
                                    <Tag key={mode} size='small' color='arcoblue'>
                                      {key ? t(key) : mode}
                                    </Tag>
                                  );
                                })}
                              </div>
                            </div>

                            <div className={styles.workflowSection}>
                              <div className={styles.workflowSectionLabel}>
                                {t('settings.connectors.externalCatalog.entrypoints')}
                              </div>
                              <div className={styles.commandList}>
                                {action.entrypoints.length > 0 ? (
                                  action.entrypoints.map((entrypoint) => (
                                    <code key={entrypoint} className={styles.commandPill}>
                                      {entrypoint}
                                    </code>
                                  ))
                                ) : (
                                  <div className={styles.detailCardText}>
                                    {t('settings.connectors.externalCatalog.noneYet')}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {action.notes?.length ? (
                            <div className={styles.workflowNotes}>
                              {action.notes.map((note) => (
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
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </>
    );
  }

  if (section === 'workflows') {
    return (
      <div className={classNames(styles.detailCard, styles.detailCardWide)}>
        <div className={styles.workflowList}>
          {details.implemented_workflows.map((workflow) => (
            <div key={workflow.id} className={styles.workflowCard}>
              <div className={styles.workflowHeader}>
                <div>
                  <div className={styles.workflowTitle}>
                    {getWorkflowDisplayLabel(details.connector, workflow.id, workflow.label, t)}
                  </div>
                  <div className={styles.workflowMeta}>
                    {t('settings.connectors.externalCatalog.workflowSurface', {
                      surface: t(getWorkflowSurfaceLabelKey(workflow.surface)),
                    })}
                  </div>
                </div>
                <Tag color={getWorkflowStatusColor(workflow.status)}>
                  {t(`settings.connectors.externalCatalog.workflowStatus.${workflow.status}`)}
                </Tag>
              </div>
              <div className={styles.workflowSection}>
                <div className={styles.workflowSectionLabel}>
                  {t('settings.connectors.externalCatalog.nativeObjects')}
                </div>
                <div className={styles.chipWrap}>
                  {getWorkflowDisplayNativeObjects(details.connector, workflow.id, workflow.native_objects, t).map(
                    (item) => (
                      <Tag key={item} size='small' color='gray'>
                        {item}
                      </Tag>
                    )
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
              {getWorkflowDisplayNotes(details.connector, workflow.id, workflow.notes, t).length > 0 ? (
                <div className={styles.workflowNotes}>
                  {getWorkflowDisplayNotes(details.connector, workflow.id, workflow.notes, t).map((note) => (
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
    );
  }

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
            [...new Set(details.implemented_workflows.flatMap((workflow) => workflow.entrypoints))].map(
              (entrypoint) => (
                <code key={entrypoint} className={styles.commandPill}>
                  {entrypoint}
                </code>
              )
            )
          ) : (
            <div className={styles.detailCardText}>{t('settings.connectors.externalCatalog.noneYet')}</div>
          )}
        </div>
      </div>
    </>
  );
}
