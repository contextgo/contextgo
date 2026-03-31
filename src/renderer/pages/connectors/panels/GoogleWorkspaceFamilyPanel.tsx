import { ipcBridge } from '@/common';
import { Button, Input, Message, Spin, Switch, Tag } from '@arco-design/web-react';
import { Pause, PlayOne, Refresh, Send } from '@icon-park/react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styles from '../ConnectorsPage.module.css';

type FamilyMode = 'google-sheets' | 'gmail' | 'google-calendar';

type PanelProps = {
  connectorId: string;
};

type ConnectorStatus = Record<string, unknown> | null;
type ConnectorConfig = Record<string, unknown> | null;
type ConnectorItem = Record<string, unknown>;

type GoogleWorkspaceFamilyApi = {
  getStatus: () => ReturnType<typeof ipcBridge.googleSheetsConnector.getStatus.invoke>;
  getConfig: () => ReturnType<typeof ipcBridge.googleSheetsConnector.getConfig.invoke>;
  setConfig: (config: Record<string, unknown>) => ReturnType<typeof ipcBridge.googleSheetsConnector.setConfig.invoke>;
  start: () => ReturnType<typeof ipcBridge.googleSheetsConnector.start.invoke>;
  stop: () => ReturnType<typeof ipcBridge.googleSheetsConnector.stop.invoke>;
  listLive: (limit: number) => Promise<{ success: boolean; msg?: string; data?: ConnectorItem[] }>;
  listStored: (limit: number) => Promise<{ success: boolean; msg?: string; data?: ConnectorItem[] }>;
  syncNow: (limit: number) => Promise<{ success: boolean; msg?: string; data?: { storedCount?: number } }>;
  onStatusChanged: (listener: (nextStatus: ConnectorStatus) => void) => (() => void) | undefined;
};

