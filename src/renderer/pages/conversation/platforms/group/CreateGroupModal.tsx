/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import {
  DEFAULT_WORKFLOW_GROUP_TEMPLATE,
  getWorkflowGroupTemplateDefinition,
  listWorkflowGroupTemplateDefinitions,
  type WorkflowTemplateRole,
} from '@/common/config/group';
import type { DiscussionGroupMode, TChatConversation, WorkflowGroupTemplate } from '@/common/config/storage';
import { useAssistantList } from '@/renderer/hooks/assistant';
import {
  buildDiscussionGroupParams,
  buildWorkflowGroupParams,
  type GroupParticipantInput,
  type WorkflowGroupParticipantInput,
} from '@/renderer/pages/conversation/utils/createConversationParams';
import { CUSTOM_AVATAR_IMAGE_MAP } from '@/renderer/pages/guid/constants';
import type { AssistantListItem } from '@/renderer/pages/settings/AgentSettings/AssistantManagement/types';
import {
  isEmoji,
  resolveAvatarImageSrc,
} from '@/renderer/pages/settings/AgentSettings/AssistantManagement/assistantUtils';
import type { AvailableAgent } from '@/renderer/utils/model/agentTypes';
import { getAgentLogo } from '@/renderer/utils/model/agentLogo';
import {
  Button,
  Checkbox,
  Input,
  InputNumber,
  Message,
  Modal,
  Radio,
  Select,
  Typography,
} from '@arco-design/web-react';
import { FolderOpen, Robot } from '@icon-park/react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const resolveAssistantDisplayName = (assistant: AssistantListItem, localeKey: string): string => {
  return assistant.nameI18n?.[localeKey] || assistant.name;
};

const resolveAssistantDescription = (assistant: AssistantListItem, localeKey: string): string => {
  return assistant.descriptionI18n?.[localeKey] || assistant.description || '';
};

type ParticipantOption = GroupParticipantInput & {
  selectionKey: string;
};

type ParticipantSection = {
  key: string;
  title: string;
  items: ParticipantOption[];
};

type GroupCreationKind = 'workflow' | 'discussion';
type WorkflowRole = WorkflowTemplateRole;

const DEFAULT_MODE: DiscussionGroupMode = 'broadcast';
const DEFAULT_GROUP_KIND: GroupCreationKind = 'workflow';

const buildSelectionKey = (participantType: ParticipantOption['type'], participantKey: string) => {
  return `${participantType}:${participantKey}`;
};

const buildCliParticipantDescription = (agent: AvailableAgent): string => {
  if (agent.cliPath) {
    return `${agent.backend} · ${agent.cliPath}`;
  }
  return agent.backend;
};

const normalizeWorkflowRoles = (
  selectionKeys: string[],
  previousRoles: Partial<Record<string, WorkflowRole>>,
  roleOrder: WorkflowRole[]
): Partial<Record<string, WorkflowRole>> => {
  const nextRoles: Partial<Record<string, WorkflowRole>> = {};
  const assignedRoles = new Set<WorkflowRole>();

  for (const key of selectionKeys) {
    const role = previousRoles[key];
    if (role && !assignedRoles.has(role)) {
      nextRoles[key] = role;
      assignedRoles.add(role);
    }
  }

  for (const key of selectionKeys) {
    if (nextRoles[key]) {
      continue;
    }

    const availableRole = roleOrder.find((role) => !assignedRoles.has(role));
    if (!availableRole) {
      break;
    }

    nextRoles[key] = availableRole;
    assignedRoles.add(availableRole);
  }

  return nextRoles;
};

