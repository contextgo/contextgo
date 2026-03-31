import { ipcBridge } from '@/common';
import type {
  GoogleDoc,
  GoogleDocsConnectorConfig,
  GoogleDocsConnectorRuntimeStatus,
  GoogleDocsStoredDocument,
  GoogleDocsSyncResult,
} from '@/common/types/connectors/googleDocs';
import { Button, Input, Message, Spin, Switch, Tag } from '@arco-design/web-react';
import { Pause, PlayOne, Refresh, Send } from '@icon-park/react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styles from '../ConnectorsPage.module.css';

const DEFAULT_SCOPES = 'https://www.googleapis.com/auth/documents.readonly, https://www.googleapis.com/auth/drive.metadata.readonly';

type GoogleDocsConnectorPanelProps = {
  connectorId: string;
};

const GoogleDocsConnectorPanel: React.FC<GoogleDocsConnectorPanelProps> = ({ connectorId }) => {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<GoogleDocsConnectorRuntimeStatus | null>(null);
  const [config, setConfig] = useState<GoogleDocsConnectorConfig | null>(null);
  const [docs, setDocs] = useState<GoogleDoc[]>([]);
  const [storedDocs, setStoredDocs] = useState<GoogleDocsStoredDocument[]>([]);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const isGoogleDocsConnector = connectorId === 'google-docs';

  const loadAll = useCallback(async () => {
    if (!isGoogleDocsConnector) return;
    setLoading(true);
    try {
      const [statusResponse, configResponse, storedResponse] = await Promise.all([
        ipcBridge.googleDocsConnector.getStatus.invoke(),
        ipcBridge.googleDocsConnector.getConfig.invoke(),
        ipcBridge.googleDocsConnector.listStoredDocs.invoke({ limit: 20 }),
      ]);
      if (statusResponse.success && statusResponse.data) setStatus(statusResponse.data);
      if (configResponse.success && configResponse.data) setConfig(configResponse.data);
      if (storedResponse.success && storedResponse.data) setStoredDocs(storedResponse.data);
    } finally {
      setLoading(false);
    }
  }, [isGoogleDocsConnector]);

  useEffect(() => { void loadAll(); }, [loadAll]);
  useEffect(() => {
    if (!isGoogleDocsConnector) return;
    const unsub = ipcBridge.googleDocsConnector.statusChanged.on?.((nextStatus: GoogleDocsConnectorRuntimeStatus) => setStatus(nextStatus));
    return () => { unsub?.(); };
  }, [isGoogleDocsConnector]);

  const patchConfig = useCallback((patch: Partial<GoogleDocsConnectorConfig>) => {
    setConfig((previous) => (previous ? { ...previous, ...patch } : previous));
  }, []);

  const saveConfig = useCallback(async () => {
    if (!config) return;
    setSaving(true);
    try {
      const response = await ipcBridge.googleDocsConnector.setConfig.invoke({ config });
      if (!response.success || !response.data) {
        Message.error(response.msg || 'Failed to save Google Docs config.');
        return;
      }
      setConfig(response.data);
      Message.success('Google Docs config saved.');
      await loadAll();
    } finally {
      setSaving(false);
    }
  }, [config, loadAll]);

  const runAction = useCallback(async (action: 'start' | 'stop' | 'list' | 'sync') => {
    setActionBusy(action);
    try {
      if (action === 'start') {
        const response = await ipcBridge.googleDocsConnector.start.invoke();
        if (!response.success) Message.error(response.msg || 'Failed to start Google Docs sidecar.');
      }
      if (action === 'stop') {
        const response = await ipcBridge.googleDocsConnector.stop.invoke();
        if (!response.success) Message.error(response.msg || 'Failed to stop Google Docs sidecar.');
      }
      if (action === 'list') {
        const response = await ipcBridge.googleDocsConnector.listDocs.invoke({ limit: 20 });
        if (!response.success || !response.data) {
          Message.error(response.msg || 'Failed to list Google Docs documents.');
        } else {
          setDocs(response.data);
          Message.success(`Loaded ${response.data.length} Google Docs documents.`);
        }
      }
      if (action === 'sync') {
        const response = await ipcBridge.googleDocsConnector.syncNow.invoke({ limit: 50 });
        if (!response.success || !response.data) {
          Message.error(response.msg || 'Failed to sync Google Docs documents.');
        } else {
          const result = response.data as GoogleDocsSyncResult;
          Message.success(`Synced ${result.storedCount} Google Docs documents.`);
        }
      }
      await loadAll();
    } finally {
      setActionBusy(null);
    }
  }, [loadAll]);

  const lifecycleColor = useMemo(() => {
    if (status?.lifecycle === 'running') return 'green';
    if (status?.lifecycle === 'error') return 'red';
    return 'gray';
  }, [status?.lifecycle]);

  if (!isGoogleDocsConnector) return null;

  return (
    <div className={styles.clipboardPanel} data-testid='google-docs-connector-panel'>
      <div className={styles.detailGrid}>
        <div className={styles.detailCard}>
          <h3 className={styles.detailCardTitle}>Google Docs Runtime</h3>
          <Spin loading={loading} block>
            <div className={styles.clipboardStatusRow}>
              <Tag color={lifecycleColor}>{status?.lifecycle || 'unknown'}</Tag>
              <Tag color='arcoblue'>{status?.hasCredentials ? 'credentials ready' : 'credentials missing'}</Tag>
              <Tag color={status?.hasCachedToken ? 'green' : 'gray'}>{status?.hasCachedToken ? 'token cached' : 'token missing'}</Tag>
            </div>
            <div className={styles.clipboardInfoList}>
              <div><strong>Command:</strong> {status?.command || config?.command || 'go'}</div>
              <div><strong>Docs stored:</strong> {status?.docCount ?? 0}</div>
              <div><strong>Store dir:</strong> {status?.storeDir || '—'}</div>
              <div><strong>Token cache:</strong> {status?.tokenCachePath || '—'}</div>
            </div>
            <div className={styles.clipboardActionRow}>
              <Button icon={<Refresh theme='outline' size='14' />} onClick={() => void loadAll()} loading={loading}>Refresh</Button>
              <Button type='primary' icon={<PlayOne theme='outline' size='14' />} onClick={() => void runAction('start')} loading={actionBusy === 'start'}>Start</Button>
              <Button icon={<Pause theme='outline' size='14' />} onClick={() => void runAction('stop')} loading={actionBusy === 'stop'}>Stop</Button>
              <Button icon={<Send theme='outline' size='14' />} onClick={() => void runAction('list')} loading={actionBusy === 'list'}>List Docs</Button>
              <Button onClick={() => void runAction('sync')} loading={actionBusy === 'sync'}>Sync Now</Button>
            </div>
          </Spin>
        </div>

        <div className={styles.detailCard}>
          <h3 className={styles.detailCardTitle}>Google Docs OAuth Reuse</h3>
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
                <Input value={config?.scopes.join(', ') ?? DEFAULT_SCOPES} onChange={(value) => patchConfig({ scopes: value.split(',').map((item) => item.trim()).filter(Boolean) })} />
              </div>
            </div>
            <div className={styles.clipboardActionRow}>
              <Button type='primary' onClick={() => void saveConfig()} loading={saving}>Save Google Docs Config</Button>
            </div>
            <div className={styles.clipboardNote}>Google Docs reuses the same Google Workspace OAuth token cache as Google Drive.</div>
          </Spin>
        </div>

        <div className={styles.detailCard}>
          <h3 className={styles.detailCardTitle}>Docs (Live)</h3>
          <div className={styles.clipboardList} data-testid='google-docs-live-list'>
            {docs.length === 0 ? <div className={styles.detailCardText}>No Google Docs loaded yet.</div> : null}
            {docs.map((doc) => (
              <div key={doc.id} className={styles.clipboardListItem}>
                <div className={styles.clipboardListMetaRow}>
                  <Tag size='small' color='arcoblue'>{doc.mimeType}</Tag>
                  <span>{doc.modifiedTime || '—'}</span>
                </div>
                <div className={styles.clipboardListPreview}>{doc.title}</div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.detailCard}>
          <h3 className={styles.detailCardTitle}>Docs (Stored)</h3>
          <div className={styles.clipboardList} data-testid='google-docs-stored-list'>
            {storedDocs.length === 0 ? <div className={styles.detailCardText}>No persisted Google Docs in ContextGo store yet.</div> : null}
            {storedDocs.map((doc) => (
              <div key={doc.recordId} className={styles.clipboardListItem}>
                <div className={styles.clipboardListMetaRow}>
                  <Tag size='small' color='green'>{doc.mimeType}</Tag>
                  <span>{doc.syncedAt}</span>
                </div>
                <div className={styles.clipboardListPreview}>{doc.title}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoogleDocsConnectorPanel;
