/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { IMessageSearchItem } from '@/common/types/database';
import { usePresetAssistantInfo } from '@/renderer/hooks/agent/usePresetAssistantInfo';
import { useOptionalConversationTabs } from '@/renderer/pages/conversation/hooks/ConversationTabsContext';
import { useCronJobsMap } from '@/renderer/pages/cron';
import { getAgentLogo } from '@/renderer/utils/model/agentLogo';
import { blockMobileInputFocus, blurActiveElement } from '@/renderer/utils/ui/focus';
import { Empty, Spin, Typography } from '@arco-design/web-react';
import { CloseSmall, MessageOne, Search } from '@icon-park/react';
import classNames from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { getBackendKeyFromConversation } from './utils/exportHelpers';
import './ConversationSearchPopover.css';

const PAGE_SIZE = 20;
const MAX_RECENT_SEARCHES = 8;
const RECENT_SEARCH_STORAGE_KEY = 'conversation.historySearch.recentKeywords';
const SNIPPET_MAX_LENGTH = 110;
const SNIPPET_PREFIX_CONTEXT_LENGTH = 34;
const SNIPPET_SUFFIX_CONTEXT_LENGTH = 58;

export const CONVERSATION_SEARCH_ROUTE = '/search/conversations';

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildSnippet = (text: string, keyword: string, maxLength = SNIPPET_MAX_LENGTH): string => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (!keyword.trim()) {
    return normalized.length > maxLength ? `${normalized.slice(0, maxLength).trimEnd()}...` : normalized;
  }

  const lowerText = normalized.toLowerCase();
  const lowerKeyword = keyword.trim().toLowerCase();
  const matchIndex = lowerText.indexOf(lowerKeyword);
  if (matchIndex === -1) {
    return normalized.length > maxLength ? `${normalized.slice(0, maxLength).trimEnd()}...` : normalized;
  }

  let start = Math.max(0, matchIndex - SNIPPET_PREFIX_CONTEXT_LENGTH);
  let end = Math.min(normalized.length, matchIndex + lowerKeyword.length + SNIPPET_SUFFIX_CONTEXT_LENGTH);

  if (end - start > maxLength) {
    const centeredStart = Math.max(0, matchIndex - Math.floor((maxLength - lowerKeyword.length) / 2));
    start = Math.min(centeredStart, Math.max(0, normalized.length - maxLength));
    end = Math.min(normalized.length, start + maxLength);
  }

  const snippet = normalized.slice(start, end).trim();
  return `${start > 0 ? '...' : ''}${snippet}${end < normalized.length ? '...' : ''}`;
};

const renderHighlightedText = (text: string, keyword: string) => {
  if (!keyword.trim()) {
    return text;
  }

  const pattern = new RegExp(`(${escapeRegExp(keyword.trim())})`, 'ig');
  const parts = text.split(pattern);
  const lowerKeyword = keyword.trim().toLowerCase();

  return parts.map((part, index) => {
    if (part.toLowerCase() !== lowerKeyword) {
      return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
    }

    return (
      <mark key={`${part}-${index}`} className='conversation-search-modal__highlight'>
        {part}
      </mark>
    );
  });
};

const formatTime = (timestamp: number): string => {
  if (!timestamp) return '';
  return new Intl.DateTimeFormat(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp);
};

interface ConversationSearchPopoverProps {
  onSessionClick?: () => void;
  onConversationSelect?: () => void;
  disabled?: boolean;
  buttonClassName?: string;
  buttonLabel?: string;
}

type ConversationSearchPanelProps = {
  onSessionClick?: () => void;
  onConversationSelect?: () => void;
  inputAutoFocus?: boolean;
};

const ConversationAgentMark: React.FC<{ conversation: IMessageSearchItem['conversation'] }> = ({ conversation }) => {
  const { info: assistantInfo } = usePresetAssistantInfo(conversation);

  if (assistantInfo) {
    if (assistantInfo.isEmoji) {
      return (
        <span className='text-18px leading-none flex-shrink-0' title={assistantInfo.name}>
          {assistantInfo.logo}
        </span>
      );
    }

    return (
      <img
        src={assistantInfo.logo}
        alt={assistantInfo.name}
        title={assistantInfo.name}
        className='w-18px h-18px rounded-50% flex-shrink-0'
      />
    );
  }

  const backendKey = getBackendKeyFromConversation(conversation);
  const logo = getAgentLogo(backendKey);
  if (logo) {
    return (
      <img
        src={logo}
        alt={`${backendKey || 'agent'} logo`}
        title={backendKey || 'agent'}
        className='w-18px h-18px rounded-50% flex-shrink-0'
      />
    );
  }

  return <MessageOne theme='outline' size='18' className='line-height-0 flex-shrink-0 text-t-secondary' />;
};

