/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * useAutoScroll - Auto-scroll hook with user scroll detection
 * Uses Virtuoso's native followOutput for streaming auto-scroll,
 * only calls scrollToIndex for user-initiated actions (send message, click button).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { VirtuosoHandle } from 'react-virtuoso';
import type { TMessage } from '@/common/chat/chatLib';

// Ignore scroll events within this window after a programmatic scroll (ms)
const PROGRAMMATIC_SCROLL_GUARD_MS = 150;
// Delay leaving the bottom state briefly so transient Virtuoso threshold flips
// near the end of a manual drag do not cause visible viewport jitter.
const AT_BOTTOM_EXIT_DEBOUNCE_MS = 120;
// After a user manually reaches the bottom, briefly suppress followOutput so
// Virtuoso and native touchpad momentum do not fight over the final position.
const MANUAL_BOTTOM_SETTLE_MS = 900;

interface UseAutoScrollOptions {
  /** Message list for detecting new messages */
  messages: TMessage[];
  /** Total item count for scroll target */
  itemCount: number;
}

interface UseAutoScrollReturn {
  /** Ref to attach to Virtuoso component */
  virtuosoRef: React.RefObject<VirtuosoHandle | null>;
  /** Scroll event handler for Virtuoso onScroll */
  handleScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  /** Virtuoso atBottomStateChange callback */
  handleAtBottomStateChange: (atBottom: boolean) => void;
  /** Virtuoso followOutput callback for streaming auto-scroll */
  handleFollowOutput: (isAtBottom: boolean) => false | 'auto';
  /** Whether to show scroll-to-bottom button */
  showScrollButton: boolean;
  /** Manually scroll to bottom (e.g., when clicking button) */
  scrollToBottom: (behavior?: 'smooth' | 'auto') => void;
  /** Hide the scroll button */
  hideScrollButton: () => void;
}

export function useAutoScroll({ messages, itemCount }: UseAutoScrollOptions): UseAutoScrollReturn {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Refs for scroll control
  const isAtBottomRef = useRef(true);
  const userScrolledRef = useRef(false);
  const manualScrollActiveRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  const previousListLengthRef = useRef(messages.length);
  const lastProgrammaticScrollTimeRef = useRef(0);
  const autoScrollBlockedUntilRef = useRef(0);
  const pendingAtBottomExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Scroll to bottom helper - only for user messages and button clicks
  const scrollToBottom = useCallback(
    (behavior: 'smooth' | 'auto' = 'smooth') => {
      if (!virtuosoRef.current) return;

      lastProgrammaticScrollTimeRef.current = Date.now();
      autoScrollBlockedUntilRef.current = 0;
      virtuosoRef.current.scrollToIndex({
        index: itemCount - 1,
        behavior,
        align: 'end',
      });
    },
    [itemCount]
  );

  // Virtuoso native followOutput - handles streaming auto-scroll internally
  // without external scrollToIndex calls that cause jitter
  const handleFollowOutput = useCallback((isAtBottom: boolean): false | 'auto' => {
    if (Date.now() < autoScrollBlockedUntilRef.current) {
      return false;
    }
    if (userScrolledRef.current || !isAtBottom) return false;
    return 'auto';
  }, []);

  // Reliable bottom state detection from Virtuoso
  const handleAtBottomStateChange = useCallback((atBottom: boolean) => {
    if (pendingAtBottomExitTimerRef.current) {
      clearTimeout(pendingAtBottomExitTimerRef.current);
      pendingAtBottomExitTimerRef.current = null;
    }

    if (!atBottom && Date.now() < autoScrollBlockedUntilRef.current) {
      return;
    }

    if (atBottom) {
      isAtBottomRef.current = true;
      setShowScrollButton(false);
      if (userScrolledRef.current || manualScrollActiveRef.current) {
        autoScrollBlockedUntilRef.current = Date.now() + MANUAL_BOTTOM_SETTLE_MS;
      }
      userScrolledRef.current = false;
      manualScrollActiveRef.current = false;
      return;
    }

    const shouldDebounceBottomExit =
      isAtBottomRef.current && (manualScrollActiveRef.current || Date.now() < autoScrollBlockedUntilRef.current);

    if (shouldDebounceBottomExit) {
      pendingAtBottomExitTimerRef.current = setTimeout(() => {
        isAtBottomRef.current = false;
        setShowScrollButton(true);
        pendingAtBottomExitTimerRef.current = null;
      }, AT_BOTTOM_EXIT_DEBOUNCE_MS);
      return;
    }

    isAtBottomRef.current = false;
    setShowScrollButton(true);
  }, []);

  // Detect user scrolling up
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const currentScrollTop = target.scrollTop;

    // Ignore scroll events shortly after a programmatic scroll to avoid
    // Virtuoso's internal layout adjustments being misdetected as user scroll
    if (Date.now() - lastProgrammaticScrollTimeRef.current < PROGRAMMATIC_SCROLL_GUARD_MS) {
      lastScrollTopRef.current = currentScrollTop;
      return;
    }

    const delta = currentScrollTop - lastScrollTopRef.current;
    if (Math.abs(delta) > 2) {
      manualScrollActiveRef.current = true;
    }
    if (delta < -10) {
      userScrolledRef.current = true;
      autoScrollBlockedUntilRef.current = 0;
    }

    lastScrollTopRef.current = currentScrollTop;
  }, []);

  // Force scroll when user sends a message
  useEffect(() => {
    const currentListLength = messages.length;
    const prevLength = previousListLengthRef.current;
    const isNewMessage = currentListLength > prevLength;

    previousListLengthRef.current = currentListLength;

    if (!isNewMessage) return;

    const lastMessage = messages[messages.length - 1];

    // User sent a message - force scroll regardless of userScrolled state
    if (lastMessage?.position === 'right') {
      userScrolledRef.current = false;
      manualScrollActiveRef.current = false;
      autoScrollBlockedUntilRef.current = 0;

      // When already pinned to the bottom, let Virtuoso's native followOutput
      // keep the viewport stable. Triggering an extra scrollToIndex here fights
      // with followOutput and causes visible bottom-edge jitter.
      if (isAtBottomRef.current) {
        return;
      }

      // Use double RAF to ensure DOM is updated before scrolling (#977)
      // 使用双 RAF 确保 DOM 更新后再滚动
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (virtuosoRef.current) {
            lastProgrammaticScrollTimeRef.current = Date.now();
            // Use scrollTo with bottom alignment for reliable scroll to end
            // 使用 scrollTo 并设置 bottom 对齐以确保可靠滚动到底部
            virtuosoRef.current.scrollToIndex({
              index: 'LAST',
              behavior: 'auto',
              align: 'end',
            });
          }
        });
      });
    }
  }, [messages]);

  // Hide scroll button handler
  const hideScrollButton = useCallback(() => {
    if (pendingAtBottomExitTimerRef.current) {
      clearTimeout(pendingAtBottomExitTimerRef.current);
      pendingAtBottomExitTimerRef.current = null;
    }
    userScrolledRef.current = false;
    manualScrollActiveRef.current = false;
    autoScrollBlockedUntilRef.current = 0;
    setShowScrollButton(false);
  }, []);

  useEffect(
    () => () => {
      if (pendingAtBottomExitTimerRef.current) {
        clearTimeout(pendingAtBottomExitTimerRef.current);
      }
    },
    []
  );

  return {
    virtuosoRef,
    handleScroll,
    handleAtBottomStateChange,
    handleFollowOutput,
    showScrollButton,
    scrollToBottom,
    hideScrollButton,
  };
}
