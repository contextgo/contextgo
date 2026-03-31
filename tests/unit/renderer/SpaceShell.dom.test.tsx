import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import SpaceShell from '../../../src/renderer/pages/space/SpaceShell';
import { MockAffineSpaceProvider } from '../../../src/renderer/pages/space/affine/MockAffineSpaceProvider';

const invokeGetUserConversations = vi.fn();
const invokeListMemoryCandidates = vi.fn();
const invokeReviewMemoryCandidate = vi.fn();
const invokePromoteMemoryCandidate = vi.fn();

vi.mock('../../../src/common/adapter/ipcBridge', () => ({
  ipcBridge: {
    database: {
      getUserConversations: {
        invoke: invokeGetUserConversations,
      },
    },
    conversation: {
      listMemoryCandidates: {
        invoke: invokeListMemoryCandidates,
      },
      reviewMemoryCandidate: {
        invoke: invokeReviewMemoryCandidate,
      },
      promoteMemoryCandidate: {
        invoke: invokePromoteMemoryCandidate,
      },
    },
  },
}));

vi.mock('@arco-design/web-react', async () => {
  const React = await import('react');
  const Tabs = (props: any) => {
    const panes = React.Children.toArray(props.children);
    return (
      <div>
        <div>
          {panes.map((pane: any) => {
            const rawKey = String(pane.key ?? '');
            const tabKey = rawKey.startsWith('.$') ? rawKey.slice(2) : rawKey;
            return (
              <button key={pane.key} onClick={() => props.onChange?.(tabKey)}>
                {pane.props.title}
              </button>
            );
          })}
        </div>
        <div>{props.children}</div>
      </div>
    );
  };
  Tabs.TabPane = (props: any) => <div data-testid={`tab-${props.title}`}>{props.children}</div>;

  const List = ({ dataSource, render }: any) => <div>{dataSource.map((item: any) => render(item))}</div>;
  List.Item = (props: any) => <div>{props.children}</div>;

  return {
    Button: (props: any) => <button {...props}>{props.children}</button>,
    Card: (props: any) => (
      <section>
        <div>{props.title}</div>
        <div>{props.children}</div>
      </section>
    ),
    Empty: (props: any) => <div>{props.description}</div>,
    List,
    Space: (props: any) => <div>{props.children}</div>,
    Tabs,
    Tag: (props: any) => <span>{props.children}</span>,
    Typography: {
      Title: (props: any) => <h1>{props.children}</h1>,
      Paragraph: (props: any) => <p>{props.children}</p>,
      Text: (props: any) => <span>{props.children}</span>,
    },
    Message: {
      useMessage: () => [
        {
          info: vi.fn(async () => undefined),
          error: vi.fn(async () => undefined),
          success: vi.fn(async () => undefined),
        },
        null,
      ],
    },
  };
});