const ParticipantAvatar: React.FC<{ participant: ParticipantOption }> = ({ participant }) => {
  if (participant.type === 'cli-agent') {
    const logo = getAgentLogo(participant.agent.backend);
    if (logo) {
      return <img src={logo} alt={participant.name} className='h-24px w-24px shrink-0 object-contain' />;
    }
  }

  const avatarImageSrc = resolveAvatarImageSrc(participant.avatar, CUSTOM_AVATAR_IMAGE_MAP);
  if (avatarImageSrc) {
    return <img src={avatarImageSrc} alt={participant.name} className='h-24px w-24px shrink-0 rd-12px object-cover' />;
  }

  if (participant.avatar && isEmoji(participant.avatar)) {
    return <span className='w-24px shrink-0 text-center text-18px leading-24px'>{participant.avatar}</span>;
  }

  return (
    <span className='flex h-24px w-24px shrink-0 items-center justify-center rd-12px bg-[var(--fill-2)]'>
      <Robot size='14' />
    </span>
  );
};

const CreateGroupModal: React.FC<{
  visible: boolean;
  workspace: string;
  cliAgents: AvailableAgent[];
  presetAssistants: AvailableAgent[];
  onCancel: () => void;
  onCreated: (conversation: TChatConversation) => void;
}> = ({ visible, workspace, cliAgents, presetAssistants, onCancel, onCreated }) => {
  const { t, i18n } = useTranslation();
  const { assistants, localeKey } = useAssistantList();
  const workflowTemplates = useMemo(() => listWorkflowGroupTemplateDefinitions(), []);
  const [groupName, setGroupName] = useState('');
  const [selectedWorkspace, setSelectedWorkspace] = useState('');
  const [groupKind, setGroupKind] = useState<GroupCreationKind>(DEFAULT_GROUP_KIND);
  const [mode, setMode] = useState<DiscussionGroupMode>(DEFAULT_MODE);
  const [workflowTemplate, setWorkflowTemplate] = useState<WorkflowGroupTemplate>(DEFAULT_WORKFLOW_GROUP_TEMPLATE);
  const [selectedParticipantKeys, setSelectedParticipantKeys] = useState<string[]>([]);
  const [workflowRolesByParticipantKey, setWorkflowRolesByParticipantKey] = useState<
    Partial<Record<string, WorkflowRole>>
  >({});
  const [workflowMaxIterations, setWorkflowMaxIterations] = useState(0);
  const [workflowScoreTarget, setWorkflowScoreTarget] = useState(0);
  const [workflowArtifactPath, setWorkflowArtifactPath] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const hasInitializedForOpenRef = useRef(false);

  const workflowTemplateDefinition = useMemo(
    () => getWorkflowGroupTemplateDefinition(workflowTemplate),
    [workflowTemplate]
  );
  const workflowRoleOrder = workflowTemplateDefinition.roleOrder;

  const presetAssistantMap = useMemo(() => {
    return new Map(assistants.map((assistant) => [assistant.id, assistant]));
  }, [assistants]);

  const presetParticipantOptions = useMemo<ParticipantOption[]>(() => {
    return presetAssistants.map((assistant) => {
      const assistantId = assistant.customAgentId || assistant.name;
      const metadata = presetAssistantMap.get(assistantId);
      const participantKey = assistantId;
      return {
        type: 'preset-assistant',
        selectionKey: buildSelectionKey('preset-assistant', participantKey),
        participantKey,
        name: metadata ? resolveAssistantDisplayName(metadata, localeKey) : assistant.name,
        avatar: metadata?.avatar || assistant.avatar,
        description: metadata ? resolveAssistantDescription(metadata, localeKey) : '',
        presetAgentType: metadata?.presetAgentType || assistant.presetAgentType,
      };
    });
  }, [localeKey, presetAssistantMap, presetAssistants]);

  const cliParticipantOptions = useMemo<ParticipantOption[]>(() => {
    return cliAgents.map((agent) => {
      const participantKey = [agent.backend, agent.cliPath || '', agent.name].join(':');
      return {
        type: 'cli-agent',
        selectionKey: buildSelectionKey('cli-agent', participantKey),
        participantKey,
        name: agent.name,
        description: buildCliParticipantDescription(agent),
        agent,
      };
    });
  }, [cliAgents]);

  const sections = useMemo<ParticipantSection[]>(() => {
    return [
      {
        key: 'preset-assistants',
        title: t('conversation.dropdown.presetAssistants'),
        items: presetParticipantOptions,
      },
      {
        key: 'cli-agents',
        title: t('conversation.dropdown.cliAgents'),
        items: cliParticipantOptions,
      },
    ].filter((section) => section.items.length > 0);
  }, [cliParticipantOptions, presetParticipantOptions, t]);

  const availableParticipants = useMemo(() => {
    return sections.flatMap((section) => section.items);
  }, [sections]);

  useEffect(() => {
    if (!visible) {
      hasInitializedForOpenRef.current = false;
      return;
    }

    if (hasInitializedForOpenRef.current || availableParticipants.length === 0) {
      return;
    }

    const defaultTemplateDefinition = getWorkflowGroupTemplateDefinition(DEFAULT_WORKFLOW_GROUP_TEMPLATE);
    const defaultSelectionKeys = availableParticipants
      .slice(0, defaultTemplateDefinition.requiredParticipantCount)
      .map((participant) => participant.selectionKey);

    setGroupName(t('conversation.group.defaultName'));
    setSelectedWorkspace(workspace || '');
    setGroupKind(DEFAULT_GROUP_KIND);
    setMode(DEFAULT_MODE);
    setWorkflowTemplate(DEFAULT_WORKFLOW_GROUP_TEMPLATE);
    setWorkflowMaxIterations(defaultTemplateDefinition.defaults.maxIterations);
    setWorkflowScoreTarget(defaultTemplateDefinition.defaults.scoreTarget);
    setWorkflowArtifactPath(defaultTemplateDefinition.defaults.artifactPath);
    setSelectedParticipantKeys(defaultSelectionKeys);
    setWorkflowRolesByParticipantKey(
      normalizeWorkflowRoles(defaultSelectionKeys, {}, defaultTemplateDefinition.roleOrder)
    );
    hasInitializedForOpenRef.current = true;
  }, [availableParticipants, t, visible, workspace]);

  const updateSelectedParticipants = (selectionKeys: string[]) => {
    setSelectedParticipantKeys(selectionKeys);
    setWorkflowRolesByParticipantKey((previousRoles) =>
      normalizeWorkflowRoles(selectionKeys, previousRoles, workflowRoleOrder)
    );
  };

  const handleGroupKindChange = (value: GroupCreationKind) => {
    setGroupKind(value);
    if (value === 'workflow') {
      const trimmedSelectionKeys = selectedParticipantKeys.slice(
        0,
        workflowTemplateDefinition.requiredParticipantCount
      );
      updateSelectedParticipants(trimmedSelectionKeys);
    }
  };

  const handleWorkflowTemplateChange = (value: WorkflowGroupTemplate) => {
    const nextTemplateDefinition = getWorkflowGroupTemplateDefinition(value);
    const trimmedSelectionKeys = selectedParticipantKeys.slice(0, nextTemplateDefinition.requiredParticipantCount);

    setWorkflowTemplate(value);
    setWorkflowMaxIterations(nextTemplateDefinition.defaults.maxIterations);
    setWorkflowScoreTarget(nextTemplateDefinition.defaults.scoreTarget);
    setWorkflowArtifactPath(nextTemplateDefinition.defaults.artifactPath);
    setSelectedParticipantKeys(trimmedSelectionKeys);
    setWorkflowRolesByParticipantKey(
      normalizeWorkflowRoles(trimmedSelectionKeys, {}, nextTemplateDefinition.roleOrder)
    );
  };

  const handleSelectWorkspace = async () => {
    try {
      const files = await ipcBridge.dialog.showOpen.invoke({
        defaultPath: selectedWorkspace || workspace || undefined,
        properties: ['openDirectory'],
      });
      const workspacePath = files?.[0];
      if (!workspacePath) {
        return;
      }
      setSelectedWorkspace(workspacePath);
    } catch (error) {
      console.error('Failed to select group workspace:', error);
      Message.error(t('conversation.group.selectWorkspaceFailed'));
    }
  };

  const handleSubmit = async () => {
    const selectedParticipants = availableParticipants.filter((participant) =>
      selectedParticipantKeys.includes(participant.selectionKey)
    );

    if (groupKind === 'workflow') {
      if (selectedParticipants.length !== workflowTemplateDefinition.requiredParticipantCount) {
        Message.warning(t('conversation.group.workflow.exactParticipants'));
        return;
      }

      const workflowParticipants = selectedParticipants.map((participant) => ({
        ...participant,
        role: workflowRolesByParticipantKey[participant.selectionKey],
      }));
      const assignedRoles = workflowParticipants.map((participant) => participant.role).filter(Boolean);
      if (
        assignedRoles.length !== workflowRoleOrder.length ||
        new Set(assignedRoles).size !== workflowRoleOrder.length
      ) {
        Message.warning(t('conversation.group.workflow.assignRoles'));
        return;
      }

      setSubmitting(true);
      try {
        const params = await buildWorkflowGroupParams({
          name: groupName.trim() || t('conversation.group.defaultName'),
          workspace: selectedWorkspace.trim() || undefined,
          language: i18n.language,
          template: workflowTemplate,
          participants: workflowParticipants as WorkflowGroupParticipantInput[],
          maxIterations: workflowMaxIterations,
          scoreTarget: workflowScoreTarget,
          artifactPath: workflowArtifactPath.trim() || undefined,
        });

        const conversation = await ipcBridge.conversation.create.invoke(params);
        onCreated(conversation);
      } catch (error) {
        console.error('Failed to create workflow group:', error);
        Message.error(t('conversation.group.createFailed'));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (selectedParticipants.length < 2) {
      Message.warning(t('conversation.group.minimumParticipants'));
      return;
    }

    setSubmitting(true);
    try {
      const params = await buildDiscussionGroupParams({
        name: groupName.trim() || t('conversation.group.defaultName'),
        workspace: selectedWorkspace.trim() || undefined,
        language: i18n.language,
        mode,
        participants: selectedParticipants,
      });

      const conversation = await ipcBridge.conversation.create.invoke(params);
      onCreated(conversation);
    } catch (error) {
      console.error('Failed to create group:', error);
      Message.error(t('conversation.group.createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={t('conversation.group.createTitle')}
      visible={visible}
      onCancel={onCancel}
      footer={
        <div className='flex justify-end gap-8px'>
          <Button onClick={onCancel}>{t('common.cancel')}</Button>
          <Button type='primary' loading={submitting} onClick={() => void handleSubmit()}>
            {t('conversation.group.createAction')}
          </Button>
        </div>
      }
    >
      <div className='flex flex-col gap-16px'>
        <div className='flex flex-col gap-6px'>
          <Typography.Text>{t('conversation.group.nameLabel')}</Typography.Text>
          <Input value={groupName} onChange={setGroupName} placeholder={t('conversation.group.namePlaceholder')} />
        </div>

        <div className='flex flex-col gap-6px'>
          <Typography.Text>{t('conversation.group.workspaceLabel')}</Typography.Text>
          <div className='flex items-center gap-8px'>
            <Input
              value={selectedWorkspace}
              onChange={setSelectedWorkspace}
              placeholder={t('conversation.group.workspacePlaceholder')}
              allowClear
            />
            <Button type='secondary' onClick={() => void handleSelectWorkspace()}>
              <span className='flex items-center gap-6px'>
                <FolderOpen theme='outline' size='16' />
                <span>{t('conversation.group.selectWorkspace')}</span>
              </span>
            </Button>
          </div>
          <Typography.Text type='secondary'>{t('conversation.group.workspaceHint')}</Typography.Text>
        </div>

        <div className='flex flex-col gap-6px'>
          <Typography.Text>{t('conversation.group.kindLabel')}</Typography.Text>
          <Radio.Group
            value={groupKind}
            onChange={(value) => handleGroupKindChange(value as GroupCreationKind)}
            type='button'
          >
            <Radio value='workflow'>{t('conversation.group.kindWorkflow')}</Radio>
            <Radio value='discussion'>{t('conversation.group.kindDiscussion')}</Radio>
          </Radio.Group>
          <Typography.Text type='secondary'>{t(`conversation.group.kindHint.${groupKind}`)}</Typography.Text>
        </div>

        {groupKind === 'discussion' ? (
          <div className='flex flex-col gap-6px'>
            <Typography.Text>{t('conversation.group.modeLabel')}</Typography.Text>
            <Radio.Group value={mode} onChange={(value) => setMode(value as DiscussionGroupMode)} type='button'>
              <Radio value='broadcast'>{t('conversation.group.modeBroadcast')}</Radio>
              <Radio value='relay'>{t('conversation.group.modeRelay')}</Radio>
              <Radio value='debate'>{t('conversation.group.modeDebate')}</Radio>
            </Radio.Group>
            <Typography.Text type='secondary'>{t(`conversation.group.modeHint.${mode}`)}</Typography.Text>
          </div>
        ) : (
          <div className='flex flex-col gap-10px'>
            <div className='flex flex-col gap-6px'>
              <Typography.Text>{t('conversation.group.workflow.templateLabel')}</Typography.Text>
              <Select
                value={workflowTemplate}
                onChange={(value) => handleWorkflowTemplateChange(value as WorkflowGroupTemplate)}
              >
                {workflowTemplates.map((template) => (
                  <Select.Option key={template.id} value={template.id}>
                    {t(template.labelKey)}
                  </Select.Option>
                ))}
              </Select>
              <Typography.Text type='secondary'>{t(workflowTemplateDefinition.hintKey)}</Typography.Text>
            </div>

            <div className='grid grid-cols-1 gap-12px md:grid-cols-2'>
              <div className='flex flex-col gap-6px'>
                <Typography.Text>{t('conversation.group.workflow.maxIterationsLabel')}</Typography.Text>
                <InputNumber
                  value={workflowMaxIterations}
                  min={workflowTemplateDefinition.constraints.maxIterations.min}
                  max={workflowTemplateDefinition.constraints.maxIterations.max}
                  step={workflowTemplateDefinition.constraints.maxIterations.step}
                  precision={0}
                  onChange={(value) => {
                    setWorkflowMaxIterations(
                      typeof value === 'number' ? value : workflowTemplateDefinition.defaults.maxIterations
                    );
                  }}
                />
                <Typography.Text type='secondary'>
                  {t('conversation.group.workflow.maxIterationsHint', {
                    min: workflowTemplateDefinition.constraints.maxIterations.min,
                    max: workflowTemplateDefinition.constraints.maxIterations.max,
                  })}
                </Typography.Text>
              </div>

              <div className='flex flex-col gap-6px'>
                <Typography.Text>{t('conversation.group.workflow.scoreTargetLabel')}</Typography.Text>
                <InputNumber
                  value={workflowScoreTarget}
                  min={workflowTemplateDefinition.constraints.scoreTarget.min}
                  max={workflowTemplateDefinition.constraints.scoreTarget.max}
                  step={workflowTemplateDefinition.constraints.scoreTarget.step}
                  precision={1}
                  onChange={(value) => {
                    setWorkflowScoreTarget(
                      typeof value === 'number' ? value : workflowTemplateDefinition.defaults.scoreTarget
                    );
                  }}
                />
                <Typography.Text type='secondary'>
                  {t('conversation.group.workflow.scoreTargetHint', {
                    min: workflowTemplateDefinition.constraints.scoreTarget.min,
                    max: workflowTemplateDefinition.constraints.scoreTarget.max,
                  })}
                </Typography.Text>
              </div>
            </div>

            <div className='flex flex-col gap-6px'>
              <Typography.Text>{t('conversation.group.workflow.artifactPathLabel')}</Typography.Text>
              <Input
                value={workflowArtifactPath}
                onChange={setWorkflowArtifactPath}
                placeholder={workflowTemplateDefinition.defaults.artifactPath}
              />
              <Typography.Text type='secondary'>{t('conversation.group.workflow.artifactPathHint')}</Typography.Text>
            </div>
          </div>
        )}

        <div className='flex flex-col gap-8px'>
          <Typography.Text>{t('conversation.group.participantsLabel')}</Typography.Text>
          <div className='flex max-h-320px flex-col gap-8px overflow-y-auto pr-4px'>
            {sections.map((section) => (
              <div key={section.key} className='flex flex-col gap-8px'>
                <Typography.Text type='secondary' className='text-12px uppercase tracking-0.08em'>
                  {section.title}
                </Typography.Text>
                {section.items.map((participant) => {
                  const selected = selectedParticipantKeys.includes(participant.selectionKey);
                  const disableSelection =
                    groupKind === 'workflow' &&
                    !selected &&
                    selectedParticipantKeys.length >= workflowTemplateDefinition.requiredParticipantCount;

                  return (
                    <div
                      key={participant.selectionKey}
                      className={`flex items-start gap-10px border border-solid p-10px rd-10px ${
                        selected
                          ? 'border-[var(--color-primary-light-4)] bg-[var(--color-fill-1)]'
                          : 'border-[var(--border-base)] bg-transparent'
                      }`}
                    >
                      <Checkbox
                        checked={selected}
                        disabled={disableSelection}
                        onChange={(checked) => {
                          updateSelectedParticipants(
                            checked
                              ? selectedParticipantKeys.includes(participant.selectionKey)
                                ? selectedParticipantKeys
                                : [...selectedParticipantKeys, participant.selectionKey]
                              : selectedParticipantKeys.filter((key) => key !== participant.selectionKey)
                          );
                        }}
                      />
                      <ParticipantAvatar participant={participant} />
                      <div className='min-w-0 flex-1'>
                        <Typography.Text className='block font-medium'>{participant.name}</Typography.Text>
                        <Typography.Paragraph
                          className='!mb-0 text-[var(--color-text-3)]'
                          ellipsis={{ rows: 2, expandable: false }}
                        >
                          {participant.description || t('conversation.group.noDescription')}
                        </Typography.Paragraph>
                        {groupKind === 'workflow' && selected ? (
                          <div className='mt-8px flex items-center gap-8px'>
                            <Typography.Text type='secondary' className='text-12px'>
                              {t('conversation.group.workflow.roleLabel')}
                            </Typography.Text>
                            <Select
                              size='small'
                              value={workflowRolesByParticipantKey[participant.selectionKey]}
                              style={{ width: 180 }}
                              onChange={(value) => {
                                const nextRole = value as WorkflowRole;
                                setWorkflowRolesByParticipantKey((previousRoles) => {
                                  const nextRoles: Partial<Record<string, WorkflowRole>> = {};
                                  for (const [key, role] of Object.entries(previousRoles)) {
                                    const assignedRole = role as WorkflowRole | undefined;
                                    if (!assignedRole) {
                                      continue;
                                    }
                                    if (assignedRole === nextRole && key !== participant.selectionKey) {
                                      continue;
                                    }
                                    nextRoles[key] = assignedRole;
                                  }
                                  nextRoles[participant.selectionKey] = nextRole;
                                  return normalizeWorkflowRoles(selectedParticipantKeys, nextRoles, workflowRoleOrder);
                                });
                              }}
                            >
                              {workflowRoleOrder.map((role) => {
                                const isTakenByOtherParticipant = Object.entries(workflowRolesByParticipantKey).some(
                                  ([key, assignedRole]) => key !== participant.selectionKey && assignedRole === role
                                );

                                return (
                                  <Select.Option key={role} value={role} disabled={isTakenByOtherParticipant}>
                                    {t(`conversation.group.role.${role}`)}
                                  </Select.Option>
                                );
                              })}
                            </Select>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <Typography.Text type='secondary'>
            {groupKind === 'workflow'
              ? t('conversation.group.workflow.exactParticipantsHint')
              : t('conversation.group.minimumParticipantsHint')}
          </Typography.Text>
        </div>
      </div>
    </Modal>
  );
};

export default CreateGroupModal;
