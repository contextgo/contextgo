/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { IProvider, TChatConversation, TProviderWithModel } from '@/common/config/storage';
import { channel } from '@/common/adapter/ipcBridge';
import { uuid } from '@/common/utils';
import addChatIcon from '@/renderer/assets/icons/add-chat.svg';
import { CronJobManager } from '@/renderer/pages/cron';
import { usePresetAssistantInfo } from '@/renderer/hooks/agent/usePresetAssistantInfo';
import { iconColors } from '@/renderer/styles/colors';
import { Button, Dropdown, Menu, Message, Tooltip, Typography } from '@arco-design/web-react';
import { ConnectionPoint, History } from '@icon-park/react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { emitter } from '../../../utils/emitter';
import AcpChat from '../platforms/acp/AcpChat';
import ChatLayout from './ChatLayout';
import ChatSider from './ChatSider';
import CodexChat from '../platforms/codex/CodexChat';
import NanobotChat from '../platforms/nanobot/NanobotChat';
import OpenClawChat from '../platforms/openclaw/OpenClawChat';
import GeminiChat from '../platforms/gemini/GeminiChat';
import GroupChat from '../platforms/group/GroupChat';
import AcpModelSelector from '@/renderer/components/agent/AcpModelSelector';
import GeminiModelSelector from '../platforms/gemini/GeminiModelSelector';
import { useGeminiModelSelection } from '../platforms/gemini/useGeminiModelSelection';
import { usePreviewContext } from '../Preview';
import { renderConversationHeaderAddons } from '../platforms/conversationHeaderAddons';
// import SkillRuleGenerator from './components/SkillRuleGenerator'; // Temporarily hidden

type PublicationIntent = {
  agentProfileId?: string;
  conversationId: string;
  conversationName?: string;
  backend: string;
  customAgentId?: string;
  workspace?: string;
  agentName?: string;
};

function buildPublicationIntent(conversation: TChatConversation): PublicationIntent | null {
  if (conversation.type === 'group' || conversation.type === 'nanobot') {
    return null;
  }

  if (conversation.type === 'gemini' || conversation.type === 'codex' || conversation.type === 'openclaw-gateway') {
    return {
      conversationId: conversation.id,
      conversationName: conversation.name,
      backend: conversation.type,
      workspace: 'workspace' in conversation.extra ? conversation.extra.workspace : undefined,
    };
  }

  if (conversation.type !== 'acp') {
    return null;
  }

  const backend = conversation.extra?.backend;
  if (!backend) {
    return null;
  }

  return {
    conversationId: conversation.id,
    conversationName: conversation.name,
    backend,
    customAgentId: conversation.extra?.customAgentId,
    workspace: conversation.extra?.workspace,
    agentName: conversation.extra?.agentName,
  };
}

