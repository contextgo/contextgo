import React from 'react';
import { Button, Card, Empty, List, Space, Tag, Typography } from '@arco-design/web-react';
import { useEffect, useMemo, useState } from 'react';
import type { IContextMemoryCandidateView } from '@/common/adapter/ipcBridge';
import type {
  ContextGoBoardRef,
  ContextGoEmbedDescriptor,
  ContextGoSurfaceStatus,
  IContextGoSpaceProvider,
} from './IContextGoSpaceProvider';
import ContextGoEmbedContainer from './ContextGoEmbedContainer';
import ContextGoNativeCanvasHost from './native/ContextGoNativeCanvasHost';

const { Paragraph, Text } = Typography;

type ContextGoCanvasSurfaceProps = {
  spaceId: string;
  boards: readonly ContextGoBoardRef[];
  provider: IContextGoSpaceProvider;
  status?: ContextGoSurfaceStatus;
  selectionSummary: string;
  selectionCount: number;
  candidateCards: readonly IContextMemoryCandidateView[];
  reviewingCandidateId?: string | null;
  onCreated?: (board: ContextGoBoardRef) => void;
  onAskAgentWithSelection: () => Promise<void>;
  onPromoteCandidate: (candidateId: string, destination: 'document' | 'board', boardId?: string) => Promise<void>;
  onReviewCandidate: (candidateId: string, action: 'approve' | 'reject') => Promise<void>;
};

