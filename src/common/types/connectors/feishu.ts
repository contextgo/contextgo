export type FeishuConnectorApiDomain = 'open.feishu.cn' | 'open.larksuite.com';

export type FeishuConnectorConfig = {
  enabled: boolean;
  appId: string;
  appSecret: string;
  apiDomain: FeishuConnectorApiDomain;
  useOAuth: boolean;
  command: string;
  args: string[];
};

export type FeishuConnectorRuntimeStatus = {
  lifecycle: 'stopped' | 'running' | 'error';
  desiredState: 'stopped' | 'running';
  available: boolean;
  note: string;
  hasCredentials: boolean;
  command?: string;
  args?: string[];
  pid?: number;
  lastStartAt?: number;
  lastStopAt?: number;
  lastError?: string;
};
