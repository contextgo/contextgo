import { ipcBridge } from '@/common';
import type {
  ClipboardCollectResult,
  ClipboardConnectorConfig,
  ClipboardConnectorRuntimeStatus,
  ClipboardDailySummary,
  ClipboardStoredEvent,
} from '@/common/types/connectors/clipboard';
import { Button, InputNumber, Message, Spin, Switch, Tag } from '@arco-design/web-react';
import { Refresh, PlayOne, Pause, FileAddition, HistoryQuery } from '@icon-park/react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styles from '../ConnectorsPage.module.css';

const formatTime = (value?: string | number): string => {
  if (!value) {
    return '—';
  }

  const date = typeof value === 'number' ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleString();
};

type ClipboardConnectorPanelProps = {
  connectorId: string;
};

const ClipboardConnectorPanel: React.FC<ClipboardConnectorPanelProps> = ({ connectorId }) => {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<ClipboardConnectorRuntimeStatus | null>(null);
  const [config, setConfig] = useState<ClipboardConnectorConfig | null>(null);
  const [events, setEvents] = useState<ClipboardStoredEvent[]>([]);
  const [summaries, setSummaries] = useState<ClipboardDailySummary[]>([]);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const isClipboardConnector = connectorId === 'contextgo-clipboard';

  const loadAll = useCallback(async () => {
    if (!isClipboardConnector) {
      return;
    }

    setLoading(true);
    try {
      const [statusResponse, configResponse, eventsResponse, summariesResponse] = await Promise.all([
        ipcBridge.clipboardConnector.getStatus.invoke(),
        ipcBridge.clipboardConnector.getConfig.invoke(),
        ipcBridge.clipboardConnector.listRecentEvents.invoke({ limit: 8 }),
        ipcBridge.clipboardConnector.listSummaries.invoke({ limit: 5 }),
      ]);

      if (statusResponse.success && statusResponse.data) {
        setStatus(statusResponse.data);
      }
      if (configResponse.success && configResponse.data) {
        setConfig(configResponse.data);
      }
      if (eventsResponse.success && eventsResponse.data) {
        setEvents(eventsResponse.data);
      }
      if (summariesResponse.success && summariesResponse.data) {
        setSummaries(summariesResponse.data);
      }
    } catch (error) {
      Message.error(error instanceof Error ? error.message : 'Failed to load clipboard connector state.');
    } finally {
      setLoading(false);
    }
  }, [isClipboardConnector]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!isClipboardConnector) {
      return;
    }

    const unsubscribe = ipcBridge.clipboardConnector.statusChanged.on?.(
      (nextStatus: ClipboardConnectorRuntimeStatus) => {
        setStatus(nextStatus);
      }
    );

    return () => {
      unsubscribe?.();
    };
  }, [isClipboardConnector]);

  const handleConfigPatch = useCallback((patch: Partial<ClipboardConnectorConfig>) => {
    setConfig((previous) => {
      if (!previous) {
        return previous;
      }
      return {
        ...previous,
        ...patch,
      };
    });
  }, []);

  const saveConfig = useCallback(async () => {
    if (!config) {
      return;
    }

    setSaving(true);
    try {
      const response = await ipcBridge.clipboardConnector.setConfig.invoke({ config });
      if (!response.success || !response.data) {
        Message.error(response.msg || 'Failed to save clipboard settings.');
        return;
      }
      setConfig(response.data);
      Message.success('Clipboard settings saved.');
      await loadAll();
    } finally {
      setSaving(false);
    }
  }, [config, loadAll]);

  const runAction = useCallback(
    async (action: 'start' | 'stop' | 'sample' | 'collect') => {
      setActionBusy(action);
      try {
        if (action === 'start') {
          const response = await ipcBridge.clipboardConnector.start.invoke();
          if (!response.success) {
            Message.error(response.msg || 'Failed to start clipboard observer.');
          }
        }
        if (action === 'stop') {
          const response = await ipcBridge.clipboardConnector.stop.invoke();
          if (!response.success) {
            Message.error(response.msg || 'Failed to stop clipboard observer.');
          }
        }
        if (action === 'sample') {
          const response = await ipcBridge.clipboardConnector.sampleNow.invoke();
          if (!response.success) {
            Message.error(response.msg || 'Failed to sample clipboard.');
          } else if (response.data) {
            Message.success('Clipboard sample saved to ContextGo store.');
          }
        }
        if (action === 'collect') {
          const response = await ipcBridge.clipboardConnector.collectNow.invoke({});
          if (!response.success || !response.data) {
            Message.error(response.msg || 'Failed to collect clipboard summaries.');
          } else {
            const result = response.data as ClipboardCollectResult;
            Message.success(`Clipboard collected: ${result.eventCount} events.`);
          }
        }
        await loadAll();
      } finally {
        setActionBusy(null);
      }
    },
    [loadAll]
  );

  const lifecycleColor = useMemo(() => {
    if (status?.lifecycle === 'running') return 'green';
    if (status?.lifecycle === 'error') return 'red';
    return 'gray';
  }, [status?.lifecycle]);

  if (!isClipboardConnector) {
    return null;
  }

  return (
    <div className={styles.clipboardPanel} data-testid='clipboard-connector-panel'>
      <div className={styles.detailGrid}>
        <div className={styles.detailCard}>
          <h3 className={styles.detailCardTitle}>Clipboard Runtime</h3>
          <Spin loading={loading} block>
            <div className={styles.clipboardStatusRow}>
              <Tag color={lifecycleColor}>{status?.lifecycle || 'unknown'}</Tag>
              <Tag color='arcoblue'>{status?.available ? 'macOS ready' : 'unsupported'}</Tag>
              {status?.observerPid ? <Tag color='cyan'>PID {status.observerPid}</Tag> : null}
            </div>
            <div className={styles.clipboardInfoList}>
              <div>
                <strong>Events:</strong> {status?.eventCount ?? 0}
              </div>
              <div>
                <strong>Summaries:</strong> {status?.summaryCount ?? 0}
              </div>
              <div>
                <strong>Last captured:</strong> {formatTime(status?.lastCapturedAt)}
              </div>
              <div>
                <strong>Last collected:</strong> {formatTime(status?.lastCollectedAt)}
              </div>
              <div>
                <strong>Observer repo:</strong> {status?.observerRepoDir || '—'}
              </div>
              <div>
                <strong>ContextGo store:</strong> {status?.storeDir || '—'}
              </div>
            </div>
            <div className={styles.clipboardNote}>{status?.note || 'Clipboard observer status unavailable.'}</div>
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
                icon={<HistoryQuery theme='outline' size='14' />}
                onClick={() => void runAction('sample')}
                loading={actionBusy === 'sample'}
              >
                Sample Now
              </Button>
              <Button
                icon={<FileAddition theme='outline' size='14' />}
                onClick={() => void runAction('collect')}
                loading={actionBusy === 'collect'}
              >
                Collect Today
              </Button>
            </div>
          </Spin>
        </div>

        <div className={styles.detailCard}>
          <h3 className={styles.detailCardTitle}>Clipboard Settings</h3>
          <Spin loading={loading} block>
            <div className={styles.clipboardControlList}>
              <div className={styles.clipboardControlRow}>
                <span>Enabled</span>
                <Switch
                  checked={config?.enabled ?? false}
                  onChange={(value) => handleConfigPatch({ enabled: value })}
                />
              </div>
              <div className={styles.clipboardControlRow}>
                <span>Retain full text</span>
                <Switch
                  checked={config?.retainFullText ?? false}
                  onChange={(value) => handleConfigPatch({ retainFullText: value })}
                />
              </div>
              <div className={styles.clipboardControlRow}>
                <span>Poll interval ms</span>
                <InputNumber
                  min={200}
                  value={config?.pollIntervalMs}
                  onChange={(value) => handleConfigPatch({ pollIntervalMs: Number(value || 200) })}
                />
              </div>
              <div className={styles.clipboardControlRow}>
                <span>Max text bytes</span>
                <InputNumber
                  min={256}
                  value={config?.maxTextBytes}
                  onChange={(value) => handleConfigPatch({ maxTextBytes: Number(value || 256) })}
                />
              </div>
            </div>
            <div className={styles.clipboardActionRow}>
              <Button type='primary' onClick={() => void saveConfig()} loading={saving}>
                Save Settings
              </Button>
            </div>
          </Spin>
        </div>

        <div className={styles.detailCard}>
          <h3 className={styles.detailCardTitle}>Recent Events</h3>
          <div className={styles.clipboardList} data-testid='clipboard-recent-list'>
            {events.length === 0 ? (
              <div className={styles.detailCardText}>No clipboard events stored in ContextGo yet.</div>
            ) : null}
            {events.map((event) => (
              <div key={event.id} className={styles.clipboardListItem}>
                <div className={styles.clipboardListMetaRow}>
                  <Tag size='small' color='arcoblue'>
                    {event.contentType}
                  </Tag>
                  <span>{formatTime(event.capturedAt)}</span>
                </div>
                <div className={styles.clipboardListPreview}>{event.textPreview || '—'}</div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.detailCard}>
          <h3 className={styles.detailCardTitle}>Daily Summaries</h3>
          <div className={styles.clipboardList} data-testid='clipboard-summary-list'>
            {summaries.length === 0 ? (
              <div className={styles.detailCardText}>No ContextGo clipboard summaries yet.</div>
            ) : null}
            {summaries.map((summary) => (
              <div key={summary.id} className={styles.clipboardListItem}>
                <div className={styles.clipboardListMetaRow}>
                  <Tag size='small' color='green'>
                    {summary.summaryDate}
                  </Tag>
                  <span>
                    {summary.eventCount} events / {summary.uniqueHashCount} unique
                  </span>
                </div>
                <div className={styles.detailCardText}>
                  {summary.topDomains.length > 0
                    ? `Top domains: ${summary.topDomains.map((item) => `${item.domain} (${item.count})`).join(', ')}`
                    : 'No domains captured for this day.'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClipboardConnectorPanel;