const ConversationSearchPanel: React.FC<ConversationSearchPanelProps> = ({
  onSessionClick,
  onConversationSelect,
  inputAutoFocus = false,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const conversationTabs = useOptionalConversationTabs();
  const { markAsRead } = useCronJobsMap();
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [items, setItems] = useState<IMessageSearchItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [recentKeywords, setRecentKeywords] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_SEARCH_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const sanitized = parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
        setRecentKeywords(sanitized.slice(0, MAX_RECENT_SEARCHES));
      }
    } catch {
      // Ignore storage parse errors and fallback to empty history.
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedKeyword(keyword.trim());
    }, 250);

    return () => window.clearTimeout(timer);
  }, [keyword]);

  const runSearch = useCallback(
    async (pageToLoad: number, append: boolean) => {
      if (!debouncedKeyword) {
        setItems([]);
        setPage(0);
        setHasMore(false);
        return;
      }

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const result = await ipcBridge.database.searchConversationMessages.invoke({
          keyword: debouncedKeyword,
          page: pageToLoad,
          pageSize: PAGE_SIZE,
        });

        setItems((prev) => (append ? [...prev, ...result.items] : result.items));
        setPage(result.page);
        setHasMore(result.hasMore);
      } catch (error) {
        console.error('[ConversationSearchPage] Search failed:', error);
        if (!append) {
          setItems([]);
          setPage(0);
          setHasMore(false);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [debouncedKeyword]
  );

  useEffect(() => {
    void runSearch(0, false);
  }, [runSearch]);

  useEffect(() => {
    if (!debouncedKeyword) return;
    const normalized = debouncedKeyword.trim();
    if (!normalized) return;

    setRecentKeywords((prev) => {
      const nextKeywords = [normalized, ...prev.filter((item) => item !== normalized)].slice(0, MAX_RECENT_SEARCHES);
      const unchanged =
        nextKeywords.length === prev.length && nextKeywords.every((item, index) => item === prev[index]);
      if (unchanged) {
        return prev;
      }

      try {
        localStorage.setItem(RECENT_SEARCH_STORAGE_KEY, JSON.stringify(nextKeywords));
      } catch {
        // Ignore storage write errors in private mode / restricted environments.
      }

      return nextKeywords;
    });
  }, [debouncedKeyword]);

  const handleLoadMore = useCallback(() => {
    if (!debouncedKeyword || loading || loadingMore || !hasMore) {
      return;
    }

    void runSearch(page + 1, true);
  }, [debouncedKeyword, hasMore, loading, loadingMore, page, runSearch]);

  const handleResultClick = useCallback(
    async (item: IMessageSearchItem) => {
      blockMobileInputFocus();
      blurActiveElement();

      onConversationSelect?.();
      markAsRead(item.conversation.id);

      if (conversationTabs) {
        const { openTab } = conversationTabs;
        openTab(item.conversation);
      }

      await Promise.resolve(
        navigate(`/conversation/${item.conversation.id}`, {
          state: {
            targetMessageId: item.messageId,
            fromConversationSearch: true,
          },
        })
      );

      onSessionClick?.();
    },
    [conversationTabs, markAsRead, navigate, onConversationSelect, onSessionClick]
  );

  const handleClearKeyword = useCallback(() => {
    setKeyword('');
    setDebouncedKeyword('');
    setItems([]);
    setPage(0);
    setHasMore(false);
    setLoading(false);
    setLoadingMore(false);
  }, []);

  const resultContent = useMemo(() => {
    if (!debouncedKeyword) {
      return (
        <div className='conversation-search-modal__state'>
          <div className='conversation-search-modal__state-content'>
            <span className='text-13px'>{t('conversation.historySearch.idle')}</span>
            {recentKeywords.length > 0 ? (
              <div className='conversation-search-modal__recent-wrap'>
                {recentKeywords.map((item) => (
                  <button
                    key={item}
                    type='button'
                    className='conversation-search-modal__recent-chip'
                    onClick={() => setKeyword(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      );
    }

    if (loading && items.length === 0) {
      return (
        <div className='h-120px flex items-center justify-center'>
          <Spin size={20} />
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div className='conversation-search-modal__state'>
          <Empty className='py-2px' description={t('conversation.historySearch.empty')} />
        </div>
      );
    }

    return (
      <div
        className='h-full min-h-0 overflow-y-auto overflow-x-hidden pr-4px'
        onScroll={(event) => {
          const target = event.currentTarget;
          if (target.scrollHeight - target.scrollTop - target.clientHeight < 48) {
            handleLoadMore();
          }
        }}
      >
        <div className='conversation-search-modal__results flex flex-col'>
          {items.map((item) => {
            const snippet = buildSnippet(item.previewText, debouncedKeyword);
            return (
              <button
                key={`${item.messageId}-${item.messageCreatedAt}`}
                type='button'
                className={classNames(
                  'conversation-search-modal__result w-full text-left cursor-pointer transition-all duration-150',
                  'focus:outline-none'
                )}
                onClick={() => {
                  void handleResultClick(item);
                }}
              >
                <div className='flex items-start justify-between gap-8px mb-6px'>
                  <div className='min-w-0 flex-1'>
                    <div className='conversation-search-modal__result-title-row'>
                      <ConversationAgentMark conversation={item.conversation} />
                      <div className='conversation-search-modal__result-title text-15px font-600 text-t-primary truncate'>
                        {item.conversation.name || t('conversation.historySearch.untitled')}
                      </div>
                    </div>
                  </div>
                  <span className='shrink-0 text-11px text-t-secondary'>{formatTime(item.messageCreatedAt)}</span>
                </div>
                <div className='conversation-search-modal__snippet text-13px leading-22px text-t-primary/92 break-words'>
                  {renderHighlightedText(snippet, debouncedKeyword)}
                </div>
              </button>
            );
          })}

          {loadingMore && (
            <div className='py-8px flex items-center justify-center gap-8px text-12px text-t-secondary'>
              <Spin size={14} />
              <span>{t('conversation.historySearch.loadingMore')}</span>
            </div>
          )}
        </div>
      </div>
    );
  }, [debouncedKeyword, handleLoadMore, handleResultClick, items, loading, loadingMore, recentKeywords, t]);

  return (
    <div className='conversation-search-modal__panel flex h-full min-h-0 flex-col'>
      <div className='conversation-search-modal__header'>
        <div className='conversation-search-modal__header-main'>
          <div className='conversation-search-modal__title'>{t('conversation.historySearch.title')}</div>
          <Typography.Paragraph className='conversation-search-modal__description !mb-0 text-13px text-t-secondary'>
            {t('conversation.historySearch.description')}
          </Typography.Paragraph>
        </div>
      </div>

      <div className='mb-14px conversation-search-modal__input-wrap'>
        <div className='conversation-search-modal__searchbar'>
          <Search theme='outline' size='16' className='conversation-search-modal__search-icon' />
          <input
            autoFocus={inputAutoFocus}
            value={keyword}
            placeholder={t('conversation.historySearch.placeholder')}
            onChange={(event) => setKeyword(event.target.value)}
            className='conversation-search-modal__search-input'
          />
          {keyword ? (
            <button
              type='button'
              className='conversation-search-modal__clear-btn'
              onClick={handleClearKeyword}
              aria-label={t('conversation.historySearch.clear')}
            >
              <CloseSmall theme='outline' size='14' />
            </button>
          ) : null}
        </div>
      </div>

      <div className='flex-1 min-h-0'>{resultContent}</div>
    </div>
  );
};

export const ConversationSearchPage: React.FC = () => (
  <div className='conversation-search-page size-full min-h-0 overflow-hidden p-16px'>
    <div className='conversation-search-page__shell mx-auto h-full w-full max-w-960px overflow-hidden'>
      <ConversationSearchPanel inputAutoFocus />
    </div>
  </div>
);

const ConversationSearchPopover: React.FC<ConversationSearchPopoverProps> = ({
  onSessionClick,
  disabled = false,
  buttonClassName,
  buttonLabel,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = location.pathname === CONVERSATION_SEARCH_ROUTE;

  const handleOpen = useCallback(() => {
    if (disabled) {
      return;
    }

    blockMobileInputFocus();
    blurActiveElement();
    void navigate(CONVERSATION_SEARCH_ROUTE);
    onSessionClick?.();
  }, [disabled, navigate, onSessionClick]);

  useEffect(() => {
    const handleGlobalSearchShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if ((event as unknown as { isComposing?: boolean }).isComposing) return;
      const key = event.key.toLowerCase();
      const isCmdOrCtrl = event.metaKey || event.ctrlKey;
      if (!isCmdOrCtrl || !event.shiftKey || key !== 'f' || event.altKey) return;
      if (typeof window !== 'undefined' && !window.electronAPI) return;
      event.preventDefault();
      handleOpen();
    };

    document.addEventListener('keydown', handleGlobalSearchShortcut, true);
    return () => {
      document.removeEventListener('keydown', handleGlobalSearchShortcut, true);
    };
  }, [handleOpen]);

  const triggerAriaLabel = buttonLabel || t('conversation.historySearch.tooltip');

  return (
    <button
      type='button'
      aria-label={triggerAriaLabel}
      aria-current={isActive ? 'page' : undefined}
      className={classNames(
        buttonLabel
          ? 'flex w-full min-w-0 items-center gap-10px rounded-10px border border-solid border-transparent bg-transparent px-12px py-9px text-left transition-all'
          : 'h-40px w-40px p-0 bg-transparent rd-0.5rem flex items-center justify-center cursor-pointer shrink-0 transition-all border border-solid border-transparent',
        {
          'hover:bg-fill-2 hover:border-[color:var(--color-border-2)]': !disabled,
          'opacity-50 cursor-not-allowed': disabled,
          'bg-aou-2 text-primary border-[color:var(--color-primary-light-3)]': isActive && !disabled,
        },
        buttonClassName
      )}
      onClick={handleOpen}
      disabled={disabled}
    >
      <Search theme='outline' size='20' className='block leading-none shrink-0' style={{ lineHeight: 0 }} />
      {buttonLabel ? <span className='min-w-0 truncate text-14px font-600 text-t-primary'>{buttonLabel}</span> : null}
    </button>
  );
};

export default ConversationSearchPopover;
