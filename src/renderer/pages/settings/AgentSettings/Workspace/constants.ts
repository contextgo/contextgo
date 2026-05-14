export const AGENT_DETAIL_TABS = ['agents', 'skills', 'hooks', 'schedules', 'commands', 'docs'] as const;

export type AgentDetailTabId = (typeof AGENT_DETAIL_TABS)[number];

export const AGENT_DETAIL_TAB_PRIORITY: readonly AgentDetailTabId[] = [
  'agents',
  'skills',
  'hooks',
  'schedules',
  'commands',
  'docs',
];
