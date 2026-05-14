/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { normalizeManagedSlashCommandLibrary, type ManagedSlashCommandRecord } from '@/common/chat/slash/library';
import { getBundledAgentPackageRequirements } from '@/common/config/presets/bundledAgentPackageRegistry';
import type { AgentPackageRequirementsPayload } from '@/common/config/presets/agentPackageManifest';
import type {
  IContextSchedule,
  IProjectCapabilitySnapshot,
  IProjectSkillCapability,
  IScheduleSpec,
} from '@/common/adapter/ipcBridge';
import MarkdownView from '@/renderer/components/Markdown';
import type { TChatConversation } from '@/common/config/storage';
import { usePresetAssistantInfo } from '@/renderer/hooks/agent/usePresetAssistantInfo';
import { AutomationPanel, AutomationSectionCard } from '@/renderer/components/automation';
import { SettingsSubModal } from '@/renderer/components/settings';
import type { HookInfo, SkillInfo } from '@/renderer/pages/settings/AgentSettings/AssistantManagement/types';
import {
  getIncompatibleHookNames,
  isHookSupportedByBackend,
} from '@/renderer/pages/settings/AgentSettings/AssistantManagement/assistantUtils';
import {
  getConversationEnabledHooks,
  resolveConversationHookBackend,
} from '@/renderer/pages/conversation/Workspace/utils/sessionHooks';
import ManagedCommandLibraryEditor from '@/renderer/pages/settings/ToolsSettings/ManagedCommandLibraryEditor';
import { emitter } from '@/renderer/utils/emitter';
import {
  getConversationWorkspacePath,
  getWorkspaceAutomationPaths,
  getWorkspaceDisplayName,
  isTemporaryWorkspace,
} from '@/renderer/utils/workspace/workspace';
import { Button, Checkbox, Input, Message, Switch, Tabs, Tag, Typography } from '@arco-design/web-react';
import { AlarmClock, Command, ConnectionPoint, Play, Refresh, Tips } from '@icon-park/react';
import React, { useCallback, useEffect, useEffectEvent, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getScheduleDirectCreateContext } from '../schedulePresetUtils';
import { formatNextRun, getJobStatusFlags } from '../scheduleUtils';
import { useScheduleJobs } from '../useScheduleJobs';

type ProjectAutomationModalProps = {
  visible: boolean;
  conversation: TChatConversation;
  onClose: () => void;
};

type ProjectScheduleEditorState = {
  name: string;
  enabled: boolean;
  message: string;
  cronExpr: string;
  scheduleDescription: string;
};

type AutomationTabKey = 'skills' | 'requirements' | 'hooks' | 'commands' | 'schedules';

type SkillSelectionState = {
  names: string[];
};

type SkillPreviewState = {
  title: string;
  sourcePath?: string;
};

type RequirementBinding = {
  source: string;
  reference: string;
  note: string;
};

type RequirementBindingFile = {
  schemaVersion?: string;
  bindings?: Record<string, Partial<RequirementBinding>>;
};

type ProjectRequirementKind = 'env' | 'command' | 'network' | 'mcp' | 'credential' | 'connector' | 'tool' | 'note';

type ProjectRequirementRow = {
  id: string;
  ownerLabel: string;
  kind: ProjectRequirementKind;
  label: string;
  status: 'ready' | 'missing' | 'info';
  source: 'compatibility' | 'openai' | 'package';
  detail?: string;
};

const EMPTY_SCHEDULE_EDITOR_STATE: ProjectScheduleEditorState = {
  name: '',
  enabled: true,
  message: '',
  cronExpr: '',
  scheduleDescription: '',
};

const EMPTY_REQUIREMENT_BINDING: RequirementBinding = {
  source: '',
  reference: '',
  note: '',
};

const normalizeHookNames = (value: unknown): string[] => {
  const enabledHooks = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && 'enabledHooks' in value
      ? (value as { enabledHooks?: unknown }).enabledHooks
      : undefined;

  if (!Array.isArray(enabledHooks)) {
    return [];
  }

  return [
    ...new Set(
      enabledHooks
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    ),
  ];
};

const normalizeSkillNames = (value: unknown): string[] => {
  const enabledSkills = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && 'enabledSkills' in value
      ? (value as { enabledSkills?: unknown }).enabledSkills
      : undefined;

  if (!Array.isArray(enabledSkills)) {
    return [];
  }

  return [
    ...new Set(
      enabledSkills
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    ),
  ];
};

function isMissingWorkspaceFileError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /ENOENT|no such file or directory|not found/i.test(message);
}

function createScheduleEditorState(job?: IContextSchedule | null): ProjectScheduleEditorState {
  if (!job) {
    return EMPTY_SCHEDULE_EDITOR_STATE;
  }

  return {
    name: job.name,
    enabled: job.enabled,
    message: job.target.kind === 'send_query' ? job.target.message : job.target.reason,
    cronExpr: job.schedule.kind === 'cron' ? job.schedule.expr : '',
    scheduleDescription: job.schedule.description,
  };
}

const resolveSkillTitle = (skill: SkillInfo): string => {
  return skill.openAIConfig?.interface?.displayName?.trim() || skill.name;
};

const resolveSkillSummary = (skill: SkillInfo): string => {
  return skill.openAIConfig?.interface?.shortDescription?.trim() || skill.description?.trim() || skill.name || '';
};

const resolveProjectSkillTitle = (capability: IProjectSkillCapability): string => {
  return capability.openAIDisplayName?.trim() || capability.name;
};

const resolveProjectSkillSummary = (capability: IProjectSkillCapability): string => {
  return capability.openAIShortDescription?.trim() || capability.description?.trim() || capability.name || '';
};

const stripSkillFrontMatter = (content: string): string => {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  const markdownBody = match ? content.slice(match[0].length) : content;
  return markdownBody.trim();
};

const resolveProjectSkillSelection = (
  snapshot: IProjectCapabilitySnapshot | null,
  fallbackNames: string[]
): SkillSelectionState => {
  const selectedNames = new Set<string>(fallbackNames);

  for (const capability of snapshot?.skills || []) {
    const normalizedId = capability.id.trim();
    if (normalizedId) {
      selectedNames.add(normalizedId);
      continue;
    }

    const normalizedName = capability.name.trim();
    if (normalizedName) {
      selectedNames.add(normalizedName);
    }
  }

  return { names: Array.from(selectedNames).toSorted((left, right) => left.localeCompare(right)) };
};

const normalizeRequirementBindings = (value: unknown): Record<string, RequirementBinding> => {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const bindings = (value as RequirementBindingFile).bindings;
  if (!bindings || typeof bindings !== 'object') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(bindings)
      .filter(([key]) => key.trim())
      .map(([key, binding]) => [
        key,
        {
          source: typeof binding?.source === 'string' ? binding.source : '',
          reference: typeof binding?.reference === 'string' ? binding.reference : '',
          note: typeof binding?.note === 'string' ? binding.note : '',
        },
      ])
  );
};

const serializeRequirementBindings = (bindings: Record<string, RequirementBinding>): string => {
  const normalizedBindings: Record<string, RequirementBinding> = {};
  for (const [key, binding] of Object.entries(bindings)) {
    const normalizedBinding = {
      source: binding.source.trim(),
      reference: binding.reference.trim(),
      note: binding.note.trim(),
    };
    if (normalizedBinding.source || normalizedBinding.reference || normalizedBinding.note) {
      normalizedBindings[key] = normalizedBinding;
    }
  }

  return `${JSON.stringify(
    {
      schemaVersion: 'project-requirement-bindings.v1',
      bindings: normalizedBindings,
    },
    null,
    2
  )}\n`;
};

const getRequirementBinding = (
  bindings: Record<string, RequirementBinding>,
  requirementId: string
): RequirementBinding => bindings[requirementId] || EMPTY_REQUIREMENT_BINDING;

