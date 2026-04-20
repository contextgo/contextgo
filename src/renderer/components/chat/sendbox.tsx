/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { SlashCommandItem } from '@/common/chat/slash/types';
import SlashCommandMenu, { type SlashCommandMenuItem } from '@/renderer/components/chat/SlashCommandMenu';
import { useCompositionInput } from '@/renderer/hooks/chat/useCompositionInput';
import { useInputFocusRing } from '@/renderer/hooks/chat/useInputFocusRing';
import { useSlashCommandController } from '@/renderer/hooks/chat/useSlashCommandController';
import { useConversationContextSafe } from '@/renderer/hooks/context/ConversationContext';
import { useLayoutContext } from '@/renderer/hooks/context/LayoutContext';
import { useDragUpload } from '@/renderer/hooks/file/useDragUpload';
import { usePasteService } from '@/renderer/hooks/file/usePasteService';
import { useLatestRef } from '@/renderer/hooks/ui/useLatestRef';
import WorkspaceMentionMenu from '@/renderer/pages/conversation/platforms/WorkspaceMentionMenu';
import { usePreviewComposer } from '@/renderer/pages/conversation/Preview';
import type { FileMetadata } from '@/renderer/services/FileService';
import { allSupportedExts } from '@/renderer/services/FileService';
import { getTextLayoutStyle, measureTextLineCount } from '@/renderer/utils/chat/textLayout';
import { mergeFileSelectionItems } from '@/renderer/utils/file/fileSelection';
import type { FileOrFolderItem } from '@/renderer/utils/file/fileTypes';
import { listWorkspaceFileItems } from '@/renderer/utils/file/workspaceFs';
import {
  findActiveWorkspaceMention,
  matchWorkspaceMentionItems,
  replaceActiveWorkspaceMention,
  resolveExactWorkspaceMentionItems,
  type WorkspaceMentionItem,
} from '@/renderer/utils/file/workspaceMentions';
import { blurActiveElement, shouldBlockMobileInputFocus } from '@/renderer/utils/ui/focus';
import { Button, Input, Message, Tag } from '@arco-design/web-react';
import { ArrowUp, CloseSmall, Square } from '@icon-park/react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './sendbox.css';

const constVoid = (): void => undefined;
const EMPTY_SELECTED_WORKSPACE_ITEMS: Array<string | FileOrFolderItem> = [];

// 临界值：超过该字符数直接切换至多行模式，避免为超长文本做昂贵的宽度测量
// Threshold: switch to multi-line mode directly when character count exceeds this value to avoid heavy layout work
const MAX_SINGLE_LINE_CHARACTERS = 800;
const MANAGED_TEMPLATE_COMMAND_INPUT_RE = /^\/([a-zA-Z0-9_-]+)(?:\s+([\s\S]*))?$/;

function expandManagedSlashCommandInput(input: string, commands: readonly SlashCommandItem[]): string {
  const normalizedInput = input.replace(/\r\n/g, '\n').trim();
  const match = normalizedInput.match(MANAGED_TEMPLATE_COMMAND_INPUT_RE);
  if (!match) {
    return input;
  }

  const [, rawCommandName, rawTrailingContent = ''] = match;
  const matchedCommand = commands.find(
    (command) =>
      command.kind === 'template' &&
      command.source === 'custom' &&
      typeof command.template === 'string' &&
      command.template.length > 0 &&
      command.name.toLowerCase() === rawCommandName.toLowerCase()
  );

  if (!matchedCommand?.template) {
    return input;
  }

  const trailingContent = rawTrailingContent.trim();
  return trailingContent ? `${matchedCommand.template}\n\n${trailingContent}` : matchedCommand.template;
}

const getSelectionItemPath = (item: string | FileOrFolderItem): string => {
  if (typeof item === 'string') {
    return item;
  }
  return item.path;
};

const areSelectionItemsEqual = (
  left: Array<string | FileOrFolderItem>,
  right: Array<string | FileOrFolderItem>
): boolean => {
  if (left.length !== right.length) {
    return false;
  }

  for (let i = 0; i < left.length; i += 1) {
    if (typeof left[i] !== typeof right[i]) {
      return false;
    }

    if (getSelectionItemPath(left[i]) !== getSelectionItemPath(right[i])) {
      return false;
    }
  }

  return true;
};

const toWorkspaceMentionItems = (items: FileOrFolderItem[]): WorkspaceMentionItem[] => {
  return items.filter((item): item is WorkspaceMentionItem => Boolean(item.isFile && item.relativePath));
};

