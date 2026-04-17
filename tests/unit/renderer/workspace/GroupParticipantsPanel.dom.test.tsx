/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { GroupParticipant } from '@/common/config/storage';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) => {
      if (key === 'conversation.workspace.groupMembers.title') {
        return 'Group Members';
      }
      if (key === 'conversation.workspace.groupMembers.count') {
        return `${options?.count ?? 0} members`;
      }
      if (key === 'conversation.workspace.groupMembers.participantType.cliAgent') {
        return 'CLI Agent';
      }
      if (key === 'conversation.workspace.groupMembers.participantType.presetAssistant') {
        return 'Preset Assistant';
      }
      if (key === 'conversation.group.noDescription') {
        return 'No description';
      }
      if (key === 'conversation.group.role.planner') {
        return 'Planner';
      }
      return key;
    },
  }),
}));

vi.mock('@/renderer/pages/guid/constants', () => ({
  CUSTOM_AVATAR_IMAGE_MAP: {},
}));

vi.mock('@/renderer/utils/platform', () => ({
  resolveExtensionAssetUrl: (url: string | undefined) => (url === 'cowork.svg' ? 'file:///mock/cowork.svg' : url),
}));

vi.mock('@/renderer/utils/model/agentLogo', () => ({
  getAgentLogo: (agent: string | undefined | null) => (agent === 'codex' ? '/mock-codex-logo.svg' : null),
}));

vi.mock('@/renderer/pages/conversation/Preview', () => ({
  usePreviewActions: () => ({
    openPreview: vi.fn(),
  }),
}));

import GroupParticipantsPanel from '@/renderer/pages/conversation/Workspace/components/GroupParticipantsPanel';

const participants: GroupParticipant[] = [
  {
    id: 'participant-1',
    participantType: 'cli-agent',
    participantKey: 'codex',
    name: 'Codex',
    description: 'codex · gpt-5',
    childConversationId: 'child-1',
    role: 'planner',
  },
  {
    id: 'participant-2',
    participantType: 'preset-assistant',
    participantKey: 'architect',
    name: 'Architect',
    avatar: 'cowork.svg',
    childConversationId: 'child-2',
    role: 'research-lead',
  },
];

describe('GroupParticipantsPanel', () => {
  it('renders participant summary cards', () => {
    render(<GroupParticipantsPanel participants={participants} />);

    expect(screen.getByText('Group Members')).toBeInTheDocument();
    expect(screen.getByText('2 members')).toBeInTheDocument();
    expect(screen.getByText('Codex')).toBeInTheDocument();
    expect(screen.getByAltText('Codex')).toHaveAttribute('src', '/mock-codex-logo.svg');
    expect(screen.getAllByText('CODEX').length).toBeGreaterThan(0);
    expect(screen.getAllByText('CLI Agent').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Planner').length).toBeGreaterThan(0);
    expect(screen.getByText('Architect')).toBeInTheDocument();
    expect(screen.getAllByText('Preset Assistant').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Research Lead').length).toBeGreaterThan(0);
    expect(screen.getByAltText('Architect')).toHaveAttribute('src', 'file:///mock/cowork.svg');
  });
});
