/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IActionButton } from '../types';
import { buildAgentSelectionCallbackToken, type ChannelSelectableAgent } from './agentSelection';

export type GenericAgentButtonInfo = ChannelSelectableAgent;

function row(...buttons: IActionButton[]): IActionButton[][] {
  return [buttons];
}

export function buildMainMenuActionButtons(): IActionButton[][] {
  return [
    [
      { label: '🆕 New Chat', action: 'session.new' },
      { label: '🔄 Agent', action: 'agent.show' },
    ],
    [
      { label: '📊 Status', action: 'session.status' },
      { label: '❓ Help', action: 'help.show' },
    ],
  ];
}

export function buildPairingCodeActionButtons(): IActionButton[][] {
  return [
    [{ label: '🔄 Refresh Code', action: 'pairing.refresh' }],
    [{ label: '❓ Pairing Help', action: 'pairing.help' }],
  ];
}

export function buildPairingStatusActionButtons(): IActionButton[][] {
  return [
    [
      { label: '🔄 Check Status', action: 'pairing.check' },
      { label: '🔄 Get New Code', action: 'pairing.refresh' },
    ],
  ];
}

export function buildSessionControlActionButtons(): IActionButton[][] {
  return row(
    { label: '🆕 New Session', action: 'session.new' },
    { label: '📊 Session Status', action: 'session.status' }
  );
}

export function buildHelpActionButtons(): IActionButton[][] {
  return [
    [
      { label: '🤖 Features', action: 'help.features' },
      { label: '🔗 Pairing Guide', action: 'help.pairing' },
    ],
    [{ label: '💬 Tips', action: 'help.tips' }],
  ];
}

export function buildResponseActionButtons(): IActionButton[][] {
  return [
    [
      { label: '📋 Copy', action: 'action.copy' },
      { label: '🔄 Regenerate', action: 'chat.regenerate' },
    ],
    [{ label: '💬 Continue', action: 'chat.continue' }],
  ];
}

export function buildErrorRecoveryActionButtons(): IActionButton[][] {
  return row({ label: '🔄 Retry', action: 'chat.regenerate' }, { label: '🆕 New Session', action: 'session.new' });
}

export function buildToolConfirmationActionButtons(
  callId: string,
  options: Array<{ label: string; value: string }>
): IActionButton[][] {
  const rows: IActionButton[][] = [];
  for (let index = 0; index < options.length; index += 2) {
    rows.push(
      options.slice(index, index + 2).map((option) => ({
        label: option.label,
        action: 'system.confirm',
        params: {
          callId,
          value: option.value,
        },
      }))
    );
  }
  return rows;
}

export function buildAgentSelectionActionButtons(
  availableAgents: GenericAgentButtonInfo[],
  currentAgentKey?: string
): IActionButton[][] {
  const rows: IActionButton[][] = [];

  for (let index = 0; index < availableAgents.length; index += 2) {
    rows.push(
      availableAgents.slice(index, index + 2).map((agent) => ({
        label: currentAgentKey === agent.key ? `✓ ${agent.emoji} ${agent.name}` : `${agent.emoji} ${agent.name}`,
        action: 'agent.select',
        params: {
          agentKey: buildAgentSelectionCallbackToken(agent),
        },
      }))
    );
  }

  return rows;
}