const PublishAgentEntryButton: React.FC<{ conversation: TChatConversation }> = ({ conversation }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const publicationIntent = useMemo(() => buildPublicationIntent(conversation), [conversation]);

  const handlePublishAgent = useCallback(async () => {
    if (!publicationIntent) {
      return;
    }

    setLoading(true);
    try {
      const result = await channel.prepareConversationAgentProfile.invoke({
        conversationId: conversation.id,
      });
      if (!result.success || !result.data) {
        throw new Error(result.msg || t('conversation.header.publishPrepareFailed'));
      }

      void navigate(
        {
          pathname: '/settings/channels',
        },
        {
          state: {
            publicationIntent: {
              ...publicationIntent,
              agentProfileId: result.data.id,
            },
          },
        }
      );
    } catch (error) {
      Message.error(error instanceof Error ? error.message : t('conversation.header.publishPrepareFailed'));
    } finally {
      setLoading(false);
    }
  }, [conversation.id, navigate, publicationIntent, t]);

  const handleContinueSession = useCallback(() => {
    if (!publicationIntent) {
      return;
    }

    void navigate(
      {
        pathname: '/settings/active-sessions',
      },
      {
        state: {
          sessionHandoffIntent: {
            sourceConversationId: publicationIntent.conversationId,
            conversationName: publicationIntent.conversationName,
            backend: publicationIntent.backend,
            workspace: publicationIntent.workspace,
            agentName: publicationIntent.agentName,
          },
        },
      }
    );
  }, [navigate, publicationIntent]);

  if (!publicationIntent) {
    return null;
  }

  return (
    <Dropdown
      trigger='click'
      droplist={
        <Menu>
          <Menu.Item key='publish-agent' onClick={() => void handlePublishAgent()}>
            {t('conversation.header.publishAgentAction')}
          </Menu.Item>
          <Menu.Item key='continue-session' onClick={() => handleContinueSession()}>
            {t('conversation.header.handoffSessionAction')}
          </Menu.Item>
        </Menu>
      }
    >
      <Tooltip content={t('conversation.header.publishAgentEntryHint')}>
        <Button
          type='text'
          size='small'
          className='chat-header-publish-pill !h-auto !w-auto !min-w-0 !px-0 !py-0'
          loading={loading}
          aria-label={t('conversation.header.publishAgentEntry')}
        >
          <span className='inline-flex items-center gap-6px rounded-full px-8px py-2px bg-2'>
            <ConnectionPoint theme='outline' size={16} fill={iconColors.primary} />
            <span className='hidden md:inline text-12px text-t-primary'>
              {t('conversation.header.publishAgentEntry')}
            </span>
          </span>
        </Button>
      </Tooltip>
    </Dropdown>
  );
};

const _AssociatedConversation: React.FC<{ conversation_id: string }> = ({ conversation_id }) => {
  const { data } = useSWR(['getAssociateConversation', conversation_id], () =>
    ipcBridge.conversation.getAssociateConversation.invoke({ conversation_id })
  );
  const navigate = useNavigate();
  const list = useMemo(() => {
    if (!data?.length) return [];
    return data.filter((conversation) => conversation.id !== conversation_id);
  }, [data]);
  if (!list.length) return null;
  return (
    <Dropdown
      droplist={
        <Menu
          onClickMenuItem={(key) => {
            Promise.resolve(navigate(`/conversation/${key}`)).catch((error) => {
              console.error('Navigation failed:', error);
            });
          }}
        >
          {list.map((conversation) => {
            return (
              <Menu.Item key={conversation.id}>
                <Typography.Ellipsis className={'max-w-300px'}>{conversation.name}</Typography.Ellipsis>
              </Menu.Item>
            );
          })}
        </Menu>
      }
      trigger={['click']}
    >
      <Button
        size='mini'
        icon={
          <History
            theme='filled'
            size='14'
            fill={iconColors.primary}
            strokeWidth={2}
            strokeLinejoin='miter'
            strokeLinecap='square'
          />
        }
      ></Button>
    </Dropdown>
  );
};

const _AddNewConversation: React.FC<{ conversation: TChatConversation }> = ({ conversation }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  if (!conversation.extra?.workspace) return null;
  return (
    <Tooltip content={t('conversation.workspace.createNewConversation')}>
      <Button
        size='mini'
        icon={<img src={addChatIcon} alt='Add chat' className='w-14px h-14px block m-auto' />}
        onClick={async () => {
          const id = uuid();
          // Fetch latest conversation from DB to ensure sessionMode is current
          const latest = await ipcBridge.conversation.get.invoke({ id: conversation.id }).catch((): null => null);
          const source = latest || conversation;
          ipcBridge.conversation.createWithConversation
            .invoke({
              conversation: {
                ...source,
                id,
                createTime: Date.now(),
                modifyTime: Date.now(),
                // Clear ACP session fields to prevent new conversation from inheriting old session context
                extra:
                  source.type === 'acp'
                    ? { ...source.extra, acpSessionId: undefined, acpSessionUpdatedAt: undefined }
                    : source.extra,
              } as TChatConversation,
            })
            .then(() => {
              Promise.resolve(navigate(`/conversation/${id}`)).catch((error) => {
                console.error('Navigation failed:', error);
              });
              emitter.emit('chat.history.refresh');
            })
            .catch((error) => {
              console.error('Failed to create conversation:', error);
            });
        }}
      />
    </Tooltip>
  );
};

