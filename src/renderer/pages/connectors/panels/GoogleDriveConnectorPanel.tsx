import { ipcBridge } from '@/common';
import type {
  GoogleDriveAuthRequest,
  GoogleDriveConnectorConfig,
  GoogleDriveConnectorRuntimeStatus,
  GoogleDriveFile,
  GoogleDriveStoredFile,
  GoogleDriveSyncResult,
} from '@/common/types/connectors/googleDrive';
import { Button, Input, Message, Spin, Switch, Tag } from '@arco-design/web-react';
import { Pause, PlayOne, Refresh, Send } from '@icon-park/react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styles from '../ConnectorsPage.module.css';

const DEFAULT_SCOPE = 'https://www.googleapis.com/auth/drive.metadata.readonly';

type GoogleDriveConnectorPanelProps = {
  connectorId: string;
};

const GoogleDriveConnectorPanel: React.FC<GoogleDriveConnectorPanelProps> = ({ connectorId }) => {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<GoogleDriveConnectorRuntimeStatus | null>(null);
  const [config, setConfig] = useState<GoogleDriveConnectorConfig | null>(null);
  const [authRequest, setAuthRequest] = useState<GoogleDriveAuthRequest | null>(null);
  const [callbackUrl, setCallbackUrl] = useState('');
  const [files, setFiles] = useState<GoogleDriveFile[]>([]);
  const [storedFiles, setStoredFiles] = useState<GoogleDriveStoredFile[]>([]);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const isGoogleDriveConnector = connectorId === 'google-drive';

  const loadAll = useCallback(async () => {
    if (!isGoogleDriveConnector) {
      return;
    }
    setLoading(true);
    try {
      const [statusResponse, configResponse, storedResponse] = await Promise.all([
        ipcBridge.googleDriveConnector.getStatus.invoke(),
        ipcBridge.googleDriveConnector.getConfig.invoke(),
        ipcBridge.googleDriveConnector.listStoredFiles.invoke({ limit: 20 }),
      ]);
      if (statusResponse.success && statusResponse.data) {
        setStatus(statusResponse.data);
      }
      if (configResponse.success && configResponse.data) {
        setConfig(configResponse.data);
      }
      if (storedResponse.success && storedResponse.data) {
        setStoredFiles(storedResponse.data);
      }
    } catch (error) {
      Message.error(error instanceof Error ? error.message : 'Failed to load Google Drive connector state.');
    } finally {
      setLoading(false);
    }
  }, [isGoogleDriveConnector]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!isGoogleDriveConnector) {
      return;
    }

    const unsubscribe = ipcBridge.googleDriveConnector.statusChanged.on?.((nextStatus: GoogleDriveConnectorRuntimeStatus) => {
      setStatus(nextStatus);
    });

    return () => {
      unsubscribe?.();
    };
  }, [isGoogleDriveConnector]);

  const patchConfig = useCallback((patch: Partial<GoogleDriveConnectorConfig>) => {
    setConfig((previous) => (previous ? { ...previous, ...patch } : previous));
  }, []);

  const saveConfig = useCallback(async () => {
    if (!config) return;
    setSaving(true);
    try {
      const response = await ipcBridge.googleDriveConnector.setConfig.invoke({ config });
      if (!response.success || !response.data) {
        Message.error(response.msg || 'Failed to save Google Drive config.');
        return;
      }
      setConfig(response.data);
      Message.success('Google Drive config saved.');
      await loadAll();
    } finally {
      setSaving(false);
    }
  }, [config, loadAll]);

  const runAction = useCallback(async (action: 'start' | 'stop') => {
    setActionBusy(action);
    try {
      const response = action === 'start'
        ? await ipcBridge.googleDriveConnector.start.invoke()
        : await ipcBridge.googleDriveConnector.stop.invoke();
      if (!response.success) {
        Message.error(response.msg || `Failed to ${action} Google Drive sidecar.`);
      }
      await loadAll();
    } finally {
      setActionBusy(null);
    }
  }, [loadAll]);

  const handleCreateAuthUrl = useCallback(async () => {
    setActionBusy('auth-url');
    try {
      const response = await ipcBridge.googleDriveConnector.createAuthRequest.invoke();
      if (!response.success || !response.data) {
        Message.error(response.msg || 'Failed to create Google Drive auth URL.');
        return;
      }
      setAuthRequest(response.data);
      Message.success('Google Drive auth URL created.');
    } finally {
      setActionBusy(null);
    }
  }, []);

  const handleCompleteAuth = useCallback(async () => {
    if (!callbackUrl.trim()) {
      Message.warning('Paste the Google callback URL first.');
      return;
    }
    setActionBusy('complete-auth');
    try {
      const response = await ipcBridge.googleDriveConnector.completeAuth.invoke({
        callbackUrl: callbackUrl.trim(),
        state: authRequest?.state,
      });
      if (!response.success) {
        Message.error(response.msg || 'Failed to complete Google Drive auth.');
        return;
      }
      Message.success('Google Drive token cached.');
      await loadAll();
    } finally {
      setActionBusy(null);
    }
  }, [authRequest?.state, callbackUrl, loadAll]);

  const handleListFiles = useCallback(async () => {
    setActionBusy('list-files');
    try {
      const response = await ipcBridge.googleDriveConnector.listFiles.invoke({ limit: 10 });
      if (!response.success || !response.data) {
        Message.error(response.msg || 'Failed to list Google Drive files.');
        return;
      }
      setFiles(response.data);
      Message.success(`Loaded ${response.data.length} Google Drive files.`);
    } finally {
      setActionBusy(null);
    }
  }, []);

  const handleSyncNow = useCallback(async () => {
    setActionBusy('sync-now');
    try {
      const response = await ipcBridge.googleDriveConnector.syncNow.invoke({ limit: 50 });
      if (!response.success || !response.data) {
        Message.error(response.msg || 'Failed to sync Google Drive files.');
        return;
      }
      const result = response.data as GoogleDriveSyncResult;
      Message.success(`Synced ${result.storedCount} Google Drive files into ContextGo store.`);
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

  if (!isGoogleDriveConnector) {
    return null;
  }

  return (
    <div className={styles.clipboardPanel} data-testid='google-drive-connector-panel'>
      <div className={styles.detailGrid}>
        <div className={styles.detailCard}>
          <h3 className={styles.detailCardTitle}>Google Drive Runtime</h3>
          <Spin loading={loading} block>
            <div className={styles.clipboardStatusRow}>
              <Tag color={lifecycleColor}>{status?.lifecycle || 'unknown'}</Tag>
              <Tag color='arcoblue'>{status?.hasCredentials ? 'credentials ready' : 'credentials missing'}</Tag>
              <Tag color={status?.hasCachedToken ? 'green' : 'gray'}>{status?.hasCachedToken ? 'token cached' : 'token missing'}</Tag>
              {status?.pid ? <Tag color='cyan'>PID {status.pid}</Tag> : null}
            </div>
            <div className={styles.clipboardInfoList}>
              <div><strong>Command:</strong> {status?.command || config?.command || 'go'}</div>
              <div><strong>Scopes:</strong> {config?.scopes.join(', ') || DEFAULT_SCOPE}</div>
              <div><strong>Token cache:</strong> {status?.tokenCachePath || '—'}</div>
              <div><strong>Token expiry:</strong> {status?.tokenExpiry || '—'}</div>
              <div><strong>Refresh token:</strong> {status?.hasRefreshToken ? 'available' : 'missing'}</div>
              <div><strong>Stored files:</strong> {status?.fileCount ?? 0}</div>
              <div><strong>Store dir:</strong> {status?.storeDir || '—'}</div>
            </div>
            <div className={styles.clipboardNote}>{status?.note || 'Google Drive connector status unavailable.'}</div>
            <div className={styles.clipboardActionRow}>
              <Button icon={<Refresh theme='outline' size='14' />} onClick={() => void loadAll()} loading={loading}>Refresh</Button>
              <Button type='primary' icon={<PlayOne theme='outline' size='14' />} onClick={() => void runAction('start')} loading={actionBusy === 'start'}>Start</Button>
              <Button icon={<Pause theme='outline' size='14' />} onClick={() => void runAction('stop')} loading={actionBusy === 'stop'}>Stop</Button>
              <Button icon={<Send theme='outline' size='14' />} onClick={() => void handleListFiles()} loading={actionBusy === 'list-files'}>List Files</Button>
              <Button onClick={() => void handleSyncNow()} loading={actionBusy === 'sync-now'}>Sync Now</Button>
            </div>
          </Spin>
        </div>

        <div className={styles.detailCard}>
          <h3 className={styles.detailCardTitle}>Google Drive OAuth</h3>
          <Spin loading={loading} block>
            <div className={styles.clipboardControlList}>
              <div className={styles.clipboardControlRow}>
                <span>Enabled</span>
                <Switch checked={config?.enabled ?? false} onChange={(value) => patchConfig({ enabled: value })} />
              </div>
              <div className={styles.clipboardControlRowColumn}>
                <span>Client ID</span>
                <Input value={config?.clientId ?? ''} onChange={(value) => patchConfig({ clientId: value })} placeholder='google-client-id.apps.googleusercontent.com' />
              </div>
              <div className={styles.clipboardControlRowColumn}>
                <span>Client Secret</span>
                <Input.Password value={config?.clientSecret ?? ''} onChange={(value) => patchConfig({ clientSecret: value })} placeholder='google-client-secret' />
              </div>
              <div className={styles.clipboardControlRowColumn}>
                <span>Scopes</span>
                <Input value={config?.scopes.join(', ') ?? DEFAULT_SCOPE} onChange={(value) => patchConfig({ scopes: value.split(',').map((item) => item.trim()).filter(Boolean) })} />
              </div>
            </div>
            <div className={styles.clipboardActionRow}>
              <Button type='primary' onClick={() => void saveConfig()} loading={saving}>Save Google Drive Config</Button>
              <Button onClick={() => void handleCreateAuthUrl()} loading={actionBusy === 'auth-url'}>Create Auth URL</Button>
            </div>
            {authRequest ? (
              <div className={styles.clipboardControlRowColumn}>
                <span>Auth URL</span>
                <Input.TextArea readOnly autoSize value={authRequest.authUrl} />
              </div>
            ) : null}
            <div className={styles.clipboardControlRowColumn}>
              <span>Callback URL</span>
              <Input.TextArea
                autoSize
                value={callbackUrl}
                onChange={setCallbackUrl}
                placeholder='Paste the Google redirect URL after consent.'
              />
            </div>
            <div className={styles.clipboardActionRow}>
              <Button onClick={() => void handleCompleteAuth()} loading={actionBusy === 'complete-auth'}>Complete Auth</Button>
            </div>
          </Spin>
        </div>

        <div className={styles.detailCard}>
          <h3 className={styles.detailCardTitle}>Drive Files (Live)</h3>
          <div className={styles.clipboardList} data-testid='google-drive-file-list'>
            {files.length === 0 ? <div className={styles.detailCardText}>No Google Drive files loaded yet.</div> : null}
            {files.map((file) => (
              <div key={file.id} className={styles.clipboardListItem}>
                <div className={styles.clipboardListMetaRow}>
                  <Tag size='small' color='arcoblue'>{file.mimeType}</Tag>
                  <span>{file.modifiedTime || '—'}</span>
                </div>
                <div className={styles.clipboardListPreview}>{file.name}</div>
                <div className={styles.detailCardText}>
                  {file.ownerNames?.length ? `Owners: ${file.ownerNames.join(', ')}` : 'Owners: —'}
                  {typeof file.sizeBytes === 'number' ? ` · Size: ${file.sizeBytes} bytes` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.detailCard}>
          <h3 className={styles.detailCardTitle}>Drive Files (Stored)</h3>
          <div className={styles.clipboardList} data-testid='google-drive-stored-file-list'>
            {storedFiles.length === 0 ? <div className={styles.detailCardText}>No persisted Google Drive files in ContextGo store yet.</div> : null}
            {storedFiles.map((file) => (
              <div key={file.recordId} className={styles.clipboardListItem}>
                <div className={styles.clipboardListMetaRow}>
                  <Tag size='small' color='green'>{file.mimeType}</Tag>
                  <span>{file.syncedAt}</span>
                </div>
                <div className={styles.clipboardListPreview}>{file.name}</div>
                <div className={styles.detailCardText}>
                  {file.ownerNames?.length ? `Owners: ${file.ownerNames.join(', ')}` : 'Owners: —'}
                  {typeof file.sizeBytes === 'number' ? ` · Size: ${file.sizeBytes} bytes` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoogleDriveConnectorPanel;
