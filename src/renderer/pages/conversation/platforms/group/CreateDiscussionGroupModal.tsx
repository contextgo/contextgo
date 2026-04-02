/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { CollaborationMode, DiscussionGroupMode, TChatConversation } from '@/common/config/storage';
import { useAssistantList } from '@/renderer/hooks/assistant';
import { CUSTOM_AVATAR_IMAGE_MAP } from '@/renderer/pages/guid/constants';
import type { AssistantListItem } from '@/renderer/pages/settings/AgentSettings/AssistantManagement/types';
import type { AvailableAgent } from '@/renderer/utils/model/agentTypes';
import { getAgentLogo } from '@/renderer/utils/model/agentLogo';
import {
  isEmoji,
  resolveAvatarImageSrc,
} from '@/renderer/pages/settings/AgentSettings/AssistantManagement/assistantUtils';
import {
  buildDiscussionGroupParams,
  type DiscussionGroupParticipantInput,
} from '@/renderer/pages/conversation/utils/createConversationParams';
import { ContextGoModal } from '@/renderer/components/base';
import { Button, Checkbox, Input, Message, Radio, Typography } from '@arco-design/web-react';
import { FolderOpen, Robot } from '@icon-park/react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  HARNESS_DEFAULT_PRESET_ASSISTANT_IDS,
  resolveHarnessDefaultSelectionKeys,
} from './createDiscussionGroupModalHelpers';
import GroupModalSection, {
  GROUP_MODAL_CONTENT_STYLE,
  GROUP_MODAL_FOOTER_BUTTON_CLASS_NAME,
  GROUP_MODAL_PARTICIPANT_CARD_CLASS_NAME,
  GROUP_MODAL_PARTICIPANT_LIST_STYLE,
  GROUP_MODAL_PARTICIPANT_META_CLASS_NAME,
  GROUP_MODAL_PARTICIPANT_CARD_SELECTED_CLASS_NAME,
  GROUP_MODAL_SEGMENTED_GROUP_CLASS_NAME,
  GROUP_MODAL_STYLE,
} from './GroupModalShared';

const resolveAssistantDisplayName = (assistant: AssistantListItem, localeKey: string): string => {
  return assistant.nameI18n?.[localeKey] || assistant.name;
};

const resolveAssistantDescription = (assistant: AssistantListItem, localeKey: string): string => {
  return assistant.descriptionI18n?.[localeKey] || assistant.description || '';
};

type ParticipantOption = DiscussionGroupParticipantInput & {
  selectionKey: string;
};

type ParticipantSection = {
  key: string;
  title: string;
  items: ParticipantOption[];
};

const buildSelectionKey = (participantType: ParticipantOption['type'], participantKey: string) => {
  return `${participantType}:${participantKey}`;
};

const buildCliParticipantDescription = (agent: AvailableAgent): string => {
  if (agent.cliPath) {
    return `${agent.backend} · ${agent.cliPath}`;
  }
  return agent.backend;
};

const ParticipantAvatar: React.FC<{ participant: ParticipantOption }> = ({ participant }) => {
  if (participant.type === 'cli-agent') {
    const logo = getAgentLogo(participant.agent.backend);
    if (logo) {
      return <img src={logo} alt={participant.name} className='w-24px h-24px object-contain shrink-0' />;
    }
  }

  const avatarImageSrc = resolveAvatarImageSrc(participant.avatar, CUSTOM_AVATAR_IMAGE_MAP);
  if (avatarImageSrc) {
    return <img src={avatarImageSrc} alt={participant.name} className='w-24px h-24px rd-12px object-cover shrink-0' />;
  }

  if (participant.avatar && isEmoji(participant.avatar)) {
    return <span className='text-18px leading-24px w-24px text-center shrink-0'>{participant.avatar}</span>;
  }

  return (
    <span className='w-24px h-24px rd-12px bg-[var(--fill-2)] flex items-center justify-center shrink-0'>
      <Robot size='14' />
    </span>
  );
};

const DEFAULT_MODE: DiscussionGroupMode = 'broadcast';
const DEFAULT_COLLABORATION_MODE: CollaborationMode = 'discussion';

