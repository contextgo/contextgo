/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type {
  ExternalSessionProvider,
  ExternalSessionSummary,
  ProductVisibleExternalSessionProvider,
} from '@/common/types/externalSessions';
import { ContextGoModal } from '@/renderer/components/base';
import { emitter } from '@/renderer/utils/emitter';
import { Button, Empty, Message, Tabs, Tag, Typography } from '@arco-design/web-react';
import { Refresh } from '@icon-park/react';
import React, { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useConversationTabs } from '../../hooks/ConversationTabsContext';
import styles from './ExternalSessionsModal.module.css';

type ExternalSessionsModalProps = {
  visible: boolean;
  onClose: () => void;
};

type ExternalSessionFilter = 'all' | ProductVisibleExternalSessionProvider;

const FILTER_ORDER: ExternalSessionFilter[] = ['all', 'claude', 'codex', 'gemini', 'opencode'];
const PRODUCT_VISIBLE_SESSION_PROVIDER_SET = new Set<ExternalSessionProvider>([
  'claude',
  'codex',
  'gemini',
  'opencode',
]);

const isProductVisibleExternalSessionProvider = (
  provider: ExternalSessionProvider
): provider is ProductVisibleExternalSessionProvider => PRODUCT_VISIBLE_SESSION_PROVIDER_SET.has(provider);

const collectSessionSignals = (session: ExternalSessionSummary): string[] => {
  return [session.model, session.modelProvider, session.reasoningEffort]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .filter(
      (value, index, values) =>
        values.findIndex((candidate) => candidate.toLowerCase() === value.toLowerCase()) === index
    );
};

