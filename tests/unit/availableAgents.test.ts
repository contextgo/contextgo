/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  AVAILABLE_AGENTS_SWR_KEY,
  buildConversationPresetAssistants,
  filterAvailableAgentsForUi,
  splitConversationDropdownAgents,
} from '../../src/renderer/utils/model/availableAgents';
import type { AvailableAgent } from '../../src/renderer/utils/model/agentTypes';
import type { AcpBackendConfig } from '../../src/common/types/acpTypes';

describe('availableAgents helpers', () => {
  const agents: AvailableAgent[] = [
    { backend: 'gemini', name: 'Gemini' },
    { backend: 'gemini', name: 'Gemini CLI', cliPath: '/usr/local/bin/gemini' },
    { backend: 'claude', name: 'Claude Code', cliPath: '/usr/local/bin/claude' },
    { backend: 'qwen', name: 'Qwen Code', cliPath: '/usr/local/bin/qwen' },
    { backend: 'opencode', name: 'OpenCode', cliPath: '/usr/local/bin/opencode' },
    { backend: 'custom', name: 'Custom Agent', customAgentId: 'custom-1' },
    { backend: 'custom', name: 'Preset Assistant', customAgentId: 'builtin-writer', isPreset: true },
    { backend: 'codex', name: 'Code Review Assistant', isPreset: true, customAgentId: 'preset-1' },
  ];

  it('uses the shared SWR key for available agents', () => {
    expect(AVAILABLE_AGENTS_SWR_KEY).toBe('acp.agents.available');
  });

  it('filters out unsupported runtimes and gemini cli entries but keeps supported runtimes', () => {
    expect(filterAvailableAgentsForUi(agents)).toEqual([
      { backend: 'gemini', name: 'Gemini' },
      { backend: 'claude', name: 'Claude Code', cliPath: '/usr/local/bin/claude' },
      { backend: 'opencode', name: 'OpenCode', cliPath: '/usr/local/bin/opencode' },
      { backend: 'custom', name: 'Custom Agent', customAgentId: 'custom-1' },
      { backend: 'custom', name: 'Preset Assistant', customAgentId: 'builtin-writer', isPreset: true },
      { backend: 'codex', name: 'Code Review Assistant', isPreset: true, customAgentId: 'preset-1' },
    ]);
  });

  it('splits conversation dropdown agents into cli and preset groups', () => {
    expect(splitConversationDropdownAgents(filterAvailableAgentsForUi(agents))).toEqual({
      cliAgents: [
        { backend: 'gemini', name: 'Gemini' },
        { backend: 'claude', name: 'Claude Code', cliPath: '/usr/local/bin/claude' },
        { backend: 'opencode', name: 'OpenCode', cliPath: '/usr/local/bin/opencode' },
        { backend: 'custom', name: 'Custom Agent', customAgentId: 'custom-1' },
      ],
      presetAssistants: [
        { backend: 'custom', name: 'Preset Assistant', customAgentId: 'builtin-writer', isPreset: true },
        { backend: 'codex', name: 'Code Review Assistant', isPreset: true, customAgentId: 'preset-1' },
      ],
    });
  });

  it('builds preset assistants from enabled assistant config entries', () => {
    const assistants: AcpBackendConfig[] = [
      { id: 'builtin-cowork', name: 'Cowork', isPreset: true, enabled: true, avatar: 'cowork', presetAgentType: 'gemini' },
      {
        id: 'builtin-reviewer',
        name: 'Reviewer',
        nameI18n: { 'zh-CN': '评审助手' },
        isPreset: true,
        enabled: true,
        presetAgentType: 'codex',
      },
      { id: 'builtin-disabled', name: 'Disabled', isPreset: true, enabled: false },
      { id: 'custom-agent', name: 'Custom Agent', isPreset: false, enabled: true },
    ];

    expect(buildConversationPresetAssistants(assistants, 'zh-CN')).toEqual([
      {
        backend: 'custom',
        name: 'Cowork',
        customAgentId: 'builtin-cowork',
        isPreset: true,
        avatar: 'cowork',
        presetAgentType: 'gemini',
      },
      {
        backend: 'custom',
        name: '评审助手',
        customAgentId: 'builtin-reviewer',
        isPreset: true,
        avatar: undefined,
        presetAgentType: 'codex',
      },
    ]);
  });

  it('hides preset assistants that depend on removed runtime types', () => {
    const assistants: AcpBackendConfig[] = [
      { id: 'builtin-supported', name: 'Supported', isPreset: true, enabled: true, presetAgentType: 'opencode' },
      { id: 'builtin-legacy', name: 'Legacy', isPreset: true, enabled: true, presetAgentType: 'qwen' },
    ];

    expect(buildConversationPresetAssistants(assistants, 'en-US')).toEqual([
      {
        backend: 'custom',
        name: 'Supported',
        customAgentId: 'builtin-supported',
        isPreset: true,
        avatar: undefined,
        presetAgentType: 'opencode',
      },
    ]);
  });
});