const readString = (record: Record<string, unknown> | null | undefined, key: string): string | undefined => {
  const value = record?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

const readBoolean = (record: Record<string, unknown> | null | undefined, key: string): boolean | undefined => {
  const value = record?.[key];
  return typeof value === 'boolean' ? value : undefined;
};

const readStringArray = (record: Record<string, unknown> | null | undefined, key: string): string[] | undefined => {
  const value = record?.[key];
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
};

const pickFirstString = (...values: Array<string | undefined>): string => {
  return values.find((value) => typeof value === 'string' && value.length > 0) ?? '—';
};

const FAMILY_CONFIG = {
  'google-sheets': {
    title: 'Google Sheets Runtime',
    configTitle: 'Google Sheets OAuth Reuse',
    liveTitle: 'Sheets (Live)',
    storedTitle: 'Sheets (Stored)',
    listLabel: 'List Sheets',
  },
  gmail: {
    title: 'Gmail Runtime',
    configTitle: 'Gmail OAuth Reuse',
    liveTitle: 'Gmail Messages (Live)',
    storedTitle: 'Gmail Messages (Stored)',
    listLabel: 'List Messages',
  },
  'google-calendar': {
    title: 'Google Calendar Runtime',
    configTitle: 'Google Calendar OAuth Reuse',
    liveTitle: 'Calendars (Live)',
    storedTitle: 'Calendars (Stored)',
    listLabel: 'List Calendars',
  },
} as const;

const DEFAULT_SCOPES: Record<FamilyMode, string> = {
  'google-sheets':
    'https://www.googleapis.com/auth/spreadsheets.readonly, https://www.googleapis.com/auth/drive.metadata.readonly',
  gmail: 'https://www.googleapis.com/auth/gmail.readonly',
  'google-calendar': 'https://www.googleapis.com/auth/calendar.readonly',
};

const isFamilyMode = (connectorId: string): connectorId is FamilyMode => {
  return connectorId === 'google-sheets' || connectorId === 'gmail' || connectorId === 'google-calendar';
};

const getFamilyApi = (mode: FamilyMode): GoogleWorkspaceFamilyApi => {
  if (mode === 'google-sheets') {
    return {
      getStatus: () => ipcBridge.googleSheetsConnector.getStatus.invoke(),
      getConfig: () => ipcBridge.googleSheetsConnector.getConfig.invoke(),
      setConfig: (config) => ipcBridge.googleSheetsConnector.setConfig.invoke({ config }),
      start: () => ipcBridge.googleSheetsConnector.start.invoke(),
      stop: () => ipcBridge.googleSheetsConnector.stop.invoke(),
      listLive: async (limit) => ipcBridge.googleSheetsConnector.listSheets.invoke({ limit }),
      listStored: async (limit) => ipcBridge.googleSheetsConnector.listStoredSheets.invoke({ limit }),
      syncNow: async (limit) => ipcBridge.googleSheetsConnector.syncNow.invoke({ limit }),
      onStatusChanged: (listener) => ipcBridge.googleSheetsConnector.statusChanged.on?.(listener),
    };
  }

  if (mode === 'gmail') {
    return {
      getStatus: () => ipcBridge.gmailConnector.getStatus.invoke(),
      getConfig: () => ipcBridge.gmailConnector.getConfig.invoke(),
      setConfig: (config) => ipcBridge.gmailConnector.setConfig.invoke({ config }),
      start: () => ipcBridge.gmailConnector.start.invoke(),
      stop: () => ipcBridge.gmailConnector.stop.invoke(),
      listLive: async (limit) => ipcBridge.gmailConnector.listMessages.invoke({ limit }),
      listStored: async (limit) => ipcBridge.gmailConnector.listStoredMessages.invoke({ limit }),
      syncNow: async (limit) => ipcBridge.gmailConnector.syncNow.invoke({ limit }),
      onStatusChanged: (listener) => ipcBridge.gmailConnector.statusChanged.on?.(listener),
    };
  }

  return {
    getStatus: () => ipcBridge.googleCalendarConnector.getStatus.invoke(),
    getConfig: () => ipcBridge.googleCalendarConnector.getConfig.invoke(),
    setConfig: (config) => ipcBridge.googleCalendarConnector.setConfig.invoke({ config }),
    start: () => ipcBridge.googleCalendarConnector.start.invoke(),
    stop: () => ipcBridge.googleCalendarConnector.stop.invoke(),
    listLive: async () => ipcBridge.googleCalendarConnector.listCalendars.invoke(),
    listStored: async (limit) => ipcBridge.googleCalendarConnector.listStoredCalendars.invoke({ limit }),
    syncNow: async () => ipcBridge.googleCalendarConnector.syncNow.invoke(),
    onStatusChanged: (listener) => ipcBridge.googleCalendarConnector.statusChanged.on?.(listener),
  };
};

const GoogleWorkspaceFamilyPanel: React.FC<PanelProps> = ({ connectorId }) => {
  const mode = isFamilyMode(connectorId) ? connectorId : null;
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<ConnectorStatus>(null);
  const [config, setConfig] = useState<ConnectorConfig>(null);
  const [liveItems, setLiveItems] = useState<ConnectorItem[]>([]);
  const [storedItems, setStoredItems] = useState<ConnectorItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const api = useMemo(() => (mode ? getFamilyApi(mode) : null), [mode]);

  const loadAll = useCallback(async () => {
    if (!api || !mode) {
      return;
    }

    setLoading(true);
    try {
      const [statusResponse, configResponse, storedResponse] = await Promise.all([
        api.getStatus(),
        api.getConfig(),
        api.listStored(20),
      ]);
      if (statusResponse.success) {
        setStatus((statusResponse.data as ConnectorStatus) ?? null);
      }
      if (configResponse.success) {
        setConfig((configResponse.data as ConnectorConfig) ?? null);
      }
      if (storedResponse.success) {
        setStoredItems(storedResponse.data || []);
      }
    } finally {
      setLoading(false);
    }
  }, [api, mode]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!api) {
      return;
    }
    const unsubscribe = api.onStatusChanged((nextStatus) => {
      setStatus(nextStatus);
    });
    return () => {
      unsubscribe?.();
    };
  }, [api]);

  const patchConfig = useCallback((patch: Record<string, unknown>) => {
    setConfig((previous) => (previous ? { ...previous, ...patch } : previous));
  }, []);

  const saveConfig = useCallback(async () => {
    if (!api || !config) {
      return;
    }
    setSaving(true);
    try {
      const response = await api.setConfig(config);
      if (!response.success) {
        Message.error(response.msg || 'Failed to save Google Workspace config.');
        return;
      }
      setConfig((response.data as ConnectorConfig) ?? null);
      Message.success('Google Workspace config saved.');
      await loadAll();
    } finally {
      setSaving(false);
    }
  }, [api, config, loadAll]);

  const runAction = useCallback(
    async (action: 'start' | 'stop' | 'list' | 'sync') => {
      if (!api || !mode) {
        return;
      }
      setActionBusy(action);
      try {
        if (action === 'start') {
          await api.start();
        }
        if (action === 'stop') {
          await api.stop();
        }
        if (action === 'list') {
          const response = await api.listLive(20);
          if (!response.success) {
            Message.error(response.msg || 'Failed to list Google Workspace items.');
          } else {
            setLiveItems(response.data || []);
            Message.success(`Loaded ${(response.data || []).length} items.`);
          }
        }
        if (action === 'sync') {
          const response = await api.syncNow(50);
          if (!response.success) {
            Message.error(response.msg || 'Failed to sync Google Workspace items.');
          } else {
            Message.success(`Synced ${response.data?.storedCount || 0} items.`);
          }
        }
        await loadAll();
      } finally {
        setActionBusy(null);
      }
    },
    [api, loadAll, mode]
  );

  const lifecycleColor = useMemo(() => {
    if (status?.lifecycle === 'running') return 'green';
    if (status?.lifecycle === 'error') return 'red';
    return 'gray';
  }, [status?.lifecycle]);

  if (!mode || !api) {
    return null;
  }

  const meta = FAMILY_CONFIG[mode];
  const lifecycle = readString(status, 'lifecycle') ?? 'unknown';
  const hasCredentials = readBoolean(status, 'hasCredentials') ?? false;
  const hasCachedToken = readBoolean(status, 'hasCachedToken') ?? false;
  const command = pickFirstString(readString(status, 'command'), readString(config, 'command'), 'go');
  const tokenCachePath = pickFirstString(readString(status, 'tokenCachePath'));
  const storeDir = pickFirstString(readString(status, 'storeDir'));
  const enabled = readBoolean(config, 'enabled') ?? false;
  const clientId = readString(config, 'clientId') ?? '';
  const clientSecret = readString(config, 'clientSecret') ?? '';
  const scopes = readStringArray(config, 'scopes');

  return (
    <div className={styles.clipboardPanel} data-testid={`${mode}-connector-panel`}>
      <div className={styles.detailGrid}>
        <div className={styles.detailCard}>
          <h3 className={styles.detailCardTitle}>{meta.title}</h3>
          <Spin loading={loading} block>
            <div className={styles.clipboardStatusRow}>
              <Tag color={lifecycleColor}>{lifecycle}</Tag>
              <Tag color='arcoblue'>{hasCredentials ? 'credentials ready' : 'credentials missing'}</Tag>
              <Tag color={hasCachedToken ? 'green' : 'gray'}>{hasCachedToken ? 'token cached' : 'token missing'}</Tag>
            </div>
            <div className={styles.clipboardInfoList}>
              <div>
                <strong>Command:</strong> {command}
              </div>
              <div>
                <strong>Token cache:</strong> {tokenCachePath}
              </div>
              <div>
                <strong>Store dir:</strong> {storeDir}
              </div>
            </div>
            <div className={styles.clipboardActionRow}>
              <Button icon={<Refresh theme='outline' size='14' />} onClick={() => void loadAll()} loading={loading}>
                Refresh
              </Button>
              <Button
                type='primary'
                icon={<PlayOne theme='outline' size='14' />}
                onClick={() => void runAction('start')}
                loading={actionBusy === 'start'}
              >
                Start
              </Button>
              <Button
                icon={<Pause theme='outline' size='14' />}
                onClick={() => void runAction('stop')}
                loading={actionBusy === 'stop'}
              >
                Stop
              </Button>
              <Button
                icon={<Send theme='outline' size='14' />}
                onClick={() => void runAction('list')}
                loading={actionBusy === 'list'}
              >
                {meta.listLabel}
              </Button>
              <Button onClick={() => void runAction('sync')} loading={actionBusy === 'sync'}>
                Sync Now
              </Button>
            </div>
          </Spin>
        </div>

        <div className={styles.detailCard}>
          <h3 className={styles.detailCardTitle}>{meta.configTitle}</h3>
          <Spin loading={loading} block>
            <div className={styles.clipboardControlList}>
              <div className={styles.clipboardControlRow}>
                <span>Enabled</span>
                <Switch checked={enabled} onChange={(value) => patchConfig({ enabled: value })} />
              </div>
              <div className={styles.clipboardControlRowColumn}>
                <span>Client ID</span>
                <Input value={clientId} onChange={(value) => patchConfig({ clientId: value })} />
              </div>
              <div className={styles.clipboardControlRowColumn}>
                <span>Client Secret</span>
                <Input.Password value={clientSecret} onChange={(value) => patchConfig({ clientSecret: value })} />
              </div>
              <div className={styles.clipboardControlRowColumn}>
                <span>Scopes</span>
                <Input
                  value={scopes?.join(', ') ?? DEFAULT_SCOPES[mode]}
                  onChange={(value) =>
                    patchConfig({
                      scopes: value
                        .split(',')
                        .map((item) => item.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>
            </div>
            <div className={styles.clipboardActionRow}>
              <Button type='primary' onClick={() => void saveConfig()} loading={saving}>
                Save Config
              </Button>
            </div>
            <div className={styles.clipboardNote}>
              This connector reuses the shared Google Workspace OAuth token cache.
            </div>
          </Spin>
        </div>

        <div className={styles.detailCard}>
          <h3 className={styles.detailCardTitle}>{meta.liveTitle}</h3>
          <div className={styles.clipboardList}>
            {liveItems.length === 0 ? <div className={styles.detailCardText}>No live items loaded yet.</div> : null}
            {liveItems.map((item, index) => (
              <div
                key={pickFirstString(readString(item, 'id'), readString(item, 'recordId'), String(index))}
                className={styles.clipboardListItem}
              >
                <div className={styles.clipboardListMetaRow}>
                  <Tag size='small' color='arcoblue'>
                    {pickFirstString(
                      readString(item, 'mimeType'),
                      readString(item, 'type'),
                      readString(item, 'accessRole'),
                      'item'
                    )}
                  </Tag>
                  <span>
                    {pickFirstString(
                      readString(item, 'modifiedTime'),
                      readString(item, 'syncedAt'),
                      readString(item, 'timeZone')
                    )}
                  </span>
                </div>
                <div className={styles.clipboardListPreview}>
                  {pickFirstString(
                    readString(item, 'title'),
                    readString(item, 'name'),
                    readString(item, 'summary'),
                    readString(item, 'subject')
                  )}
                </div>
                {mode === 'gmail' ? (
                  <div className={styles.detailCardText}>
                    {(readString(item, 'from') ? `From: ${readString(item, 'from')}` : 'From: —') +
                      (readString(item, 'snippet') ? ` · ${readString(item, 'snippet')}` : '')}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.detailCard}>
          <h3 className={styles.detailCardTitle}>{meta.storedTitle}</h3>
          <div className={styles.clipboardList}>
            {storedItems.length === 0 ? (
              <div className={styles.detailCardText}>No persisted items in ContextGo store yet.</div>
            ) : null}
            {storedItems.map((item, index) => (
              <div
                key={pickFirstString(readString(item, 'recordId'), readString(item, 'id'), String(index))}
                className={styles.clipboardListItem}
              >
                <div className={styles.clipboardListMetaRow}>
                  <Tag size='small' color='green'>
                    {pickFirstString(
                      readString(item, 'mimeType'),
                      readString(item, 'type'),
                      readString(item, 'accessRole'),
                      'item'
                    )}
                  </Tag>
                  <span>
                    {pickFirstString(
                      readString(item, 'syncedAt'),
                      readString(item, 'modifiedTime'),
                      readString(item, 'timeZone')
                    )}
                  </span>
                </div>
                <div className={styles.clipboardListPreview}>
                  {pickFirstString(
                    readString(item, 'title'),
                    readString(item, 'name'),
                    readString(item, 'summary'),
                    readString(item, 'subject')
                  )}
                </div>
                {mode === 'gmail' ? (
                  <div className={styles.detailCardText}>
                    {(readString(item, 'from') ? `From: ${readString(item, 'from')}` : 'From: —') +
                      (readString(item, 'snippet') ? ` · ${readString(item, 'snippet')}` : '')}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoogleWorkspaceFamilyPanel;
