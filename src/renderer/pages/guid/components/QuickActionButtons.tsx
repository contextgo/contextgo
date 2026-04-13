/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { acpConversation } from '@/common/adapter/ipcBridge';
import { useLayoutContext } from '@/renderer/hooks/context/LayoutContext';
import { Button } from '@arco-design/web-react';
import { Download, Right } from '@icon-park/react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../index.module.css';

type QuickActionButtonsProps = {
  onOpenExternalSessions: () => void;
  inactiveBorderColor: string;
  activeShadow: string;
};

type ExternalSessionsQuickStatus = 'checking' | 'ready' | 'empty' | 'error';

const EXTERNAL_SESSIONS_CACHE_TTL_MS = 5000;

let externalSessionsCache: {
  count: number;
  at: number;
} | null = null;

const QuickActionButtons: React.FC<QuickActionButtonsProps> = ({
  onOpenExternalSessions,
  inactiveBorderColor,
  activeShadow,
}) => {
  const { t } = useTranslation();
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const [hoveredQuickAction, setHoveredQuickAction] = useState<'external' | null>(null);
  const [externalSessionsQuickStatus, setExternalSessionsQuickStatus] = useState<ExternalSessionsQuickStatus>(
    externalSessionsCache ? (externalSessionsCache.count > 0 ? 'ready' : 'empty') : 'checking'
  );
  const [externalSessionCount, setExternalSessionCount] = useState(externalSessionsCache?.count ?? 0);

  useEffect(() => {
    let alive = true;

    const loadExternalSessions = async (forceRefresh = false) => {
      const now = Date.now();
      if (!forceRefresh && externalSessionsCache && now - externalSessionsCache.at < EXTERNAL_SESSIONS_CACHE_TTL_MS) {
        const nextCount = externalSessionsCache.count;
        setExternalSessionCount(nextCount);
        setExternalSessionsQuickStatus(nextCount > 0 ? 'ready' : 'empty');
        return;
      }

      setExternalSessionsQuickStatus('checking');

      try {
        const result = await acpConversation.listExternalSessions.invoke({ forceRefresh });
        if (!alive) {
          return;
        }

        const nextCount = result?.success ? (result.data?.sessions?.length ?? 0) : 0;
        setExternalSessionCount(nextCount);
        setExternalSessionsQuickStatus(result?.success ? (nextCount > 0 ? 'ready' : 'empty') : 'error');
        externalSessionsCache = { count: nextCount, at: Date.now() };
      } catch {
        if (!alive) {
          return;
        }
        setExternalSessionsQuickStatus('error');
      }
    };

    void loadExternalSessions();

    const handleFocus = () => {
      void loadExternalSessions(true);
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      alive = false;
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const quickActionStyle = useCallback(
    (isActive: boolean) => ({
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: inactiveBorderColor,
      boxShadow: isActive ? activeShadow : 'none',
    }),
    [activeShadow, inactiveBorderColor]
  );

  const externalSessionsStatusLabel =
    externalSessionsQuickStatus === 'ready'
      ? t('guid.externalSessions.readyCount', {
          count: externalSessionCount,
          defaultValue: `${externalSessionCount} sessions ready`,
        })
      : externalSessionsQuickStatus === 'checking'
        ? t('guid.externalSessions.loading', {
            defaultValue: 'Scanning external sessions...',
          })
        : externalSessionsQuickStatus === 'error'
          ? t('guid.externalSessions.loadFailed', {
              defaultValue: 'Failed to scan external sessions.',
            })
          : t('guid.externalSessions.emptyState', {
              defaultValue: 'No external sessions are waiting yet.',
            });

  const externalSessionsMobileStatusLabel =
    externalSessionsQuickStatus === 'ready'
      ? t('guid.externalSessions.readyCountShort', {
          count: externalSessionCount,
          defaultValue: `${externalSessionCount} ready`,
        })
      : externalSessionsQuickStatus === 'checking'
        ? t('guid.externalSessions.loadingShort', {
            defaultValue: 'Scanning',
          })
        : externalSessionsQuickStatus === 'error'
          ? t('guid.externalSessions.loadFailedShort', {
              defaultValue: 'Scan failed',
            })
          : t('guid.externalSessions.emptyStateShort', {
              defaultValue: 'None yet',
            });

  const externalSessionsTitleLabel = t('guid.externalSessions.title', {
    defaultValue: 'Continue external sessions',
  });

  const externalSessionsIconColor =
    externalSessionsQuickStatus === 'ready'
      ? 'rgb(var(--success-6))'
      : externalSessionsQuickStatus === 'checking'
        ? 'rgb(var(--primary-6))'
        : externalSessionsQuickStatus === 'error'
          ? 'rgb(var(--warning-6))'
          : 'var(--color-text-3)';

  if (isMobile) {
    return (
      <div className={styles.guidQuickActionsMobile}>
        <div className={styles.guidQuickActionsMobileGrid}>
          <div className={styles.guidQuickActionMobileStack}>
            <Button type='text' className={styles.guidQuickActionMobileButton} onClick={onOpenExternalSessions}>
              <span className={styles.guidQuickActionMobileButtonInner}>
                <span className={styles.guidQuickActionIcon}>
                  <Download theme='outline' size={20} fill={externalSessionsIconColor} strokeWidth={3} />
                </span>
                <span className={styles.guidQuickActionMobileTitle}>{externalSessionsTitleLabel}</span>
                <span className={styles.guidQuickActionChevron} aria-hidden='true'>
                  <Right theme='outline' size={16} fill='currentColor' strokeWidth={3} />
                </span>
              </span>
            </Button>
            <span className={styles.guidQuickActionMobileStatus}>{externalSessionsMobileStatusLabel}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`absolute left-50% -translate-x-1/2 flex flex-col justify-center items-center ${styles.guidQuickActions}`}
    >
      <div className='flex justify-center items-center gap-24px'>
        <div
          className='group inline-flex items-center justify-center h-36px min-w-36px max-w-36px px-0 rd-999px bg-fill-0 cursor-pointer overflow-hidden whitespace-nowrap hover:max-w-248px hover:px-14px hover:justify-start hover:gap-8px transition-[max-width,padding,border-radius,box-shadow] duration-420 ease-in-out'
          style={quickActionStyle(hoveredQuickAction === 'external')}
          onMouseEnter={() => setHoveredQuickAction('external')}
          onMouseLeave={() => setHoveredQuickAction(null)}
          onClick={onOpenExternalSessions}
        >
          <Download
            theme='outline'
            size={20}
            fill={externalSessionsIconColor}
            strokeWidth={3}
            className='flex-shrink-0 transition-colors duration-300'
          />
          <span
            className='opacity-0 max-w-0 overflow-hidden text-14px text-[var(--color-text-2)] group-hover:opacity-100 group-hover:max-w-260px transition-all duration-360 ease-in-out'
            title={`${externalSessionsTitleLabel} · ${externalSessionsStatusLabel}`}
          >
            {externalSessionsTitleLabel} · {externalSessionsMobileStatusLabel}
          </span>
        </div>
      </div>
    </div>
  );
};

export default QuickActionButtons;
