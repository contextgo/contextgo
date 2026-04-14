export const AGENT_DETAIL_TABS = ['skills', 'hooks', 'schedules', 'commands', 'agents', 'docs'] as const;

export type AgentDetailTabId = (typeof AGENT_DETAIL_TABS)[number];

export const AGENT_DETAIL_TAB_PRIORITY: readonly AgentDetailTabId[] = [
  'skills',
  'hooks',
  'schedules',
  'commands',
  'agents',
  'docs',
];
