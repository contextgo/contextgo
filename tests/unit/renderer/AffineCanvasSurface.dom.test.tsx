import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import AffineCanvasSurface from '../../../src/renderer/pages/space/affine/AffineCanvasSurface';
import { MockAffineSpaceProvider } from '../../../src/renderer/pages/space/affine/MockAffineSpaceProvider';

vi.mock('@arco-design/web-react', async () => {
  const React = await import('react');
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
    Tag: (props: any) => <span>{props.children}</span>,
    Typography: {
      Paragraph: (props: any) => <p>{props.children}</p>,
      Text: (props: any) => <span>{props.children}</span>,
    },
  };
});

describe('AffineCanvasSurface', () => {
  it('shows board candidate preview cards after promotion result is reflected in boards', async () => {
    const provider = new MockAffineSpaceProvider({
      boards: [
        {
          id: 'board-1',
          title: 'Launch Board',
          spaceId: 'space-1',
          cards: [
            {
              id: 'card-1',
              title: 'Release checklist decision',
              preview: 'Release checklist decision · Tier: factual',
              sourceCandidateId: 'candidate-1',
            },
          ],
        },
      ],
    });

    render(
      <AffineCanvasSurface
        spaceId='space-1'
        boards={[
          {
            id: 'board-1',
            title: 'Launch Board',
            spaceId: 'space-1',
            cards: [
              {
                id: 'card-1',
                title: 'Release checklist decision',
                preview: 'Release checklist decision · Tier: factual',
                sourceCandidateId: 'candidate-1',
              },
            ],
          },
        ]}
        provider={provider}
        status={{ mode: 'shell', ready: true, label: 'AFFiNE Provider' }}
        selectionSummary='No selection'
        selectionCount={0}
        candidateCards={[]}
        onAskAgentWithSelection={vi.fn(async () => undefined)}
        onPromoteCandidate={vi.fn(async () => undefined)}
        onReviewCandidate={vi.fn(async () => undefined)}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Active Board Cards (1) · Launch Board')).toBeInTheDocument();
      expect(screen.getByText('Release checklist decision')).toBeInTheDocument();
    });
  });
});