const ExternalSessionsModal: React.FC<ExternalSessionsModalProps> = ({ visible, onClose }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { openTab } = useConversationTabs();
  const [messageApi, messageContext] = Message.useMessage();
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<ExternalSessionSummary[]>([]);
  const [activeFilter, setActiveFilter] = useState<ExternalSessionFilter>('all');
  const [importingSessionId, setImportingSessionId] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const requestSeqRef = useRef(0);

  const loadSessions = useEffectEvent(async () => {
    if (loadingRef.current) {
      return;
    }

    loadingRef.current = true;
    const requestId = requestSeqRef.current + 1;
    requestSeqRef.current = requestId;
    setLoading(true);

    try {
      const sessionsResult = await ipcBridge.acpConversation.listExternalSessions.invoke({});
      if (!sessionsResult?.success) {
        throw new Error(sessionsResult?.msg || 'Failed to scan external sessions');
      }

      if (requestSeqRef.current === requestId) {
        setSessions(sessionsResult.data?.sessions ?? []);
      }
    } catch (error) {
      console.error('Failed to load external sessions:', error);
      messageApi.error(
        t('guid.externalSessions.loadFailed', {
          defaultValue: 'Failed to scan external sessions.',
        })
      );
    } finally {
      if (requestSeqRef.current === requestId) {
        setLoading(false);
      }
      loadingRef.current = false;
    }
  });

  const importSession = useCallback(
    async (session: ExternalSessionSummary) => {
      setImportingSessionId(session.sessionId);

      try {
        const result = await ipcBridge.acpConversation.importExternalSession.invoke({
          provider: session.provider,
          sessionId: session.sessionId,
        });

        if (!result?.success || !result.data?.conversation) {
          throw new Error(result?.msg || 'Failed to import external session');
        }

        const conversation = result.data.conversation;
        emitter.emit('chat.history.refresh');
        openTab(conversation);
        onClose();
        await navigate(`/conversation/${conversation.id}`);
      } catch (error) {
        console.error('Failed to import external session:', error);
        messageApi.error(
          t('guid.externalSessions.importFailed', {
            defaultValue: 'Failed to take over the selected external session.',
          })
        );
      } finally {
        setImportingSessionId(null);
      }
    },
    [messageApi, navigate, onClose, openTab, t]
  );

  useEffect(() => {
    if (!visible) {
      return;
    }

    setActiveFilter('all');
    void loadSessions();
  }, [visible]);

  const visibleSessions = useMemo(
    () => sessions.filter((session) => isProductVisibleExternalSessionProvider(session.provider)),
    [sessions]
  );

  const filteredSessions = useMemo(
    () =>
      activeFilter === 'all' ? visibleSessions : visibleSessions.filter((session) => session.provider === activeFilter),
    [activeFilter, visibleSessions]
  );

  const renderSessionCard = (session: ExternalSessionSummary) => {
    const sessionSignals = collectSessionSignals(session);

    return (
      <div key={`${session.provider}:${session.sessionId}`} className={styles.sessionCard}>
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-8px flex-wrap'>
            <Tag size='small' color='arcoblue'>
              {t(`guid.externalSessions.providers.${session.provider}`, {
                defaultValue: session.provider,
              })}
            </Tag>
            <span className={styles.sessionTitle}>{session.title}</span>
          </div>
          <div className={styles.sessionMeta}>{session.workspace}</div>
          {sessionSignals.length > 0 ? (
            <div className={styles.sessionSignalRow}>
              {sessionSignals.map((signal) => (
                <span key={signal} className={styles.sessionSignal}>
                  {signal}
                </span>
              ))}
            </div>
          ) : null}
          <div className={styles.sessionMeta}>
            {t('guid.externalSessions.updatedAt', {
              defaultValue: 'Updated {{time}}',
              time: new Date(session.updatedAt).toLocaleString(),
            })}
          </div>
        </div>
        <Button
          type='primary'
          size='small'
          loading={importingSessionId === session.sessionId}
          onClick={() => {
            void importSession(session);
          }}
        >
          {t('guid.externalSessions.import', {
            defaultValue: 'Take over',
          })}
        </Button>
      </div>
    );
  };

  return (
    <>
      {messageContext}
      <ContextGoModal
        visible={visible}
        onCancel={onClose}
        unmountOnExit
        className='external-sessions-modal'
        header={{
          title: t('guid.externalSessions.title', {
            defaultValue: 'Continue external sessions',
          }),
          showClose: true,
          className: 'px-24px pt-20px',
          style: { borderBottom: 'none' },
        }}
        footer={null}
        style={{
          width: 'min(720px, calc(100vw - 32px))',
          maxHeight: 'calc(100vh - 40px)',
        }}
        contentStyle={{
          padding: '14px 24px 24px',
          overflow: 'auto',
          maxHeight: 'calc(100vh - 136px)',
        }}
      >
        <div className={styles.modalBody}>
          <div className='flex items-start justify-between gap-12px'>
            <Typography.Paragraph className='!mb-0 text-t-secondary'>
              {t('guid.externalSessions.description', {
                count: sessions.length,
                defaultValue:
                  'New CLI sessions created outside ContextGo will appear here when they have not been taken over yet.',
              })}
            </Typography.Paragraph>
            <Button
              size='mini'
              type='text'
              icon={<Refresh size={14} className={loading ? 'animate-spin' : ''} />}
              onClick={() => {
                void loadSessions();
              }}
            >
              {t('guid.externalSessions.refresh', {
                defaultValue: 'Refresh',
              })}
            </Button>
          </div>

          <div className={styles.filterRail}>
            <Tabs
              className={styles.filterTabs}
              activeTab={activeFilter}
              size='small'
              type='rounded'
              onChange={(key) => {
                setActiveFilter(key as ExternalSessionFilter);
              }}
            >
              {FILTER_ORDER.map((filter) => (
                <Tabs.TabPane
                  key={filter}
                  title={
                    filter === 'all'
                      ? t('guid.externalSessions.filters.all', {
                          defaultValue: 'All',
                        })
                      : t(`guid.externalSessions.providers.${filter}`, {
                          defaultValue: filter,
                        })
                  }
                />
              ))}
            </Tabs>
          </div>

          {loading && filteredSessions.length === 0 && visibleSessions.length === 0 ? (
            <div className='py-20px text-center text-13px text-t-secondary'>
              {t('guid.externalSessions.loading', {
                defaultValue: 'Scanning external sessions...',
              })}
            </div>
          ) : filteredSessions.length > 0 ? (
            <div className={styles.sessionsList}>{filteredSessions.map((session) => renderSessionCard(session))}</div>
          ) : (
            <Empty
              className='py-24px'
              description={t('guid.externalSessions.description', {
                count: 0,
                defaultValue:
                  'New CLI sessions created outside ContextGo will appear here when they have not been taken over yet.',
              })}
            />
          )}
        </div>
      </ContextGoModal>
    </>
  );
};

export default ExternalSessionsModal;