const buildPresetParticipantOption = (assistant: AssistantListItem, localeKey: string): ParticipantOption => {
  return {
    type: 'preset-assistant',
    selectionKey: buildSelectionKey('preset-assistant', assistant.id),
    participantKey: assistant.id,
    name: resolveAssistantDisplayName(assistant, localeKey),
    avatar: assistant.avatar,
    description: resolveAssistantDescription(assistant, localeKey),
    presetAgentType: assistant.presetAgentType,
  };
};

const resolveHarnessRoleLabelKey = (roleIndex: number): string => {
  if (roleIndex === 0) {
    return 'conversation.group.role.planner';
  }
  if (roleIndex === 1) {
    return 'conversation.group.role.generator';
  }
  return 'conversation.group.role.evaluator';
};

const CreateDiscussionGroupModal: React.FC<{
  visible: boolean;
  workspace: string;
  cliAgents: AvailableAgent[];
  presetAssistants: AvailableAgent[];
  onCancel: () => void;
  onCreated: (conversation: TChatConversation) => void;
}> = ({ visible, workspace, cliAgents, presetAssistants, onCancel, onCreated }) => {
  const { t, i18n } = useTranslation();
  const { assistants, localeKey } = useAssistantList();
  const [groupName, setGroupName] = useState('');
  const [selectedWorkspace, setSelectedWorkspace] = useState('');
  const [mode, setMode] = useState<DiscussionGroupMode>(DEFAULT_MODE);
  const [collaborationMode, setCollaborationMode] = useState<CollaborationMode>(DEFAULT_COLLABORATION_MODE);
  const [selectedParticipantKeys, setSelectedParticipantKeys] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const presetAssistantMap = useMemo(() => {
    return new Map(assistants.map((assistant) => [assistant.id, assistant]));
  }, [assistants]);

  const presetParticipantOptions = useMemo<ParticipantOption[]>(() => {
    const availablePresetOptions: ParticipantOption[] = presetAssistants.map((assistant) => {
      const assistantId = assistant.customAgentId || assistant.name;
      const metadata = presetAssistantMap.get(assistantId);
      const participantKey = assistantId;
      return {
        type: 'preset-assistant' as const,
        selectionKey: buildSelectionKey('preset-assistant', participantKey),
        participantKey,
        name: metadata ? resolveAssistantDisplayName(metadata, localeKey) : assistant.name,
        avatar: metadata?.avatar || assistant.avatar,
        description: metadata ? resolveAssistantDescription(metadata, localeKey) : '',
        presetAgentType: metadata?.presetAgentType || assistant.presetAgentType,
      };
    });

    const availableOptionMap = new Map(availablePresetOptions.map((option) => [option.participantKey, option]));
    const harnessDefaultOptions: ParticipantOption[] = [];

    HARNESS_DEFAULT_PRESET_ASSISTANT_IDS.forEach((assistantId) => {
      const availableOption = availableOptionMap.get(assistantId);
      if (availableOption) {
        harnessDefaultOptions.push(availableOption);
        return;
      }

      const assistant = presetAssistantMap.get(assistantId);
      if (assistant) {
        harnessDefaultOptions.push(buildPresetParticipantOption(assistant, localeKey));
      }
    });

    return [
      ...harnessDefaultOptions,
      ...availablePresetOptions.filter(
        (option) =>
          !HARNESS_DEFAULT_PRESET_ASSISTANT_IDS.includes(
            option.participantKey as (typeof HARNESS_DEFAULT_PRESET_ASSISTANT_IDS)[number]
          )
      ),
    ];
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

  const participantMap = useMemo(() => {
    return new Map(availableParticipants.map((participant) => [participant.selectionKey, participant]));
  }, [availableParticipants]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setGroupName(t('conversation.group.defaultName'));
    setSelectedWorkspace(workspace || '');
    setMode(DEFAULT_MODE);
    setCollaborationMode(DEFAULT_COLLABORATION_MODE);
    setSelectedParticipantKeys(availableParticipants.slice(0, 3).map((participant) => participant.selectionKey));
  }, [availableParticipants, t, visible, workspace]);

  useEffect(() => {
    if (collaborationMode !== 'planner-generator-evaluator') {
      return;
    }

    if (mode !== 'debate') {
      setMode('debate');
    }

    setSelectedParticipantKeys(resolveHarnessDefaultSelectionKeys(availableParticipants));
  }, [availableParticipants, collaborationMode, mode]);

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
      console.error('Failed to select discussion group workspace:', error);
      Message.error(t('conversation.group.selectWorkspaceFailed'));
    }
  };

  const handleSubmit = async () => {
    if (selectedParticipantKeys.length < 2) {
      Message.warning(t('conversation.group.minimumParticipants'));
      return;
    }

    const selectedParticipants = selectedParticipantKeys
      .map((selectionKey) => participantMap.get(selectionKey))
      .filter((participant): participant is ParticipantOption => Boolean(participant));
    if (selectedParticipants.length < 2) {
      Message.warning(t('conversation.group.minimumParticipants'));
      return;
    }

    setSubmitting(true);
    try {
      let gitRepository: Awaited<ReturnType<typeof ipcBridge.fs.getGitRepositoryInfo.invoke>>['data'] | undefined;

      if (collaborationMode === 'planner-generator-evaluator') {
        if (!selectedWorkspace.trim()) {
          Message.warning(t('conversation.group.harnessRequiresWorkspace'));
          return;
        }

        if (selectedParticipants.length !== 3) {
          Message.warning(t('conversation.group.harnessRequiresThreeParticipants'));
          return;
        }

        const repositoryResult = await ipcBridge.fs.getGitRepositoryInfo.invoke({
          path: selectedWorkspace.trim(),
        });
        if (
          !repositoryResult.success ||
          !repositoryResult.data?.isRepository ||
          !repositoryResult.data.repositoryRoot
        ) {
          Message.warning(t('conversation.group.harnessRequiresGitRepo'));
          return;
        }
        gitRepository = repositoryResult.data;
      }

      const params = await buildDiscussionGroupParams({
        name: groupName.trim() || t('conversation.group.defaultName'),
        workspace: selectedWorkspace.trim() || undefined,
        language: i18n.language,
        mode,
        participants: selectedParticipants,
        collaborationMode,
        gitRepository,
      });

      const conversation = await ipcBridge.conversation.create.invoke(params);
      onCreated(conversation);
    } catch (error) {
      console.error('Failed to create discussion group:', error);
      Message.error(t('conversation.group.createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ContextGoModal
      visible={visible}
      onCancel={onCancel}
      className='discussion-group-modal'
      header={{
        title: t('conversation.group.createTitle'),
        showClose: true,
        className: 'px-20px pt-16px',
      }}
      footer={{
        className: 'px-20px pb-16px',
        render: () => (
          <div className='flex justify-end gap-10px pt-4px'>
            <Button onClick={onCancel} className={GROUP_MODAL_FOOTER_BUTTON_CLASS_NAME}>
              {t('common.cancel')}
            </Button>
            <Button
              type='primary'
              loading={submitting}
              onClick={() => void handleSubmit()}
              className={GROUP_MODAL_FOOTER_BUTTON_CLASS_NAME}
            >
              {t('conversation.group.createAction')}
            </Button>
          </div>
        ),
      }}
      style={GROUP_MODAL_STYLE}
      contentStyle={GROUP_MODAL_CONTENT_STYLE}
    >
      <div className='flex w-full min-w-0 flex-col gap-12px'>
        <GroupModalSection title={t('conversation.group.nameLabel')}>
          <Input value={groupName} onChange={setGroupName} placeholder={t('conversation.group.namePlaceholder')} />
        </GroupModalSection>

        <GroupModalSection title={t('conversation.group.collaborationLabel')}>
          <Radio.Group
            value={collaborationMode}
            onChange={(value) => setCollaborationMode(value as CollaborationMode)}
            type='button'
            className={GROUP_MODAL_SEGMENTED_GROUP_CLASS_NAME}
          >
            <Radio value='discussion'>{t('conversation.group.collaborationDiscussion')}</Radio>
            <Radio value='planner-generator-evaluator'>{t('conversation.group.collaborationHarness')}</Radio>
          </Radio.Group>
          <Typography.Text type='secondary'>
            {t(`conversation.group.collaborationHint.${collaborationMode}`)}
          </Typography.Text>
        </GroupModalSection>

        <GroupModalSection title={t('conversation.group.workspaceLabel')}>
          <div className='flex flex-col gap-8px md:flex-row md:items-center'>
            <Input
              value={selectedWorkspace}
              onChange={setSelectedWorkspace}
              placeholder={t('conversation.group.workspacePlaceholder')}
              allowClear
              className='min-w-0 flex-1'
            />
            <Button
              type='secondary'
              onClick={() => void handleSelectWorkspace()}
              className='shrink-0 self-start md:self-auto'
            >
              <span className='flex items-center gap-6px'>
                <FolderOpen theme='outline' size='16' />
                <span>{t('conversation.group.selectWorkspace')}</span>
              </span>
            </Button>
          </div>
          <Typography.Text type='secondary'>{t('conversation.group.workspaceHint')}</Typography.Text>
        </GroupModalSection>

        <GroupModalSection title={t('conversation.group.modeLabel')}>
          <Radio.Group
            value={mode}
            onChange={(value) => setMode(value as DiscussionGroupMode)}
            type='button'
            className={GROUP_MODAL_SEGMENTED_GROUP_CLASS_NAME}
          >
            <Radio value='broadcast' disabled={collaborationMode === 'planner-generator-evaluator'}>
              {t('conversation.group.modeBroadcast')}
            </Radio>
            <Radio value='relay' disabled={collaborationMode === 'planner-generator-evaluator'}>
              {t('conversation.group.modeRelay')}
            </Radio>
            <Radio value='debate'>{t('conversation.group.modeDebate')}</Radio>
          </Radio.Group>
          <Typography.Text type='secondary'>{t(`conversation.group.modeHint.${mode}`)}</Typography.Text>
          {collaborationMode === 'planner-generator-evaluator' ? (
            <Typography.Text type='secondary'>{t('conversation.group.harnessUsesDebate')}</Typography.Text>
          ) : null}
        </GroupModalSection>

        <GroupModalSection title={t('conversation.group.participantsLabel')}>
          <div className='flex flex-col gap-8px overflow-y-auto pr-4px' style={GROUP_MODAL_PARTICIPANT_LIST_STYLE}>
            {sections.map((section) => (
              <div key={section.key} className='flex flex-col gap-8px'>
                <Typography.Text type='secondary' className='text-12px uppercase tracking-0.08em'>
                  {section.title}
                </Typography.Text>
                {section.items.map((participant) => {
                  const selected = selectedParticipantKeys.includes(participant.selectionKey);
                  const selectedRoleIndex = selectedParticipantKeys.indexOf(participant.selectionKey);
                  return (
                    <div
                      key={participant.selectionKey}
                      className={[
                        GROUP_MODAL_PARTICIPANT_CARD_CLASS_NAME,
                        selected ? GROUP_MODAL_PARTICIPANT_CARD_SELECTED_CLASS_NAME : '',
                      ].join(' ')}
                    >
                      <Checkbox
                        checked={selected}
                        onChange={(checked) => {
                          setSelectedParticipantKeys((prev) => {
                            if (checked) {
                              if (
                                collaborationMode === 'planner-generator-evaluator' &&
                                !prev.includes(participant.selectionKey) &&
                                prev.length >= 3
                              ) {
                                return prev;
                              }
                              return prev.includes(participant.selectionKey)
                                ? prev
                                : [...prev, participant.selectionKey];
                            }
                            return prev.filter((key) => key !== participant.selectionKey);
                          });
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
                        {collaborationMode === 'planner-generator-evaluator' && selected ? (
                          <div className={GROUP_MODAL_PARTICIPANT_META_CLASS_NAME}>
                            <Typography.Text type='secondary' className='text-12px'>
                              {t(resolveHarnessRoleLabelKey(selectedRoleIndex))}
                            </Typography.Text>
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
            {collaborationMode === 'planner-generator-evaluator'
              ? t('conversation.group.harnessParticipantsHint')
              : t('conversation.group.minimumParticipantsHint')}
          </Typography.Text>
        </GroupModalSection>
      </div>
    </ContextGoModal>
  );
};

export default CreateDiscussionGroupModal;