describe('SpaceShell', () => {
  it('renders overview with real thread and pending review data', async () => {
    invokeGetUserConversations.mockResolvedValue([
      {
        id: 'conv-1',
        name: 'Release Thread',
        type: 'acp',
        modifyTime: 2,
        createTime: 1,
        model: { platform: 'openai', name: 'Model', useModel: 'gpt-4.1' },
        extra: { spaceId: 'space-1' },
      },
    ]);
    invokeListMemoryCandidates.mockResolvedValue({
      success: true,
      data: {
        candidates: [
          {
            id: 'candidate-1',
            spaceId: 'space-1',
            summary: 'Confirm release checklist policy',
            tier: 'factual',
            destination: 'memory',
            reviewStatus: 'pending',
            promotionScore: 40,
            createdAt: '2026-03-30T00:00:00.000Z',
            updatedAt: '2026-03-30T00:00:00.000Z',
          },
        ],
      },
    });
    invokeReviewMemoryCandidate.mockResolvedValue({ success: true, data: {} });
    invokePromoteMemoryCandidate.mockResolvedValue({ success: true, data: {} });

    render(<SpaceShell spaceId='space-1' spaceName='My Space' provider={new MockAffineSpaceProvider()} />);

    await waitFor(() => {
      expect(screen.getByText('Release Thread')).toBeInTheDocument();
      expect(screen.getByText('Confirm release checklist policy')).toBeInTheDocument();
    });
  });

  it('asks agent with current canvas selection through provider', async () => {
    invokeGetUserConversations.mockResolvedValue([]);
    invokeListMemoryCandidates.mockResolvedValue({ success: true, data: { candidates: [] } });
    invokeReviewMemoryCandidate.mockResolvedValue({ success: true, data: {} });
    invokePromoteMemoryCandidate.mockResolvedValue({ success: true, data: {} });

    const onAskAgentWithSelection = vi.fn(async () => undefined);
    const provider = new MockAffineSpaceProvider({
      selection: {
        summary: '2 items selected from current canvas',
        items: [
          { kind: 'document', id: 'doc-1', title: 'Doc 1' },
          { kind: 'memory-candidate', id: 'candidate-1', title: 'Candidate 1' },
        ],
      },
      docs: [{ id: 'doc-1', title: 'Release Plan', spaceId: 'space-1' }],
      boards: [{ id: 'board-1', title: 'Launch Canvas', spaceId: 'space-1' }],
      onAskAgentWithSelection,
    });

    render(<SpaceShell spaceId='space-1' spaceName='My Space' provider={provider} />);
    fireEvent.click(screen.getByText('Canvas'));
    fireEvent.click(screen.getByText('Ask Agent with Selection'));

    await waitFor(() => {
      expect(onAskAgentWithSelection).toHaveBeenCalledWith(
        expect.objectContaining({
          spaceId: 'space-1',
          view: 'canvas',
        })
      );
    });
  });

  it('reviews candidate memories from context view', async () => {
    invokeGetUserConversations.mockResolvedValue([]);
    invokeListMemoryCandidates.mockResolvedValue({
      success: true,
      data: {
        candidates: [
          {
            id: 'candidate-1',
            spaceId: 'space-1',
            summary: 'Confirm release checklist policy',
            tier: 'factual',
            destination: 'memory',
            reviewStatus: 'pending',
            promotionScore: 40,
            createdAt: '2026-03-30T00:00:00.000Z',
            updatedAt: '2026-03-30T00:00:00.000Z',
          },
        ],
      },
    });
    invokeReviewMemoryCandidate.mockResolvedValue({ success: true, data: {} });
    invokePromoteMemoryCandidate.mockResolvedValue({ success: true, data: {} });

    render(<SpaceShell spaceId='space-1' spaceName='My Space' provider={new MockAffineSpaceProvider()} />);
    fireEvent.click(screen.getByText('Context'));
    fireEvent.click(screen.getByText('Approve'));

    await waitFor(() => {
      expect(invokeReviewMemoryCandidate).toHaveBeenCalledWith({
        candidateId: 'candidate-1',
        action: 'approve',
      });
    });
  });

  it('promotes candidate memories to docs from context view', async () => {
    invokeGetUserConversations.mockResolvedValue([]);
    invokeListMemoryCandidates.mockResolvedValue({
      success: true,
      data: {
        candidates: [
          {
            id: 'candidate-1',
            spaceId: 'space-1',
            summary: 'Confirm release checklist policy',
            tier: 'factual',
            destination: 'memory',
            reviewStatus: 'pending',
            promotionScore: 40,
            createdAt: '2026-03-30T00:00:00.000Z',
            updatedAt: '2026-03-30T00:00:00.000Z',
          },
        ],
      },
    });
    invokeReviewMemoryCandidate.mockResolvedValue({ success: true, data: {} });
    invokePromoteMemoryCandidate.mockResolvedValue({ success: true, data: {} });

    render(<SpaceShell spaceId='space-1' spaceName='My Space' provider={new MockAffineSpaceProvider()} />);
    fireEvent.click(screen.getByText('Context'));
    fireEvent.click(screen.getByText('Promote to Doc'));

    await waitFor(() => {
      expect(invokePromoteMemoryCandidate).toHaveBeenCalledWith({
        candidateId: 'candidate-1',
        destination: 'document',
      });
    });
  });

  it('shows candidate cards inside canvas view and promotes to board', async () => {
    invokeGetUserConversations.mockResolvedValue([]);
    invokeListMemoryCandidates.mockResolvedValue({
      success: true,
      data: {
        candidates: [
          {
            id: 'candidate-1',
            spaceId: 'space-1',
            summary: 'Confirm release checklist policy',
            tier: 'factual',
            destination: 'memory',
            reviewStatus: 'pending',
            promotionScore: 40,
            createdAt: '2026-03-30T00:00:00.000Z',
            updatedAt: '2026-03-30T00:00:00.000Z',
          },
        ],
      },
    });
    invokeReviewMemoryCandidate.mockResolvedValue({ success: true, data: {} });
    invokePromoteMemoryCandidate.mockResolvedValue({ success: true, data: {} });

    render(
      <SpaceShell
        spaceId='space-1'
        spaceName='My Space'
        provider={
          new MockAffineSpaceProvider({
            boards: [{ id: 'board-1', title: 'Launch Board', spaceId: 'space-1', cards: [] }],
          })
        }
      />
    );
    fireEvent.click(screen.getByText('Canvas'));
    fireEvent.click(screen.getByText('Promote to Launch Board'));

    await waitFor(() => {
      expect(invokePromoteMemoryCandidate).toHaveBeenCalledWith({
        candidateId: 'candidate-1',
        destination: 'board',
      });
    });
  });
});
