import React from 'react';
import { Avatar, Button, Card, List, Message, Space, Tabs, Tag, Typography } from '@arco-design/web-react';
import { Left } from '@icon-park/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ipcBridge } from '@/common';
import type {
  IContextMemoryCandidateView,
  IContextMemoryView,
  IContextProfileView,
} from '@/common/adapter/ipcBridge';
import type { SpaceMember, SpacePermissionsPolicy, TChatConversation, TSpace } from '@/common/config/storage';
import { useAuth } from '@/renderer/hooks/context/AuthContext';
import { SPACE_MVP_PRIMARY_VIEWS } from './constants';
import type {
  SpacePrimaryView,
} from './types';
import type {
  ContextGoBoardRef,
  ContextGoDocRef,
  ContextGoSurfaceStatus,
  IContextGoSpaceProvider,
} from './content/IContextGoSpaceProvider';
import { ContextGoContentBridge } from './content/ContextGoContentBridge';
import { getSpaceContentRuntimeConfig } from './content/spaceContentRuntimeConfig';
import ContextGoDocsSurface from './content/ContextGoDocsSurface';
import ContextGoCanvasSurface from './content/ContextGoCanvasSurface';
import SpaceContextPanel from './components/SpaceContextPanel';
import SpaceMembersPanel, { DEFAULT_ROLE_CAPABILITIES } from './components/SpaceMembersPanel';

const { Paragraph, Title, Text } = Typography;

type SpaceShellProps = {
  spaceId: string;
  spaceName: string;
  provider?: IContextGoSpaceProvider;
};

function useSpaceProvider(spaceRecord?: TSpace, provider?: IContextGoSpaceProvider): IContextGoSpaceProvider {
  const runtimeConfig = getSpaceContentRuntimeConfig();
  return useMemo(
    () =>
      provider ??
      new ContextGoContentBridge({
        space: spaceRecord,
        mode: runtimeConfig.webAppUrl ? 'embedded' : 'shell',
        repoPath: '/Users/codefriday/workspace/project/contextgo/affine',
        webAppUrl: runtimeConfig.webAppUrl,
      }),
    [provider, runtimeConfig.webAppUrl, spaceRecord]
  );
}

function buildCandidateMarkdown(candidate: IContextMemoryCandidateView): string {
  const sections = [`# ${candidate.summary}`];
  if (candidate.detail) {
    sections.push(candidate.detail);
  }
  sections.push(`- Tier: ${candidate.tier}`);
  sections.push(`- Promotion Score: ${candidate.promotionScore}`);
  return sections.join('\n\n');
}

function sortConversationsByModifyTime(conversations: readonly TChatConversation[]): TChatConversation[] {
  return [...conversations].sort((left, right) => (right.modifyTime || 0) - (left.modifyTime || 0));
}

function buildDefaultLocalMember(user: ReturnType<typeof useAuth>['user']): SpaceMember {
  const now = Date.now();
  return {
    id: user?.id || 'local-user',
    displayName: user?.displayName || user?.username || 'Local User',
    secondaryText: user?.email || (user?.username ? `@${user.username}` : 'Local-only session'),
    avatarUrl: user?.avatarUrl ?? null,
    role: 'owner',
    status: 'active',
    createTime: now,
    modifyTime: now,
  };
}

function buildDefaultPermissionsPolicy(): SpacePermissionsPolicy {
  return {
    roleCapabilities: DEFAULT_ROLE_CAPABILITIES,
    durableMemoryRoles: ['owner', 'admin', 'reviewer'],
    criticalMemoryReviewRoles: ['owner', 'admin', 'reviewer'],
  };
}