// 仅抽取 Gemini 会话，确保包含模型信息
// Narrow to Gemini conversations so model field is always available
type GeminiConversation = Extract<TChatConversation, { type: 'gemini' }>;

const GeminiConversationPanel: React.FC<{ conversation: GeminiConversation; sliderTitle: React.ReactNode }> = ({
  conversation,
  sliderTitle,
}) => {
  // Save model selection to conversation via IPC
  const onSelectModel = useCallback(
    async (_provider: IProvider, modelName: string) => {
      const selected = { ..._provider, useModel: modelName } as TProviderWithModel;
      const ok = await ipcBridge.conversation.update.invoke({ id: conversation.id, updates: { model: selected } });
      return Boolean(ok);
    },
    [conversation.id]
  );

  // Share model selection state between header and send box
  const modelSelection = useGeminiModelSelection({ initialModel: conversation.model, onSelectModel });
  const workspaceEnabled = Boolean(conversation.extra?.workspace);

  // 使用统一的 Hook 获取预设助手信息 / Use unified hook for preset assistant info
  const { info: presetAssistantInfo } = usePresetAssistantInfo(conversation);

  const geminiHeaderLeft = useMemo(() => <GeminiModelSelector selection={modelSelection} />, [modelSelection]);

  const geminiHeaderExtra = useMemo(
    () => (
      <div className='flex items-center gap-8px'>
        <div className='shrink-0'>
          <PublishAgentEntryButton conversation={conversation} />
        </div>
        <div className='shrink-0'>
          <CronJobManager conversation={conversation} />
        </div>
      </div>
    ),
    [conversation]
  );

  const chatLayoutProps = {
    title: conversation.name,
    siderTitle: sliderTitle,
    sider: <ChatSider conversation={conversation} />,
    headerLeft: geminiHeaderLeft,
    headerExtra: geminiHeaderExtra,
    workspaceEnabled,
    workspacePath: conversation.extra?.workspace,
    backend: 'gemini' as const,
    // 传递预设助手信息 / Pass preset assistant info
    agentName: presetAssistantInfo?.name,
    agentLogo: presetAssistantInfo?.logo,
    agentLogoIsEmoji: presetAssistantInfo?.isEmoji,
  };

  return (
    <ChatLayout {...chatLayoutProps} conversationId={conversation.id}>
      <GeminiChat
        conversation_id={conversation.id}
        workspace={conversation.extra.workspace}
        modelSelection={modelSelection}
      />
    </ChatLayout>
  );
};

