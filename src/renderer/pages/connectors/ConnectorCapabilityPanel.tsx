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

type RuntimeStatusItem = {
  id: string;
  labelKey: string;
  value: string;
  tone?: 'green' | 'orange' | 'red' | 'gray' | 'arcoblue';
  mono?: boolean;
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

const getRuntimeValue = (runtime: Record<string, unknown>, key: string): unknown => runtime[key];

const formatRuntimeValue = (value: unknown, t: (key: string) => string): string | null => {
  if (typeof value === 'boolean') {
    return t(
      value
        ? 'settings.connectors.externalCatalog.runtimeValues.true'
        : 'settings.connectors.externalCatalog.runtimeValues.false'
    );
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const buildXiaohongshuRuntimeStatusItems = (
  runtime: Record<string, unknown>,
  t: (key: string) => string
): RuntimeStatusItem[] => {
  const serviceRunning =
    getRuntimeValue(runtime, 'pid_running') === true || getRuntimeValue(runtime, 'health_reachable') === true;
  const loggedIn = getRuntimeValue(runtime, 'logged_in') === true;
  const capabilities = getRuntimeValue(runtime, 'capabilities');
  const runtimeDir = formatRuntimeValue(getRuntimeValue(runtime, 'state_dir'), t);
  const serviceRepo = formatRuntimeValue(getRuntimeValue(runtime, 'service_repo_path'), t);
  const cookiesPath = formatRuntimeValue(getRuntimeValue(runtime, 'cookies_path'), t);
  const baseUrl = formatRuntimeValue(getRuntimeValue(runtime, 'base_url'), t);
  const activeAccount = formatRuntimeValue(getRuntimeValue(runtime, 'active_account_id'), t);
  const accountCount = formatRuntimeValue(getRuntimeValue(runtime, 'account_count'), t);
  const headless = formatRuntimeValue(getRuntimeValue(runtime, 'headless'), t);

  const items: Array<RuntimeStatusItem | null> = [
    {
      id: 'service-status',
      labelKey: 'settings.connectors.externalCatalog.runtimeFields.serviceStatus',
      value: t(
        serviceRunning
          ? 'settings.connectors.externalCatalog.runtimeValues.running'
          : 'settings.connectors.externalCatalog.runtimeValues.stopped'
      ),
      tone: serviceRunning ? 'green' : 'red',
    },
    {
      id: 'login-status',
      labelKey: 'settings.connectors.externalCatalog.runtimeFields.loginStatus',
      value: t(
        loggedIn
          ? 'settings.connectors.externalCatalog.runtimeValues.loggedIn'
          : 'settings.connectors.externalCatalog.runtimeValues.loggedOut'
      ),
      tone: loggedIn ? 'green' : 'orange',
    },
    activeAccount
      ? {
          id: 'active-account',
          labelKey: 'settings.connectors.externalCatalog.runtimeFields.activeAccount',
          value: activeAccount,
          tone: 'arcoblue',
        }
      : null,
    accountCount
      ? {
          id: 'account-count',
          labelKey: 'settings.connectors.externalCatalog.runtimeFields.accounts',
          value: accountCount,
        }
      : null,
    baseUrl
      ? {
          id: 'base-url',
          labelKey: 'settings.connectors.externalCatalog.runtimeFields.baseUrl',
          value: baseUrl,
          mono: true,
        }
      : null,
    headless
      ? {
          id: 'headless',
          labelKey: 'settings.connectors.externalCatalog.runtimeFields.headlessMode',
          value: headless,
        }
      : null,
    Array.isArray(capabilities)
      ? {
          id: 'capabilities',
          labelKey: 'settings.connectors.externalCatalog.runtimeFields.capabilityCount',
          value: String(capabilities.length),
        }
      : null,
    cookiesPath
      ? {
          id: 'cookies-path',
          labelKey: 'settings.connectors.externalCatalog.runtimeFields.cookiesPath',
          value: cookiesPath,
          mono: true,
        }
      : null,
    serviceRepo && serviceRepo !== '(unset)'
      ? {
          id: 'service-repo',
          labelKey: 'settings.connectors.externalCatalog.runtimeFields.serviceRepo',
          value: serviceRepo,
          mono: true,
        }
      : null,
    runtimeDir
      ? {
          id: 'runtime-dir',
          labelKey: 'settings.connectors.externalCatalog.runtimeFields.runtimeDir',
          value: runtimeDir,
          mono: true,
        }
      : null,
  ];

  return items.filter((item): item is RuntimeStatusItem => item !== null);
};

const buildRuntimeStatusItems = (
  details: ExternalConnectorCatalogDetails,
  t: (key: string) => string
): RuntimeStatusItem[] => {
  if (details.connector === 'xiaohongshu') {
    return buildXiaohongshuRuntimeStatusItems(details.runtime, t);
  }
  return [];
};

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
  const runtimeStatusItems = buildRuntimeStatusItems(details, t);

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
      {runtimeStatusItems.length > 0 ? (
        <div className={classNames(styles.detailCard, styles.detailCardWide)}>
          <div className={styles.capabilityHeader}>
            <div>
              <h3 className={styles.detailCardTitle}>{t('settings.connectors.externalCatalog.runtimeStatus')}</h3>
              <div className={styles.detailCardText}>
                {t('settings.connectors.externalCatalog.runtimeStatusSummary')}
              </div>
            </div>
            <Tag color='cyan'>{runtimeStatusItems.length}</Tag>
          </div>
          <div className={styles.runtimeStatusGrid}>
            {runtimeStatusItems.map((item) => (
              <div key={item.id} className={styles.runtimeStatusItem}>
                <div className={styles.runtimeStatusLabel}>{t(item.labelKey)}</div>
                <div className={classNames(styles.runtimeStatusValue, item.mono && styles.runtimeStatusValueMono)}>
                  {item.tone ? <Tag color={item.tone}>{item.value}</Tag> : item.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

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