export default function SpaceShell(props: SpaceShellProps) {
  const [messageApi, messageHolder] = Message.useMessage();
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<SpacePrimaryView>('canvas');
  const [docs, setDocs] = useState<readonly ContextGoDocRef[]>([]);
  const [boards, setBoards] = useState<readonly ContextGoBoardRef[]>([]);
  const [providerStatus, setProviderStatus] = useState<ContextGoSurfaceStatus | undefined>();
  const [selectionSummary, setSelectionSummary] = useState<string>('');
  const [selectionCount, setSelectionCount] = useState<number>(0);
  const [conversations, setConversations] = useState<TChatConversation[]>([]);
  const [spaceRecord, setSpaceRecord] = useState<TSpace | undefined>();
  const provider = useSpaceProvider(spaceRecord, props.provider);
  const [acceptedMemories, setAcceptedMemories] = useState<readonly IContextMemoryView[]>([]);
  const [profiles, setProfiles] = useState<readonly IContextProfileView[]>([]);
  const [pendingCandidates, setPendingCandidates] = useState<IContextMemoryCandidateView[]>([]);
  const [reviewingCandidateId, setReviewingCandidateId] = useState<string | null>(null);

  const loadSpaceData = useCallback(async () => {
    const [status, nextDocs, nextBoards, selection, allConversations, reviewResult, contextResult, nextSpace] = await Promise.all([
      provider.getStatus(),
      provider.listDocs(props.spaceId),
      provider.listBoards(props.spaceId),
      provider.getSelectionContext(props.spaceId),
      ipcBridge.database.getUserConversations.invoke({ page: 0, pageSize: 200 }),
      ipcBridge.conversation.listMemoryCandidates.invoke({
        spaceId: props.spaceId,
        state: 'pending_review',
        reviewStatus: 'pending',
      }),
      ipcBridge.space.getContext.invoke({ spaceId: props.spaceId }),
      ipcBridge.space.get.invoke({ id: props.spaceId }),
    ]);

    const nextConversations = sortConversationsByModifyTime(
      allConversations.filter((conversation) => conversation.extra?.spaceId === props.spaceId)
    );

    setProviderStatus(status);
    setDocs(nextDocs);
    setBoards(nextBoards);
    setSelectionSummary(selection.summary ?? '');
    setSelectionCount(selection.items.length);
    setConversations(nextConversations);
    setSpaceRecord(nextSpace);
    setPendingCandidates(reviewResult.data?.candidates ?? []);
    setAcceptedMemories(contextResult.memories ?? []);
    setProfiles(contextResult.profiles ?? []);
  }, [props.spaceId, provider]);

  useEffect(() => {
    let cancelled = false;

    void loadSpaceData().catch(async (error) => {
      if (cancelled) {
        return;
      }
      console.warn('[SpaceShell] Failed to load space overview:', error);
      await messageApi.error('Failed to load space overview');
    });

    return () => {
      cancelled = true;
    };
  }, [loadSpaceData]);

  const handleAskAgentWithSelection = async () => {
    const selection = await provider.getSelectionContext(props.spaceId);
    await provider.askAgentWithSelection({
      spaceId: props.spaceId,
      view: activeView,
      items: selection.items,
    });
    await messageApi.info(`${selection.items.length} item(s) sent to Agent`);
  };

  const handleReviewCandidate = async (candidateId: string, action: 'approve' | 'reject') => {
    try {
      setReviewingCandidateId(candidateId);
      const result = await ipcBridge.conversation.reviewMemoryCandidate.invoke({ candidateId, action });
      if (!result.success) {
        throw new Error(result.msg || `Failed to ${action} candidate`);
      }
      await loadSpaceData();
      await messageApi.success(
        action === 'approve' ? t('space.context.actions.approve') : t('space.context.actions.reject')
      );
    } catch (error) {
      console.warn('[SpaceShell] Failed to review candidate:', error);
      await messageApi.error(action === 'approve' ? 'Approve failed' : 'Reject failed');
    } finally {
      setReviewingCandidateId(null);
    }
  };

  const handlePromoteCandidate = async (candidateId: string, destination: 'document' | 'board', boardId?: string) => {
    try {
      setReviewingCandidateId(candidateId);
      if (destination === 'document') {
        const candidate = pendingCandidates.find((item) => item.id === candidateId);
        const doc = await provider.promoteCandidateToDoc({
          spaceId: props.spaceId,
          candidateId,
          title: candidate?.summary || `Candidate ${candidateId}`,
          content: candidate ? buildCandidateMarkdown(candidate) : undefined,
        });
        setDocs((prev) => [doc, ...prev.filter((item) => item.id !== doc.id)]);
      } else {
        const candidate = pendingCandidates.find((item) => item.id === candidateId);
        const board = await provider.promoteCandidateToBoard({
          spaceId: props.spaceId,
          candidateId,
          boardId,
          title: candidate?.summary || `Candidate ${candidateId}`,
          content: candidate ? buildCandidateMarkdown(candidate) : undefined,
        });
        setBoards((prev) => [board, ...prev.filter((item) => item.id !== board.id)]);
      }

      const result = await ipcBridge.conversation.promoteMemoryCandidate.invoke({
        candidateId,
        destination,
      });
      if (!result.success) {
        throw new Error(result.msg || `Failed to promote candidate to ${destination}`);
      }

      await loadSpaceData();
      await messageApi.success(
        destination === 'document' ? t('space.context.actions.promoteDoc') : t('space.context.actions.promoteBoard')
      );
    } catch (error) {
      console.warn('[SpaceShell] Failed to promote candidate:', error);
      await messageApi.error(destination === 'document' ? 'Promote to Doc failed' : 'Promote to Board failed');
    } finally {
      setReviewingCandidateId(null);
    }
  };

  const members = useMemo<readonly SpaceMember[]>(() => {
    if (spaceRecord?.members && spaceRecord.members.length > 0) {
      return spaceRecord.members;
    }

    return [buildDefaultLocalMember(user)];
  }, [spaceRecord?.members, user]);

  const permissionsPolicy = useMemo<SpacePermissionsPolicy>(() => {
    return spaceRecord?.permissionsPolicy ?? buildDefaultPermissionsPolicy();
  }, [spaceRecord?.permissionsPolicy]);

  const handleMembersChange = useCallback(
    async (nextMembers: readonly SpaceMember[], nextPermissionsPolicy: SpacePermissionsPolicy) => {
      const result = await ipcBridge.space.update.invoke({
        id: props.spaceId,
        updates: {
          members: [...nextMembers],
          permissionsPolicy: nextPermissionsPolicy,
        },
      });

      if (!result) {
        throw new Error('Failed to update space members');
      }

      setSpaceRecord(result);
      await messageApi.success(t('common.saveSuccess'));
    },
    [messageApi, props.spaceId, t]
  );

  const renderDocs = () => {
    return (
      <div className='grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.75fr)]'>
        <ContextGoDocsSurface
          spaceId={props.spaceId}
          docs={docs}
          provider={provider}
          status={providerStatus}
          onCreated={(doc) => setDocs((prev) => [doc, ...prev])}
        />
        <SpaceContextPanel
          docsCount={docs.length}
          boardsCount={boards.length}
          threadCount={conversations.length}
          acceptedMemories={acceptedMemories}
          profiles={profiles}
          pendingCandidates={pendingCandidates}
          selectionSummary={selectionSummary}
          compact
        />
      </div>
    );
  };

  const renderCanvas = () => {
    return (
        <ContextGoCanvasSurface
          spaceId={props.spaceId}
          boards={boards}
          provider={provider}
        status={providerStatus}
        selectionSummary={selectionSummary || t('space.context.selectionEmpty')}
        selectionCount={selectionCount}
        candidateCards={pendingCandidates}
        reviewingCandidateId={reviewingCandidateId}
        onCreated={(board) => setBoards((prev) => [board, ...prev])}
        onAskAgentWithSelection={handleAskAgentWithSelection}
        onPromoteCandidate={handlePromoteCandidate}
        onReviewCandidate={handleReviewCandidate}
      />
    );
  };

  const renderContext = () => {
    return (
      <div className='grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'>
        <SpaceContextPanel
          docsCount={docs.length}
          boardsCount={boards.length}
          threadCount={conversations.length}
          acceptedMemories={acceptedMemories}
          profiles={profiles}
          pendingCandidates={pendingCandidates}
          selectionSummary={selectionSummary}
        />
        <Card size='small' title={t('space.context.candidateTitle')}>
          {pendingCandidates.length === 0 ? (
            <Text type='secondary'>{t('space.context.candidateEmpty')}</Text>
          ) : (
            <List
              dataSource={[...pendingCandidates.slice(0, 12)]}
              render={(item: IContextMemoryCandidateView) => (
                <List.Item key={item.id}>
                  <Space direction='vertical' size={8} className='w-full'>
                    <Space direction='vertical' size={2} className='w-full'>
                      <Text>{item.summary}</Text>
                      <Text type='secondary'>
                        {item.reviewStatus} · score {item.promotionScore} · {item.tier} · {item.destination}
                      </Text>
                    </Space>
                    <Space wrap>
                      <Button
                        size='small'
                        type='primary'
                        loading={reviewingCandidateId === item.id}
                        onClick={() => void handleReviewCandidate(item.id, 'approve')}
                      >
                        {t('space.context.actions.approve')}
                      </Button>
                      <Button
                        size='small'
                        status='danger'
                        loading={reviewingCandidateId === item.id}
                        onClick={() => void handleReviewCandidate(item.id, 'reject')}
                      >
                        {t('space.context.actions.reject')}
                      </Button>
                      <Button
                        size='small'
                        loading={reviewingCandidateId === item.id}
                        onClick={() => void handlePromoteCandidate(item.id, 'document')}
                      >
                        {t('space.context.actions.promoteDoc')}
                      </Button>
                      <Button
                        size='small'
                        loading={reviewingCandidateId === item.id}
                        onClick={() => void handlePromoteCandidate(item.id, 'board')}
                      >
                        {t('space.context.actions.promoteBoard')}
                      </Button>
                    </Space>
                  </Space>
                </List.Item>
              )}
            />
          )}
        </Card>
      </div>
    );
  };

  const renderMembers = () => {
    return (
      <SpaceMembersPanel
        members={members}
        permissionsPolicy={permissionsPolicy}
        onChange={handleMembersChange}
      />
    );
  };

  const renderActiveView = () => {
    switch (activeView) {
      case 'docs':
        return renderDocs();
      case 'context':
        return renderContext();
      case 'members':
        return renderMembers();
      case 'canvas':
      default:
        return renderCanvas();
    }
  };

  return (
    <div className='flex h-full flex-col gap-4 p-4'>
      {messageHolder}
      <Card size='small'>
        <Space direction='vertical' size='small' className='w-full'>
          <Space align='start' className='w-full justify-between'>
            <Space direction='vertical' size='small' className='min-w-0'>
              <Button
                type='outline'
                size='small'
                icon={<Left theme='outline' size='14' />}
                onClick={() => void navigate('/guid')}
              >
                {t('common.returnToWorkbench')}
              </Button>
              <div>
                <Title heading={4} className='mb-0'>
                  {props.spaceName}
                </Title>
                <Paragraph className='mb-0 mt-4px text-13px text-t-secondary'>{t('space.header.subtitle')}</Paragraph>
              </div>
            </Space>
            <Space direction='vertical' size='small' align='end'>
              <Space wrap>
                <Tag color='green'>{providerStatus?.label || t('space.header.providerFallback')}</Tag>
                <Tag color='arcoblue'>{t('space.header.members', { count: members.length })}</Tag>
                <Tag color='purple'>{t('space.header.roleAware')}</Tag>
              </Space>
              <Space>
                {members.slice(0, 3).map((member) => (
                  <Avatar key={member.id} size={28}>
                    {member.avatarUrl ? <img src={member.avatarUrl} alt={member.displayName} /> : member.displayName[0]}
                  </Avatar>
                ))}
              </Space>
            </Space>
          </Space>
          <Tabs activeTab={activeView} onChange={(key) => setActiveView(key as SpacePrimaryView)}>
            {SPACE_MVP_PRIMARY_VIEWS.map((view) => (
              <Tabs.TabPane key={view} title={t(`space.tabs.${view}`)} />
            ))}
          </Tabs>
        </Space>
      </Card>
      <div className='min-h-0 flex-1 overflow-auto'>{renderActiveView()}</div>
    </div>
  );
}