const resolveConversationPackageAssistantId = (conversation: TChatConversation): string | undefined => {
  const extra = conversation.extra as { presetAssistantId?: unknown; customAgentId?: unknown } | undefined;
  const rawId =
    typeof extra?.presetAssistantId === 'string' && extra.presetAssistantId.trim()
      ? extra.presetAssistantId.trim()
      : typeof extra?.customAgentId === 'string' && extra.customAgentId.trim()
        ? extra.customAgentId.trim()
        : '';

  if (!rawId) {
    return undefined;
  }

  return rawId.startsWith('builtin-') ? rawId : `builtin-${rawId}`;
};

const compactDetail = (parts: Array<string | undefined>): string | undefined => {
  const detail = parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(' · ');
  return detail || undefined;
};

const buildPackageRequirementOwnerLabel = (
  ownerSkillNames: readonly string[] | undefined,
  fallbackLabel: string
): string => {
  return ownerSkillNames?.length ? ownerSkillNames.join(', ') : fallbackLabel;
};

const buildPackageRequirementRows = (
  requirements: AgentPackageRequirementsPayload | undefined,
  packageLabel: string
): ProjectRequirementRow[] => {
  if (!requirements) {
    return [];
  }

  const rows: ProjectRequirementRow[] = [];

  for (const tool of requirements.tools || []) {
    rows.push({
      id: `package:tool:${tool.id}`,
      ownerLabel: buildPackageRequirementOwnerLabel(tool.ownerSkillNames, packageLabel),
      kind: tool.kind === 'mcp' ? 'mcp' : tool.kind === 'cli' ? 'command' : 'tool',
      label: tool.label,
      status: tool.required ? 'missing' : 'info',
      source: 'package',
      detail: compactDetail([
        tool.description,
        tool.mcp?.url,
        tool.mcp?.command,
        tool.mcp?.envRefs?.length ? `env: ${tool.mcp.envRefs.join(', ')}` : undefined,
      ]),
    });
  }

  for (const credential of requirements.credentials || []) {
    rows.push({
      id: `package:credential:${credential.id}`,
      ownerLabel: buildPackageRequirementOwnerLabel(credential.ownerSkillNames, packageLabel),
      kind: 'credential',
      label: credential.label,
      status: credential.required ? 'missing' : 'info',
      source: 'package',
      detail: compactDetail([
        credential.description,
        credential.provider ? `provider: ${credential.provider}` : undefined,
        credential.env ? `env: ${credential.env}` : undefined,
        credential.scopes?.length ? `scopes: ${credential.scopes.join(', ')}` : undefined,
      ]),
    });
  }

  for (const connector of requirements.connectors || []) {
    rows.push({
      id: `package:connector:${connector.id}`,
      ownerLabel: buildPackageRequirementOwnerLabel(connector.ownerSkillNames, packageLabel),
      kind: 'connector',
      label: connector.label,
      status: connector.required ? 'missing' : 'info',
      source: 'package',
      detail: compactDetail([
        connector.description,
        connector.connectorType ? `connector: ${connector.connectorType}` : undefined,
        connector.capabilities?.length ? `capabilities: ${connector.capabilities.join(', ')}` : undefined,
        connector.scopes?.length ? `scopes: ${connector.scopes.join(', ')}` : undefined,
      ]),
    });
  }

  return rows;
};

const resolveRequirementStatus = (
  status: ProjectRequirementRow['status'],
  binding: RequirementBinding
): ProjectRequirementRow['status'] => {
  if (binding.source.trim() && binding.reference.trim()) {
    return 'ready';
  }

  return status;
};

