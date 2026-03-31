import { Button, Card, Empty, List, Message, Space, Tabs, Tag, Typography } from '@arco-design/web-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ipcBridge } from '@/common';
import type { TChatConversation } from '@/common/config/storage';
import type { IContextMemoryCandidateView } from '@/common/adapter/ipcBridge';
import { SPACE_MVP_PRIMARY_VIEWS } from './constants';
import type { SpacePrimaryView } from './types';
import type { AffineProviderStatus, IAffineSpaceProvider } from './affine/IAffineSpaceProvider';
import { AffineProviderBridge } from './affine/AffineProviderBridge';
import { getAffineRuntimeConfig } from './affine/affineRuntimeConfig';
import AffineDocSurface from './affine/AffineDocSurface';
import AffineCanvasSurface from './affine/AffineCanvasSurface';

const { Title, Text } = Typography;

type SpaceShellProps = {
  spaceId: string;
  spaceName: string;
  provider?: IAffineSpaceProvider;
};

function useSpaceProvider(provider?: IAffineSpaceProvider): IAffineSpaceProvider {
  const runtimeConfig = getAffineRuntimeConfig();
  return useMemo(
    () =>
      provider ??
      new AffineProviderBridge({
        mode: runtimeConfig.webAppUrl ? 'embedded' : 'shell',
        repoPath: '/Users/codefriday/workspace/project/contextgo/affine',
        webAppUrl: runtimeConfig.webAppUrl,
      }),
    [provider, runtimeConfig.webAppUrl]
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

export default function SpaceShell(props: SpaceShellProps) {
  const [messageApi, messageHolder] = Message.useMessage();
  const provider = useSpaceProvider(props.provider);
  const [activeView, setActiveView] = useState<SpacePrimaryView>('overview');
  const [docs, setDocs] = useState<readonly { id: string; title: string; spaceId: string }[]>([]);
  const [boards, setBoards] = useState<readonly { id: string; title: string; spaceId: string }[]>([]);
  const [providerStatus, setProviderStatus] = useState<AffineProviderStatus | undefined>();
  const [selectionSummary, setSelectionSummary] = useState<string>('No active selection');
  const [selectionCount, setSelectionCount] = useState<number>(0);
  const [conversations, setConversations] = useState<TChatConversation[]>([]);
  const [pendingCandidates, setPendingCandidates] = useState<IContextMemoryCandidateView[]>([]);
  const [reviewingCandidateId, setReviewingCandidateId] = useState<string | null>(null);

  const loadSpaceData = useCallback(async () => {
    const [status, nextDocs, nextBoards, selection, allConversations, reviewResult] = await Promise.all([
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
    ]);

    setProviderStatus(status);
    setDocs(nextDocs);
    setBoards(nextBoards);
    setSelectionSummary(selection.summary ?? 'No active selection');
    setSelectionCount(selection.items.length);
    setConversations(
      sortConversationsByModifyTime(allConversations.filter((conversation) => conversation.extra?.spaceId === props.spaceId))
    );
    setPendingCandidates(reviewResult.data?.candidates ?? []);
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
  }, [loadSpaceData, messageApi]);

  const handleAskAgentWithSelection = async () => {
    const selection = await provider.getSelectionContext(props.spaceId);
    await provider.askAgentWithSelection({
      spaceId: props.spaceId,
      view: activeView,
      items: selection.items,
    });
    await messageApi.info(`Sent ${selection.items.length} selected item(s) to Agent`);
  };

  const handleReviewCandidate = async (candidateId: string, action: 'approve' | 'reject') => {
    try {
      setReviewingCandidateId(candidateId);
      const result = await ipcBridge.conversation.reviewMemoryCandidate.invoke({ candidateId, action });
      if (!result.success) {
        throw new Error(result.msg || `Failed to ${action} candidate`);
      }
      await loadSpaceData();
      await messageApi.success(action === 'approve' ? 'Candidate approved' : 'Candidate rejected');
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
      await messageApi.success(destination === 'document' ? 'Promoted to Doc' : 'Promoted to Board');
    } catch (error) {
      console.warn('[SpaceShell] Failed to promote candidate:', error);
      await messageApi.error(destination === 'document' ? 'Promote to Doc failed' : 'Promote to Board failed');
    } finally {
      setReviewingCandidateId(null);
    }
  };


  const recentThreads = conversations.slice(0, 5);
  const pendingReviewPreview = pendingCandidates.slice(0, 5);

  const renderOverview = () => {
    return (
      <div className='grid grid-cols-1 gap-4 xl:grid-cols-2'>
        <Card size='small' title={`Recent Threads (${recentThreads.length})`}>
          {recentThreads.length === 0 ? (
            <Empty description='No threads in this space yet' />
          ) : (
            <List
              dataSource={recentThreads}
              render={(item) => (
                <List.Item key={item.id}>
                  <Space direction='vertical' size={2} className='w-full'>
                    <Text>{item.name}</Text>
                    <Text type='secondary'>{item.type}</Text>
                  </Space>
                </List.Item>
              )}
            />
          )}
        </Card>
        <Card size='small' title={`Recent Docs (${docs.length})`}>
          {docs.length === 0 ? (
            <Empty description='No docs yet' />
          ) : (
            <List
              dataSource={docs.slice(0, 5)}
              render={(item) => (
                <List.Item key={item.id}>
                  <Space direction='vertical' size={2} className='w-full'>
                    <Text>{item.title}</Text>
                    {item.preview ? <Text type='secondary'>{item.preview}</Text> : null}
                  </Space>
                </List.Item>
              )}
            />
          )}
        </Card>
        <Card size='small' title={`Recent Boards (${boards.length})`}>
          {boards.length === 0 ? (
            <Empty description='No boards yet' />
          ) : (
            <List
              dataSource={boards.slice(0, 5)}
              render={(item) => (
                <List.Item key={item.id}>
                  <Space direction='vertical' size={2} className='w-full'>
                    <Text>{item.title}</Text>
                    {item.preview ? <Text type='secondary'>{item.preview}</Text> : null}
                  </Space>
                </List.Item>
              )}
            />
          )}
        </Card>
        <Card size='small' title='Connector Status'>
          <Space direction='vertical' size='small'>
            <Text type='secondary'>Connector overview will be connected next.</Text>
            <Tag color='gray'>No connector status bridge yet</Tag>
          </Space>
        </Card>
        <Card size='small' title={`Pending Reviews (${pendingReviewPreview.length})`}>
          {pendingReviewPreview.length === 0 ? (
            <Empty description='No pending candidate memories' />
          ) : (
            <List
              dataSource={pendingReviewPreview}
              render={(item) => (
                <List.Item key={item.id}>
                  <Space direction='vertical' size={2} className='w-full'>
                    <Text>{item.summary}</Text>
                    <Text type='secondary'>score {item.promotionScore} · {item.tier}</Text>
                  </Space>
                </List.Item>
              )}
            />
          )}
        </Card>
      </div>
    );
  };

  const renderDocs = () => {
    return (
      <AffineDocSurface
        spaceId={props.spaceId}
        docs={docs}
        provider={provider}
        status={providerStatus}
        onCreated={(doc) => setDocs((prev) => [doc, ...prev])}
      />
    );
  };

  const renderCanvas = () => {
    return (
      <AffineCanvasSurface
        spaceId={props.spaceId}
        boards={boards}
        provider={provider}
        status={providerStatus}
        selectionSummary={selectionSummary}
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
      <div className='grid grid-cols-1 gap-4 xl:grid-cols-2'>
        <Card size='small' title='Accepted Memories'>
          <Text type='secondary'>Memory list will be linked to context engine APIs.</Text>
        </Card>
        <Card size='small' title={`Candidate Memories (${pendingCandidates.length})`}>
          {pendingCandidates.length === 0 ? (
            <Empty description='No candidate memories' />
          ) : (
            <List
              dataSource={pendingCandidates.slice(0, 12)}
              render={(item) => (
                <List.Item key={item.id}>
                  <Space direction='vertical' size={8} className='w-full'>
                    <Space direction='vertical' size={2} className='w-full'>
                      <Text>{item.summary}</Text>
                      <Text type='secondary'>
                        {item.reviewStatus} · score {item.promotionScore} · {item.tier} · {item.destination}
                      </Text>
                    </Space>
                    <Space>
                      <Button
                        size='small'
                        type='primary'
                        loading={reviewingCandidateId === item.id}
                        onClick={() => void handleReviewCandidate(item.id, 'approve')}
                      >
                        Approve
                      </Button>
                      <Button
                        size='small'
                        status='danger'
                        loading={reviewingCandidateId === item.id}
                        onClick={() => void handleReviewCandidate(item.id, 'reject')}
                      >
                        Reject
                      </Button>
                      <Button
                        size='small'
                        loading={reviewingCandidateId === item.id}
                        onClick={() => void handlePromoteCandidate(item.id, 'document')}
                      >
                        Promote to Doc
                      </Button>
                      <Button
                        size='small'
                        loading={reviewingCandidateId === item.id}
                        onClick={() => void handlePromoteCandidate(item.id, 'board')}
                      >
                        Promote to Board
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

  const renderActiveView = () => {
    switch (activeView) {
      case 'docs':
        return renderDocs();
      case 'canvas':
        return renderCanvas();
      case 'context':
        return renderContext();
      case 'overview':
      default:
        return renderOverview();
    }
  };

  return (
    <div className='flex h-full flex-col gap-4 p-4'>
      {messageHolder}
      <Card size='small'>
        <Space direction='vertical' size='small' className='w-full'>
          <Space align='center' className='w-full justify-between'>
            <div>
              <Title heading={4} className='mb-0'>
                {props.spaceName}
              </Title>
              <Text type='secondary'>Space ID: {props.spaceId}</Text>
            </div>
            <Tag color='green'>{providerStatus?.label || 'AFFiNE-ready'}</Tag>
          </Space>
          <Tabs activeTab={activeView} onChange={(key) => setActiveView(key as SpacePrimaryView)}>
            {SPACE_MVP_PRIMARY_VIEWS.map((view) => (
              <Tabs.TabPane key={view} title={view.charAt(0).toUpperCase() + view.slice(1)} />
            ))}
          </Tabs>
        </Space>
      </Card>
      <div className='min-h-0 flex-1 overflow-auto'>{renderActiveView()}</div>
    </div>
  );
}
