/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IExtensionAgentActivityItem } from '@/common/adapter/ipcBridge';
import {
  CONTEXT_ENGINE_SYSTEM_ASSISTANTS,
  findContextEngineSystemAssistantByRole,
} from '@/common/config/presets/systemAssistants';
import { useContextEngineActivity } from '@/renderer/hooks/agent/useContextEngineActivity';
import { Button, Tag, Typography } from '@arco-design/web-react';
import { Robot } from '@icon-park/react';
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const STATUS_TAG_COLOR = {
  active: 'green',
  checking: 'arcoblue',
  error: 'orangered',
  idle: 'gray',
} as const;

const AGENT_STATE_TAG_COLOR = {
  error: 'orangered',
  executing: 'arcoblue',
  idle: 'gray',
  researching: 'arcoblue',
  syncing: 'arcoblue',
  writing: 'green',
} as const;

type MaintenanceGroupKey = 'session_compaction' | 'project_promotion' | 'other';

type MaintenanceGroup = {
  key: MaintenanceGroupKey;
  agents: IExtensionAgentActivityItem[];
  activeCount: number;
};

function resolveMaintenanceGroupKey(agent: IExtensionAgentActivityItem): MaintenanceGroupKey {
  if (agent.maintenanceKind === 'session_compaction') {
    return 'session_compaction';
  }
  if (agent.maintenanceKind === 'project_promotion') {
    return 'project_promotion';
  }
  return 'other';
}

function formatUpdateTime(timestamp: number | undefined): string {
  if (!timestamp) {
    return '--';
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  }).format(new Date(timestamp));
}

function resolveAssistantName(agent: IExtensionAgentActivityItem, localeKey: string): string {
  const assistant = findContextEngineSystemAssistantByRole(agent.systemRole);
  return assistant?.nameI18n[localeKey] || assistant?.nameI18n['en-US'] || agent.agentName;
}