const ProjectAutomationModal: React.FC<ProjectAutomationModalProps> = ({ visible, conversation, onClose }) => {
  const { t } = useTranslation();
  const [messageApi, messageContext] = Message.useMessage();
  const [activeTab, setActiveTab] = useState<AutomationTabKey>('skills');
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleDeleting, setScheduleDeleting] = useState(false);
  const [scheduleRunningNow, setScheduleRunningNow] = useState(false);
  const [hooksLoading, setHooksLoading] = useState(false);
  const [hooksSaving, setHooksSaving] = useState(false);
  const [availableHooks, setAvailableHooks] = useState<HookInfo[]>([]);
  const [selectedHooks, setSelectedHooks] = useState<string[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [availableSkills, setAvailableSkills] = useState<SkillInfo[]>([]);
  const [projectCapabilitySnapshot, setProjectCapabilitySnapshot] = useState<IProjectCapabilitySnapshot | null>(null);
  const [requirementBindings, setRequirementBindings] = useState<Record<string, RequirementBinding>>({});
  const [requirementsSaving, setRequirementsSaving] = useState(false);
  const [previewingSkill, setPreviewingSkill] = useState<SkillPreviewState | null>(null);
  const [skillPreviewContent, setSkillPreviewContent] = useState('');
  const [skillPreviewLoading, setSkillPreviewLoading] = useState(false);
  const directCreateContext = useMemo(() => getScheduleDirectCreateContext(conversation), [conversation]);
  const workspacePath = useMemo(() => getConversationWorkspacePath(conversation), [conversation]);
  const spaceId = conversation.extra?.spaceId;
  const automationPaths = useMemo(
    () => (workspacePath ? getWorkspaceAutomationPaths(workspacePath) : null),
    [workspacePath]
  );
  const workspaceDisplayName = useMemo(
    () => (workspacePath ? getWorkspaceDisplayName(workspacePath, t) : null),
    [workspacePath, t]
  );
  const workspaceIsTemporary = useMemo(
    () => (workspacePath ? isTemporaryWorkspace(workspacePath) : false),
    [workspacePath]
  );
  const { jobs, loading, updateJob, deleteJob, runJobNow } = useScheduleJobs(conversation.id);
  const currentBackend = useMemo(() => resolveConversationHookBackend(conversation), [conversation]);
  const existingJob = jobs[0] ?? null;
  const [scheduleState, setScheduleState] = useState<ProjectScheduleEditorState>(EMPTY_SCHEDULE_EDITOR_STATE);
  const incompatibleHookNameSet = useMemo(
    () => new Set(getIncompatibleHookNames(availableHooks, selectedHooks, currentBackend)),
    [availableHooks, currentBackend, selectedHooks]
  );
  const presetAssistant = usePresetAssistantInfo(conversation);
  const packageAssistantId = useMemo(() => resolveConversationPackageAssistantId(conversation), [conversation]);
  const packageRequirementRows = useMemo(
    () =>
      buildPackageRequirementRows(
        packageAssistantId ? getBundledAgentPackageRequirements(packageAssistantId) : undefined,
        presetAssistant.info?.name ||
          packageAssistantId ||
          t('conversation.workspace.automation.requirementsPackageFallback', { defaultValue: 'Agent package' })
      ),
    [packageAssistantId, presetAssistant.info?.name, t]
  );
  const conversationEnabledSkills = useMemo(
    () => normalizeSkillNames((conversation.extra as { enabledSkills?: unknown } | undefined)?.enabledSkills),
    [conversation]
  );
  const skillSelection = useMemo(
    () => resolveProjectSkillSelection(projectCapabilitySnapshot, conversationEnabledSkills),
    [conversationEnabledSkills, projectCapabilitySnapshot]
  );
  const selectedSkillNameSet = useMemo(() => new Set(skillSelection.names), [skillSelection.names]);
  const previewSkillBody = useMemo(() => stripSkillFrontMatter(skillPreviewContent), [skillPreviewContent]);
  const availableProjectSkills = useMemo(
    () =>
      (projectCapabilitySnapshot?.skills || [])
        .map((capability) => {
          const matchedSkill = availableSkills.find(
            (skill) => skill.name === capability.name || skill.name === capability.id
          );

          return {
            capability,
            matchedSkill,
          };
        })
        .toSorted((left, right) => {
          const leftTitle = left.matchedSkill
            ? resolveSkillTitle(left.matchedSkill)
            : resolveProjectSkillTitle(left.capability);
          const rightTitle = right.matchedSkill
            ? resolveSkillTitle(right.matchedSkill)
            : resolveProjectSkillTitle(right.capability);
          return leftTitle.localeCompare(rightTitle);
        }),
    [availableSkills, projectCapabilitySnapshot]
  );
  const projectRequirementRows = useMemo<ProjectRequirementRow[]>(() => {
    const seen = new Set<string>();
    const rows: ProjectRequirementRow[] = [...packageRequirementRows];
    for (const row of packageRequirementRows) {
      seen.add(row.id);
    }

    for (const { capability, matchedSkill } of availableProjectSkills) {
      const ownerLabel = matchedSkill ? resolveSkillTitle(matchedSkill) : resolveProjectSkillTitle(capability);
      const hints = [...(capability.dependencyHints || []), ...(matchedSkill?.dependencyHints || [])];

      for (const hint of hints) {
        const id = `${capability.id || capability.name}:${hint.source}:${hint.kind}:${hint.label}`;
        if (seen.has(id)) {
          continue;
        }

        seen.add(id);
        rows.push({
          id,
          ownerLabel,
          kind: hint.kind,
          label: hint.label,
          status: hint.status,
          source: hint.source,
          detail: hint.detail,
        });
      }
    }

    return rows.toSorted((left, right) => {
      if (left.status !== right.status) {
        return left.status === 'missing'
          ? -1
          : right.status === 'missing'
            ? 1
            : left.status.localeCompare(right.status);
      }

      return `${left.ownerLabel}:${left.label}`.localeCompare(`${right.ownerLabel}:${right.label}`);
    });
  }, [availableProjectSkills, packageRequirementRows]);

  useEffect(() => {
    if (!visible) {
      setPreviewingSkill(null);
      setSkillPreviewContent('');
      setSkillPreviewLoading(false);
      return;
    }

    setActiveTab('skills');
    setScheduleState(createScheduleEditorState(existingJob));
  }, [existingJob, visible]);

  const loadProjectCommandLibrary = useCallback(async (): Promise<ManagedSlashCommandRecord[]> => {
    if (!automationPaths) {
      return [];
    }

    try {
      const raw = await ipcBridge.fs.readFile.invoke({ path: automationPaths.commandsFile });
      return normalizeManagedSlashCommandLibrary(JSON.parse(raw));
    } catch (error) {
      if (!isMissingWorkspaceFileError(error)) {
        throw error;
      }
      return [];
    }
  }, [automationPaths]);

  const loadSpaceCommandLibrary = useCallback(async (): Promise<ManagedSlashCommandRecord[]> => {
    if (!spaceId) {
      return [];
    }

    return ipcBridge.space.getCommandLibrary.invoke({ id: spaceId });
  }, [spaceId]);

  const saveProjectCommandLibrary = useCallback(
    async (nextLibrary: ManagedSlashCommandRecord[]) => {
      if (!automationPaths) {
        return;
      }

      await ipcBridge.fs.writeFile.invoke({
        path: automationPaths.commandsFile,
        data: `${JSON.stringify(nextLibrary, null, 2)}\n`,
      });
    },
    [automationPaths]
  );

  const saveSpaceCommandLibrary = useCallback(
    async (nextLibrary: ManagedSlashCommandRecord[]) => {
      if (!spaceId) {
        return;
      }

      await ipcBridge.space.saveCommandLibrary.invoke({
        id: spaceId,
        commands: nextLibrary,
      });
    },
    [spaceId]
  );

  const validateScheduleInput = useCallback((): ProjectScheduleEditorState | null => {
    const name = scheduleState.name.trim();
    const message = scheduleState.message.trim();
    const scheduleDescription = scheduleState.scheduleDescription.trim();
    const cronExpr = scheduleState.cronExpr.trim();

    if (!name) {
      messageApi.error(t('conversation.workspace.automation.scheduleEditor.validation.nameRequired'));
      return null;
    }

    if (!message) {
      messageApi.error(t('conversation.workspace.automation.scheduleEditor.validation.messageRequired'));
      return null;
    }

    if (!existingJob || existingJob.schedule.kind === 'cron') {
      if (!cronExpr) {
        messageApi.error(t('conversation.workspace.automation.scheduleEditor.validation.cronRequired'));
        return null;
      }

      if (!scheduleDescription) {
        messageApi.error(t('conversation.workspace.automation.scheduleEditor.validation.descriptionRequired'));
        return null;
      }
    }

    return {
      name,
      enabled: scheduleState.enabled,
      message,
      cronExpr,
      scheduleDescription,
    };
  }, [existingJob, messageApi, scheduleState, t]);

  const handleSaveSchedule = useCallback(async () => {
    const normalized = validateScheduleInput();
    if (!normalized || !directCreateContext) {
      return;
    }

    setScheduleSaving(true);
    try {
      if (existingJob) {
        const nextSchedule: IScheduleSpec | undefined =
          existingJob.schedule.kind === 'cron'
            ? {
                kind: 'cron',
                expr: normalized.cronExpr,
                description: normalized.scheduleDescription,
                tz: existingJob.schedule.tz,
              }
            : undefined;

        await updateJob(existingJob.id, {
          name: normalized.name,
          enabled: normalized.enabled,
          schedule: nextSchedule,
          target:
            existingJob.target.kind === 'send_query'
              ? {
                  ...existingJob.target,
                  message: normalized.message,
                }
              : existingJob.target,
        });

        messageApi.success(t('common.saveSuccess'));
        return;
      }

      await ipcBridge.schedule.createConversationSchedule.invoke({
        name: normalized.name,
        schedule: {
          kind: 'cron',
          expr: normalized.cronExpr,
          description: normalized.scheduleDescription,
        },
        message: normalized.message,
        conversationId: directCreateContext.conversationId,
        conversationTitle: directCreateContext.conversationTitle,
        workspacePath: directCreateContext.workspacePath,
        agentType: directCreateContext.agentType,
        createdBy: 'user',
      });

      messageApi.success(t('common.createSuccess'));
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : t('common.unknownError'));
    } finally {
      setScheduleSaving(false);
    }
  }, [directCreateContext, existingJob, messageApi, t, updateJob, validateScheduleInput]);

  const handleDeleteSchedule = useCallback(async () => {
    if (!existingJob) {
      return;
    }

    setScheduleDeleting(true);
    try {
      await deleteJob(existingJob.id);
      messageApi.success(t('schedule.deleteSuccess'));
      setScheduleState(EMPTY_SCHEDULE_EDITOR_STATE);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : t('common.unknownError'));
    } finally {
      setScheduleDeleting(false);
    }
  }, [deleteJob, existingJob, messageApi, t]);

  const handleRunScheduleNow = useCallback(async () => {
    if (!existingJob) {
      return;
    }

    setScheduleRunningNow(true);
    try {
      await runJobNow(existingJob.id);
      messageApi.success(t('schedule.runNowSuccess'));
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : t('common.unknownError'));
    } finally {
      setScheduleRunningNow(false);
    }
  }, [existingJob, messageApi, runJobNow, t]);

  const loadSelectedHooks = useCallback(async (): Promise<string[]> => {
    if (!automationPaths) {
      return getConversationEnabledHooks(conversation);
    }

    try {
      const raw = await ipcBridge.fs.readFile.invoke({ path: automationPaths.hooksFile });
      if (typeof raw !== 'string') {
        return getConversationEnabledHooks(conversation);
      }

      return normalizeHookNames(JSON.parse(raw) as unknown);
    } catch (error) {
      if (!isMissingWorkspaceFileError(error)) {
        console.warn('Failed to parse workspace hook selection:', automationPaths.hooksFile, error);
        return [];
      }

      return getConversationEnabledHooks(conversation);
    }
  }, [automationPaths, conversation]);

  const handleRefreshHooks = useEffectEvent(async (): Promise<HookInfo[]> => {
    setHooksLoading(true);
    try {
      const [hooks, enabledHooks] = await Promise.all([
        workspacePath
          ? ipcBridge.fs.listAvailableHooks.invoke({ workspacePath })
          : ipcBridge.fs.listAvailableHooks.invoke({}),
        loadSelectedHooks(),
      ]);
      setAvailableHooks(hooks);
      setSelectedHooks(enabledHooks);
      return hooks;
    } catch (error) {
      console.error('Failed to load session hooks:', error);
      messageApi.error(t('conversation.workspace.sessionHooksLoadFailed', { defaultValue: 'Failed to load hooks' }));
      setAvailableHooks([]);
      setSelectedHooks(await loadSelectedHooks());
      return [];
    } finally {
      setHooksLoading(false);
    }
  });

  const loadRequirementBindings = useCallback(async (): Promise<Record<string, RequirementBinding>> => {
    if (!automationPaths) {
      return {};
    }

    try {
      const raw = await ipcBridge.fs.readFile.invoke({ path: automationPaths.requirementBindingsFile });
      if (typeof raw !== 'string' || !raw.trim()) {
        return {};
      }

      return normalizeRequirementBindings(JSON.parse(raw) as unknown);
    } catch (error) {
      if (!isMissingWorkspaceFileError(error)) {
        console.warn('Failed to load project requirement bindings:', automationPaths.requirementBindingsFile, error);
        messageApi.error(
          t('conversation.workspace.automation.requirementsLoadFailed', {
            defaultValue: 'Failed to load project requirement bindings',
          })
        );
      }
      return {};
    }
  }, [automationPaths, messageApi, t]);

  const handleRefreshSkills = useEffectEvent(async () => {
    if (!workspacePath) {
      setAvailableSkills([]);
      setProjectCapabilitySnapshot(null);
      setRequirementBindings({});
      return;
    }

    setSkillsLoading(true);
    try {
      const [skills, snapshot, bindings] = await Promise.all([
        ipcBridge.fs.listAvailableSkills.invoke({ workspacePath }),
        ipcBridge.conversation.getProjectCapabilitySnapshot.invoke({ workspacePath }),
        loadRequirementBindings(),
      ]);
      setAvailableSkills(skills);
      setProjectCapabilitySnapshot(snapshot || null);
      setRequirementBindings(bindings);
    } catch (error) {
      console.error('Failed to load project skills:', error);
      messageApi.error(
        t('conversation.workspace.automation.skillsLoadFailed', { defaultValue: 'Failed to load project skills' })
      );
      setAvailableSkills([]);
      setProjectCapabilitySnapshot(null);
      setRequirementBindings({});
    } finally {
      setSkillsLoading(false);
    }
  });

  const handleCloseSkillPreview = useCallback(() => {
    if (skillPreviewLoading) {
      return;
    }

    setPreviewingSkill(null);
    setSkillPreviewContent('');
  }, [skillPreviewLoading]);

  const handleOpenSkillPreview = useCallback(
    async (capability: IProjectSkillCapability, skill?: SkillInfo) => {
      const mirroredSkillBody = capability.skillDocumentBody?.trim();
      const previewTitle = skill ? resolveSkillTitle(skill) : resolveProjectSkillTitle(capability);
      const previewSourcePath =
        capability.skillDocumentRelativePath || skill?.location || capability.workspaceRelativePath;

      setPreviewingSkill({
        title: previewTitle,
        sourcePath: previewSourcePath,
      });
      setSkillPreviewContent(mirroredSkillBody || '');

      if (mirroredSkillBody) {
        setSkillPreviewLoading(false);
        return;
      }

      if (!skill?.location) {
        setPreviewingSkill(null);
        messageApi.error(t('settings.assistantSkillPreviewFailed', { defaultValue: 'Failed to load skill content.' }));
        return;
      }

      setSkillPreviewLoading(true);

      try {
        const result = await ipcBridge.fs.readSkillContent.invoke({ skillPath: skill.location });
        if (!result.success || !result.data?.content) {
          setPreviewingSkill(null);
          messageApi.error(
            result.msg || t('settings.assistantSkillPreviewFailed', { defaultValue: 'Failed to load skill content.' })
          );
          return;
        }

        setSkillPreviewContent(result.data.content);
      } catch (error) {
        console.error('Failed to preview skill content:', error);
        setPreviewingSkill(null);
        messageApi.error(t('settings.assistantSkillPreviewFailed', { defaultValue: 'Failed to load skill content.' }));
      } finally {
        setSkillPreviewLoading(false);
      }
    },
    [messageApi, t]
  );

  useEffect(() => {
    if (visible && activeTab === 'hooks') {
      void handleRefreshHooks();
    }
    // useEffectEvent handlers must NOT be used as effect deps; they are intentionally stable-call, unstable-identity.
    // Depend only on real triggering state.
  }, [activeTab, visible, workspacePath]);

  useEffect(() => {
    if (visible && (activeTab === 'skills' || activeTab === 'requirements')) {
      void handleRefreshSkills();
    }
    // useEffectEvent handlers must NOT be used as effect deps; they are intentionally stable-call, unstable-identity.
    // Depend only on real triggering state.
  }, [activeTab, visible, workspacePath]);

  const handleSaveHooks = useCallback(async () => {
    setHooksSaving(true);
    try {
      const incompatibleHookNames = getIncompatibleHookNames(availableHooks, selectedHooks, currentBackend);
      if (incompatibleHookNames.length > 0) {
        messageApi.error(
          t('settings.hookSaveIncompatible', {
            hooks: incompatibleHookNames.join(', '),
            defaultValue: 'Remove hooks not supported by the selected agent before saving: {{hooks}}',
          })
        );
        return;
      }

      const normalizedSelection = normalizeHookNames(selectedHooks);

      if (automationPaths) {
        await ipcBridge.fs.writeFile.invoke({
          path: automationPaths.hooksFile,
          data:
            JSON.stringify(
              {
                enabledHooks: normalizedSelection,
              },
              null,
              2
            ) + '\n',
        });
      }

      const mirrorSaved = await ipcBridge.conversation.update.invoke({
        id: conversation.id,
        updates: {
          extra: {
            enabledHooks: normalizedSelection,
          },
        },
        mergeExtra: true,
      });

      if (!automationPaths && !mirrorSaved) {
        messageApi.error(
          t('conversation.workspace.sessionHooksSaveFailed', {
            defaultValue: 'Failed to save session hooks',
          })
        );
        return;
      }

      if (automationPaths && !mirrorSaved) {
        console.warn('Failed to mirror workspace hook selection into conversation extra:', conversation.id);
      }

      messageApi.success(
        t('conversation.workspace.sessionHooksSaved', {
          defaultValue: 'Session hooks updated',
        })
      );
      void handleRefreshHooks();
    } catch (error) {
      console.error('Failed to save session hooks:', error);
      messageApi.error(
        t('conversation.workspace.sessionHooksSaveFailed', {
          defaultValue: 'Failed to save session hooks',
        })
      );
    } finally {
      setHooksSaving(false);
    }
  }, [
    automationPaths,
    availableHooks,
    conversation.id,
    currentBackend,
    handleRefreshHooks,
    messageApi,
    selectedHooks,
    t,
  ]);

  const handleRequirementBindingChange = useCallback(
    (requirementId: string, field: keyof RequirementBinding, value: string) => {
      setRequirementBindings((current) => ({
        ...current,
        [requirementId]: {
          ...getRequirementBinding(current, requirementId),
          [field]: value,
        },
      }));
    },
    []
  );

  const handleSaveRequirementBindings = useCallback(async () => {
    if (!automationPaths) {
      return;
    }

    setRequirementsSaving(true);
    try {
      await ipcBridge.fs.writeFile.invoke({
        path: automationPaths.requirementBindingsFile,
        data: serializeRequirementBindings(requirementBindings),
      });
      messageApi.success(
        t('conversation.workspace.automation.requirementsSaveSuccess', {
          defaultValue: 'Project requirement bindings saved',
        })
      );
    } catch (error) {
      console.error('Failed to save project requirement bindings:', error);
      messageApi.error(
        t('conversation.workspace.automation.requirementsSaveFailed', {
          defaultValue: 'Failed to save project requirement bindings',
        })
      );
    } finally {
      setRequirementsSaving(false);
    }
  }, [automationPaths, messageApi, requirementBindings, t]);

  const scheduleStatus = existingJob ? getJobStatusFlags(existingJob) : null;

  return (
    <SettingsSubModal
      visible={visible}
      title={t('conversation.workspace.automation.modalTitle')}
      onCancel={onClose}
      footer={null}
      unmountOnExit
      style={{ width: 'min(1100px, calc(100vw - 32px))' }}
      contentStyle={{ padding: '12px 24px 24px', maxHeight: 'min(82vh, 920px)', overflow: 'auto' }}
    >
      {messageContext}
      <div className='flex flex-col gap-16px'>
        <div className='rounded-16px border border-solid border-[var(--color-border-2)] bg-[var(--color-fill-1)] p-16px'>
          <Typography.Paragraph className='mb-0 text-t-secondary'>
            {t('conversation.workspace.automation.modalDescription')}
          </Typography.Paragraph>
          <div className='mt-12px grid gap-12px md:grid-cols-2'>
            <div className='rounded-12px bg-[var(--color-bg-1)] p-12px'>
              <Typography.Text bold>{t('conversation.workspace.automation.sessionTitle')}</Typography.Text>
              <Typography.Paragraph className='mb-0 mt-8px text-t-secondary'>
                {t('conversation.workspace.automation.sessionDescription')}
              </Typography.Paragraph>
              <Typography.Paragraph className='mb-0 mt-8px text-t-secondary'>
                {t('conversation.workspace.automation.sessionConversationLabel')}: {conversation.name}
              </Typography.Paragraph>
            </div>
            <div className='rounded-12px bg-[var(--color-bg-1)] p-12px'>
              <Typography.Text bold>{t('conversation.workspace.automation.workspaceTitle')}</Typography.Text>
              <Typography.Paragraph className='mb-0 mt-8px text-t-secondary'>
                {t('conversation.workspace.automation.workspaceDescription')}
              </Typography.Paragraph>
              {workspaceDisplayName ? (
                <Typography.Paragraph className='mb-0 mt-8px text-t-secondary'>
                  {t('conversation.workspace.automation.workspaceLabel')}: {workspaceDisplayName}
                </Typography.Paragraph>
              ) : (
                <Typography.Paragraph className='mb-0 mt-8px text-t-secondary'>
                  {t('conversation.workspace.automation.workspaceUnavailable')}
                </Typography.Paragraph>
              )}
              {workspaceDisplayName && workspaceIsTemporary ? (
                <Typography.Paragraph className='mb-0 mt-8px text-t-secondary'>
                  {t('conversation.workspace.automation.workspaceTemporaryHint')}
                </Typography.Paragraph>
              ) : null}
            </div>
          </div>
        </div>
        <div className='rounded-16px border border-solid border-[var(--color-border-2)] bg-[var(--color-bg-1)] p-16px'>
          <Tabs activeTab={activeTab} onChange={(value) => setActiveTab(value as AutomationTabKey)}>
            <Tabs.TabPane key='skills' title={t('conversation.workspace.automation.skillsTitle')}>
              <div className='mt-8px'>
                <AutomationPanel
                  title={t('conversation.workspace.automation.skillsTitle')}
                  description={t('conversation.workspace.automation.skillsDescription')}
                  icon={<Tips theme='outline' size='18' className='app-icon text-t-primary' />}
                  meta={
                    <div className='flex flex-col gap-8px'>
                      {automationPaths ? (
                        <Typography.Text type='secondary'>
                          {t('conversation.workspace.automation.skillsPathHint', { path: automationPaths.skillsDir })}
                        </Typography.Text>
                      ) : null}
                      {presetAssistant.info ? (
                        <Typography.Text type='secondary'>
                          {t('conversation.workspace.automation.skillsAssistantLabel')}: {presetAssistant.info.name}
                        </Typography.Text>
                      ) : null}
                    </div>
                  }
                  actions={
                    <Button
                      type='secondary'
                      icon={<Refresh size={14} className={skillsLoading ? 'animate-spin' : ''} />}
                      onClick={() => void handleRefreshSkills()}
                    >
                      {t('common.refresh', { defaultValue: 'Refresh' })}
                    </Button>
                  }
                >
                  <AutomationSectionCard
                    title={t('conversation.workspace.automation.skillsSelectedTitle')}
                    description={t('conversation.workspace.automation.skillsSelectedDescription')}
                    extra={<span>{skillSelection.names.length}</span>}
                  >
                    {skillSelection.names.length > 0 ? (
                      <div className='flex flex-wrap gap-8px'>
                        {skillSelection.names.map((name) => (
                          <Tag key={name} color='arcoblue'>
                            {name}
                          </Tag>
                        ))}
                      </div>
                    ) : (
                      <Typography.Paragraph className='mb-0 text-t-secondary'>
                        {t('conversation.workspace.automation.skillsSelectedEmpty')}
                      </Typography.Paragraph>
                    )}
                  </AutomationSectionCard>

                  <AutomationSectionCard
                    title={t('conversation.workspace.automation.skillsAvailableTitle')}
                    description={t('conversation.workspace.automation.skillsAvailableDescription')}
                    extra={<span>{availableProjectSkills.length}</span>}
                  >
                    {skillsLoading ? (
                      <div className='py-16px text-center text-12px text-t-secondary'>{t('common.loading')}</div>
                    ) : availableProjectSkills.length > 0 ? (
                      <div className='flex flex-col gap-8px'>
                        {availableProjectSkills.map(({ capability, matchedSkill }) => {
                          const isSelected =
                            selectedSkillNameSet.has(capability.name) || selectedSkillNameSet.has(capability.id);
                          const canPreview = Boolean(capability.skillDocumentBody?.trim() || matchedSkill?.location);
                          return (
                            <div
                              key={capability.docKey}
                              className={`rounded-12px border border-solid border-[var(--color-border-2)] bg-[var(--color-fill-1)] p-12px transition-colors ${
                                canPreview ? 'cursor-pointer hover:bg-[var(--color-fill-2)]' : ''
                              }`}
                              role={canPreview ? 'button' : undefined}
                              tabIndex={canPreview ? 0 : undefined}
                              onClick={
                                canPreview ? () => void handleOpenSkillPreview(capability, matchedSkill) : undefined
                              }
                              onKeyDown={
                                canPreview
                                  ? (event) => {
                                      if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        void handleOpenSkillPreview(capability, matchedSkill);
                                      }
                                    }
                                  : undefined
                              }
                            >
                              <div className='flex flex-wrap items-start justify-between gap-12px'>
                                <div className='min-w-0 flex-1'>
                                  <div className='flex flex-wrap items-center gap-6px'>
                                    <Typography.Text bold>
                                      {matchedSkill
                                        ? resolveSkillTitle(matchedSkill)
                                        : resolveProjectSkillTitle(capability)}
                                    </Typography.Text>
                                    {isSelected ? (
                                      <Tag size='small' color='green'>
                                        {t('conversation.workspace.automation.skillsSelectedTag')}
                                      </Tag>
                                    ) : null}
                                    {capability.implicitInvocation ? (
                                      <Tag size='small' color='gold'>
                                        {t('conversation.workspace.automation.skillsImplicitTag')}
                                      </Tag>
                                    ) : null}
                                    {canPreview ? (
                                      <Tag size='small' color='arcoblue'>
                                        {t('conversation.workspace.contextMenu.preview')}
                                      </Tag>
                                    ) : null}
                                  </div>
                                  <Typography.Paragraph className='mb-0 mt-6px text-t-secondary'>
                                    {matchedSkill
                                      ? resolveSkillSummary(matchedSkill)
                                      : resolveProjectSkillSummary(capability)}
                                  </Typography.Paragraph>
                                  <Typography.Paragraph className='mb-0 mt-6px break-all text-12px text-t-tertiary'>
                                    {capability.workspaceRelativePath}
                                  </Typography.Paragraph>
                                  {capability.compatibility.length > 0 ? (
                                    <div className='mt-8px flex flex-wrap gap-6px'>
                                      {capability.compatibility.slice(0, 3).map((item) => (
                                        <Tag
                                          key={`${capability.workspaceRelativePath}:${item}`}
                                          size='small'
                                          color='gray'
                                        >
                                          {item}
                                        </Tag>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : workspacePath ? (
                      <Typography.Paragraph className='mb-0 text-t-secondary'>
                        {t('conversation.workspace.automation.skillsEmpty')}
                      </Typography.Paragraph>
                    ) : (
                      <Typography.Paragraph className='mb-0 text-t-secondary'>
                        {t('conversation.workspace.automation.workspaceUnavailable')}
                      </Typography.Paragraph>
                    )}
                  </AutomationSectionCard>
                </AutomationPanel>
              </div>
            </Tabs.TabPane>

            <Tabs.TabPane key='requirements' title={t('conversation.workspace.automation.requirementsTitle')}>
              <div className='mt-8px'>
                <AutomationPanel
                  title={t('conversation.workspace.automation.requirementsTitle')}
                  description={t('conversation.workspace.automation.requirementsDescription')}
                  icon={<ConnectionPoint theme='outline' size='18' className='app-icon text-t-primary' />}
                  meta={
                    <div className='flex flex-col gap-8px'>
                      {automationPaths ? (
                        <Typography.Text type='secondary'>
                          {t('conversation.workspace.automation.requirementsPathHint', {
                            path: automationPaths.requirementBindingsFile,
                          })}
                        </Typography.Text>
                      ) : null}
                      <Typography.Text type='secondary'>
                        {t('conversation.workspace.automation.requirementsNoSecretsHint')}
                      </Typography.Text>
                    </div>
                  }
                  actions={
                    <div className='flex flex-wrap gap-8px'>
                      <Button
                        type='secondary'
                        icon={<Refresh size={14} className={skillsLoading ? 'animate-spin' : ''} />}
                        onClick={() => void handleRefreshSkills()}
                      >
                        {t('common.refresh', { defaultValue: 'Refresh' })}
                      </Button>
                      <Button
                        type='primary'
                        loading={requirementsSaving}
                        disabled={!automationPaths}
                        onClick={() => void handleSaveRequirementBindings()}
                      >
                        {t('conversation.workspace.automation.requirementsSave')}
                      </Button>
                    </div>
                  }
                >
                  <AutomationSectionCard
                    title={t('conversation.workspace.automation.requirementsBindingsTitle')}
                    description={t('conversation.workspace.automation.requirementsBindingsDescription')}
                    extra={<span>{projectRequirementRows.length}</span>}
                  >
                    {skillsLoading ? (
                      <div className='py-16px text-center text-12px text-t-secondary'>{t('common.loading')}</div>
                    ) : projectRequirementRows.length > 0 ? (
                      <div className='flex flex-col gap-8px'>
                        {projectRequirementRows.map((requirement) => {
                          const binding = getRequirementBinding(requirementBindings, requirement.id);
                          const status = resolveRequirementStatus(requirement.status, binding);
                          const statusColor = status === 'ready' ? 'green' : status === 'missing' ? 'red' : 'gray';
                          const statusLabel =
                            status === 'ready'
                              ? t('conversation.workspace.automation.requirementsReady')
                              : status === 'missing'
                                ? t('conversation.workspace.automation.requirementsMissing')
                                : t('conversation.workspace.automation.requirementsInfo');
                          const kindLabel =
                            requirement.kind === 'env'
                              ? t('conversation.workspace.automation.requirementsKind.env')
                              : requirement.kind === 'command'
                                ? t('conversation.workspace.automation.requirementsKind.command')
                                : requirement.kind === 'network'
                                  ? t('conversation.workspace.automation.requirementsKind.network')
                                  : requirement.kind === 'mcp'
                                    ? t('conversation.workspace.automation.requirementsKind.mcp')
                                    : requirement.kind === 'credential'
                                      ? t('conversation.workspace.automation.requirementsKind.credential')
                                      : requirement.kind === 'connector'
                                        ? t('conversation.workspace.automation.requirementsKind.connector')
                                        : requirement.kind === 'tool'
                                          ? t('conversation.workspace.automation.requirementsKind.tool')
                                          : t('conversation.workspace.automation.requirementsKind.note');

                          return (
                            <div
                              key={requirement.id}
                              className='rounded-12px border border-solid border-[var(--color-border-2)] bg-[var(--color-fill-1)] p-12px'
                            >
                              <div className='flex flex-wrap items-start justify-between gap-12px'>
                                <div className='min-w-0 flex-1'>
                                  <div className='flex flex-wrap items-center gap-6px'>
                                    <Typography.Text bold>{requirement.label}</Typography.Text>
                                    <Tag size='small' color={statusColor}>
                                      {statusLabel}
                                    </Tag>
                                    <Tag size='small' color='arcoblue'>
                                      {kindLabel}
                                    </Tag>
                                  </div>
                                  <Typography.Paragraph className='mb-0 mt-6px text-t-secondary'>
                                    {t('conversation.workspace.automation.requirementsOwnerLabel')}:{' '}
                                    {requirement.ownerLabel}
                                  </Typography.Paragraph>
                                  {requirement.detail ? (
                                    <Typography.Paragraph className='mb-0 mt-6px text-12px text-t-tertiary'>
                                      {requirement.detail}
                                    </Typography.Paragraph>
                                  ) : null}
                                </div>
                              </div>
                              <div className='mt-12px grid gap-8px md:grid-cols-3'>
                                <Input
                                  value={binding.source}
                                  placeholder={t('conversation.workspace.automation.requirementsSourcePlaceholder')}
                                  onChange={(value) => handleRequirementBindingChange(requirement.id, 'source', value)}
                                />
                                <Input
                                  value={binding.reference}
                                  placeholder={t('conversation.workspace.automation.requirementsReferencePlaceholder')}
                                  onChange={(value) =>
                                    handleRequirementBindingChange(requirement.id, 'reference', value)
                                  }
                                />
                                <Input
                                  value={binding.note}
                                  placeholder={t('conversation.workspace.automation.requirementsNotePlaceholder')}
                                  onChange={(value) => handleRequirementBindingChange(requirement.id, 'note', value)}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : workspacePath ? (
                      <Typography.Paragraph className='mb-0 text-t-secondary'>
                        {t('conversation.workspace.automation.requirementsEmpty')}
                      </Typography.Paragraph>
                    ) : (
                      <Typography.Paragraph className='mb-0 text-t-secondary'>
                        {t('conversation.workspace.automation.workspaceUnavailable')}
                      </Typography.Paragraph>
                    )}
                  </AutomationSectionCard>
                </AutomationPanel>
              </div>
            </Tabs.TabPane>

            <Tabs.TabPane key='hooks' title={t('conversation.workspace.sessionHooksTitle')}>
              <div className='mt-8px'>
                <AutomationPanel
                  title={t('conversation.workspace.sessionHooksTitle')}
                  description={t('conversation.workspace.sessionHooksHint')}
                  icon={<ConnectionPoint theme='outline' size='18' className='app-icon text-t-primary' />}
                  meta={
                    <div className='flex flex-col gap-8px'>
                      <Typography.Text type='secondary'>
                        {t('conversation.workspace.sessionHooksCurrentAgent', {
                          defaultValue: 'Current agent',
                        })}
                        : {currentBackend}
                      </Typography.Text>
                      {automationPaths ? (
                        <Typography.Text type='secondary' className='break-all'>
                          {automationPaths.hooksFile}
                        </Typography.Text>
                      ) : null}
                    </div>
                  }
                  actions={
                    <>
                      <Button
                        type='secondary'
                        icon={<Refresh size={14} className={hooksLoading ? 'animate-spin' : ''} />}
                        onClick={() => void handleRefreshHooks()}
                      >
                        {t('common.refresh', { defaultValue: 'Refresh' })}
                      </Button>
                      <Button type='primary' loading={hooksSaving} onClick={() => void handleSaveHooks()}>
                        {t('common.save', { defaultValue: 'Save' })}
                      </Button>
                    </>
                  }
                >
                  <AutomationSectionCard
                    title={t('conversation.workspace.sessionHooksAvailable', {
                      defaultValue: 'Available Hooks',
                    })}
                    extra={<span>{availableHooks.length}</span>}
                  >
                    {availableHooks.length > 0 ? (
                      <div className='flex flex-col gap-4px'>
                        {availableHooks.map((hook) => {
                          const isSupportedByCurrentAgent = isHookSupportedByBackend(hook, currentBackend);
                          const isSelected = selectedHooks.includes(hook.name);
                          const isSelectedButIncompatible = incompatibleHookNameSet.has(hook.name);

                          return (
                            <div
                              key={hook.name}
                              className='flex items-start gap-8px rounded-8px p-8px transition-colors hover:bg-fill-1'
                            >
                              <Checkbox
                                checked={isSelected}
                                disabled={!isSupportedByCurrentAgent && !isSelected}
                                className='mt-2px cursor-pointer'
                                onChange={() => {
                                  if (isSelected) {
                                    setSelectedHooks(selectedHooks.filter((item) => item !== hook.name));
                                  } else {
                                    setSelectedHooks([...selectedHooks, hook.name]);
                                  }
                                }}
                              />
                              <div className='min-w-0 flex-1'>
                                <div className='flex flex-wrap items-center gap-6px'>
                                  <div className='text-13px font-medium text-t-primary'>{hook.name}</div>
                                  {hook.executionType ? (
                                    <Tag size='small' color='arcoblue'>
                                      {hook.executionType}
                                    </Tag>
                                  ) : null}
                                  {hook.version ? (
                                    <Tag size='small' color='gray'>
                                      v{hook.version}
                                    </Tag>
                                  ) : null}
                                  {!isSupportedByCurrentAgent ? (
                                    <Tag size='small' color='red'>
                                      {t('settings.hookUnsupportedTag', { defaultValue: 'Unsupported' })}
                                    </Tag>
                                  ) : null}
                                </div>
                                {hook.description ? (
                                  <div className='mt-2px line-clamp-2 text-12px text-t-secondary'>
                                    {hook.description}
                                  </div>
                                ) : null}
                                {!isSupportedByCurrentAgent ? (
                                  <div className='mt-6px text-11px text-danger-6'>
                                    {isSelectedButIncompatible
                                      ? t('settings.hookSelectedButUnsupported', {
                                          defaultValue:
                                            'This hook is selected but will not run for the current agent. Remove it before saving.',
                                        })
                                      : t('settings.hookUnsupportedHint', {
                                          defaultValue: 'This hook does not support the current agent.',
                                        })}
                                  </div>
                                ) : null}
                                <div className='mt-6px break-all text-11px text-t-tertiary'>
                                  {t('settings.hookLocation', { defaultValue: 'Location' })}: {hook.location}
                                </div>
                                {hook.supportedBackends && hook.supportedBackends.length > 0 ? (
                                  <div className='mt-6px flex flex-wrap gap-4px'>
                                    <span className='text-11px text-t-tertiary'>
                                      {t('settings.hookSupportedBackends', {
                                        defaultValue: 'Supported backends',
                                      })}
                                      :
                                    </span>
                                    {hook.supportedBackends.map((backend) => (
                                      <Tag key={`${hook.name}-${backend}`} size='small' color='purple'>
                                        {backend}
                                      </Tag>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className='py-16px text-center text-12px text-t-secondary'>
                        {hooksLoading
                          ? t('common.loading')
                          : t('settings.noAvailableHooks', { defaultValue: 'No hooks found in the hook directory' })}
                      </div>
                    )}
                  </AutomationSectionCard>
                </AutomationPanel>
              </div>
            </Tabs.TabPane>

            <Tabs.TabPane key='commands' title={t('settings.commands.title')}>
              <div className='mt-8px'>
                {spaceId ? (
                  <ManagedCommandLibraryEditor
                    variant='embedded'
                    title={t('conversation.workspace.automation.spaceCommandsTitle', {
                      defaultValue: 'Space Commands',
                    })}
                    description={t('conversation.workspace.automation.spaceCommandsDescription', {
                      defaultValue:
                        'These commands are stored with the bound Space and are applied before project-local commands.',
                    })}
                    usageHint={t('conversation.workspace.automation.spaceCommandsUsageHint', {
                      defaultValue:
                        'Project Local Commands can override a Space command by slash name, case-insensitively.',
                    })}
                    loadLibrary={loadSpaceCommandLibrary}
                    saveLibrary={saveSpaceCommandLibrary}
                    onLibraryChanged={() => {
                      emitter.emit('commands.library.updated');
                    }}
                    headerMeta={
                      <Typography.Text type='secondary'>
                        {t('conversation.workspace.automation.spaceCommandsStorageHint', {
                          defaultValue: 'Stored in the current Space record.',
                        })}
                      </Typography.Text>
                    }
                  />
                ) : (
                  <AutomationPanel
                    title={t('conversation.workspace.automation.spaceCommandsTitle', {
                      defaultValue: 'Space Commands',
                    })}
                    description={t('conversation.workspace.automation.spaceCommandsDescription', {
                      defaultValue:
                        'These commands are stored with the bound Space and are applied before project-local commands.',
                    })}
                    icon={<Command theme='outline' size='18' className='app-icon text-t-primary' />}
                  >
                    <AutomationSectionCard>
                      <Typography.Paragraph className='mb-0 text-t-secondary'>
                        {t('conversation.workspace.automation.spaceUnavailable', {
                          defaultValue:
                            'This conversation is not bound to a Space yet, so Space Commands are unavailable.',
                        })}
                      </Typography.Paragraph>
                    </AutomationSectionCard>
                  </AutomationPanel>
                )}
                {automationPaths ? (
                  <div className='mt-16px'>
                    <ManagedCommandLibraryEditor
                      variant='embedded'
                      title={t('conversation.workspace.automation.projectCommandsTitle', {
                        defaultValue: 'Project Local Commands',
                      })}
                      description={t('conversation.workspace.automation.projectCommandsDescription', {
                        defaultValue:
                          'These commands are saved into `.contextgo/commands.json` for the current workspace and override Space Commands with the same slash name.',
                      })}
                      usageHint={t('conversation.workspace.automation.projectCommandsUsageHint', {
                        defaultValue:
                          'Use project-local commands for workspace-specific overrides and private slash templates.',
                      })}
                      loadLibrary={loadProjectCommandLibrary}
                      saveLibrary={saveProjectCommandLibrary}
                      onLibraryChanged={() => {
                        emitter.emit('commands.library.updated');
                      }}
                      headerMeta={
                        <Typography.Text type='secondary'>
                          {t('conversation.workspace.automation.projectCommandsPathHint', {
                            defaultValue: 'Saved to: {{path}}',
                            path: automationPaths.commandsFile,
                          })}
                        </Typography.Text>
                      }
                    />
                  </div>
                ) : (
                  <div className='mt-16px'>
                    <AutomationPanel
                      title={t('conversation.workspace.automation.projectCommandsTitle', {
                        defaultValue: 'Project Local Commands',
                      })}
                      description={t('conversation.workspace.automation.projectCommandsDescription', {
                        defaultValue:
                          'These commands are saved into `.contextgo/commands.json` for the current workspace and override Space Commands with the same slash name.',
                      })}
                      icon={<Command theme='outline' size='18' className='app-icon text-t-primary' />}
                    >
                      <AutomationSectionCard>
                        <Typography.Paragraph className='mb-0 text-t-secondary'>
                          {t('conversation.workspace.automation.workspaceUnavailable')}
                        </Typography.Paragraph>
                      </AutomationSectionCard>
                    </AutomationPanel>
                  </div>
                )}
              </div>
            </Tabs.TabPane>

            <Tabs.TabPane key='schedules' title={t('schedule.scheduledTasks')}>
              <div className='mt-8px'>
                <AutomationPanel
                  title={t('schedule.scheduledTasks')}
                  description={t('conversation.workspace.automation.schedulesDescription')}
                  icon={<AlarmClock theme='outline' size='18' className='app-icon text-t-primary' />}
                  meta={
                    <div className='flex flex-col gap-8px'>
                      <Typography.Text type='secondary'>
                        {t('conversation.workspace.automation.sessionConversationLabel')}: {conversation.name}
                      </Typography.Text>
                      {automationPaths ? (
                        <Typography.Text type='secondary'>
                          {t('conversation.workspace.automation.schedulesPathHint', {
                            path: automationPaths.schedulesFile,
                          })}
                        </Typography.Text>
                      ) : null}
                    </div>
                  }
                  actions={
                    existingJob ? (
                      <>
                        <Tag color={scheduleStatus?.hasError ? 'red' : scheduleStatus?.isPaused ? 'orange' : 'green'}>
                          {scheduleStatus?.hasError
                            ? t('schedule.status.error')
                            : scheduleStatus?.isPaused
                              ? t('schedule.status.paused')
                              : t('schedule.status.active')}
                        </Tag>
                        <Button
                          type='secondary'
                          icon={<Play theme='outline' size={14} />}
                          loading={scheduleRunningNow}
                          onClick={() => void handleRunScheduleNow()}
                        >
                          {t('schedule.actions.runNow')}
                        </Button>
                      </>
                    ) : null
                  }
                >
                  {loading ? (
                    <AutomationSectionCard>
                      <Typography.Text type='secondary'>{t('common.loading')}</Typography.Text>
                    </AutomationSectionCard>
                  ) : (
                    <>
                      {!existingJob ? (
                        <AutomationSectionCard>
                          <Typography.Paragraph className='mb-0 text-t-secondary'>
                            {t('conversation.workspace.automation.scheduleEmpty')}
                          </Typography.Paragraph>
                        </AutomationSectionCard>
                      ) : null}

                      <AutomationSectionCard>
                        <div className='flex flex-col gap-16px'>
                          <div className='grid gap-12px md:grid-cols-2'>
                            <div className='rounded-12px bg-[var(--color-fill-1)] p-12px'>
                              <Typography.Text bold>{t('schedule.drawer.name')}</Typography.Text>
                              <Input
                                className='mt-8px'
                                value={scheduleState.name}
                                placeholder={t('conversation.workspace.automation.scheduleEditor.namePlaceholder')}
                                onChange={(value) => setScheduleState((prev) => ({ ...prev, name: value }))}
                              />
                            </div>

                            <div className='rounded-12px bg-[var(--color-fill-1)] p-12px'>
                              <div className='flex items-center justify-between gap-12px'>
                                <Typography.Text bold>{t('schedule.drawer.taskStatus')}</Typography.Text>
                                <div className='flex items-center gap-8px'>
                                  <Typography.Text type='secondary'>
                                    {scheduleState.enabled
                                      ? t('schedule.drawer.enabled')
                                      : t('schedule.drawer.disabled')}
                                  </Typography.Text>
                                  <Switch
                                    checked={scheduleState.enabled}
                                    onChange={(enabled) => setScheduleState((prev) => ({ ...prev, enabled }))}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className='rounded-12px bg-[var(--color-fill-1)] p-12px'>
                            <Typography.Text bold>{t('schedule.drawer.command')}</Typography.Text>
                            <Input.TextArea
                              className='mt-8px'
                              value={scheduleState.message}
                              placeholder={t('schedule.drawer.commandPlaceholder')}
                              autoSize={{ minRows: 3, maxRows: 10 }}
                              onChange={(value) => setScheduleState((prev) => ({ ...prev, message: value }))}
                            />
                          </div>

                          {existingJob && existingJob.schedule.kind !== 'cron' ? (
                            <div className='rounded-12px bg-[var(--color-fill-1)] p-12px'>
                              <Typography.Text bold>{t('schedule.schedule')}</Typography.Text>
                              <Typography.Paragraph className='mb-0 mt-8px text-t-secondary'>
                                {t('conversation.workspace.automation.scheduleReadonlyHint', {
                                  kind: existingJob.schedule.kind,
                                })}
                              </Typography.Paragraph>
                              <Typography.Paragraph className='mb-0 mt-8px'>
                                {existingJob.schedule.description}
                              </Typography.Paragraph>
                            </div>
                          ) : (
                            <div className='grid gap-12px md:grid-cols-2'>
                              <div className='rounded-12px bg-[var(--color-fill-1)] p-12px'>
                                <Typography.Text bold>
                                  {t('conversation.workspace.automation.scheduleEditor.cronExpressionLabel')}
                                </Typography.Text>
                                <Input
                                  className='mt-8px'
                                  value={scheduleState.cronExpr}
                                  placeholder={t(
                                    'conversation.workspace.automation.scheduleEditor.cronExpressionPlaceholder'
                                  )}
                                  onChange={(value) => setScheduleState((prev) => ({ ...prev, cronExpr: value }))}
                                />
                              </div>

                              <div className='rounded-12px bg-[var(--color-fill-1)] p-12px'>
                                <Typography.Text bold>
                                  {t('conversation.workspace.automation.scheduleEditor.descriptionLabel')}
                                </Typography.Text>
                                <Input
                                  className='mt-8px'
                                  value={scheduleState.scheduleDescription}
                                  placeholder={t(
                                    'conversation.workspace.automation.scheduleEditor.descriptionPlaceholder'
                                  )}
                                  onChange={(value) =>
                                    setScheduleState((prev) => ({ ...prev, scheduleDescription: value }))
                                  }
                                />
                              </div>
                            </div>
                          )}

                          {existingJob ? (
                            <div className='grid gap-12px md:grid-cols-2'>
                              <div className='rounded-12px bg-[var(--color-fill-1)] p-12px'>
                                <Typography.Text bold>{t('schedule.nextRun')}</Typography.Text>
                                <Typography.Paragraph className='mb-0 mt-8px'>
                                  {formatNextRun(existingJob.state.nextRunAtMs)}
                                </Typography.Paragraph>
                              </div>
                              <div className='rounded-12px bg-[var(--color-fill-1)] p-12px'>
                                <Typography.Text bold>{t('schedule.lastRun')}</Typography.Text>
                                <Typography.Paragraph className='mb-0 mt-8px'>
                                  {formatNextRun(existingJob.state.lastRunAtMs)}
                                </Typography.Paragraph>
                              </div>
                            </div>
                          ) : null}

                          <div className='flex justify-between gap-12px'>
                            <div>
                              {existingJob ? (
                                <Button
                                  status='danger'
                                  loading={scheduleDeleting}
                                  onClick={() => void handleDeleteSchedule()}
                                >
                                  {t('schedule.actions.delete')}
                                </Button>
                              ) : null}
                            </div>
                            <Button
                              type='primary'
                              loading={scheduleSaving}
                              disabled={!directCreateContext}
                              onClick={() => void handleSaveSchedule()}
                            >
                              {existingJob ? t('common.save') : t('common.create')}
                            </Button>
                          </div>
                        </div>
                      </AutomationSectionCard>
                    </>
                  )}
                </AutomationPanel>
              </div>
            </Tabs.TabPane>
          </Tabs>
        </div>
      </div>

      <SettingsSubModal
        visible={previewingSkill !== null}
        title={previewingSkill?.title}
        onCancel={handleCloseSkillPreview}
        footer={null}
        style={{ width: 'min(920px, calc(100vw - 32px))' }}
        contentStyle={{ padding: '12px 24px 24px', maxHeight: 'min(82vh, 920px)', overflow: 'auto' }}
      >
        <div className='flex flex-col gap-12px'>
          {previewingSkill?.sourcePath ? (
            <Typography.Paragraph className='mb-0 break-all text-12px text-t-tertiary'>
              {previewingSkill.sourcePath}
            </Typography.Paragraph>
          ) : null}

          <div className='rounded-12px border border-solid border-[var(--color-border-2)] bg-[var(--color-bg-1)] p-16px'>
            {skillPreviewLoading ? (
              <div className='py-16px text-center text-12px text-t-secondary'>{t('common.loading')}</div>
            ) : previewSkillBody ? (
              <MarkdownView hiddenCodeCopyButton>{previewSkillBody}</MarkdownView>
            ) : (
              <div className='py-16px text-center text-12px text-t-secondary'>
                {t('settings.promptPreviewEmpty', { defaultValue: 'No content to preview' })}
              </div>
            )}
          </div>
        </div>
      </SettingsSubModal>
    </SettingsSubModal>
  );
};

export default ProjectAutomationModal;