const ChatConversation: React.FC<{
  conversation?: TChatConversation;
}> = ({ conversation }) => {
  const { t } = useTranslation();
  const { openPreview } = usePreviewContext();
  const workspaceEnabled = Boolean(conversation?.extra?.workspace);

  const isGeminiConversation = conversation?.type === 'gemini';
  const isGroupConversation = conversation?.type === 'group';

  const conversationNode = useMemo(() => {
    if (!conversation || isGeminiConversation) return null;
    switch (conversation.type) {
      case 'acp':
        return (
          <AcpChat
            key={conversation.id}
            conversation_id={conversation.id}
            workspace={conversation.extra?.workspace}
            backend={conversation.extra?.backend || 'claude'}
            sessionMode={conversation.extra?.sessionMode}
            agentName={(conversation.extra as { agentName?: string })?.agentName}
          ></AcpChat>
        );
      case 'codex': // Legacy: new Codex conversations use ACP protocol. Kept for existing sessions.
        return (
          <CodexChat
            key={conversation.id}
            conversation_id={conversation.id}
            workspace={conversation.extra?.workspace}
          />
        );
      case 'openclaw-gateway':
        return (
          <OpenClawChat
            key={conversation.id}
            conversation_id={conversation.id}
            workspace={conversation.extra?.workspace}
          />
        );
      case 'nanobot':
        return (
          <NanobotChat
            key={conversation.id}
            conversation_id={conversation.id}
            workspace={conversation.extra?.workspace}
          />
        );
      case 'group':
        return <GroupChat key={conversation.id} conversation={conversation} />;
      default:
        return null;
    }
  }, [conversation, isGeminiConversation, isGroupConversation]);

  // 使用统一的 Hook 获取预设助手信息（ACP/Codex 会话）
  // Use unified hook for preset assistant info (ACP/Codex conversations)
  const { info: presetAssistantInfo, isLoading: isLoadingPreset } = usePresetAssistantInfo(
    isGeminiConversation || isGroupConversation ? undefined : conversation
  );

  const sliderTitle: React.ReactNode = null;

  // For ACP/Codex conversations, use AcpModelSelector that can show/switch models.
  // For other non-Gemini conversations, show disabled GeminiModelSelector.
  // NOTE: This must be placed before the Gemini early return to maintain consistent hook order.
  const modelSelector = useMemo(() => {
    if (!conversation || isGeminiConversation || isGroupConversation) return undefined;
    if (conversation.type === 'acp') {
      const extra = conversation.extra as { backend?: string; currentModelId?: string };
      return (
        <AcpModelSelector
          conversationId={conversation.id}
          backend={extra.backend}
          initialModelId={extra.currentModelId}
        />
      );
    }
    if (conversation.type === 'codex') {
      return <AcpModelSelector conversationId={conversation.id} />;
    }
    if (conversation.type === 'openclaw-gateway') {
      const extra = conversation.extra as { runtimeValidation?: { expectedModel?: string } };
      return (
        <AcpModelSelector
          conversationId={conversation.id}
          backend='openclaw-gateway'
          initialModelId={extra.runtimeValidation?.expectedModel}
        />
      );
    }
    return <GeminiModelSelector disabled={true} />;
  }, [conversation, isGeminiConversation, isGroupConversation]);

  const headerExtraNode = useMemo(
    () => (
      <div className='flex items-center gap-8px'>
        {conversation ? (
          <div className='shrink-0'>
            <PublishAgentEntryButton conversation={conversation} />
          </div>
        ) : null}
        {conversation
          ? renderConversationHeaderAddons({
              conversation,
              openUrlPreview: (url, metadata) => {
                openPreview(url, 'url', metadata);
              },
            })
          : null}
        {conversation ? (
          <div className='shrink-0'>
            <CronJobManager conversation={conversation} />
          </div>
        ) : null}
      </div>
    ),
    [conversation, openPreview]
  );

  if (conversation && conversation.type === 'gemini') {
    // Gemini 会话独立渲染，带右上角模型选择
    // Render Gemini layout with dedicated top-right model selector
    return <GeminiConversationPanel key={conversation.id} conversation={conversation} sliderTitle={sliderTitle} />;
  }

  // 如果有预设助手信息，使用预设助手的 logo 和名称；加载中时不进入 fallback；否则使用 backend 的 logo
  // If preset assistant info exists, use preset logo/name; while loading, avoid fallback; otherwise use backend logo
  const chatLayoutProps = isGroupConversation
    ? {
        agentName: t('conversation.group.header'),
      }
    : presetAssistantInfo
      ? {
          agentName: presetAssistantInfo.name,
          agentLogo: presetAssistantInfo.logo,
          agentLogoIsEmoji: presetAssistantInfo.isEmoji,
        }
      : isLoadingPreset
        ? {} // Still loading custom agents — avoid showing backend logo prematurely
        : {
            backend:
              conversation?.type === 'acp'
                ? conversation?.extra?.backend
                : conversation?.type === 'codex'
                  ? 'codex'
                  : conversation?.type === 'openclaw-gateway'
                    ? 'openclaw-gateway'
                    : conversation?.type === 'nanobot'
                      ? 'nanobot'
                      : undefined,
            agentName: (conversation?.extra as { agentName?: string })?.agentName,
          };

  return (
    <ChatLayout
      title={conversation?.name}
      {...chatLayoutProps}
      headerLeft={modelSelector}
      headerExtra={headerExtraNode}
      siderTitle={sliderTitle}
      sider={<ChatSider conversation={conversation} />}
      workspaceEnabled={workspaceEnabled}
      workspacePath={conversation?.extra?.workspace}
      conversationId={conversation?.id}
    >
      {conversationNode}
    </ChatLayout>
  );
};

export default ChatConversation;
