/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { ExternalSessionProvider, ExternalSessionSummary } from '@/common/types/externalSessions';
import { ContextGoModal } from '@/renderer/components/base';
import { emitter } from '@/renderer/utils/emitter';
import { Button, Empty, Message, Tabs, Tag, Typography } from '@arco-design/web-react';
import { Down, Refresh, Right } from '@icon-park/react';
import React, { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useConversationTabs } from '../../hooks/ConversationTabsContext';
import styles from './ExternalSessionsModal.module.css';

type ExternalSessionsModalProps = {
  visible: boolean;
  onClose: () => void;
};

type ExternalSessionFilter = 'all' | ExternalSessionProvider;
type OpenClawAgentSummary = {
  agentId: string;
  agentName: string;
  workspace?: string;
};

const FILTER_ORDER: ExternalSessionFilter[] = ['all', 'claude', 'codex', 'gemini', 'opencode', 'openclaw-gateway'];
const isSameAgentList = (left: string[], right: string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);
const normalizeOpenClawAgentId = (agentId?: string) => agentId?.trim().toLowerCase() || 'main';

const ExternalSessionsModal: React.FC<ExternalSessionsModalProps> = ({ visible, onClose }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { openTab } = useConversationTabs();
  const [messageApi, messageContext] = Message.useMessage();
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<ExternalSessionSummary[]>([]);
  const [openclawAgents, setOpenclawAgents] = useState<OpenClawAgentSummary[]>([]);
  const [activeFilter, setActiveFilter] = useState<ExternalSessionFilter>('all');
  const [expandedOpenClawAgents, setExpandedOpenClawAgents] = useState<string[]>([]);
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
      const [sessionsResult, agentsResult] = await Promise.all([
        ipcBridge.acpConversation.listExternalSessions.invoke({}),
        ipcBridge.acpConversation.getAvailableAgents.invoke(),
      ]);
      if (!sessionsResult?.success) {
        throw new Error(sessionsResult?.msg || 'Failed to scan external sessions');
      }

      if (requestSeqRef.current === requestId) {
        setSessions(sessionsResult.data?.sessions ?? []);
        const agentMap = new Map<string, OpenClawAgentSummary>();

        for (const agent of agentsResult?.success ? agentsResult.data || [] : []) {
          if (agent.backend !== 'openclaw-gateway' || typeof agent.openclawAgentId !== 'string') {
            continue;
          }

          const normalizedAgentId = normalizeOpenClawAgentId(agent.openclawAgentId);
          if (!agentMap.has(normalizedAgentId)) {
            agentMap.set(normalizedAgentId, {
              agentId: normalizedAgentId,
              agentName: agent.name,
              workspace: typeof agent.workspace === 'string' ? agent.workspace : undefined,
            });
          }
        }

        for (const session of sessionsResult.data?.sessions ?? []) {
          if (session.provider !== 'openclaw-gateway' || !session.openclawAgentId) {
            continue;
          }

          const normalizedAgentId = normalizeOpenClawAgentId(session.openclawAgentId);
          if (!agentMap.has(normalizedAgentId)) {
            agentMap.set(normalizedAgentId, {
              agentId: normalizedAgentId,
              agentName: session.agentName || session.openclawAgentId,
              workspace: session.workspace,
            });
          }
        }

        setOpenclawAgents(Array.from(agentMap.values()));
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

  const providerFilteredSessions =
    activeFilter === 'all' ? sessions : sessions.filter((session) => session.provider === activeFilter);
  const filteredSessions = providerFilteredSessions;
  const openclawSessionGroups =
    activeFilter === 'openclaw-gateway'
      ? openclawAgents.map((agent) => ({
          agent,
          sessions: filteredSessions.filter(
            (session) =>
              session.provider === 'openclaw-gateway' &&
              normalizeOpenClawAgentId(session.openclawAgentId) === agent.agentId
          ),
        }))
      : [];

  useEffect(() => {
    if (activeFilter !== 'openclaw-gateway') {
      return;
    }

    setExpandedOpenClawAgents((current) => {
      const next =
        current.length > 0
          ? current.filter((agentId) => openclawSessionGroups.some((group) => group.agent.agentId === agentId))
          : openclawSessionGroups.filter((group) => group.sessions.length > 0).map((group) => group.agent.agentId);

      return isSameAgentList(current, next) ? current : next;
    });
  }, [activeFilter, openclawSessionGroups]);

  const toggleOpenClawAgentGroup = (agentId: string) => {
    setExpandedOpenClawAgents((current) =>
      current.includes(agentId) ? current.filter((item) => item !== agentId) : [...current, agentId]
    );
  };

  const renderSessionCard = (session: ExternalSessionSummary) => (
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

          {loading && filteredSessions.length === 0 && sessions.length === 0 ? (
            <div className='py-20px text-center text-13px text-t-secondary'>
              {t('guid.externalSessions.loading', {
                defaultValue: 'Scanning external sessions...',
              })}
            </div>
          ) : activeFilter === 'openclaw-gateway' && openclawSessionGroups.length > 0 ? (
            <div className={styles.groupList}>
              {openclawSessionGroups.map(({ agent, sessions: agentSessions }) => (
                <div key={agent.agentId} className='flex flex-col gap-8px'>
                  <div
                    className={styles.groupHeader}
                    onClick={() => {
                      toggleOpenClawAgentGroup(agent.agentId);
                    }}
                  >
                    {expandedOpenClawAgents.includes(agent.agentId) ? (
                      <Down size={16} className='shrink-0 text-t-secondary' />
                    ) : (
                      <Right size={16} className='shrink-0 text-t-secondary' />
                    )}
                    <span className={styles.groupTitle}>{agent.agentName}</span>
                    <Tag size='small' color='gray'>
                      {String(agentSessions.length)}
                    </Tag>
                  </div>
                  {expandedOpenClawAgents.includes(agent.agentId) ? (
                    <div className={styles.groupChildren}>
                      <div className={styles.sessionMeta}>{agent.workspace || agentSessions[0]?.workspace || ''}</div>
                      {agentSessions.length > 0 ? (
                        <div className={styles.sessionsList}>
                          {agentSessions.map((session) => renderSessionCard(session))}
                        </div>
                      ) : (
                        <div aria-hidden='true' className={styles.emptyBranch} />
                      )}
                    </div>
                  ) : null}
                </div>
              ))}
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
