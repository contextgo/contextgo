import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const conversationCreateInvoke = vi.fn();
const dialogShowOpenInvoke = vi.fn();
const buildDiscussionGroupParamsMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        'common.cancel': 'Cancel',
        'conversation.group.createTitle': 'Create Group',
        'conversation.group.createAction': 'Create Group',
        'conversation.group.defaultName': 'Agent Group',
        'conversation.group.nameLabel': 'Group Name',
        'conversation.group.namePlaceholder': 'Enter a group name',
        'conversation.group.workspaceLabel': 'Workspace',
        'conversation.group.workspacePlaceholder': 'Choose a workspace',
        'conversation.group.workspaceHint': 'Shared workspace hint',
        'conversation.group.selectWorkspace': 'Choose Folder',
        'conversation.group.fixedFlowLabel': 'How Collaboration Works',
        'conversation.group.fixedFlowHint': 'Fixed flow hint',
        'conversation.group.participantsLabel': 'Participants',
        'conversation.group.minimumParticipantsHint': 'Pick two or more participants',
        'conversation.group.minimumParticipants': 'Select at least two participants',
        'conversation.group.noDescription': 'No description',
        'conversation.dropdown.presetAssistants': 'Preset Assistants',
        'conversation.dropdown.cliAgents': 'Runnable Agents',
      };
      return labels[key] || key;
    },
    i18n: {
      language: 'en-US',
    },
  }),
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    dialog: {
      showOpen: {
        invoke: (...args: unknown[]) => dialogShowOpenInvoke(...args),
      },
    },
    conversation: {
      create: {
        invoke: (...args: unknown[]) => conversationCreateInvoke(...args),
      },
    },
  },
}));

vi.mock('@/renderer/hooks/assistant', () => ({
  useAssistantList: () => ({
    assistants: [],
    localeKey: 'en-US',
  }),
}));

vi.mock('@/renderer/components/base', () => ({
  ContextGoModal: ({
    visible,
    children,
    footer,
    header,
  }: {
    visible?: boolean;
    children?: React.ReactNode;
    footer?: {
      render?: () => React.ReactNode;
    };
    header?: {
      title?: React.ReactNode;
    };
  }) =>
    visible ? (
      <div>
        <div>{header?.title}</div>
        <div>{children}</div>
        <div>{footer?.render?.()}</div>
      </div>
    ) : null,
}));

vi.mock('@/renderer/pages/conversation/utils/createConversationParams', () => ({
  buildDiscussionGroupParams: (...args: unknown[]) => buildDiscussionGroupParamsMock(...args),
}));

import CreateGroupModal from '@/renderer/pages/conversation/platforms/group/CreateGroupModal';

describe('CreateGroupModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildDiscussionGroupParamsMock.mockResolvedValue({
      type: 'group',
      extra: {
        orchestration: {
          kind: 'discussion',
          mode: 'debate',
          rounds: 2,
        },
      },
    });
    conversationCreateInvoke.mockResolvedValue({
      id: 'group-1',
      type: 'group',
      name: 'Agent Group',
      extra: {
        participants: [],
        orchestration: {
          kind: 'discussion',
          mode: 'debate',
          rounds: 2,
        },
      },
    });
  });

  it('renders the simplified group flow without workflow controls and creates a debate-backed group', async () => {
    render(
      <CreateGroupModal
        visible={true}
        workspace='/tmp/workspace'
        spaceId='space-1'
        cliAgents={[
          {
            backend: 'codex',
            name: 'Codex',
            cliPath: '/usr/local/bin/codex',
          },
        ]}
        presetAssistants={[
          {
            backend: 'custom',
            name: 'Researcher',
            customAgentId: 'researcher',
            presetAgentType: 'codex',
          },
        ]}
        onCancel={() => undefined}
        onCreated={() => undefined}
      />
    );

    expect(screen.getAllByText('Create Group').length).toBeGreaterThan(1);
    expect(screen.getByText('How Collaboration Works')).toBeInTheDocument();
    expect(screen.getByText('Fixed flow hint')).toBeInTheDocument();
    expect(screen.queryByText('Workflow')).not.toBeInTheDocument();
    expect(screen.queryByText('Discussion Mode')).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByText('Create Group')[1]);

    await waitFor(() => {
      expect(buildDiscussionGroupParamsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'debate',
        })
      );
    });
    expect(conversationCreateInvoke).toHaveBeenCalled();
  });
});
