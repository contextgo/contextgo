/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { useInputFocusRing } from '@/renderer/hooks/chat/useInputFocusRing';
import SlashCommandMenu, { type SlashCommandMenuItem } from '@/renderer/components/chat/SlashCommandMenu';
import { useSlashCommandController } from '@/renderer/hooks/chat/useSlashCommandController';
import { useLayoutContext } from '@/renderer/hooks/context/LayoutContext';
import { useConversationContextSafe } from '@/renderer/hooks/context/ConversationContext';
import type { FileOrFolderItem } from '@/renderer/utils/file/fileTypes';
import { mergeFileSelectionItems } from '@/renderer/utils/file/fileSelection';
import { listWorkspaceFileItems } from '@/renderer/utils/file/workspaceFs';
import {
  buildWorkspaceMentionInsertion,
  filterWorkspaceMentionItems,
  getActiveWorkspaceMentionQuery,
  getAllWorkspaceMentionQueries,
  getWorkspaceMentionOwnershipKeys,
} from '@/renderer/utils/file/workspaceMentions';
import { usePreviewContext } from '@/renderer/pages/conversation/Preview';
import WorkspaceMentionMenu from '@/renderer/pages/conversation/platforms/WorkspaceMentionMenu';
import { blurActiveElement, shouldBlockMobileInputFocus } from '@/renderer/utils/ui/focus';
import { getTextLayoutStyle, measureTextLineCount } from '@/renderer/utils/chat/textLayout';
import { Button, Input, Message, Tag } from '@arco-design/web-react';
import { ArrowUp, CloseSmall, SquareSmall } from '@icon-park/react';
import type { SlashCommandItem } from '@/common/chat/slash/types';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCompositionInput } from '@renderer/hooks/chat/useCompositionInput';
import { useDragUpload } from '@renderer/hooks/file/useDragUpload';
import { useLatestRef } from '@renderer/hooks/ui/useLatestRef';
import { usePasteService } from '@renderer/hooks/file/usePasteService';
import type { FileMetadata } from '@renderer/services/FileService';
import { allSupportedExts } from '@renderer/services/FileService';
import './sendbox.css';

const constVoid = (): void => undefined;
// 临界值：超过该字符数直接切换至多行模式，避免为超长文本做昂贵的宽度测量
// Threshold: switch to multi-line mode directly when character count exceeds this value to avoid heavy layout work
const MAX_SINGLE_LINE_CHARACTERS = 800;
const EMPTY_SELECTED_WORKSPACE_ITEMS: Array<string | FileOrFolderItem> = [];