const ContextEngineActivityCard: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { activeMaintenanceCount, maintenanceAgents, status } = useContextEngineActivity();

  const visibleMaintenanceAgents = useMemo<IExtensionAgentActivityItem[]>(() => {
    const agentsByRole = new Map<string, IExtensionAgentActivityItem>();

    maintenanceAgents.forEach((agent) => {
      const key = agent.systemRole || agent.maintenanceKind || agent.id;
      agentsByRole.set(key, agent);
    });

    CONTEXT_ENGINE_SYSTEM_ASSISTANTS.forEach((assistant) => {
      if (agentsByRole.has(assistant.systemRole)) {
        return;
      }

      agentsByRole.set(assistant.systemRole, {
        id: assistant.id,
        backend: 'context-engine',
        agentName: assistant.nameI18n['en-US'] || assistant.id,
        state: 'idle',
        runtimeStatus: assistant.deliveryStatus === 'live' ? 'finished' : 'unknown',
        conversations: 0,
        activeConversations: 0,
        lastActiveAt: 0,
        currentTask: assistant.descriptionI18n[i18n.language] || assistant.descriptionI18n['en-US'],
        runType: 'maintenance',
        systemManaged: true,
        assistantId: assistant.id,
        systemOwner: assistant.owner,
        systemRole: assistant.systemRole,
        maintenanceKind: assistant.jobType,
        recentEvents: [],
      });
    });

    return Array.from(agentsByRole.values());
  }, [i18n.language, maintenanceAgents]);

  const getAgentStateLabel = (state: keyof typeof AGENT_STATE_TAG_COLOR): string =>
    t(`agent.contextEngine.state.${state}`, {
      defaultValue: state,
    });

  const summaryLabel =
    status === 'checking'
      ? t('agent.contextEngine.loading', { defaultValue: 'Loading maintenance activity...' })
      : status === 'error'
        ? t('agent.contextEngine.loadFailed', { defaultValue: 'Failed to load maintenance activity.' })
        : activeMaintenanceCount > 0
          ? t('agent.contextEngine.activeCount', {
              count: activeMaintenanceCount,
              defaultValue: activeMaintenanceCount + ' maintenance runs active',
            })
          : visibleMaintenanceAgents.length > 0
            ? t('agent.contextEngine.idleCount', {
                count: visibleMaintenanceAgents.length,
                defaultValue: visibleMaintenanceAgents.length + ' maintenance agents watching',
              })
            : t('agent.contextEngine.empty', {
                defaultValue: 'Waiting for the first maintenance run.',
              });

  const previewGroups = useMemo<MaintenanceGroup[]>(() => {
    const groups = new Map<MaintenanceGroupKey, MaintenanceGroup>([
      ['session_compaction', { key: 'session_compaction', agents: [], activeCount: 0 }],
      ['project_promotion', { key: 'project_promotion', agents: [], activeCount: 0 }],
      ['other', { key: 'other', agents: [], activeCount: 0 }],
    ]);

    visibleMaintenanceAgents.forEach((agent) => {
      const key = resolveMaintenanceGroupKey(agent);
      const group = groups.get(key);
      if (!group) {
        return;
      }
      group.agents.push(agent);
      group.activeCount += agent.activeConversations;
    });

    return ['session_compaction', 'project_promotion', 'other']
      .map((key) => groups.get(key as MaintenanceGroupKey))
      .filter((group): group is MaintenanceGroup => Boolean(group && group.agents.length > 0));
  }, [visibleMaintenanceAgents]);

  const statusLabel =
    status === 'active'
      ? t('agent.contextEngine.active', { defaultValue: 'Active' })
      : status === 'error'
        ? t('common.error', { defaultValue: 'Error' })
        : status === 'checking'
          ? t('common.loading', { defaultValue: 'Loading' })
          : t('agent.contextEngine.idle', { defaultValue: 'Watching' });

  const getMaintenanceGroupLabel = (key: MaintenanceGroupKey): string =>
    t(`agent.contextEngine.groups.${key}`, {
      defaultValue: key,
    });

  const getMaintenanceGroupSummary = (group: MaintenanceGroup): string =>
    group.activeCount > 0
      ? t('agent.contextEngine.groupActiveCount', {
          count: group.activeCount,
          defaultValue: group.activeCount + ' runs active',
        })
      : t('agent.contextEngine.groupWatchingCount', {
          count: group.agents.length,
          defaultValue: group.agents.length + ' agents watching',
        });

  return (
    <section className='rounded-24px border border-border-2 bg-fill-1 p-20px shadow-sm'>
      <div className='flex flex-wrap items-start justify-between gap-16px'>
        <div className='min-w-0 flex flex-1 items-start gap-12px'>
          <div className='mt-2px flex h-40px w-40px shrink-0 items-center justify-center rounded-14px bg-fill-2'>
            <Robot theme='outline' size={20} fill='rgb(var(--primary-6))' strokeWidth={3} />
          </div>
          <div className='min-w-0 flex-1'>
            <div className='flex flex-wrap items-center gap-8px'>
              <Typography.Title heading={6} className='!mb-0 !text-[var(--text-primary)]'>
                {t('agent.contextEngine.title', { defaultValue: 'Context Engine' })}
              </Typography.Title>
              <Tag color={STATUS_TAG_COLOR[status]} size='small'>
                {statusLabel}
              </Tag>
              <Tag size='small'>{t('agent.contextEngine.systemManaged', { defaultValue: 'System-managed' })}</Tag>
            </div>
            <Typography.Paragraph className='!mb-0 mt-6px text-13px leading-6 text-t-secondary'>
              {t('agent.contextEngine.description', {
                defaultValue:
                  'System-managed maintenance agents continuously compact session context and promote stable project knowledge.',
              })}
            </Typography.Paragraph>
          </div>
        </div>
        <Button type='text' onClick={() => void navigate('/settings/system-runs')}>
          {t('agent.contextEngine.openConsole', { defaultValue: 'Open Console' })}
        </Button>
      </div>

      <div className='mt-16px text-14px font-600 leading-6 text-t-primary'>{summaryLabel}</div>

      {previewGroups.length > 0 ? (
        <div className='mt-16px grid gap-10px'>
          {previewGroups.map((group) => (
            <section key={group.key} className='rounded-20px border border-border-2 bg-fill-2 p-14px'>
              <div className='flex flex-wrap items-center justify-between gap-8px'>
                <div className='min-w-0 flex-1'>
                  <div className='truncate text-13px font-600 leading-6 text-t-primary'>
                    {getMaintenanceGroupLabel(group.key)}
                  </div>
                  <div className='mt-2px text-12px leading-5 text-t-secondary'>
                    {getMaintenanceGroupSummary(group)}
                  </div>
                </div>
                <Tag size='small'>{group.agents.length}</Tag>
              </div>

              <div className='mt-10px grid gap-10px'>
                {group.agents.map((agent) => {
                  const latestEvent = agent.recentEvents[0]?.text;
                  const assistantName = resolveAssistantName(agent, i18n.language);

                  return (
                    <article key={agent.id} className='rounded-18px border border-border-2 bg-fill-1 px-14px py-12px'>
                      <div className='flex flex-wrap items-center justify-between gap-8px'>
                        <div className='min-w-0 flex-1'>
                          <div className='truncate text-13px font-600 leading-6 text-t-primary'>{assistantName}</div>
                        </div>
                        <Tag color={AGENT_STATE_TAG_COLOR[agent.state]} size='small'>
                          {getAgentStateLabel(agent.state)}
                        </Tag>
                      </div>
                      <div className='mt-6px text-13px leading-6 text-t-primary'>
                        {agent.currentTask || t('agent.contextEngine.taskFallback', { defaultValue: 'No summary yet' })}
                      </div>
                      <div className='mt-8px flex flex-col gap-4px text-12px leading-5 text-t-secondary'>
                        {agent.scopeLabel ? (
                          <div className='break-words'>
                            {t('agent.contextEngine.scope', {
                              scope: agent.scopeLabel,
                              defaultValue: 'Scope: ' + agent.scopeLabel,
                            })}
                          </div>
                        ) : null}
                        {agent.artifactTitle ? (
                          <div className='break-words'>
                            {t('agent.contextEngine.artifactTitle', {
                              title: agent.artifactTitle,
                              defaultValue: 'Doc: ' + agent.artifactTitle,
                            })}
                          </div>
                        ) : null}
                        {agent.artifactRelativePath ? (
                          <div className='break-all'>
                            {t('agent.contextEngine.artifactPath', {
                              path: agent.artifactRelativePath,
                              defaultValue: 'Path: ' + agent.artifactRelativePath,
                            })}
                          </div>
                        ) : null}
                        {latestEvent ? (
                          <div className='break-words'>
                            {t('agent.contextEngine.latestEvent', {
                              event: latestEvent,
                              defaultValue: 'Latest: ' + latestEvent,
                            })}
                          </div>
                        ) : null}
                        <div>
                          {t('agent.contextEngine.updatedAt', {
                            time: formatUpdateTime(agent.lastActiveAt),
                            defaultValue: 'Updated ' + formatUpdateTime(agent.lastActiveAt),
                          })}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </section>
  );
};

export default ContextEngineActivityCard;
