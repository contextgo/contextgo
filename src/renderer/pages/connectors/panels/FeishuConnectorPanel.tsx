import { ipcBridge } from '@/common';
import type { FeishuConnectorConfig, FeishuConnectorRuntimeStatus } from '@/common/types/connectors/feishu';
import { Button, Input, Message, Spin, Switch, Tag } from '@arco-design/web-react';
import { Pause, PlayOne, Refresh } from '@icon-park/react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styles from '../ConnectorsPage.module.css';

type FeishuConnectorPanelProps = {
  connectorId: string;
};

const FeishuConnectorPanel: React.FC<FeishuConnectorPanelProps> = ({ connectorId }) => {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<FeishuConnectorRuntimeStatus | null>(null);
  const [config, setConfig] = useState<FeishuConnectorConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const isFeishuConnector = connectorId === 'lark';

  const loadAll = useCallback(async () => {
    if (!isFeishuConnector) {
      return;
    }
    setLoading(true);
    try {
      const [statusResponse, configResponse] = await Promise.all([
        ipcBridge.feishuConnector.getStatus.invoke(),
        ipcBridge.feishuConnector.getConfig.invoke(),
      ]);
      if (statusResponse.success && statusResponse.data) {
        setStatus(statusResponse.data);
      }
      if (configResponse.success && configResponse.data) {
        setConfig(configResponse.data);
      }
    } catch (error) {
      Message.error(error instanceof Error ? error.message : 'Failed to load Feishu connector state.');
    } finally {
      setLoading(false);
    }
  }, [isFeishuConnector]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!isFeishuConnector) {
      return;
    }

    const unsubscribe = ipcBridge.feishuConnector.statusChanged.on?.((nextStatus: FeishuConnectorRuntimeStatus) => {
      setStatus(nextStatus);
    });

    return () => {
      unsubscribe?.();
    };
  }, [isFeishuConnector]);

  const patchConfig = useCallback((patch: Partial<FeishuConnectorConfig>) => {
    setConfig((previous) => (previous ? { ...previous, ...patch } : previous));
  }, []);

  const saveConfig = useCallback(async () => {
    if (!config) return;
    setSaving(true);
    try {
      const response = await ipcBridge.feishuConnector.setConfig.invoke({ config });
      if (!response.success || !response.data) {
        Message.error(response.msg || 'Failed to save Feishu connector config.');
        return;
      }
      setConfig(response.data);
      Message.success('Feishu connector config saved.');
      await loadAll();
    } finally {
      setSaving(false);
    }
  }, [config, loadAll]);

  const runAction = useCallback(async (action: 'start' | 'stop') => {
    setActionBusy(action);
    try {
      const response = action === 'start'
        ? await ipcBridge.feishuConnector.start.invoke()
        : await ipcBridge.feishuConnector.stop.invoke();
      if (!response.success) {
        Message.error(response.msg || `Failed to ${action} Feishu sidecar.`);
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

  if (!isFeishuConnector) {
    return null;
  }

  return (
    <div className={styles.clipboardPanel} data-testid='feishu-connector-panel'>
      <div className={styles.detailGrid}>
        <div className={styles.detailCard}>
          <h3 className={styles.detailCardTitle}>Feishu OpenAPI Runtime</h3>
          <Spin loading={loading} block>
            <div className={styles.clipboardStatusRow}>
              <Tag color={lifecycleColor}>{status?.lifecycle || 'unknown'}</Tag>
              <Tag color='arcoblue'>{status?.hasCredentials ? 'credentials ready' : 'credentials missing'}</Tag>
              {status?.pid ? <Tag color='cyan'>PID {status.pid}</Tag> : null}
            </div>
            <div className={styles.clipboardInfoList}>
              <div><strong>Package:</strong> {config?.command || '@larksuiteoapi/lark-mcp'}</div>
              <div><strong>Domain:</strong> {config?.apiDomain || 'open.feishu.cn'}</div>
              <div><strong>OAuth mode:</strong> {config?.useOAuth ? 'enabled' : 'disabled'}</div>
              <div><strong>Command:</strong> {status?.command || 'npx'}</div>
            </div>
            <div className={styles.clipboardNote}>{status?.note || 'Feishu connector status unavailable.'}</div>
            <div className={styles.clipboardActionRow}>
              <Button icon={<Refresh theme='outline' size='14' />} onClick={() => void loadAll()} loading={loading}>Refresh</Button>
              <Button type='primary' icon={<PlayOne theme='outline' size='14' />} onClick={() => void runAction('start')} loading={actionBusy === 'start'}>Start</Button>
              <Button icon={<Pause theme='outline' size='14' />} onClick={() => void runAction('stop')} loading={actionBusy === 'stop'}>Stop</Button>
            </div>
          </Spin>
        </div>

        <div className={styles.detailCard}>
          <h3 className={styles.detailCardTitle}>Feishu Credentials</h3>
          <Spin loading={loading} block>
            <div className={styles.clipboardControlList}>
              <div className={styles.clipboardControlRow}>
                <span>Enabled</span>
                <Switch checked={config?.enabled ?? false} onChange={(value) => patchConfig({ enabled: value })} />
              </div>
              <div className={styles.clipboardControlRowColumn}>
                <span>App ID</span>
                <Input value={config?.appId ?? ''} onChange={(value) => patchConfig({ appId: value })} placeholder='cli_a1b2c3' />
              </div>
              <div className={styles.clipboardControlRowColumn}>
                <span>App Secret</span>
                <Input.Password value={config?.appSecret ?? ''} onChange={(value) => patchConfig({ appSecret: value })} placeholder='secret' />
              </div>
              <div className={styles.clipboardControlRow}>
                <span>Use OAuth</span>
                <Switch checked={config?.useOAuth ?? false} onChange={(value) => patchConfig({ useOAuth: value })} />
              </div>
            </div>
            <div className={styles.clipboardActionRow}>
              <Button type='primary' onClick={() => void saveConfig()} loading={saving}>Save Feishu Config</Button>
            </div>
          </Spin>
        </div>
      </div>
    </div>
  );
};

export default FeishuConnectorPanel;