const SendBox: React.FC<{
  value?: string;
  onChange?: (value: string) => void;
  onSend: (message: string) => Promise<void>;
  onQueue?: (message: string) => Promise<void> | void;
  onSteer?: (message: string) => Promise<void> | void;
  onEditLatestPending?: () => void;
  onStop?: () => Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  tools?: React.ReactNode;
  prefix?: React.ReactNode;
  placeholder?: string;
  onFilesAdded?: (files: FileMetadata[]) => void;
  pendingUploadCount?: number;
  onUploadStateChange?: (state: { isUploading: boolean; pendingCount: number }) => void;
  supportedExts?: string[];
  defaultMultiLine?: boolean;
  lockMultiLine?: boolean;
  sendButtonPrefix?: React.ReactNode;
  slashCommands?: SlashCommandItem[];
  onSlashBuiltinCommand?: (name: string) => void;
  selectedWorkspaceItems?: Array<string | FileOrFolderItem>;
  onSelectedWorkspaceItemsChange?: (items: Array<string | FileOrFolderItem>) => void;
}> = ({
  onSend,
  onQueue,
  onSteer,
  onEditLatestPending,
  onStop,
  prefix,
  className,
  loading,
  tools,
  disabled,
  placeholder,
  value: input = '',
  onChange: setInput = constVoid,
  onFilesAdded,
  pendingUploadCount = 0,
  onUploadStateChange,
  supportedExts = allSupportedExts,
  defaultMultiLine = false,
  lockMultiLine = false,
  sendButtonPrefix,
  slashCommands = [],
  onSlashBuiltinCommand,
  selectedWorkspaceItems = EMPTY_SELECTED_WORKSPACE_ITEMS,
  onSelectedWorkspaceItemsChange,
}) => {
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const conversationContext = useConversationContextSafe();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [isSingleLine, setIsSingleLine] = useState(!defaultMultiLine);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const isInputActive = isInputFocused;
  const { activeBorderColor, inactiveBorderColor, activeShadow } = useInputFocusRing();
  const containerRef = useRef<HTMLDivElement>(null);
  const singleLineWidthRef = useRef<number>(0);
  const mobileUserFocusIntentUntilRef = useRef(0);
  const warmedConversationRef = useRef<string | undefined>(undefined);
  const warmupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestInputRef = useLatestRef(input);
  const setInputRef = useLatestRef(setInput);
  const [caretPosition, setCaretPosition] = useState(input.length);
  const [workspaceMentionItems, setWorkspaceMentionItems] = useState<FileOrFolderItem[]>([]);
  const [workspaceMentionLoading, setWorkspaceMentionLoading] = useState(false);
  const [workspaceMentionActiveIndex, setWorkspaceMentionActiveIndex] = useState(0);
  const [dismissedWorkspaceMentionToken, setDismissedWorkspaceMentionToken] = useState<string | null>(null);
  const mentionOwnedPathsRef = useRef<Set<string>>(new Set());
  const loadedWorkspaceMentionsRef = useRef<string | null>(null);

  // 集成预览面板的"添加到聊天"功能 / Integrate preview panel's "Add to chat" functionality
  const { setSendBoxHandler, domSnippets, removeDomSnippet, clearDomSnippets } = usePreviewContext();
  const hasPendingUploads = pendingUploadCount > 0;
  const activeWorkspaceMentionQuery = useMemo(() => {
    if (!conversationContext?.workspace) {
      return null;
    }
    return getActiveWorkspaceMentionQuery(input, caretPosition);
  }, [caretPosition, conversationContext?.workspace, input]);
  const activeWorkspaceMentionTokenKey = useMemo(() => {
    if (!activeWorkspaceMentionQuery) {
      return null;
    }
    return `${activeWorkspaceMentionQuery.start}:${activeWorkspaceMentionQuery.rawQuery}`;
  }, [activeWorkspaceMentionQuery]);
  const allWorkspaceMentionQueries = useMemo(() => getAllWorkspaceMentionQueries(input), [input]);

  // 注册处理器以接收来自预览面板的文本 / Register handler to receive text from preview panel
  useEffect(() => {
    const handler = (text: string) => {
      const base = latestInputRef.current;
      const newValue = base ? `${base}\n\n${text}` : text;
      setInputRef.current(newValue);
    };
    setSendBoxHandler(handler);
    return () => {
      setSendBoxHandler(null);
    };
  }, [setSendBoxHandler]);

  // 初始化时获取单行输入框的可用宽度
  // Initialize and get the available width of single-line input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (containerRef.current && singleLineWidthRef.current === 0) {
        const textarea = containerRef.current.querySelector('textarea');
        if (textarea) {
          // 保存单行模式下的可用宽度作为固定基准
          // Save the available width in single-line mode as a fixed baseline
          singleLineWidthRef.current = textarea.offsetWidth;
        }
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // 移动端挂载后主动清除焦点，拦截路由切换导致的非用户触发聚焦
  useEffect(() => {
    if (!isMobile) return;
    const timer = setTimeout(() => {
      blurActiveElement();
    }, 0);
    return () => clearTimeout(timer);
  }, [isMobile]);

  // 检测是否单行
  // Detect whether to use single-line or multi-line mode
  useEffect(() => {
    // 有换行符直接多行
    // Switch to multi-line mode if newline character exists
    if (input.includes('\n')) {
      setIsSingleLine(false);
      return;
    }

    // 空文本默认回到单行，除非外部明确锁定多行模式
    // Reset to single-line mode for empty input unless multi-line is explicitly locked
    if (!input.length) {
      if (!lockMultiLine) {
        setIsSingleLine(true);
      }
      return;
    }

    // 还没获取到基准宽度时不做判断
    // Skip detection if baseline width is not yet obtained
    if (singleLineWidthRef.current === 0) {
      return;
    }

    // 长文本无需测量，直接切换多行，防止创建超宽 DOM 触发长时间布局计算
    // Skip measurement for long text and switch to multi-line immediately to avoid heavy layout work
    if (input.length >= MAX_SINGLE_LINE_CHARACTERS) {
      setIsSingleLine(false);
      return;
    }

    // 通过 pretext 进行按行布局判断，而不是只看单次宽度测量
    // Use pretext-driven line counting instead of a single width threshold
    const frame = requestAnimationFrame(() => {
      const textarea = containerRef.current?.querySelector('textarea');
      if (!textarea) {
        return;
      }

      const lineCount = measureTextLineCount({
        text: input,
        maxWidth: singleLineWidthRef.current,
        ...getTextLayoutStyle(textarea),
      });

      if (lineCount > 1) {
        setIsSingleLine(false);
      } else if (!lockMultiLine) {
        setIsSingleLine(true);
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [input, lockMultiLine]);

  // 使用拖拽 hook
  const { isFileDragging, dragHandlers } = useDragUpload({
    supportedExts,
    onFilesAdded,
    conversationId: conversationContext?.conversationId,
    onUploadStateChange,
  });

  const [message, context] = Message.useMessage();

  const builtinSlashCommands = useMemo<SlashCommandItem[]>(() => {
    if (!onSlashBuiltinCommand) {
      return [];
    }
    return [
      {
        name: 'open',
        description: t('conversation.workspace.addFile', { defaultValue: 'Add File' }),
        kind: 'builtin',
        source: 'builtin',
      },
    ];
  }, [onSlashBuiltinCommand, t]);

  const mergedSlashCommands = useMemo(() => {
    const map = new Map<string, SlashCommandItem>();
    for (const command of builtinSlashCommands) {
      map.set(command.name, command);
    }
    for (const command of slashCommands) {
      if (!map.has(command.name)) {
        map.set(command.name, command);
      }
    }
    return Array.from(map.values());
  }, [builtinSlashCommands, slashCommands]);

  const slashController = useSlashCommandController({
    input,
    commands: mergedSlashCommands,
    onExecuteBuiltin: (name) => {
      onSlashBuiltinCommand?.(name);
      setInput('');
    },
    onSelectTemplate: (command) => {
      if (command.template) {
        setInput(command.template);
        return;
      }
      setInput(`/${command.name} `);
    },
  });

  const slashMenuItems = useMemo<SlashCommandMenuItem[]>(
    () =>
      slashController.filteredCommands.map((command) => ({
        key: command.name,
        label: `/${command.name}`,
        description: command.description,
        badge: command.hint,
      })),
    [slashController.filteredCommands]
  );
  const isWorkspaceMentionMenuOpen =
    Boolean(conversationContext?.workspace) &&
    Boolean(activeWorkspaceMentionQuery) &&
    activeWorkspaceMentionTokenKey !== dismissedWorkspaceMentionToken;
  const visibleWorkspaceMentionItems = useMemo(
    () =>
      activeWorkspaceMentionQuery
        ? filterWorkspaceMentionItems(workspaceMentionItems, activeWorkspaceMentionQuery.query)
        : [],
    [activeWorkspaceMentionQuery, workspaceMentionItems]
  );
  const isOverlayOpen = slashController.isOpen || isWorkspaceMentionMenuOpen;

  // 使用共享的输入法合成处理
  const { isComposing, compositionHandlers, createKeyDownHandler } = useCompositionInput();

  // 使用共享的PasteService集成
  const { onPaste, onFocus: handlePasteFocus } = usePasteService({
    supportedExts,
    onFilesAdded,
    conversationId: conversationContext?.conversationId,
    onUploadStateChange,
    onTextPaste: (text: string) => {
      // 处理清理后的文本粘贴，在当前光标位置插入文本而不是替换整个内容
      const textarea = document.activeElement as HTMLTextAreaElement;
      if (textarea && textarea.tagName === 'TEXTAREA') {
        const cursorPosition = textarea.selectionStart;
        const currentValue = textarea.value;
        const start = textarea.selectionStart ?? textarea.value.length;
        const end = textarea.selectionEnd ?? start;
        const newValue = currentValue.slice(0, start) + text + currentValue.slice(end);
        setInput(newValue);
        // 设置光标到插入文本后的位置
        setTimeout(() => {
          textarea.setSelectionRange(cursorPosition + text.length, cursorPosition + text.length);
        }, 0);
      } else {
        // 如果无法获取光标位置，回退到追加到末尾的行为
        setInput(text);
      }
    },
  });

  useEffect(() => {
    if (!conversationContext?.workspace) {
      loadedWorkspaceMentionsRef.current = null;
      setWorkspaceMentionItems([]);
      setWorkspaceMentionLoading(false);
      return;
    }

    if (!isWorkspaceMentionMenuOpen) {
      return;
    }

    if (loadedWorkspaceMentionsRef.current === conversationContext.workspace) {
      return;
    }

    let cancelled = false;
    setWorkspaceMentionLoading(true);

    void listWorkspaceFileItems(conversationContext.workspace)
      .then((items) => {
        if (cancelled) {
          return;
        }
        loadedWorkspaceMentionsRef.current = conversationContext.workspace;
        setWorkspaceMentionItems(items);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        loadedWorkspaceMentionsRef.current = null;
        setWorkspaceMentionItems([]);
        console.warn('[SendBox] Failed to load workspace mention items:', error);
      })
      .finally(() => {
        if (!cancelled) {
          setWorkspaceMentionLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [conversationContext?.workspace, isWorkspaceMentionMenuOpen]);

  useEffect(() => {
    if (!activeWorkspaceMentionTokenKey) {
      setWorkspaceMentionActiveIndex(0);
      return;
    }
    setWorkspaceMentionActiveIndex(0);
    setDismissedWorkspaceMentionToken(null);
  }, [activeWorkspaceMentionTokenKey]);

  useEffect(() => {
    if (!visibleWorkspaceMentionItems.length) {
      setWorkspaceMentionActiveIndex(0);
      return;
    }
    setWorkspaceMentionActiveIndex((previous) => Math.min(previous, visibleWorkspaceMentionItems.length - 1));
  }, [visibleWorkspaceMentionItems]);

  useEffect(() => {
    if (!onSelectedWorkspaceItemsChange || !selectedWorkspaceItems.length) {
      return;
    }

    const mentionQueries = new Set(allWorkspaceMentionQueries.map((item) => item.query.toLowerCase()));
    const nextItems = selectedWorkspaceItems.filter((item) => {
      const itemPath = typeof item === 'string' ? item : item.path;
      if (!itemPath || !mentionOwnedPathsRef.current.has(itemPath)) {
        return true;
      }

      const shouldKeep = getWorkspaceMentionOwnershipKeys(item).some((key) => mentionQueries.has(key));
      if (!shouldKeep) {
        mentionOwnedPathsRef.current.delete(itemPath);
      }
      return shouldKeep;
    });

    if (nextItems.length !== selectedWorkspaceItems.length) {
      onSelectedWorkspaceItemsChange(nextItems);
    }
  }, [allWorkspaceMentionQueries, onSelectedWorkspaceItemsChange, selectedWorkspaceItems]);

  const markMobileFocusIntent = useCallback(() => {
    if (!isMobile) return;
    mobileUserFocusIntentUntilRef.current = Date.now() + 1500;
  }, [isMobile]);

  const handleInputFocus = useCallback(() => {
    if (isMobile && Date.now() > mobileUserFocusIntentUntilRef.current) {
      blurActiveElement();
      return;
    }
    if (isMobile && shouldBlockMobileInputFocus()) {
      blurActiveElement();
      return;
    }
    mobileUserFocusIntentUntilRef.current = 0;
    handlePasteFocus();
    setIsInputFocused(true);

    // Pre-warm worker bootstrap after focus stays for 1s (debounce).
    // Avoids triggering warmup for every conversation during rapid switching.
    const cid = conversationContext?.conversationId;
    if (cid && warmedConversationRef.current !== cid) {
      if (warmupTimerRef.current) clearTimeout(warmupTimerRef.current);
      warmupTimerRef.current = setTimeout(() => {
        warmedConversationRef.current = cid;
        ipcBridge.conversation.warmup.invoke({ conversation_id: cid }).catch(() => {});
      }, 1000);
    }
  }, [handlePasteFocus, isMobile, conversationContext?.conversationId]);
  const handleInputBlur = useCallback(() => {
    if (warmupTimerRef.current) {
      clearTimeout(warmupTimerRef.current);
      warmupTimerRef.current = null;
    }
    setIsInputFocused(false);
  }, []);
  const syncCaretPosition = useCallback((target: EventTarget & HTMLTextAreaElement) => {
    setCaretPosition(target.selectionStart ?? target.value.length);
  }, []);

  const insertSelectedWorkspaceMention = useCallback(
    (item: FileOrFolderItem) => {
      if (!activeWorkspaceMentionQuery) {
        return;
      }

      const insertion = buildWorkspaceMentionInsertion(item);
      const suffix = activeWorkspaceMentionQuery.end < input.length ? '' : ' ';
      const nextValue =
        input.slice(0, activeWorkspaceMentionQuery.start) +
        insertion +
        suffix +
        input.slice(activeWorkspaceMentionQuery.end);
      const nextCaretPosition = activeWorkspaceMentionQuery.start + insertion.length + suffix.length;

      setInput(nextValue);
      setCaretPosition(nextCaretPosition);
      mentionOwnedPathsRef.current.add(item.path);
      setDismissedWorkspaceMentionToken(null);

      if (onSelectedWorkspaceItemsChange) {
        const merged = mergeFileSelectionItems(selectedWorkspaceItems, [item]);
        if (merged !== selectedWorkspaceItems) {
          onSelectedWorkspaceItemsChange(merged);
        }
      }

      setTimeout(() => {
        const textarea = containerRef.current?.querySelector('textarea');
        if (textarea) {
          textarea.focus();
          textarea.setSelectionRange(nextCaretPosition, nextCaretPosition);
        }
      }, 0);
    },
    [activeWorkspaceMentionQuery, input, onSelectedWorkspaceItemsChange, selectedWorkspaceItems, setInput]
  );

  const handleWorkspaceMentionMenuKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!isWorkspaceMentionMenuOpen || !activeWorkspaceMentionTokenKey) {
        return false;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        setDismissedWorkspaceMentionToken(activeWorkspaceMentionTokenKey);
        return true;
      }

      if (!visibleWorkspaceMentionItems.length) {
        return false;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setWorkspaceMentionActiveIndex((previous) => (previous + 1) % visibleWorkspaceMentionItems.length);
        return true;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setWorkspaceMentionActiveIndex((previous) =>
          previous === 0 ? visibleWorkspaceMentionItems.length - 1 : previous - 1
        );
        return true;
      }

      if (event.key === 'Enter') {
        const selectedItem = visibleWorkspaceMentionItems[workspaceMentionActiveIndex];
        if (!selectedItem) {
          return false;
        }
        event.preventDefault();
        insertSelectedWorkspaceMention(selectedItem);
        return true;
      }

      return false;
    },
    [
      activeWorkspaceMentionTokenKey,
      insertSelectedWorkspaceMention,
      isWorkspaceMentionMenuOpen,
      visibleWorkspaceMentionItems,
      workspaceMentionActiveIndex,
    ]
  );

  const hasMessageContent = Boolean(input.trim() || domSnippets.length > 0);

  const buildFinalMessage = useCallback(() => {
    let finalMessage = input;
    if (domSnippets.length > 0) {
      const snippetsHtml = domSnippets
        .map((s) => `\n\n---\nDOM Snippet (${s.tag}):\n\`\`\`html\n${s.html}\n\`\`\``)
        .join('');
      finalMessage = input + snippetsHtml;
    }

    return finalMessage;
  }, [domSnippets, input]);

  const consumeInputMessage = useCallback(() => {
    const finalMessage = buildFinalMessage();
    setInput('');
    clearDomSnippets();
    return finalMessage;
  }, [buildFinalMessage, clearDomSnippets, setInput]);

  const sendDeferredMessage = useCallback(
    (handler?: (message: string) => Promise<void> | void) => {
      if (!handler || !hasMessageContent) {
        return false;
      }
      if (hasPendingUploads) {
        return false;
      }

      const finalMessage = consumeInputMessage();
      void Promise.resolve(handler(finalMessage));
      return true;
    },
    [consumeInputMessage, hasMessageContent, hasPendingUploads]
  );

  const sendMessageHandler = () => {
    if (loading || isLoading || hasPendingUploads) {
      message.warning(t('messages.conversationInProgress'));
      return;
    }
    if (!hasMessageContent) {
      return;
    }
    setIsLoading(true);
    const finalMessage = consumeInputMessage();

    onSend(finalMessage)
      .catch(() => {})
      .finally(() => {
        setIsLoading(false);
      });
  };

  const stopHandler = async () => {
    if (!onStop) return;
    try {
      await onStop();
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate button disabled state and style
  const isButtonDisabled = disabled || !hasMessageContent || hasPendingUploads;
  const buttonStyle = {
    backgroundColor: isButtonDisabled ? undefined : '#000000',
    borderColor: isButtonDisabled ? undefined : '#000000',
  };

  // Reusable send button component
  const hasStopAction = typeof onStop === 'function';
  const stopButtonStyle = hasStopAction
    ? {
        color: 'rgb(var(--danger-6))',
        backgroundColor: 'rgba(var(--danger-6), 0.12)',
        borderColor: 'rgba(var(--danger-6), 0.24)',
      }
    : {
        color: 'var(--text-tertiary)',
        backgroundColor: 'var(--fill-2)',
        borderColor: 'var(--border-base)',
      };

  const stopButton = (
    <Button
      shape='circle'
      type='secondary'
      disabled={!hasStopAction}
      className='bg-animate sendbox-stop-button'
      style={stopButtonStyle}
      aria-label={t('conversation.group.workflow.decision.stop')}
      icon={<SquareSmall theme='filled' size='10' fill='currentColor' strokeWidth={3} />}
      onClick={hasStopAction ? () => void stopHandler() : undefined}
    ></Button>
  );

  const sendButton = (
    <Button
      shape='circle'
      type='primary'
      disabled={isButtonDisabled}
      className='send-button-custom'
      style={buttonStyle}
      icon={<ArrowUp theme='filled' size='14' fill='white' strokeWidth={5} />}
      onClick={() => {
        sendMessageHandler();
      }}
    />
  );

  const baseKeyDownHandler = createKeyDownHandler(sendMessageHandler, slashController.onKeyDown);

  const handleInputKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (isComposing.current) {
        return;
      }

      if (handleWorkspaceMentionMenuKeyDown(event)) {
        return;
      }

      if (!slashController.isOpen && !disabled) {
        if (event.key === 'Tab' && !event.shiftKey && onQueue && hasMessageContent) {
          event.preventDefault();
          sendDeferredMessage(onQueue);
          return;
        }

        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && onSteer && hasMessageContent) {
          event.preventDefault();
          sendDeferredMessage(onSteer);
          return;
        }

        if (event.altKey && event.key === 'ArrowUp' && onEditLatestPending) {
          event.preventDefault();
          onEditLatestPending();
          return;
        }
      }

      baseKeyDownHandler(event);
    },
    [
      baseKeyDownHandler,
      disabled,
      handleWorkspaceMentionMenuKeyDown,
      hasMessageContent,
      isComposing,
      onEditLatestPending,
      onQueue,
      onSteer,
      sendDeferredMessage,
      slashController.isOpen,
    ]
  );

  return (
    <div className={className}>
      <div
        ref={containerRef}
        className={`relative border-3 b bg-dialog-fill-0 b-solid flex flex-col ${isMobile ? 'p-12px rd-18px' : 'p-16px rd-20px'} ${isOverlayOpen ? 'overflow-visible' : 'overflow-hidden'} ${isFileDragging ? 'b-dashed' : ''}`}
        style={{
          transition: 'box-shadow 0.25s ease, border-color 0.25s ease',
          ...(isFileDragging
            ? {
                backgroundColor: 'var(--color-primary-light-1)',
                borderColor: 'rgb(var(--primary-3))',
                borderWidth: '1px',
              }
            : {
                borderWidth: '1px',
                borderColor: isInputActive ? activeBorderColor : inactiveBorderColor,
                boxShadow: isInputActive ? activeShadow : 'none',
              }),
        }}
        {...dragHandlers}
      >
        {isWorkspaceMentionMenuOpen ? (
          <div className='absolute left-12px right-12px bottom-[calc(100%+8px)] z-70'>
            <WorkspaceMentionMenu
              label={t('conversation.workspace.addFile')}
              loading={workspaceMentionLoading}
              loadingText={t('common.loading')}
              emptyText={t('conversation.workspace.search.empty')}
              items={visibleWorkspaceMentionItems}
              activeIndex={workspaceMentionActiveIndex}
              onHoverItem={setWorkspaceMentionActiveIndex}
              onSelectItem={insertSelectedWorkspaceMention}
            />
          </div>
        ) : slashController.isOpen ? (
          <div className='absolute left-12px right-12px bottom-[calc(100%+8px)] z-70'>
            <SlashCommandMenu
              title={t('messages.slash.title', { defaultValue: 'Commands' })}
              hint={t('messages.slash.hint', { defaultValue: 'Type / to open command menu' })}
              items={slashMenuItems}
              activeIndex={slashController.activeIndex}
              loading={false}
              onHoverItem={slashController.setActiveIndex}
              onSelectItem={(item) => {
                const targetIndex = slashController.filteredCommands.findIndex((command) => command.name === item.key);
                if (targetIndex >= 0) {
                  slashController.onSelectByIndex(targetIndex);
                }
              }}
              emptyText={t('messages.slash.empty', { defaultValue: 'No commands found' })}
            />
          </div>
        ) : null}
        <div style={{ width: '100%' }}>
          {prefix}
          {context}
          {hasPendingUploads && (
            <div className='mb-8px'>
              <Tag color='arcoblue'>
                {t('conversation.chat.uploadPending', {
                  count: pendingUploadCount,
                  defaultValue: 'Uploading {{count}} file(s)...',
                })}
              </Tag>
            </div>
          )}
          {/* DOM 片段标签 / DOM snippet tags */}
          {domSnippets.length > 0 && (
            <div className='flex flex-wrap gap-6px mb-8px'>
              {domSnippets.map((snippet) => (
                <Tag
                  key={snippet.id}
                  closable
                  closeIcon={<CloseSmall theme='outline' size='12' />}
                  onClose={() => removeDomSnippet(snippet.id)}
                  className='text-12px bg-fill-2 b-1 b-solid b-border-2 rd-4px'
                >
                  {snippet.tag}
                </Tag>
              ))}
            </div>
          )}
        </div>
        <div
          className={isSingleLine ? 'flex items-center gap-2 w-full min-w-0 overflow-hidden' : 'w-full overflow-hidden'}
        >
          {isSingleLine && (
            <div className={isMobile ? 'sendbox-tools sendbox-tools-scroll-mobile' : 'flex-shrink-0 sendbox-tools'}>
              {isMobile ? <div className='sendbox-tools-scroll-mobile-track'>{tools}</div> : tools}
            </div>
          )}
          <Input.TextArea
            autoFocus={!isMobile}
            disabled={disabled}
            value={input}
            placeholder={placeholder}
            className={`pl-0 pr-0 !b-none focus:shadow-none m-0 !bg-transparent !focus:bg-transparent !hover:bg-transparent lh-[20px] !resize-none text-14px ${isMobile ? 'sendbox-input--mobile' : ''}`}
            style={{
              width: isSingleLine ? 'auto' : '100%',
              flex: isSingleLine ? 1 : 'none',
              minWidth: 0,
              maxWidth: '100%',
              marginLeft: 0,
              marginRight: 0,
              marginBottom: isSingleLine ? 0 : '8px',
              height: isSingleLine ? '20px' : 'auto',
              minHeight: isSingleLine ? '20px' : '80px',
              overflowY: isSingleLine ? 'hidden' : 'auto',
              overflowX: 'hidden',
              whiteSpace: isSingleLine ? 'nowrap' : 'pre-wrap',
              textOverflow: isSingleLine ? 'ellipsis' : 'clip',
              wordBreak: isSingleLine ? 'normal' : 'break-word',
              overflowWrap: 'break-word',
            }}
            onChange={(v, event) => {
              setInput(v);
              const target = event?.target as HTMLTextAreaElement | undefined;
              if (target) {
                syncCaretPosition(target);
                return;
              }
              setCaretPosition(v.length);
            }}
            onPaste={onPaste}
            onTouchStart={markMobileFocusIntent}
            onMouseDown={markMobileFocusIntent}
            onClick={(event) => syncCaretPosition(event.currentTarget)}
            onKeyUp={(event) => syncCaretPosition(event.currentTarget)}
            onSelect={(event) => syncCaretPosition(event.currentTarget as HTMLTextAreaElement)}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            {...compositionHandlers}
            autoSize={isSingleLine ? false : { minRows: 1, maxRows: 10 }}
            onKeyDown={handleInputKeyDown}
          ></Input.TextArea>
          {isSingleLine && (
            <div className='flex items-center gap-2'>
              {sendButtonPrefix}
              {isLoading || loading ? stopButton : sendButton}
            </div>
          )}
        </div>
        {!isSingleLine && (
          <div
            className={
              isMobile
                ? 'flex w-full min-w-0 items-end justify-between gap-8px overflow-hidden'
                : 'flex items-center justify-between gap-2 w-full'
            }
          >
            {isMobile ? (
              <div className='sendbox-tools-mobile-shell flex-1 self-end'>
                <div className='sendbox-tools sendbox-tools-scroll-mobile sendbox-tools-scroll-mobile-bottom'>
                  <div className='sendbox-tools-scroll-mobile-track'>{tools}</div>
                </div>
              </div>
            ) : (
              <div className='sendbox-tools'>{tools}</div>
            )}
            <div
              className={
                isMobile
                  ? 'sendbox-mobile-actions flex shrink-0 items-end justify-end gap-8px self-end'
                  : 'flex items-center gap-2'
              }
            >
              {sendButtonPrefix}
              {isLoading || loading ? stopButton : sendButton}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SendBox;
