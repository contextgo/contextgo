import { ipcBridge } from '@/common';
import type { TSpace } from '@/common/config/storage';
import type {
  BrowserActivityConnectorStatus,
  BrowserActivityEntry,
} from '@/common/types/connectors/browserActivity';
import { STORAGE_KEYS } from '@/common/config/storageKeys';
import { Button, Input, Message, Spin, Tag } from '@arco-design/web-react';
import { ConnectionPoint, HistoryQuery, Send } from '@icon-park/react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../ConnectorsPage.module.css';

const EMPTY_STATUS: BrowserActivityConnectorStatus = {
  eventCount: 0,
};

const formatTime = (value?: string): string => {
  if (!value) {
    return '—';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }

  return parsed.toLocaleString();
};

const resolveSpaceFromList = (spaces: readonly TSpace[]): TSpace | null => {
  if (spaces.length === 0) {
    return null;
  }

  const selectedSpaceId = typeof window === 'undefined' ? null : localStorage.getItem(STORAGE_KEYS.SELECTED_SPACE_ID);
  if (selectedSpaceId) {
    const matched = spaces.find((space) => space.id === selectedSpaceId);
    if (matched) {
      return matched;
    }
  }

  return spaces.find((space) => space.isDefault) ?? spaces[0] ?? null;
};

type BrowserActivityConnectorPanelProps = {
  connectorId: string;
};

