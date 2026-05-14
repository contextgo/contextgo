/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { TChatConversation } from '@/common/config/storage';
import { useAssistantList } from '@/renderer/hooks/assistant';
import { ContextGoModal } from '@/renderer/components/base';
import { CUSTOM_AVATAR_IMAGE_MAP } from '@/renderer/pages/guid/constants';
import type { AssistantListItem } from '@/renderer/pages/settings/AgentSettings/AssistantManagement/types';
import {
  isEmoji,
  resolveAvatarImageSrc,
} from '@/renderer/pages/settings/AgentSettings/AssistantManagement/assistantUtils';
import {
  buildDiscussionGroupParams,
  type GroupParticipantInput,
} from '@/renderer/pages/conversation/utils/createConversationParams';
import type { AvailableAgent } from '@/renderer/utils/model/agentTypes';
import { getAgentLogo } from '@/renderer/utils/model/agentLogo';
import { Button, Checkbox, Input, Message, Typography } from '@arco-design/web-react';
import { FolderOpen, Robot } from '@icon-park/react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import GroupModalSection, {
  GROUP_MODAL_CONTENT_STYLE,
  GROUP_MODAL_FIELD_CLASS_NAME,
  GROUP_MODAL_FOOTER_BUTTON_CLASS_NAME,
  GROUP_MODAL_PARTICIPANT_CARD_CLASS_NAME,
  GROUP_MODAL_PARTICIPANT_CARD_SELECTED_CLASS_NAME,
  GROUP_MODAL_PARTICIPANT_LIST_STYLE,
  GROUP_MODAL_STYLE,
} from './GroupModalShared';

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
  spaceId?: string;
  cliAgents: AvailableAgent[];
  presetAssistants: AvailableAgent[];
  onCancel: () => void;
  onCreated: (conversation: TChatConversation) => void;
}> = ({ visible, workspace, spaceId, cliAgents, presetAssistants, onCancel, onCreated }) => {
  const { t, i18n } = useTranslation();
  const { assistants, localeKey } = useAssistantList();
  const [groupName, setGroupName] = useState('');
  const [selectedWorkspace, setSelectedWorkspace] = useState('');
  const [selectedParticipantKeys, setSelectedParticipantKeys] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const hasInitializedForOpenRef = useRef(false);

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

    setGroupName(t('conversation.group.defaultName'));
    setSelectedWorkspace(workspace || '');
    setSelectedParticipantKeys(availableParticipants.slice(0, 2).map((participant) => participant.selectionKey));
    hasInitializedForOpenRef.current = true;
  }, [availableParticipants, t, visible, workspace]);

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

    if (selectedParticipants.length < 2) {
      Message.warning(t('conversation.group.minimumParticipants'));
      return;
    }

    setSubmitting(true);
    try {
      const params = await buildDiscussionGroupParams({
        name: groupName.trim() || t('conversation.group.defaultName'),
        spaceId,
        workspace: selectedWorkspace.trim() || undefined,
        language: i18n.language,
        mode: 'debate',
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
    <ContextGoModal
      visible={visible}
      onCancel={onCancel}
      className='create-group-modal'
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
          <Input
            value={groupName}
            onChange={setGroupName}
            placeholder={t('conversation.group.namePlaceholder')}
            className={GROUP_MODAL_FIELD_CLASS_NAME}
          />
        </GroupModalSection>

        <GroupModalSection title={t('conversation.group.workspaceLabel')}>
          <div className='flex flex-col gap-8px md:flex-row md:items-center'>
            <Input
              value={selectedWorkspace}
              onChange={setSelectedWorkspace}
              placeholder={t('conversation.group.workspacePlaceholder')}
              allowClear
              className={`min-w-0 flex-1 ${GROUP_MODAL_FIELD_CLASS_NAME}`}
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

        <GroupModalSection title={t('conversation.group.fixedFlowLabel')}>
          <Typography.Text type='secondary'>{t('conversation.group.fixedFlowHint')}</Typography.Text>
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
                          setSelectedParticipantKeys((previousKeys) =>
                            checked
                              ? previousKeys.includes(participant.selectionKey)
                                ? previousKeys
                                : [...previousKeys, participant.selectionKey]
                              : previousKeys.filter((key) => key !== participant.selectionKey)
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
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <Typography.Text type='secondary'>{t('conversation.group.minimumParticipantsHint')}</Typography.Text>
        </GroupModalSection>
      </div>
    </ContextGoModal>
  );
};

export default CreateGroupModal;
