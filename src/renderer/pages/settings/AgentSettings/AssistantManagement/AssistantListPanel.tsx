/**
 * AssistantListPanel — Renders the assistant catalog with editable product assistants
 * and read-only system assistants.
 */
import classNames from 'classnames';
import { findContextEngineSystemAssistantByRole } from '@/common/config/presets/systemAssistants';
import { useSettingsViewMode } from '@/renderer/components/settings/SettingsModal/settingsViewContext';
import { useContextEngineActivity } from '@/renderer/hooks/agent/useContextEngineActivity';
import type { AssistantListItem } from './types';
import AssistantAvatar from './AssistantAvatar';
import { Button, Collapse, Switch, Tag, Tooltip } from '@arco-design/web-react';
import { Plus, SettingOne } from '@icon-park/react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { getAssistantBadges } from './assistantUtils';
import styles from '../AgentSettingsPage.module.css';

type AssistantListPanelProps = {
  assistants: AssistantListItem[];
  systemAssistants: AssistantListItem[];
  activeAssistantId: string | null;
  localeKey: string;
  avatarImageMap: Record<string, string>;
  isExtensionAssistant: (assistant: AssistantListItem | null | undefined) => boolean;
  onEdit: (assistant: AssistantListItem) => void;
  onDuplicate: (assistant: AssistantListItem) => void;
  onCreate: () => void;
  onToggleEnabled: (assistant: AssistantListItem, checked: boolean) => void;
  setActiveAssistantId: (id: string) => void;
  presentation?: 'auto' | 'embedded';
};

const ACTIVE_RUNTIME_STATUSES = new Set(['running', 'pending']);

const SYSTEM_AGENT_STATUS_TAG_COLOR = {
  active: 'green',
  idle: 'gray',
  planned: 'gold',
} as const;

