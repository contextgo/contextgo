/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button, Empty, Tag, Typography } from '@arco-design/web-react';
import { Robot } from '@icon-park/react';
import classNames from 'classnames';
import type { IExtensionSystemRunItem } from '@/common/adapter/ipcBridge';
import {
  CONTEXT_ENGINE_SYSTEM_ASSISTANTS,
  findContextEngineSystemAssistantByRole,
} from '@/common/config/presets/systemAssistants';
import { useContextEngineActivity } from '@/renderer/hooks/agent/useContextEngineActivity';
import SettingsPageWrapper from '../components/SettingsPageWrapper';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from './AgentSettingsPage.module.css';

const STATUS_TAG_COLOR = {
  active: 'green',
  checking: 'arcoblue',
  error: 'orangered',
  idle: 'gray',
} as const;

const RUN_STATE_TAG_COLOR = {
  error: 'orangered',
  executing: 'arcoblue',
  idle: 'gray',
  researching: 'arcoblue',
  syncing: 'arcoblue',
  writing: 'green',
} as const;

const SYSTEM_AGENT_STATUS_TAG_COLOR = {
  active: 'green',
  idle: 'gray',
  planned: 'gold',
} as const;

function formatUpdateTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  }).format(new Date(timestamp));
}

function resolveRunTitle(run: IExtensionSystemRunItem, localeKey: string): string {
  const assistant = findContextEngineSystemAssistantByRole(run.systemRole);
  return assistant?.nameI18n[localeKey] || assistant?.nameI18n['en-US'] || run.agentName;
}

function resolveTriggerKindLabel(kind: string, t: (key: string, options?: Record<string, unknown>) => string): string {
  return t(`settings.systemAgentTriggerKinds.${kind}`, {
    defaultValue: kind,
  });
}

function resolveExecutionBoundaryLabel(
  boundary: string | undefined,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  if (!boundary) {
    return '--';
  }

  return t(`settings.systemAgentExecutionBoundaries.${boundary}`, {
    defaultValue: boundary,
  });
}

function formatArtifactTargets(targets: readonly string[] | undefined): string {
  if (!targets || targets.length === 0) {
    return '--';
  }

  return targets.join(' · ');
}

function formatRecentEventKind(kind: string): string {
  return kind;
}

function resolveRunEventQualifier(run: IExtensionSystemRunItem): string | undefined {
  return resolveArtifactKindLabel(run) ?? run.source;
}

type SystemRunDetailRow = {
  key: string;
  value?: string;
};

function renderDetailGroup(title: string, rows: SystemRunDetailRow[]): React.ReactNode {
  const visibleRows = rows.filter((row) => row.value);
  if (visibleRows.length === 0) {
    return null;
  }

  return (
    <section className={styles.systemRunsMetaGroup}>
      <div className={styles.systemRunsMetaGroupTitle}>{title}</div>
      <div className={styles.systemRunsMetaGroupBody}>
        {visibleRows.map((row) => (
          <div key={row.key} className={styles.systemRunsDetailText}>
            {row.value}
          </div>
        ))}
      </div>
    </section>
  );
}

function resolveArtifactKindLabel(run: IExtensionSystemRunItem): string | undefined {
  const targets = run.artifactTargets ?? [];
  if (targets.includes('project_rules') || targets.includes('project_skill')) {
    return 'proposal';
  }
  if (targets.includes('space_digest') || targets.includes('profile_memory')) {
    return 'space-distillation';
  }
  if (targets.includes('session_working_context') || targets.includes('session_checkpoint')) {
    return 'session-context';
  }
  if (targets.includes('project_doc')) {
    return 'project-context';
  }
  return undefined;
}

function resolveDefinitionGovernanceIdentity(jobType: string): string {
  if (jobType === 'session_compaction' || jobType === 'session_pattern_detection') {
    return 'session_steward';
  }
  if (jobType === 'project_promotion' || jobType === 'project_capability_curation') {
    return 'project_curator';
  }
  return 'space_curator';
}

