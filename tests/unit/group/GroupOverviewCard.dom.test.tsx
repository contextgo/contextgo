import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { TChatConversation } from '@/common/config/storage';

const useMessageListMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        'conversation.group.overview.title': 'Group Overview',
        'conversation.group.fixedFlowHint':
          'Every run follows one fixed flow: every agent responds independently, then reacts after seeing the others, and the system closes with one group synthesis.',
        'conversation.group.overview.status.running': 'Running',
        'conversation.group.overview.status.idle': 'Idle',
        'conversation.group.overview.status.finished': 'Finished',
        'conversation.group.overview.latestSpeaker': 'Latest Speaker',
        'conversation.group.overview.latestRoundSummary': 'Latest Round Summary',
        'conversation.group.overview.finalSynthesis': 'Final Synthesis',
        'conversation.group.overview.pending': 'Pending',
      };
      return labels[key] || key;
    },
  }),
}));

vi.mock('@/renderer/pages/conversation/Messages/hooks', () => ({
  useMessageList: () => useMessageListMock(),
}));

import GroupOverviewCard from '@/renderer/pages/conversation/platforms/group/GroupOverviewCard';

const conversation: Extract<TChatConversation, { type: 'group' }> = {
  id: 'group-1',
  name: 'Agent Group',
  type: 'group',
  createTime: 1,
  modifyTime: 1,
  status: 'finished',
  model: {
    id: 'group-placeholder',
    name: 'Group',
    useModel: 'group',
    platform: 'group' as TChatConversation['model']['platform'],
    baseUrl: '',
    apiKey: '',
  },
  extra: {
    workspace: '/tmp/workspace',
    customWorkspace: true,
    participants: [
      {
        id: 'participant-1',
        participantType: 'cli-agent',
        participantKey: 'codex',
        name: 'Codex',
        childConversationId: 'child-1',
      },
      {
        id: 'participant-2',
        participantType: 'cli-agent',
        participantKey: 'claude',
        name: 'Claude',
        childConversationId: 'child-2',
      },
    ],
    orchestration: {
      kind: 'discussion',
      mode: 'debate',
      rounds: 2,
    },
  },
};

describe('GroupOverviewCard', () => {
  it('renders participants and the latest round and final summaries', () => {
    useMessageListMock.mockReturnValue([
      {
        id: 'participant-msg-1',
        msg_id: 'participant-msg-1',
        conversation_id: 'group-1',
        type: 'text',
        position: 'left',
        content: {
          content: 'Participant reply',
          groupMeta: {
            kind: 'discussion',
            participantId: 'participant-1',
            participantName: 'Codex',
            mode: 'debate',
            round: 2,
          },
        },
        createdAt: 1,
      },
      {
        id: 'round-summary',
        msg_id: 'round-summary',
        conversation_id: 'group-1',
        type: 'text',
        position: 'left',
        content: {
          content: '## Round 2 Summary\n\n- **Codex**: prefers option A',
          groupMeta: {
            kind: 'discussion',
            participantId: 'group-round-summary:2',
            participantName: 'Round 2 Summary',
            mode: 'debate',
            round: 2,
            summaryKind: 'round',
          },
        },
        createdAt: 2,
      },
      {
        id: 'final-summary',
        msg_id: 'final-summary',
        conversation_id: 'group-1',
        type: 'text',
        position: 'left',
        content: {
          content: '## Group Synthesis\n\n### Final Participant Views\n- **Codex**: prefers option A',
          groupMeta: {
            kind: 'discussion',
            participantId: 'group-final-summary',
            participantName: 'Group Synthesis',
            mode: 'debate',
            round: 2,
            summaryKind: 'final',
          },
        },
        createdAt: 3,
      },
    ]);

    render(<GroupOverviewCard conversation={conversation} running={false} />);

    expect(screen.getByText('Group Overview')).toBeInTheDocument();
    expect(screen.getAllByText('Codex').length).toBeGreaterThan(1);
    expect(screen.getByText('Claude')).toBeInTheDocument();
    expect(screen.getByText('Latest Speaker')).toBeInTheDocument();
    expect(screen.getByText('Latest Round Summary')).toBeInTheDocument();
    expect(screen.getByText('Final Synthesis')).toBeInTheDocument();
    expect(screen.getByText('Finished')).toBeInTheDocument();
    expect(screen.getAllByText(/Codex/).length).toBeGreaterThan(2);
    expect(screen.getByText(/Group Synthesis/)).toBeInTheDocument();
  });
});