function formatUpdateTime(timestamp?: number): string {
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

const AssistantListPanel: React.FC<AssistantListPanelProps> = ({
  assistants,
  systemAssistants,
  activeAssistantId,
  localeKey,
  avatarImageMap,
  isExtensionAssistant,
  onEdit,
  onDuplicate,
  onCreate,
  onToggleEnabled,
  setActiveAssistantId,
  presentation = 'auto',
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const viewMode = useSettingsViewMode();
  const isPageMode = viewMode === 'page';
  const isEmbeddedPresentation = presentation === 'embedded';
  const { maintenanceAgents, activeMaintenanceCount, status } = useContextEngineActivity();
  const totalAssistantCount = assistants.length + systemAssistants.length;

  const maintenanceAgentsByRole = useMemo(() => {
    const nextMap = new Map<string, (typeof maintenanceAgents)[number]>();

    maintenanceAgents.forEach((agent) => {
      if (!agent.systemRole) {
        return;
      }
      nextMap.set(agent.systemRole, agent);
    });

    return nextMap;
  }, [maintenanceAgents]);

  const editableListContent =
    assistants.length > 0 ? (
      <div className={styles.assistantList}>
        {assistants.map((assistant) => {
          const assistantIsExtension = isExtensionAssistant(assistant);
          const isActive = activeAssistantId === assistant.id;
          const badges = getAssistantBadges(assistant, localeKey, t);
          const workspaceHint =
            assistant.workspaceBootstrapHintI18n?.[localeKey] || assistant.workspaceBootstrapHintI18n?.['en-US'];
          return (
            <div
              key={assistant.id}
              className={classNames(styles.assistantCard, isActive && styles.assistantCardActive)}
              onClick={() => {
                setActiveAssistantId(assistant.id);
                onEdit(assistant);
              }}
            >
              <div className={styles.assistantCardMain}>
                <AssistantAvatar assistant={assistant} size={isPageMode ? 34 : 28} avatarImageMap={avatarImageMap} />
                <div className={styles.assistantMeta}>
                  <div className={styles.assistantTitleRow}>
                    <span className={styles.assistantName}>{assistant.nameI18n?.[localeKey] || assistant.name}</span>
                    {badges.length > 0 && (
                      <div className={styles.assistantBadgeRow}>
                        {badges.map((badge) => (
                          <Tag key={badge.key} size='small' color={badge.tone} className={styles.assistantBadgeTag}>
                            {badge.label}
                          </Tag>
                        ))}
                      </div>
                    )}
                  </div>
                  {(assistant.descriptionI18n?.[localeKey] || assistant.description) && (
                    <div className={styles.assistantDescription}>
                      {assistant.descriptionI18n?.[localeKey] || assistant.description}
                    </div>
                  )}
                  {workspaceHint && (
                    <Tooltip content={workspaceHint}>
                      <div className={styles.assistantWorkspaceHint}>{workspaceHint}</div>
                    </Tooltip>
                  )}
                </div>
              </div>
              <div className={styles.assistantActions}>
                <Button
                  type='text'
                  size='mini'
                  className={styles.assistantDuplicateButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate(assistant);
                  }}
                >
                  {t('settings.duplicateAssistant', { defaultValue: 'Duplicate' })}
                </Button>
                <Switch
                  size='small'
                  checked={assistantIsExtension ? true : assistant.enabled !== false}
                  disabled={assistantIsExtension}
                  onChange={(checked) => {
                    onToggleEnabled(assistant, checked);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <Button
                  type='text'
                  size='small'
                  className={styles.assistantSettingsButton}
                  icon={<SettingOne size={16} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(assistant);
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    ) : (
      <div className={styles.emptyState}>
        {t('settings.assistantsEmpty', { defaultValue: 'No assistants configured.' })}
      </div>
    );

  const systemSummaryLabel =
    status === 'checking'
      ? t('agent.contextEngine.loading', { defaultValue: 'Loading maintenance activity...' })
      : status === 'error'
        ? t('agent.contextEngine.loadFailed', { defaultValue: 'Failed to load maintenance activity.' })
        : activeMaintenanceCount > 0
          ? t('agent.contextEngine.activeCount', {
              count: activeMaintenanceCount,
              defaultValue: `${activeMaintenanceCount} maintenance runs active`,
            })
          : systemAssistants.length > 0
            ? t('agent.contextEngine.idleCount', {
                count: systemAssistants.length,
                defaultValue: `${systemAssistants.length} maintenance agents watching`,
              })
            : t('agent.contextEngine.empty', {
                defaultValue: 'Waiting for the first maintenance run.',
              });

  const systemListContent =
    systemAssistants.length > 0 ? (
      <div className={styles.assistantList}>
        {systemAssistants.map((assistant) => {
          const definition = findContextEngineSystemAssistantByRole(assistant.systemRole);
          const deliveryStatus = definition?.deliveryStatus;
          const activity = assistant.systemRole ? maintenanceAgentsByRole.get(assistant.systemRole) : undefined;
          const description = assistant.descriptionI18n?.[localeKey] || assistant.description;
          const latestEvent = activity?.recentEvents[0]?.text;
          const isActive = Boolean(
            activity &&
            (activity.activeConversations > 0 ||
              (activity.runtimeStatus && ACTIVE_RUNTIME_STATUSES.has(activity.runtimeStatus)))
          );
          const runtimeStatusTone =
            deliveryStatus === 'planned'
              ? SYSTEM_AGENT_STATUS_TAG_COLOR.planned
              : isActive
                ? SYSTEM_AGENT_STATUS_TAG_COLOR.active
                : SYSTEM_AGENT_STATUS_TAG_COLOR.idle;
          const runtimeStatusLabel =
            deliveryStatus === 'planned'
              ? t('settings.systemAssistantPlanned', { defaultValue: 'Planned' })
              : isActive
                ? t('agent.contextEngine.active', { defaultValue: 'Active' })
                : t('agent.contextEngine.idle', { defaultValue: 'Watching' });
          const showRuntimeStatusTag = deliveryStatus !== 'planned' || isActive;
          const summary =
            activity?.currentTask ||
            description ||
            t('agent.contextEngine.taskFallback', { defaultValue: 'No summary yet' });
          const triggerKinds = (assistant.triggerKinds || []).map((kind) => resolveTriggerKindLabel(kind, t));
          const boundaryLabel = resolveExecutionBoundaryLabel(assistant.executionBoundary, t);
          const updatedAtLabel = formatUpdateTime(activity?.lastActiveAt);

          return (
            <div key={assistant.id} className={classNames(styles.assistantCard, styles.systemAssistantCard)}>
              <div className={styles.assistantCardMain}>
                <AssistantAvatar assistant={assistant} size={isPageMode ? 34 : 28} avatarImageMap={avatarImageMap} />
                <div className={styles.assistantMeta}>
                  <div className={styles.assistantTitleRow}>
                    <span className={styles.assistantName}>{assistant.nameI18n?.[localeKey] || assistant.name}</span>
                    <div className={styles.assistantBadgeRow}>
                      <Tag size='small' color='arcoblue' className={styles.assistantBadgeTag}>
                        {t('agent.contextEngine.systemManaged', { defaultValue: 'System-managed' })}
                      </Tag>
                      {deliveryStatus ? (
                        <Tag
                          size='small'
                          color={deliveryStatus === 'live' ? 'green' : 'gold'}
                          className={styles.assistantBadgeTag}
                        >
                          {deliveryStatus === 'live'
                            ? t('settings.systemAssistantLive', { defaultValue: 'Live' })
                            : t('settings.systemAssistantPlanned', { defaultValue: 'Planned' })}
                        </Tag>
                      ) : null}
                      {showRuntimeStatusTag ? (
                        <Tag size='small' color={runtimeStatusTone} className={styles.assistantBadgeTag}>
                          {runtimeStatusLabel}
                        </Tag>
                      ) : null}
                    </div>
                  </div>
                  {summary ? <div className={styles.assistantDescription}>{summary}</div> : null}
                  <div className={styles.systemAgentMetaList}>
                    {triggerKinds.length > 0 ? (
                      <div className={styles.systemAgentMetaItem}>
                        {t('settings.systemRunsTrigger', {
                          trigger: triggerKinds.join(' · '),
                          defaultValue: `Trigger: ${triggerKinds.join(' · ')}`,
                        })}
                      </div>
                    ) : null}
                    {assistant.executionBoundary ? (
                      <div className={styles.systemAgentMetaItem}>
                        {t('settings.systemRunsBoundary', {
                          path: boundaryLabel,
                          defaultValue: `Boundary: ${boundaryLabel}`,
                        })}
                      </div>
                    ) : null}
                    {activity?.scopeLabel ? (
                      <div className={styles.systemAgentMetaItem}>
                        {t('agent.contextEngine.scope', {
                          scope: activity.scopeLabel,
                          defaultValue: `Scope: ${activity.scopeLabel}`,
                        })}
                      </div>
                    ) : null}
                    {latestEvent ? (
                      <div className={styles.systemAgentMetaItem}>
                        {t('agent.contextEngine.latestEvent', {
                          event: latestEvent,
                          defaultValue: `Latest: ${latestEvent}`,
                        })}
                      </div>
                    ) : null}
                    <div className={styles.systemAgentMetaItem}>
                      {t('agent.contextEngine.updatedAt', {
                        time: updatedAtLabel,
                        defaultValue: `Updated ${updatedAtLabel}`,
                      })}
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles.assistantActions}>
                {activity?.activeConversations ? (
                  <Tag size='small' color='green' className={styles.assistantBadgeTag}>
                    {t('agent.contextEngine.activeCount', {
                      count: activity.activeConversations,
                      defaultValue: `${activity.activeConversations} maintenance runs active`,
                    })}
                  </Tag>
                ) : null}
                <Button
                  type='outline'
                  size='small'
                  className={styles.secondaryPillButton}
                  onClick={() => void navigate('/settings/system-runs')}
                >
                  {t('settings.systemAgentViewRuns', { defaultValue: 'View Runs' })}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    ) : null;

  const productSection = (
    <div className={styles.surface}>
      <div className={styles.sectionHeader}>
        <div>
          <div className={styles.sectionTitle}>
            {t('settings.assistantsList', { defaultValue: 'Available assistants' })}
          </div>
          <div className={styles.sectionDescription}>
            {t('settings.productAssistantsDescription', {
              defaultValue: 'User-facing built-in, extension, and custom assistants for direct work.',
            })}
          </div>
        </div>
        <span className={styles.sectionMeta}>{assistants.length}</span>
      </div>
      {editableListContent}
    </div>
  );

  const systemSection = systemListContent ? (
    <div className={styles.surface}>
      <div className={styles.sectionHeader}>
        <div>
          <div className={styles.sectionTitle}>{t('settings.systemAgents', { defaultValue: 'System Agents' })}</div>
          <div className={styles.sectionDescription}>
            {t('settings.systemAgentsDescription', {
              defaultValue:
                'Engine-managed agents run automatically in the background to compact session context and promote stable project knowledge.',
            })}
          </div>
        </div>
        <div className={styles.sectionHeaderActions}>
          <span className={styles.sectionMeta}>{systemAssistants.length}</span>
          <Button
            type='outline'
            size='small'
            className={styles.secondaryPillButton}
            onClick={() => void navigate('/settings/system-runs')}
          >
            {t('agent.contextEngine.openConsole', { defaultValue: 'Open Console' })}
          </Button>
        </div>
      </div>
      <div className={styles.systemAgentSummary}>{systemSummaryLabel}</div>
      {systemListContent}
    </div>
  ) : null;

  if (isEmbeddedPresentation) {
    return (
      <div className={styles.sectionStack}>
        {productSection}
        {systemSection}
      </div>
    );
  }

  if (isPageMode) {
    return (
      <div className={styles.pageStack}>
        <div className={styles.heroSurface}>
          <div className={styles.heroRow}>
            <div className={styles.heroMeta}>
              <div className={styles.titleRow}>
                <h1 className={styles.pageTitle}>{t('settings.assistants', { defaultValue: 'Assistants' })}</h1>
                <span className={styles.countBadge}>{totalAssistantCount}</span>
              </div>
              <p className={styles.pageDescription}>
                {t('settings.assistantsPageDescription', {
                  defaultValue:
                    'Create and edit agents here, alongside the system-managed Context Engine agents that keep project memory flowing.',
                })}
              </p>
            </div>
            <div className={styles.actions}>
              <Button
                type='primary'
                className={styles.primaryPillButton}
                icon={<Plus size={14} />}
                onClick={() => onCreate()}
              >
                {t('settings.createAssistant', { defaultValue: 'Create Assistant' })}
              </Button>
            </div>
          </div>
          <div className={styles.heroDetails}>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>
                  {t('settings.assistantsWorkbenchProductAgents', { defaultValue: 'Product agents' })}
                </div>
                <div className={styles.statValue}>{assistants.length}</div>
                <div className={styles.statDescription}>
                  {t('settings.assistantsWorkbenchProductAgentsHint', {
                    defaultValue: 'Direct-use agents available in this workspace.',
                  })}
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>
                  {t('settings.assistantsWorkbenchSystemAgents', { defaultValue: 'System agents' })}
                </div>
                <div className={styles.statValue}>{systemAssistants.length}</div>
                <div className={styles.statDescription}>
                  {t('settings.assistantsWorkbenchSystemAgentsHint', {
                    defaultValue: 'Background agents managed by Context Engine.',
                  })}
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>
                  {t('settings.assistantsWorkbenchActiveRuns', { defaultValue: 'Active runs' })}
                </div>
                <div className={styles.statValue}>{activeMaintenanceCount}</div>
                <div className={styles.statDescription}>
                  {t('settings.assistantsWorkbenchActiveRunsHint', {
                    defaultValue: 'Maintenance executions currently in progress.',
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.sectionStack}>
          {productSection}
          {systemSection}
        </div>
      </div>
    );
  }

  return (
    <Collapse.Item
      header={
        <div className='flex items-center justify-between w-full'>
          <span>{t('settings.assistants', { defaultValue: 'Assistants' })}</span>
        </div>
      }
      name='smart-assistants'
      extra={
        <Button
          type='outline'
          size='small'
          className={styles.secondaryPillButton}
          icon={<Plus size={14} fill='currentColor' />}
          onClick={(e) => {
            e.stopPropagation();
            onCreate();
          }}
        >
          {t('settings.createAssistant', { defaultValue: 'Create' })}
        </Button>
      }
    >
      <div className={classNames('py-2', styles.sectionStack)}>
        {productSection}
        {systemSection}
      </div>
    </Collapse.Item>
  );
};

export default AssistantListPanel;
