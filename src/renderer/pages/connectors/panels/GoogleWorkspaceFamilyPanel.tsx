import { ipcBridge } from '@/common';
import { Button, Input, Message, Spin, Switch, Tag } from '@arco-design/web-react';
import { Pause, PlayOne, Refresh, Send } from '@icon-park/react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styles from '../ConnectorsPage.module.css';

type FamilyMode = 'google-sheets' | 'gmail' | 'google-calendar';

type PanelProps = {
  connectorId: string;
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
  'google-sheets': 'https://www.googleapis.com/auth/spreadsheets.readonly, https://www.googleapis.com/auth/drive.metadata.readonly',
  gmail: 'https://www.googleapis.com/auth/gmail.readonly',
  'google-calendar': 'https://www.googleapis.com/auth/calendar.readonly',
};

const isFamilyMode = (connectorId: string): connectorId is FamilyMode => {
  return connectorId === 'google-sheets' || connectorId === 'gmail' || connectorId === 'google-calendar';
};

const GoogleWorkspaceFamilyPanel: React.FC<PanelProps> = ({ connectorId }) => {
  const mode = isFamilyMode(connectorId) ? connectorId : null;
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [liveItems, setLiveItems] = useState<any[]>([]);
  const [storedItems, setStoredItems] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const api = useMemo(() => {
    if (!mode) {
      return null;
    }
    if (mode === 'google-sheets') {
      return ipcBridge.googleSheetsConnector;
    }
    if (mode === 'gmail') {
      return ipcBridge.gmailConnector;
    }
    return ipcBridge.googleCalendarConnector;
  }, [mode]);

  const loadAll = useCallback(async () => {
    if (!api || !mode) {
      return;
    }

    setLoading(true);
    try {
      const [statusResponse, configResponse, storedResponse] = await Promise.all([
        api.getStatus.invoke(),
        api.getConfig.invoke(),
        mode === 'google-sheets'
          ? api.listStoredSheets.invoke({ limit: 20 })
          : mode === 'gmail'
            ? api.listStoredMessages.invoke({ limit: 20 })
            : api.listStoredCalendars.invoke({ limit: 20 }),
      ]);
      if (statusResponse.success) {
        setStatus(statusResponse.data);
      }
      if (configResponse.success) {
        setConfig(configResponse.data);
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
    const unsubscribe = api.statusChanged.on?.((nextStatus: any) => {
      setStatus(nextStatus);
    });
    return () => {
      unsubscribe?.();
    };
  }, [api]);

  const patchConfig = useCallback((patch: Record<string, unknown>) => {
    setConfig((previous: any) => (previous ? { ...previous, ...patch } : previous));
  }, []);

  const saveConfig = useCallback(async () => {
    if (!api || !config) {
      return;
    }
    setSaving(true);
    try {
      const response = await api.setConfig.invoke({ config });
      if (!response.success) {
        Message.error(response.msg || 'Failed to save Google Workspace config.');
        return;
      }
      setConfig(response.data);
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
          await api.start.invoke();
        }
        if (action === 'stop') {
          await api.stop.invoke();
        }
        if (action === 'list') {
          const response =
            mode === 'google-sheets'
              ? await api.listSheets.invoke({ limit: 20 })
              : mode === 'gmail'
                ? await api.listMessages.invoke({ limit: 20 })
                : await api.listCalendars.invoke({});
          if (!response.success) {
            Message.error(response.msg || 'Failed to list Google Workspace items.');
          } else {
            setLiveItems(response.data || []);
            Message.success(`Loaded ${(response.data || []).length} items.`);
          }
        }
        if (action === 'sync') {
          const response = await api.syncNow.invoke({ limit: 50 });
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

  return (
    <div className={styles.clipboardPanel} data-testid={`${mode}-connector-panel`}>
      <div className={styles.detailGrid}>
        <div className={styles.detailCard}>
          <h3 className={styles.detailCardTitle}>{meta.title}</h3>
          <Spin loading={loading} block>
            <div className={styles.clipboardStatusRow}>
              <Tag color={lifecycleColor}>{status?.lifecycle || 'unknown'}</Tag>
              <Tag color='arcoblue'>{status?.hasCredentials ? 'credentials ready' : 'credentials missing'}</Tag>
              <Tag color={status?.hasCachedToken ? 'green' : 'gray'}>
                {status?.hasCachedToken ? 'token cached' : 'token missing'}
              </Tag>
            </div>
            <div className={styles.clipboardInfoList}>
              <div><strong>Command:</strong> {status?.command || config?.command || 'go'}</div>
              <div><strong>Token cache:</strong> {status?.tokenCachePath || '—'}</div>
              <div><strong>Store dir:</strong> {status?.storeDir || '—'}</div>
            </div>
            <div className={styles.clipboardActionRow}>
              <Button icon={<Refresh theme='outline' size='14' />} onClick={() => void loadAll()} loading={loading}>Refresh</Button>
              <Button type='primary' icon={<PlayOne theme='outline' size='14' />} onClick={() => void runAction('start')} loading={actionBusy === 'start'}>Start</Button>
              <Button icon={<Pause theme='outline' size='14' />} onClick={() => void runAction('stop')} loading={actionBusy === 'stop'}>Stop</Button>
              <Button icon={<Send theme='outline' size='14' />} onClick={() => void runAction('list')} loading={actionBusy === 'list'}>{meta.listLabel}</Button>
              <Button onClick={() => void runAction('sync')} loading={actionBusy === 'sync'}>Sync Now</Button>
            </div>
          </Spin>
        </div>

        <div className={styles.detailCard}>
          <h3 className={styles.detailCardTitle}>{meta.configTitle}</h3>
          <Spin loading={loading} block>
            <div className={styles.clipboardControlList}>
              <div className={styles.clipboardControlRow}>
                <span>Enabled</span>
                <Switch checked={config?.enabled ?? false} onChange={(value) => patchConfig({ enabled: value })} />
              </div>
              <div className={styles.clipboardControlRowColumn}>
                <span>Client ID</span>
                <Input value={config?.clientId ?? ''} onChange={(value) => patchConfig({ clientId: value })} />
              </div>
              <div className={styles.clipboardControlRowColumn}>
                <span>Client Secret</span>
                <Input.Password value={config?.clientSecret ?? ''} onChange={(value) => patchConfig({ clientSecret: value })} />
              </div>
              <div className={styles.clipboardControlRowColumn}>
                <span>Scopes</span>
                <Input value={config?.scopes?.join(', ') ?? DEFAULT_SCOPES[mode]} onChange={(value) => patchConfig({ scopes: value.split(',').map((item) => item.trim()).filter(Boolean) })} />
              </div>
            </div>
            <div className={styles.clipboardActionRow}>
              <Button type='primary' onClick={() => void saveConfig()} loading={saving}>Save Config</Button>
            </div>
            <div className={styles.clipboardNote}>This connector reuses the shared Google Workspace OAuth token cache.</div>
          </Spin>
        </div>

        <div className={styles.detailCard}>
          <h3 className={styles.detailCardTitle}>{meta.liveTitle}</h3>
          <div className={styles.clipboardList}>
            {liveItems.length === 0 ? <div className={styles.detailCardText}>No live items loaded yet.</div> : null}
            {liveItems.map((item, index) => (
              <div key={item.id || item.recordId || index} className={styles.clipboardListItem}>
                <div className={styles.clipboardListMetaRow}>
                  <Tag size='small' color='arcoblue'>{item.mimeType || item.type || item.accessRole || 'item'}</Tag>
                  <span>{item.modifiedTime || item.syncedAt || item.timeZone || '—'}</span>
                </div>
                <div className={styles.clipboardListPreview}>
                  {item.title || item.name || item.summary || item.subject || '—'}
                </div>
                {mode === 'gmail' ? (
                  <div className={styles.detailCardText}>
                    {(item.from ? `From: ${item.from}` : 'From: —') +
                      (item.snippet ? ` · ${item.snippet}` : '')}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.detailCard}>
          <h3 className={styles.detailCardTitle}>{meta.storedTitle}</h3>
          <div className={styles.clipboardList}>
            {storedItems.length === 0 ? <div className={styles.detailCardText}>No persisted items in ContextGo store yet.</div> : null}
            {storedItems.map((item, index) => (
              <div key={item.recordId || item.id || index} className={styles.clipboardListItem}>
                <div className={styles.clipboardListMetaRow}>
                  <Tag size='small' color='green'>{item.mimeType || item.type || item.accessRole || 'item'}</Tag>
                  <span>{item.syncedAt || item.modifiedTime || item.timeZone || '—'}</span>
                </div>
                <div className={styles.clipboardListPreview}>
                  {item.title || item.name || item.summary || item.subject || '—'}
                </div>
                {mode === 'gmail' ? (
                  <div className={styles.detailCardText}>
                    {(item.from ? `From: ${item.from}` : 'From: —') +
                      (item.snippet ? ` · ${item.snippet}` : '')}
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