type SendBoxProps = {
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
  supportedExts?: string[];
  defaultMultiLine?: boolean;
  lockMultiLine?: boolean;
  sendButtonPrefix?: React.ReactNode;
  slashCommands?: SlashCommandItem[];
  onSlashBuiltinCommand?: (name: string) => void;
  pendingUploadCount?: number;
  selectedWorkspaceItems?: Array<string | FileOrFolderItem>;
  onSelectedWorkspaceItemsChange?: (items: Array<string | FileOrFolderItem>) => void;
};

const SendBox: React.FC<SendBoxProps> = ({
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
  supportedExts = allSupportedExts,
  defaultMultiLine = false,
  lockMultiLine = false,
  sendButtonPrefix,
  slashCommands = [],
  onSlashBuiltinCommand,
  pendingUploadCount = 0,
  selectedWorkspaceItems = EMPTY_SELECTED_WORKSPACE_ITEMS,
  onSelectedWorkspaceItemsChange,
}) => {
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const conversationContext = useConversationContextSafe();
  const workspacePath = conversationContext?.workspace?.trim() || '';
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [isSingleLine, setIsSingleLine] = useState(!defaultMultiLine);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(input.length);
  const [dragPendingUploadCount, setDragPendingUploadCount] = useState(0);
  const [pastePendingUploadCount, setPastePendingUploadCount] = useState(0);
  const [workspaceItems, setWorkspaceItems] = useState<WorkspaceMentionItem[]>([]);
  const [activeWorkspaceMentionIndex, setActiveWorkspaceMentionIndex] = useState(0);
  const isInputActive = isInputFocused;
  const { activeBorderColor, inactiveBorderColor, activeShadow } = useInputFocusRing();
  const containerRef = useRef<HTMLDivElement>(null);
  const singleLineWidthRef = useRef<number>(0);
  const mobileUserFocusIntentUntilRef = useRef(0);
  const warmedConversationRef = useRef<string | undefined>(undefined);
  const warmupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldRestoreDesktopFocusRef = useRef(false);
  const desktopFocusSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const latestInputRef = useLatestRef(input);
  const setInputRef = useLatestRef(setInput);
  const cursorPositionRef = useLatestRef(cursorPosition);
  const workspaceItemsRef = useLatestRef(workspaceItems);
  const loadedWorkspacePathRef = useRef<string | undefined>(undefined);
  const workspaceItemsRequestRef = useRef<Promise<WorkspaceMentionItem[]> | null>(null);
  const mentionOwnedSelectionPathsRef = useRef<Set<string>>(new Set());

  const activeWorkspaceMention = useMemo(
    () => findActiveWorkspaceMention(input, cursorPosition),
    [cursorPosition, input]
  );

  // 集成预览面板的"添加到聊天"功能 / Integrate preview panel's "Add to chat" functionality
  const { setSendBoxHandler, domSnippets, removeDomSnippet, clearDomSnippets } = usePreviewComposer();

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
  }, [latestInputRef, setInputRef, setSendBoxHandler]);

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

  const getTextareaElement = useCallback((): HTMLTextAreaElement | null => {
    return containerRef.current?.querySelector('textarea') ?? null;
  }, []);

  // Restore the desktop chat input after the window briefly loses focus.
  // This prevents transient main-window blur/focus churn from interrupting typing.
  useEffect(() => {
    if (isMobile || typeof window === 'undefined') {
      return undefined;
    }

    const handleWindowBlur = () => {
      const textarea = getTextareaElement();
      if (!textarea || document.activeElement !== textarea) {
        shouldRestoreDesktopFocusRef.current = false;
        desktopFocusSelectionRef.current = null;
        return;
      }

      shouldRestoreDesktopFocusRef.current = true;
      desktopFocusSelectionRef.current = {
        start: textarea.selectionStart ?? textarea.value.length,
        end: textarea.selectionEnd ?? textarea.value.length,
      };
    };

    const handleWindowFocus = () => {
      if (!shouldRestoreDesktopFocusRef.current) {
        return;
      }

      shouldRestoreDesktopFocusRef.current = false;
      const restoreSelection = desktopFocusSelectionRef.current;

      window.setTimeout(() => {
        const textarea = getTextareaElement();
        if (!textarea || textarea.disabled || document.activeElement === textarea) {
          return;
        }

        textarea.focus();

        const defaultPosition = Math.min(cursorPositionRef.current, textarea.value.length);
        const selectionStart = Math.min(restoreSelection?.start ?? defaultPosition, textarea.value.length);
        const selectionEnd = Math.min(restoreSelection?.end ?? selectionStart, textarea.value.length);
        textarea.setSelectionRange(selectionStart, selectionEnd);
      }, 0);
    };

    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [cursorPositionRef, getTextareaElement, isMobile]);

  useEffect(() => {
    setCursorPosition((prev) => Math.min(prev, input.length));
  }, [input.length]);

  useEffect(() => {
    if (loadedWorkspacePathRef.current === workspacePath) {
      return;
    }

    workspaceItemsRequestRef.current = null;
    loadedWorkspacePathRef.current = undefined;
    setWorkspaceItems([]);
  }, [workspacePath]);

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
    onUploadStateChange: ({ pendingCount }) => {
      setDragPendingUploadCount(pendingCount);
    },
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

  // 使用共享的输入法合成处理
  const { isComposing, compositionHandlers, createKeyDownHandler } = useCompositionInput();

  // 使用共享的PasteService集成
  const { onPaste, onFocus: handlePasteFocus } = usePasteService({
    supportedExts,
    onFilesAdded,
    conversationId: conversationContext?.conversationId,
    onUploadStateChange: ({ pendingCount }) => {
      setPastePendingUploadCount(pendingCount);
    },
    onTextPaste: (text: string) => {
      // 处理清理后的文本粘贴，在当前光标位置插入文本而不是替换整个内容
      const textarea = document.activeElement as HTMLTextAreaElement;
      if (textarea && textarea.tagName === 'TEXTAREA') {
        const currentValue = textarea.value;
        const start = textarea.selectionStart ?? textarea.value.length;
        const end = textarea.selectionEnd ?? start;
        const newValue = currentValue.slice(0, start) + text + currentValue.slice(end);
        setInput(newValue);
        setCursorPosition(start + text.length);
        // 设置光标到插入文本后的位置
        setTimeout(() => {
          textarea.setSelectionRange(start + text.length, start + text.length);
        }, 0);
      } else {
        // 如果无法获取光标位置，回退到追加到末尾的行为
        setInput(text);
        setCursorPosition(text.length);
      }
    },
  });

  const ensureWorkspaceItems = useCallback(async (): Promise<WorkspaceMentionItem[]> => {
    if (!workspacePath) {
      return [];
    }

    if (loadedWorkspacePathRef.current === workspacePath) {
      return workspaceItemsRef.current;
    }

    if (workspaceItemsRequestRef.current) {
      return workspaceItemsRequestRef.current;
    }

    const request = listWorkspaceFileItems(workspacePath)
      .then((items) => {
        const mentionItems = toWorkspaceMentionItems(items);
        loadedWorkspacePathRef.current = workspacePath;
        setWorkspaceItems(mentionItems);
        return mentionItems;
      })
      .catch((error) => {
        console.warn('[SendBox] Failed to load workspace mention items:', error);
        loadedWorkspacePathRef.current = workspacePath;
        setWorkspaceItems([]);
        return [] as WorkspaceMentionItem[];
      })
      .finally(() => {
        workspaceItemsRequestRef.current = null;
      });

    workspaceItemsRequestRef.current = request;
    return request;
  }, [conversationContext?.conversationId, workspaceItemsRef, workspacePath]);

  const syncWorkspaceMentionSelections = useCallback(
    (nextInput: string, availableItems: WorkspaceMentionItem[]) => {
      if (!onSelectedWorkspaceItemsChange) {
        return;
      }

      const previousMentionPaths = mentionOwnedSelectionPathsRef.current;
      const mentionItems = resolveExactWorkspaceMentionItems(nextInput, availableItems);
      const nextMentionPaths = new Set(mentionItems.map((item) => item.path));
      const baseSelections = selectedWorkspaceItems.filter(
        (item) => !previousMentionPaths.has(getSelectionItemPath(item))
      );
      const nextSelections = mergeFileSelectionItems(baseSelections, mentionItems);

      mentionOwnedSelectionPathsRef.current = nextMentionPaths;

      if (!areSelectionItemsEqual(selectedWorkspaceItems, nextSelections)) {
        onSelectedWorkspaceItemsChange(nextSelections as Array<string | FileOrFolderItem>);
      }
    },
    [onSelectedWorkspaceItemsChange, selectedWorkspaceItems]
  );

  useEffect(() => {
    if (!workspacePath) {
      if (mentionOwnedSelectionPathsRef.current.size > 0) {
        mentionOwnedSelectionPathsRef.current = new Set();
      }
      return;
    }

    if (!activeWorkspaceMention && !input.includes('@workspace/')) {
      return;
    }

    void ensureWorkspaceItems();
  }, [activeWorkspaceMention, ensureWorkspaceItems, input, workspacePath]);

  useEffect(() => {
    if (!onSelectedWorkspaceItemsChange) {
      return;
    }

    if (
      input.includes('@workspace/') &&
      workspaceItems.length === 0 &&
      loadedWorkspacePathRef.current !== workspacePath
    ) {
      void ensureWorkspaceItems().then((items) => {
        syncWorkspaceMentionSelections(input, items);
      });
      return;
    }

    syncWorkspaceMentionSelections(input, workspaceItems);
  }, [
    ensureWorkspaceItems,
    input,
    onSelectedWorkspaceItemsChange,
    syncWorkspaceMentionSelections,
    workspaceItems,
    workspacePath,
  ]);

  const workspaceMentionSuggestions = useMemo(() => {
    if (!activeWorkspaceMention || !workspacePath) {
      return [];
    }

    return matchWorkspaceMentionItems(workspaceItems, activeWorkspaceMention.rawQuery);
  }, [activeWorkspaceMention, workspaceItems, workspacePath]);

  useEffect(() => {
    setActiveWorkspaceMentionIndex((prev) => Math.min(prev, Math.max(workspaceMentionSuggestions.length - 1, 0)));
  }, [workspaceMentionSuggestions.length]);

  const handleWorkspaceMentionSelect = useCallback(
    (item: WorkspaceMentionItem) => {
      if (!activeWorkspaceMention) {
        return;
      }

      const replacement = replaceActiveWorkspaceMention(input, activeWorkspaceMention, item);
      setInput(replacement.value);
      setCursorPosition(replacement.selectionStart);
      syncWorkspaceMentionSelections(replacement.value, workspaceItemsRef.current);

      setTimeout(() => {
        const textarea = containerRef.current?.querySelector('textarea');
        if (!textarea) {
          return;
        }
        textarea.focus();
        textarea.setSelectionRange(replacement.selectionStart, replacement.selectionStart);
      }, 0);
    },
    [activeWorkspaceMention, input, setInput, syncWorkspaceMentionSelections, workspaceItemsRef]
  );

  const markMobileFocusIntent = useCallback(() => {
    if (!isMobile) return;
    mobileUserFocusIntentUntilRef.current = Date.now() + 1500;
  }, [isMobile]);

  const handleInputFocus = useCallback(
    (event: React.FocusEvent<HTMLTextAreaElement>) => {
      setCursorPosition(event.target.selectionStart ?? event.target.value.length);

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
    },
    [conversationContext?.conversationId, handlePasteFocus, isMobile]
  );

  const handleInputBlur = useCallback(() => {
    if (warmupTimerRef.current) {
      clearTimeout(warmupTimerRef.current);
      warmupTimerRef.current = null;
    }
    setIsInputFocused(false);
  }, []);

  const hasMessageContent = Boolean(input.trim() || domSnippets.length > 0);
  const totalPendingUploadCount = pendingUploadCount + dragPendingUploadCount + pastePendingUploadCount;

  const buildFinalMessage = useCallback(() => {
    let finalMessage = expandManagedSlashCommandInput(input, mergedSlashCommands);
    if (domSnippets.length > 0) {
      const snippetsHtml = domSnippets
        .map((snippet) => `\n\n---\nDOM Snippet (${snippet.tag}):\n\`\`\`html\n${snippet.html}\n\`\`\``)
        .join('');
      finalMessage += snippetsHtml;
    }

    return finalMessage;
  }, [domSnippets, input, mergedSlashCommands]);

  const consumeInputMessage = useCallback(() => {
    const finalMessage = buildFinalMessage();
    setInput('');
    clearDomSnippets();
    return finalMessage;
  }, [buildFinalMessage, clearDomSnippets, setInput]);

  const sendDeferredMessage = useCallback(
    (
      handler?: (message: string) => Promise<void> | void,
      options?: {
        allowWhileBusy?: boolean;
      }
    ) => {
      if (!handler || !hasMessageContent) {
        return false;
      }
      if (totalPendingUploadCount > 0 || (!options?.allowWhileBusy && (loading || isLoading))) {
        message.warning(t('messages.conversationInProgress'));
        return false;
      }

      const finalMessage = consumeInputMessage();
      void Promise.resolve(handler(finalMessage));
      return true;
    },
    [consumeInputMessage, hasMessageContent, isLoading, loading, message, t, totalPendingUploadCount]
  );

  const sendMessageHandler = () => {
    if (loading || isLoading || totalPendingUploadCount > 0) {
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
  const isButtonDisabled = disabled || !hasMessageContent;
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
      className='bg-animate sendbox-stop-button sendbox-tool-button'
      style={stopButtonStyle}
      aria-label={t('conversation.group.workflow.decision.stop')}
      icon={<Square theme='filled' size='12' fill='currentColor' strokeWidth={2} />}
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

      if (!slashController.isOpen && workspaceMentionSuggestions.length > 0) {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setActiveWorkspaceMentionIndex((prev) => (prev + 1) % workspaceMentionSuggestions.length);
          return;
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setActiveWorkspaceMentionIndex(
            (prev) => (prev - 1 + workspaceMentionSuggestions.length) % workspaceMentionSuggestions.length
          );
          return;
        }

        if ((event.key === 'Enter' && !event.shiftKey) || (event.key === 'Tab' && !event.shiftKey)) {
          event.preventDefault();
          handleWorkspaceMentionSelect(
            workspaceMentionSuggestions[activeWorkspaceMentionIndex] || workspaceMentionSuggestions[0]
          );
          return;
        }

        if (event.key === 'Escape') {
          event.preventDefault();
          const textarea = event.currentTarget as HTMLTextAreaElement;
          setCursorPosition(textarea.selectionStart ?? textarea.value.length);
          return;
        }
      }

      if (!slashController.isOpen && !disabled) {
        if (event.key === 'Tab' && !event.shiftKey && onQueue && hasMessageContent) {
          event.preventDefault();
          sendDeferredMessage(onQueue, { allowWhileBusy: true });
          return;
        }

        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && onSteer && hasMessageContent) {
          event.preventDefault();
          sendDeferredMessage(onSteer, { allowWhileBusy: true });
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
      activeWorkspaceMentionIndex,
      baseKeyDownHandler,
      disabled,
      handleWorkspaceMentionSelect,
      hasMessageContent,
      isComposing,
      onEditLatestPending,
      onQueue,
      onSteer,
      sendDeferredMessage,
      slashController.isOpen,
      workspaceMentionSuggestions,
    ]
  );

  const shouldShowWorkspaceMentionMenu = !slashController.isOpen && workspaceMentionSuggestions.length > 0;

  return (
    <div className={className}>
      <div
        ref={containerRef}
        className={`relative border-3 b bg-dialog-fill-0 b-solid flex flex-col ${isMobile ? 'p-12px rd-18px' : 'p-16px rd-20px'} ${
          slashController.isOpen || shouldShowWorkspaceMentionMenu ? 'overflow-visible' : 'overflow-hidden'
        } ${isFileDragging ? 'b-dashed' : ''}`}
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
        {shouldShowWorkspaceMentionMenu && (
          <div className='absolute left-12px right-12px bottom-[calc(100%+8px)] z-70'>
            <WorkspaceMentionMenu
              items={workspaceMentionSuggestions}
              activeIndex={activeWorkspaceMentionIndex}
              onSelect={handleWorkspaceMentionSelect}
            />
          </div>
        )}
        {slashController.isOpen && (
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
        )}
        <div style={{ width: '100%' }}>
          {prefix}
          {context}
          {/* DOM 片段标签 / DOM snippet tags */}
          {domSnippets.length > 0 && (
            <div className='mb-8px flex flex-wrap gap-6px'>
              {domSnippets.map((snippet) => (
                <Tag
                  key={snippet.id}
                  closable
                  closeIcon={<CloseSmall theme='outline' size='12' />}
                  onClose={() => removeDomSnippet(snippet.id)}
                  className='rd-4px bg-fill-2 text-12px b-1 b-solid b-border-2'
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
            onChange={(value, event) => {
              setInput(value);
              setCursorPosition(event?.target.selectionStart ?? value.length);
            }}
            onSelect={(event) => {
              setCursorPosition(event.currentTarget.selectionStart ?? event.currentTarget.value.length);
            }}
            onPaste={onPaste}
            onTouchStart={markMobileFocusIntent}
            onMouseDown={markMobileFocusIntent}
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