const BrowserActivityConnectorPanel: React.FC<BrowserActivityConnectorPanelProps> = ({ connectorId }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [spaceId, setSpaceId] = useState('');
  const [status, setStatus] = useState<BrowserActivityConnectorStatus>(EMPTY_STATUS);
  const [events, setEvents] = useState<BrowserActivityEntry[]>([]);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [ingesting, setIngesting] = useState(false);

  const isBrowserActivityConnector = connectorId === 'contextgo-browser-extension';

  const loadAll = useCallback(async () => {
    if (!isBrowserActivityConnector) {
      return;
    }

    setLoading(true);
    try {
      const spaces = await ipcBridge.space.list.invoke();
      const activeSpace = resolveSpaceFromList(spaces) ?? (await ipcBridge.space.ensureDefault.invoke());
      if (!activeSpace?.id) {
        setSpaceId('');
        setStatus(EMPTY_STATUS);
        setEvents([]);
        return;
      }

      setSpaceId(activeSpace.id);
      const [statusResponse, eventsResponse] = await Promise.all([
        ipcBridge.browserActivityConnector.getStatus.invoke({ spaceId: activeSpace.id }),
        ipcBridge.browserActivityConnector.listRecent.invoke({ spaceId: activeSpace.id, limit: 8 }),
      ]);

      if (!statusResponse.success) {
        throw new Error(statusResponse.msg || t('settings.connectors.browserActivity.loadFailed'));
      }
      if (!eventsResponse.success) {
        throw new Error(eventsResponse.msg || t('settings.connectors.browserActivity.loadFailed'));
      }

      setStatus(statusResponse.data ?? EMPTY_STATUS);
      setEvents(eventsResponse.data ?? []);
    } catch (error) {
      setStatus(EMPTY_STATUS);
      setEvents([]);
      Message.error(error instanceof Error ? error.message : t('settings.connectors.browserActivity.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [isBrowserActivityConnector, t]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleIngest = useCallback(async () => {
    if (!spaceId.trim()) {
      Message.error(t('settings.connectors.browserActivity.spaceUnavailable'));
      return;
    }

    setIngesting(true);
    try {
      const response = await ipcBridge.browserActivityConnector.ingest.invoke({
        spaceId,
        url: url.trim(),
        title: title.trim(),
        excerpt: excerpt.trim() || undefined,
        source: 'manual-import',
      });
      if (!response.success) {
        Message.error(response.msg || t('settings.connectors.browserActivity.ingestFailed'));
        return;
      }
      Message.success(t('settings.connectors.browserActivity.ingestSuccess'));
      setUrl('');
      setTitle('');
      setExcerpt('');
      await loadAll();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : t('settings.connectors.browserActivity.ingestFailed'));
    } finally {
      setIngesting(false);
    }
  }, [excerpt, loadAll, spaceId, t, title, url]);

  if (!isBrowserActivityConnector) {
    return null;
  }

  return (
    <div className={styles.clipboardPanel} data-testid='browser-activity-connector-panel'>
      <div className={styles.detailGrid}>
        <div className={styles.detailCard}>
          <h3 className={styles.detailCardTitle}>{t('settings.connectors.browserActivity.runtimeTitle')}</h3>
          <Spin loading={loading} block>
            <div className={styles.clipboardStatusRow}>
              <Tag color='green'>{t('settings.connectors.browserActivity.contextEngineReady')}</Tag>
              {spaceId ? <Tag color='arcoblue'>{spaceId}</Tag> : null}
            </div>
            <div className={styles.clipboardInfoList}>
              <div>
                <strong>{t('settings.connectors.browserActivity.currentSpace')}:</strong> {spaceId || '—'}
              </div>
              <div>
                <strong>{t('settings.connectors.browserActivity.eventCount')}:</strong> {status.eventCount}
              </div>
              <div>
                <strong>{t('settings.connectors.browserActivity.latestVisited')}:</strong> {formatTime(status.latestVisitedAt)}
              </div>
              <div>
                <strong>{t('settings.connectors.browserActivity.latestDomain')}:</strong> {status.latestDomain || '—'}
              </div>
            </div>
            <div className={styles.clipboardNote}>{t('settings.connectors.browserActivity.runtimeNote')}</div>
            <div className={styles.clipboardActionRow}>
              <Button icon={<HistoryQuery theme='outline' size='14' />} onClick={() => void loadAll()} loading={loading}>
                {t('settings.connectors.browserActivity.refreshAction')}
              </Button>
            </div>
          </Spin>
        </div>

        <div className={styles.detailCard}>
          <h3 className={styles.detailCardTitle}>{t('settings.connectors.browserActivity.ingestTitle')}</h3>
          <Spin loading={loading} block>
            <div className={styles.clipboardControlList}>
              <div className={styles.clipboardControlRowColumn}>
                <span>{t('settings.connectors.browserActivity.urlLabel')}</span>
                <Input value={url} onChange={setUrl} placeholder={t('settings.connectors.browserActivity.urlPlaceholder')} />
              </div>
              <div className={styles.clipboardControlRowColumn}>
                <span>{t('settings.connectors.browserActivity.titleLabel')}</span>
                <Input
                  value={title}
                  onChange={setTitle}
                  placeholder={t('settings.connectors.browserActivity.titlePlaceholder')}
                />
              </div>
              <div className={styles.clipboardControlRowColumn}>
                <span>{t('settings.connectors.browserActivity.excerptLabel')}</span>
                <Input.TextArea
                  value={excerpt}
                  onChange={setExcerpt}
                  autoSize={{ minRows: 4, maxRows: 8 }}
                  placeholder={t('settings.connectors.browserActivity.excerptPlaceholder')}
                />
              </div>
            </div>
            <div className={styles.clipboardActionRow}>
              <Button
                type='primary'
                icon={<Send theme='outline' size='14' />}
                onClick={() => void handleIngest()}
                loading={ingesting}
                disabled={!spaceId.trim() || !url.trim() || !title.trim()}
              >
                {t('settings.connectors.browserActivity.ingestAction')}
              </Button>
            </div>
          </Spin>
        </div>

        <div className={styles.detailCard}>
          <h3 className={styles.detailCardTitle}>{t('settings.connectors.browserActivity.recentTitle')}</h3>
          <Spin loading={loading} block>
            {events.length === 0 ? (
              <div className={styles.unsupportedHint}>{t('settings.connectors.browserActivity.empty')}</div>
            ) : (
              <div className={styles.clipboardList}>
                {events.map((event) => (
                  <div key={event.id} className={styles.clipboardListItem}>
                    <div className={styles.clipboardListMetaRow}>
                      <span>
                        <ConnectionPoint theme='outline' size='14' className={styles.categoryChevron} /> {event.title}
                      </span>
                      <Tag color='gray'>
                        {event.source === 'browser-extension'
                          ? t('settings.connectors.browserActivity.sourceExtension')
                          : t('settings.connectors.browserActivity.sourceManual')}
                      </Tag>
                    </div>
                    <div className={styles.clipboardListPreview}>{event.url}</div>
                    <div className={styles.clipboardListMetaRow}>
                      <span>{event.domain}</span>
                      <span>{formatTime(event.visitedAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Spin>
        </div>
      </div>
    </div>
  );
};

export default BrowserActivityConnectorPanel;