function resolveDefinitionArtifactTargets(jobType: string): string[] {
  if (jobType === 'session_compaction') {
    return ['session_timeline', 'session_working_context', 'session_checkpoint'];
  }
  if (jobType === 'session_pattern_detection') {
    return ['space_digest'];
  }
  if (jobType === 'project_promotion') {
    return ['project_doc'];
  }
  if (jobType === 'project_capability_curation') {
    return ['project_doc', 'project_rules', 'project_skill'];
  }
  if (jobType === 'space_memory_distillation') {
    return ['space_digest', 'profile_memory'];
  }
  return ['space_digest'];
}

const SystemRunsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { status, systemRuns, activeMaintenanceCount, lastCheckedAt } = useContextEngineActivity();
  const lastCheckedLabel = lastCheckedAt ? formatUpdateTime(lastCheckedAt) : '--';
  const governanceSummary = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const run of systemRuns) {
      const identity = run.governanceIdentity;
      if (!identity) {
        continue;
      }
      counts.set(identity, (counts.get(identity) ?? 0) + 1);
    }
    return [...counts.entries()];
  }, [systemRuns]);

  return (
    <SettingsPageWrapper>
      <div className='flex flex-col gap-16px'>
        <section className='rounded-24px border border-border-2 bg-fill-1 p-20px shadow-sm'>
          <div className='flex flex-wrap items-start justify-between gap-16px'>
            <div className={styles.systemRunsHeroMain}>
              <div className={styles.systemRunsHeroIcon}>
                <Robot theme='outline' size={20} fill='rgb(var(--primary-6))' strokeWidth={3} />
              </div>
              <div className='min-w-0 flex-1'>
                <div className={styles.systemRunsHeroTitleRow}>
                  <div className={styles.systemRunsHeroTitle}>
                    {t('settings.systemRuns', { defaultValue: 'System Runs' })}
                  </div>
                  <Tag color={STATUS_TAG_COLOR[status]} size='small'>
                    {status === 'active'
                      ? t('agent.contextEngine.active', { defaultValue: 'Active' })
                      : status === 'checking'
                        ? t('common.loading', { defaultValue: 'Loading' })
                        : status === 'error'
                          ? t('common.error', { defaultValue: 'Error' })
                          : t('agent.contextEngine.idle', { defaultValue: 'Watching' })}
                  </Tag>
                  <Tag size='small'>
                    {t('settings.systemRunsCount', {
                      count: systemRuns.length,
                      defaultValue: `${systemRuns.length} runs`,
                    })}
                  </Tag>
                </div>
                <Typography.Paragraph className={styles.systemRunsHeroDescription}>
                  {t('settings.systemRunsDesc', {
                    defaultValue:
                      'Read-only console for Context Engine sessions and runs. Trigger routing, execution boundary, and artifacts are surfaced here.',
                  })}
                </Typography.Paragraph>
              </div>
            </div>
            <div
              className={
                styles.systemRunsSummaryCard +
                ' rounded-18px border border-border-2 bg-fill-2 px-16px py-12px text-right'
              }
            >
              <div className='text-12px text-t-secondary'>
                {t('settings.systemRunsActiveNow', { defaultValue: 'Active now' })}
              </div>
              <div className='mt-4px text-24px font-700 leading-none text-t-primary'>{activeMaintenanceCount}</div>
            </div>
          </div>
        </section>

        {governanceSummary.length > 0 ? (
          <section className='rounded-20px border border-border-2 bg-fill-1 px-16px py-12px'>
            <div className='flex flex-wrap items-center gap-8px'>
              {governanceSummary.map(([identity, count]) => (
                <Tag key={identity} size='small'>
                  {t('settings.systemRunsIdentityCount', {
                    identity,
                    count,
                    defaultValue: `${identity} · ${count}`,
                  })}
                </Tag>
              ))}
            </div>
          </section>
        ) : null}

        {systemRuns.length === 0 ? (
          <>
            <section className='rounded-24px border border-dashed border-border-2 bg-fill-1 p-32px'>
              <Empty description={t('settings.systemRunsEmptyTitle', { defaultValue: 'No run history yet.' })} />
              <Typography.Paragraph className={styles.systemRunsEmptyDescription}>
                {t('settings.systemRunsEmptyDescription', {
                  defaultValue:
                    'Context Engine is already watching this workspace. Historical records will appear here after the first maintenance trigger completes.',
                })}
              </Typography.Paragraph>
            </section>

            <section className={styles.surface}>
              <div className={styles.sectionHeader}>
                <div>
                  <div className={styles.sectionTitle}>
                    {t('settings.systemRunsDefinitionsTitle', { defaultValue: 'Registered system agents' })}
                  </div>
                  <div className={styles.sectionDescription}>
                    {t('settings.systemRunsDefinitionsDescription', {
                      defaultValue:
                        'Definitions stay visible before the first run. Trigger conditions and execution boundaries are listed here, while historical records only appear after execution.',
                    })}
                  </div>
                </div>
                <span className={styles.sectionMeta}>{CONTEXT_ENGINE_SYSTEM_ASSISTANTS.length}</span>
              </div>

              <div className={styles.systemAgentSummary}>
                {t('settings.systemRunsLastChecked', {
                  time: lastCheckedLabel,
                  defaultValue: `Last checked: ${lastCheckedLabel}`,
                })}
              </div>

              <div className={styles.assistantList}>
                {CONTEXT_ENGINE_SYSTEM_ASSISTANTS.map((assistant) => {
                  const name = assistant.nameI18n[i18n.language] || assistant.nameI18n['en-US'] || assistant.id;
                  const description =
                    assistant.descriptionI18n[i18n.language] || assistant.descriptionI18n['en-US'] || assistant.id;
                  const triggerKinds = assistant.runtimeSpec.triggerKinds.map((kind) =>
                    resolveTriggerKindLabel(kind, t)
                  );
                  const boundaryLabel = resolveExecutionBoundaryLabel(assistant.runtimeSpec.executionBoundary, t);
                  const governanceIdentity = resolveDefinitionGovernanceIdentity(assistant.jobType);
                  const artifactTargets = resolveDefinitionArtifactTargets(assistant.jobType);
                  const isPlanned = assistant.deliveryStatus === 'planned';
                  const runtimeStatusTone = isPlanned
                    ? SYSTEM_AGENT_STATUS_TAG_COLOR.planned
                    : SYSTEM_AGENT_STATUS_TAG_COLOR.idle;
                  const runtimeStatusLabel = isPlanned
                    ? t('settings.systemAssistantPlanned', { defaultValue: 'Planned' })
                    : t('agent.contextEngine.idle', { defaultValue: 'Watching' });

                  return (
                    <div key={assistant.id} className={classNames(styles.assistantCard, styles.systemAssistantCard)}>
                      <div className={styles.assistantCardMain}>
                        <div className={styles.systemRunsDefinitionIcon}>
                          <Robot theme='outline' size={18} strokeWidth={3} />
                        </div>
                        <div className={styles.assistantMeta}>
                          <div className={styles.assistantTitleRow}>
                            <span className={styles.assistantName}>{name}</span>
                            <div className={styles.assistantBadgeRow}>
                              <Tag size='small' color='arcoblue' className={styles.assistantBadgeTag}>
                                {t('agent.contextEngine.systemManaged', { defaultValue: 'System-managed' })}
                              </Tag>
                              <Tag
                                size='small'
                                color={assistant.deliveryStatus === 'live' ? 'green' : 'gold'}
                                className={styles.assistantBadgeTag}
                              >
                                {assistant.deliveryStatus === 'live'
                                  ? t('settings.systemAssistantLive', { defaultValue: 'Live' })
                                  : t('settings.systemAssistantPlanned', { defaultValue: 'Planned' })}
                              </Tag>
                              <Tag size='small' color={runtimeStatusTone} className={styles.assistantBadgeTag}>
                                {runtimeStatusLabel}
                              </Tag>
                            </div>
                          </div>
                          <div className={styles.assistantDescription}>{description}</div>
                          <div className={styles.systemAgentMetaList}>
                            <div className={styles.systemAgentMetaItem}>
                              {t('settings.systemRunsTrigger', {
                                trigger: triggerKinds.join(' · '),
                                defaultValue: `Trigger: ${triggerKinds.join(' · ')}`,
                              })}
                            </div>
                            <div className={styles.systemAgentMetaItem}>
                              {t('settings.systemRunsBoundary', {
                                path: boundaryLabel,
                                defaultValue: `Boundary: ${boundaryLabel}`,
                              })}
                            </div>
                            <div className={styles.systemAgentMetaItem}>
                              {t('settings.systemRunsGovernance', {
                                identity: governanceIdentity,
                                defaultValue: `Governance: ${governanceIdentity}`,
                              })}
                            </div>
                            <div className={styles.systemAgentMetaItem}>
                              {t('settings.systemRunsArtifacts', {
                                artifacts: formatArtifactTargets(artifactTargets),
                                defaultValue: `Artifacts: ${formatArtifactTargets(artifactTargets)}`,
                              })}
                            </div>
                            <div className={styles.systemAgentMetaItem}>
                              {t('settings.systemRunsLastChecked', {
                                time: lastCheckedLabel,
                                defaultValue: `Last checked: ${lastCheckedLabel}`,
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        ) : (
          <section className='grid gap-12px'>
            {systemRuns.map((run) => {
              const artifactKind = resolveArtifactKindLabel(run);
              const eventQualifier = resolveRunEventQualifier(run);
              const routingRows: SystemRunDetailRow[] = [
                {
                  key: 'scope',
                  value: run.scopeLabel ? t('agent.contextEngine.scope', { scope: run.scopeLabel }) : undefined,
                },
                {
                  key: 'boundary',
                  value: run.executionBoundaryPath
                    ? t('settings.systemRunsBoundary', {
                        path: run.executionBoundaryPath,
                        defaultValue: `Boundary: ${run.executionBoundaryPath}`,
                      })
                    : undefined,
                },
                {
                  key: 'trigger',
                  value:
                    run.triggerLabel || run.triggerEvent
                      ? t('settings.systemRunsTrigger', {
                          trigger: run.triggerLabel || run.triggerEvent || '--',
                          defaultValue: `Trigger: ${run.triggerLabel || run.triggerEvent || '--'}`,
                        })
                      : undefined,
                },
                {
                  key: 'reason',
                  value: run.reason
                    ? t('settings.systemRunsReason', {
                        reason: run.reason,
                        defaultValue: `Reason: ${run.reason}`,
                      })
                    : undefined,
                },
                {
                  key: 'lifecycle-summary',
                  value: run.lifecycleSummary
                    ? t('settings.systemRunsLifecycleSummary', {
                        summary: run.lifecycleSummary,
                        defaultValue: `Lifecycle summary: ${run.lifecycleSummary}`,
                      })
                    : undefined,
                },
                {
                  key: 'source',
                  value: run.source
                    ? t('settings.systemRunsSource', {
                        source: run.source,
                        defaultValue: `Source: ${run.source}`,
                      })
                    : undefined,
                },
                {
                  key: 'source-record',
                  value: run.sourceRecordId
                    ? t('settings.systemRunsSourceRecord', {
                        sourceRecordId: run.sourceRecordId,
                        defaultValue: `Source record: ${run.sourceRecordId}`,
                      })
                    : undefined,
                },
                {
                  key: 'ingest-mode',
                  value: run.ingestMode
                    ? t('settings.systemRunsIngestMode', {
                        ingestMode: run.ingestMode,
                        defaultValue: `Ingest mode: ${run.ingestMode}`,
                      })
                    : undefined,
                },
                {
                  key: 'replay-cursor',
                  value: run.replayFromCursor
                    ? t('settings.systemRunsReplayCursor', {
                        replayFromCursor: run.replayFromCursor,
                        defaultValue: `Replay cursor: ${run.replayFromCursor}`,
                      })
                    : undefined,
                },
                {
                  key: 'provenance-summary',
                  value: run.provenanceSummary
                    ? t('settings.systemRunsProvenanceSummary', {
                        summary: run.provenanceSummary,
                        defaultValue: `Provenance summary: ${run.provenanceSummary}`,
                      })
                    : undefined,
                },
                {
                  key: 'governance',
                  value: run.governanceIdentity
                    ? t('settings.systemRunsGovernance', {
                        identity: run.governanceIdentity,
                        defaultValue: `Governance: ${run.governanceIdentity}`,
                      })
                    : undefined,
                },
              ];
              const artifactRows: SystemRunDetailRow[] = [
                {
                  key: 'kind',
                  value: artifactKind
                    ? t('settings.systemRunsArtifactKind', {
                        kind: artifactKind,
                        defaultValue: `Artifact kind: ${artifactKind}`,
                      })
                    : undefined,
                },
                {
                  key: 'targets',
                  value:
                    run.artifactTargets && run.artifactTargets.length > 0
                      ? t('settings.systemRunsArtifacts', {
                          artifacts: formatArtifactTargets(run.artifactTargets),
                          defaultValue: `Artifacts: ${formatArtifactTargets(run.artifactTargets)}`,
                        })
                      : undefined,
                },
                {
                  key: 'summary',
                  value: run.latestArtifactSummary
                    ? t('settings.systemRunsArtifactSummary', {
                        summary: run.latestArtifactSummary,
                        defaultValue: `Artifact summary: ${run.latestArtifactSummary}`,
                      })
                    : undefined,
                },
                {
                  key: 'title',
                  value: run.artifactTitle ? t('agent.contextEngine.artifactTitle', { title: run.artifactTitle }) : undefined,
                },
                {
                  key: 'path',
                  value: run.artifactRelativePath
                    ? t('agent.contextEngine.artifactPath', { path: run.artifactRelativePath })
                    : undefined,
                },
              ];

              return (
                <article
                  key={run.id}
                  data-testid={`system-run-${run.id}`}
                  className={classNames(
                    'rounded-20px border border-border-2 bg-fill-1 p-16px shadow-sm',
                    styles.systemRunsCard
                  )}
                >
                  <div className='flex flex-wrap items-start justify-between gap-12px'>
                    <div className='min-w-0 flex-1'>
                      <div className='flex flex-wrap items-center gap-8px'>
                        <div className='truncate text-14px font-600 leading-6 text-t-primary'>
                          {resolveRunTitle(run, i18n.language)}
                        </div>
                        <Tag color={RUN_STATE_TAG_COLOR[run.state]} size='small'>
                          {t(`agent.contextEngine.state.${run.state}`, { defaultValue: run.state })}
                        </Tag>
                        {run.maintenanceKind ? <Tag size='small'>{run.maintenanceKind}</Tag> : null}
                        {run.source ? <Tag size='small'>{run.source}</Tag> : null}
                        {artifactKind ? <Tag size='small'>{artifactKind}</Tag> : null}
                      </div>
                      <div className='mt-6px text-13px leading-6 text-t-primary'>
                        {run.currentTask || t('agent.contextEngine.taskFallback', { defaultValue: 'No summary yet' })}
                      </div>
                    </div>
                    <div className='text-12px text-t-secondary'>
                      {t('agent.contextEngine.updatedAt', {
                        time: formatUpdateTime(run.lastActiveAt),
                        defaultValue: `Updated ${formatUpdateTime(run.lastActiveAt)}`,
                      })}
                    </div>
                  </div>

                  <div className={classNames('mt-12px', styles.systemRunsMetaGrid)}>
                    {renderDetailGroup(t('settings.systemRunsRoutingTitle', { defaultValue: 'Routing' }), routingRows)}
                    {renderDetailGroup(t('settings.systemRunsArtifactTitle', { defaultValue: 'Artifact' }), artifactRows)}
                  </div>

                  {run.recentEvents.length > 0 ? (
                    <div
                      data-testid={`system-run-event-stream-${run.id}`}
                      className={classNames('mt-12px', styles.systemRunsEventStream)}
                    >
                      {run.recentEvents.slice(0, 4).map((event, index) => (
                        <div
                          key={`${run.id}-${index}-${event.at}`}
                          className={classNames('text-12px leading-5 text-t-secondary', styles.systemRunsEventRow)}
                        >
                          <span className={styles.systemRunsEventTimestamp}>{formatUpdateTime(event.at)}</span>
                          <span data-testid={`system-run-event-kind-${run.id}-${index}`}>
                            <Tag size='small'>{formatRecentEventKind(event.kind)}</Tag>
                          </span>
                          {eventQualifier ? (
                            <span
                              data-testid={`system-run-event-qualifier-${run.id}-${index}`}
                              className={classNames(styles.systemRunsEventQualifier, {
                                [styles.systemRunsEventQualifierArtifact]: Boolean(artifactKind),
                              })}
                            >
                              {eventQualifier}
                            </span>
                          ) : null}
                          <span className={styles.systemRunsEventMessage}>{event.text}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </section>
        )}

        <div className='flex justify-end'>
          <Button type='outline' onClick={() => void navigate('/guid')}>
            {t('common.back', { defaultValue: 'Back to Chat' })}
          </Button>
        </div>
      </div>
    </SettingsPageWrapper>
  );
};

export default SystemRunsPage;