export default function ContextGoCanvasSurface(props: ContextGoCanvasSurfaceProps) {
  const [activeBoardId, setActiveBoardId] = useState<string | undefined>(props.boards[0]?.id);
  const [embedDescriptor, setEmbedDescriptor] = useState<ContextGoEmbedDescriptor | undefined>();

  useEffect(() => {
    if (!activeBoardId) {
      setEmbedDescriptor(undefined);
      return;
    }

    let cancelled = false;
    void props.provider
      .getEmbedDescriptor({ kind: 'board', spaceId: props.spaceId, entityId: activeBoardId })
      .then((descriptor) => {
        if (!cancelled) {
          setEmbedDescriptor(descriptor);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeBoardId, props.provider, props.spaceId]);

  useEffect(() => {
    if (!activeBoardId && props.boards[0]?.id) {
      setActiveBoardId(props.boards[0].id);
    }
  }, [activeBoardId, props.boards]);

  const handleCreate = async () => {
    const board = await props.provider.createBoard(props.spaceId, `New Board ${props.boards.length + 1}`);
    props.onCreated?.(board);
    setActiveBoardId(board.id);
  };

  const candidateCards = props.candidateCards.slice(0, 8);
  const activeBoard = useMemo(
    () => props.boards.find((board) => board.id === activeBoardId),
    [activeBoardId, props.boards]
  );
  const boardPromotionLabel = activeBoard ? `Promote to ${activeBoard.title}` : 'Promote to New Board';
  const activeBoardCards = [...(activeBoard?.cards ?? [])];
  const embeddedCanvasSrc = useMemo(() => embedDescriptor?.src, [embedDescriptor?.src]);

  const renderCandidateCards = () => {
    return (
      <Card size='small' title={`Canvas Candidate Cards (${candidateCards.length})`}>
        {candidateCards.length === 0 ? (
          <Empty description='No candidate cards yet' />
        ) : (
          <List
            dataSource={candidateCards}
            render={(item) => (
              <List.Item key={item.id}>
                <Space direction='vertical' size={8} className='w-full'>
                  <Space direction='vertical' size={2} className='w-full'>
                    <Text>{item.summary}</Text>
                    <Text type='secondary'>
                      score {item.promotionScore} · {item.tier} · {item.destination}
                    </Text>
                  </Space>
                  <Space>
                    <Button
                      size='mini'
                      type='primary'
                      loading={props.reviewingCandidateId === item.id}
                      onClick={() => void props.onReviewCandidate(item.id, 'approve')}
                    >
                      Approve
                    </Button>
                    <Button
                      size='mini'
                      status='danger'
                      loading={props.reviewingCandidateId === item.id}
                      onClick={() => void props.onReviewCandidate(item.id, 'reject')}
                    >
                      Reject
                    </Button>
                    <Button
                      size='mini'
                      loading={props.reviewingCandidateId === item.id}
                      onClick={() => void props.onPromoteCandidate(item.id, 'document')}
                    >
                      Promote to Doc
                    </Button>
                    <Button
                      size='mini'
                      loading={props.reviewingCandidateId === item.id}
                      onClick={() => void props.onPromoteCandidate(item.id, 'board', activeBoard?.id)}
                    >
                      {boardPromotionLabel}
                    </Button>
                  </Space>
                </Space>
              </List.Item>
            )}
          />
        )}
      </Card>
    );
  };

  const renderActiveBoardPreview = () => {
    return (
      <Card
        size='small'
        title={`Active Board Cards (${activeBoardCards.length})${activeBoard ? ` · ${activeBoard.title}` : ''}`}
      >
        {!activeBoard ? (
          <Empty description='No active board selected' />
        ) : activeBoardCards.length === 0 ? (
          <Empty description='This board has no candidate cards yet' />
        ) : (
          <List
            dataSource={activeBoardCards}
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
    );
  };

  if (props.status?.mode === 'embedded' && embeddedCanvasSrc) {
    return (
      <Space direction='vertical' size='medium' className='w-full'>
        <Card size='small' title='Space Canvas'>
          <Space direction='vertical' size='small' className='w-full'>
            <Tag color='green'>{props.status.mode}</Tag>
            <Text type='secondary'>
              {props.status?.webAppUrl ? `Connected to ${props.status.webAppUrl}` : 'Canvas URL not configured yet'}
            </Text>
            <Paragraph className='mb-0'>{props.selectionSummary}</Paragraph>
            <Space>
              <Tag color='arcoblue'>{props.selectionCount} selected</Tag>
              <Button type='primary' size='small' onClick={() => void props.onAskAgentWithSelection()}>
                Ask Agent with Selection
              </Button>
              <Button size='small' onClick={() => void handleCreate()}>
                New Board
              </Button>
              <Button size='small' onClick={() => void props.provider.openBoard(props.spaceId, activeBoardId || props.spaceId)}>
                Open Canvas
              </Button>
            </Space>
          </Space>
        </Card>
        <ContextGoEmbedContainer
          descriptor={{
            title: embedDescriptor?.title || 'Space Canvas',
            mode: 'iframe',
            src: embeddedCanvasSrc,
          }}
          height={760}
        />
      </Space>
    );
  }

  if (props.status?.mode === 'shell') {
    return (
      <Space direction='vertical' size='medium' className='w-full'>
        <ContextGoNativeCanvasHost
          spaceId={props.spaceId}
          boardId={activeBoardId}
          selectionSummary={props.selectionSummary}
        />
        <Card size='small' title={`Boards (${props.boards.length})`}>
          {props.boards.length === 0 ? (
            <Empty description='No boards yet' />
          ) : (
            <List
              dataSource={[...props.boards]}
              render={(item) => (
                <List.Item key={item.id}>
                  <Space className='w-full justify-between'>
                    <Space direction='vertical' size={2} className='w-full'>
                      <Text>{item.title}</Text>
                      {item.preview ? <Text type='secondary'>{item.preview}</Text> : null}
                    </Space>
                    <Space>
                      <Button size='mini' onClick={() => setActiveBoardId(item.id)}>
                        Select
                      </Button>
                      <Button size='mini' onClick={() => void props.provider.openBoard(props.spaceId, item.id)}>
                        Open
                      </Button>
                    </Space>
                  </Space>
                </List.Item>
              )}
            />
          )}
        </Card>
        {renderActiveBoardPreview()}
        {renderCandidateCards()}
      </Space>
    );
  }

  return (
    <Space direction='vertical' size='medium' className='w-full'>
      <Card size='small' title='Space Canvas'>
        <Space direction='vertical' size='small' className='w-full'>
          <Tag color='green'>{props.status?.mode || 'shell'}</Tag>
          <Text type='secondary'>
            {props.status?.webAppUrl ? `Connected to ${props.status.webAppUrl}` : 'Canvas URL not configured yet'}
          </Text>
          <Paragraph className='mb-0'>{props.selectionSummary}</Paragraph>
          <Space>
            <Tag color='arcoblue'>{props.selectionCount} selected</Tag>
            <Button type='primary' size='small' onClick={() => void props.onAskAgentWithSelection()}>
              Ask Agent with Selection
            </Button>
            <Button size='small' onClick={() => void handleCreate()}>
              New Board
            </Button>
          </Space>
        </Space>
      </Card>
      <Card size='small' title={`Boards (${props.boards.length})`}>
        {props.boards.length === 0 ? (
          <Empty description='No boards yet' />
        ) : (
          <List
            dataSource={[...props.boards]}
            render={(item) => (
              <List.Item key={item.id}>
                <Space className='w-full justify-between'>
                  <Space direction='vertical' size={2} className='w-full'>
                    <Text>{item.title}</Text>
                    {item.preview ? <Text type='secondary'>{item.preview}</Text> : null}
                  </Space>
                  <Space>
                    <Button size='mini' onClick={() => setActiveBoardId(item.id)}>
                      Select
                    </Button>
                    <Button size='mini' onClick={() => void props.provider.openBoard(props.spaceId, item.id)}>
                      Open
                    </Button>
                  </Space>
                </Space>
              </List.Item>
            )}
          />
        )}
      </Card>
      {renderActiveBoardPreview()}
      {renderCandidateCards()}
    </Space>
  );
}
