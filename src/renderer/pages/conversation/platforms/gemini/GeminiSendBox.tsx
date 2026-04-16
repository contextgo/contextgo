import { ipcBridge } from '@/common';
import { uuid } from '@/common/utils';
import AgentSetupCard from '@/renderer/components/agent/AgentSetupCard';
import ContextUsageIndicator from '@/renderer/components/agent/ContextUsageIndicator';
import FilePreview from '@/renderer/components/media/FilePreview';
import HorizontalFileList from '@/renderer/components/media/HorizontalFileList';
import PendingMessageBar from '@/renderer/components/chat/PendingMessageBar';
import SendBox from '@/renderer/components/chat/sendbox';
import { useAgentReadinessCheck } from '@/renderer/hooks/agent/useAgentReadinessCheck';
import { useAutoTitle } from '@/renderer/hooks/chat/useAutoTitle';
import { useLatestRef } from '@/renderer/hooks/ui/useLatestRef';
import { useOpenFileSelector } from '@/renderer/hooks/file/useOpenFileSelector';
import FileAttachButton from '@/renderer/components/media/FileAttachButton';
import { getSendBoxDraftHook, type FileOrFolderItem } from '@/renderer/hooks/chat/useSendBoxDraft';
import { createSetUploadFile, useSendBoxFiles } from '@/renderer/hooks/chat/useSendBoxFiles';
import { useSlashCommands } from '@/renderer/hooks/chat/useSlashCommands';
import { useAddOrUpdateMessage } from '@/renderer/pages/conversation/Messages/hooks';
import { usePreviewContext } from '@/renderer/pages/conversation/Preview';
import {
  usePendingConversationMessages,
  type PendingConversationMessage,
  type PendingConversationMessageMode,
} from '@/renderer/pages/conversation/hooks/usePendingConversationMessages';
import { allSupportedExts } from '@/renderer/services/FileService';
import { emitter, useAddEventListener } from '@/renderer/utils/emitter';
import { mergeFileSelectionItems } from '@/renderer/utils/file/fileSelection';
import { buildDisplayMessage, collectSelectedFiles } from '@/renderer/utils/file/messageFiles';
import { buildWorkspaceReferenceLabel } from '@/renderer/utils/file/workspaceReferences';
import { getModelContextLimit } from '@/renderer/utils/model/modelContextLimits';
import { Tag } from '@arco-design/web-react';
import { Shield } from '@icon-park/react';
import { iconColors } from '@/renderer/styles/colors';
import AgentModeSelector from '@/renderer/components/agent/AgentModeSelector';
import ThoughtDisplay from '@/renderer/components/chat/ThoughtDisplay';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GeminiModelSelection } from './useGeminiModelSelection';
import { useGeminiMessage } from './useGeminiMessage';
import { useGeminiQuotaFallback } from './useGeminiQuotaFallback';
import { useGeminiInitialMessage } from './useGeminiInitialMessage';

const useGeminiSendBoxDraft = getSendBoxDraftHook('gemini', {
  _type: 'gemini',
  atPath: [],
  content: '',
  uploadFile: [],
});

const EMPTY_AT_PATH: Array<string | FileOrFolderItem> = [];
const EMPTY_UPLOAD_FILES: string[] = [];

const useSendBoxDraft = (conversation_id: string) => {
  const { data, mutate } = useGeminiSendBoxDraft(conversation_id);

  const atPath = data?.atPath ?? EMPTY_AT_PATH;
  const uploadFile = data?.uploadFile ?? EMPTY_UPLOAD_FILES;
  const content = data?.content ?? '';

  const setAtPath = useCallback(
    (nextAtPath: Array<string | FileOrFolderItem>) => {
      mutate((prev) => ({ ...prev, atPath: nextAtPath }));
    },
    [data, mutate]
  );

  const setUploadFile = createSetUploadFile(mutate, data);

  const setContent = useCallback(
    (nextContent: string) => {
      mutate((prev) => ({ ...prev, content: nextContent }));
    },
    [data, mutate]
  );

  return {
    atPath,
    uploadFile,
    setAtPath,
    setUploadFile,
    content,
    setContent,
  };
};

const GeminiSendBox: React.FC<{
  conversation_id: string;
  modelSelection: GeminiModelSelection;
}> = ({ conversation_id, modelSelection }) => {
  const [workspacePath, setWorkspacePath] = useState('');
  const { t } = useTranslation();
  const { checkAndUpdateTitle } = useAutoTitle();

  // Agent auto-detection state - only for new conversation + no auth scenario
  const [showSetupCard, setShowSetupCard] = useState(false);
  const [isNewConversation, setIsNewConversation] = useState(true);
  const autoSwitchTriggeredRef = useRef(false);

  const { currentModel, getDisplayModelName, providers, geminiModeLookup, getAvailableModels, handleSelectModel } =
    modelSelection;

  // Check if no auth (no Google login AND no API key configured)
  const hasNoAuth = providers.length === 0;

  // Agent readiness check - only used when no auth
  const {
    isChecking: agentIsChecking,
    error: agentError,
    availableAgents,
    bestAgent,
    progress: checkProgress,
    currentAgent,
    performFullCheck,
    reset: resetAgentCheck,
  } = useAgentReadinessCheck({
    conversationType: 'gemini',
    autoCheck: false,
  });

  const { handleGeminiError } = useGeminiQuotaFallback({
    currentModel,
    providers,
    geminiModeLookup,
    getAvailableModels,
    handleSelectModel,
  });

  const { thought, running, canSteerPendingMessage, tokenUsage, setActiveMsgId, setWaitingResponse, resetState } =
    useGeminiMessage(conversation_id, handleGeminiError);

  const { atPath, uploadFile, setAtPath, setUploadFile, content, setContent } = useSendBoxDraft(conversation_id);
  const [pendingUploadCount, setPendingUploadCount] = useState(0);

  useGeminiInitialMessage({
    conversationId: conversation_id,
    currentModelId: currentModel?.useModel,
    hasNoAuth,
    setContent,
    setActiveMsgId,
    setWaitingResponse,
    autoSwitchTriggeredRef,
    setShowSetupCard,
    performFullCheck,
  });

  useEffect(() => {
    void ipcBridge.conversation.get.invoke({ id: conversation_id }).then((res) => {
      if (!res?.extra?.workspace) return;
      setWorkspacePath(res.extra.workspace);
    });
  }, [conversation_id]);

  // Reset conversation state (detection only triggers on new message, not on mount/tab-switch)
  useEffect(() => {
    setShowSetupCard(false);
    setIsNewConversation(true);
    autoSwitchTriggeredRef.current = false;
    resetAgentCheck();

    void ipcBridge.database.getConversationMessages
      .invoke({ conversation_id, page: 0, pageSize: 1 })
      .then((messages) => {
        const hasMessages = messages && messages.length > 0;
        setIsNewConversation(!hasMessages);
      });
  }, [conversation_id, resetAgentCheck]);

  // Dismiss the setup card
  const handleDismissSetupCard = useCallback(() => {
    setShowSetupCard(false);
  }, []);

  // Retry agent check
  const handleRetryCheck = useCallback(() => {
    void performFullCheck();
  }, [performFullCheck]);

  const slashCommands = useSlashCommands(conversation_id);

  const addOrUpdateMessage = useAddOrUpdateMessage();
  const { setSendBoxHandler } = usePreviewContext();

  // Use useLatestRef to keep latest setters to avoid re-registering handler
  const setContentRef = useLatestRef(setContent);
  const atPathRef = useLatestRef(atPath);

  // Register handler for adding text from preview panel to sendbox
  useEffect(() => {
    const handler = (text: string) => {
      const newContent = content ? `${content}\n${text}` : text;
      setContentRef.current(newContent);
    };
    setSendBoxHandler(handler);
  }, [setSendBoxHandler, content]);

  // Listen for sendbox.fill event to populate input from external sources
  useAddEventListener(
    'sendbox.fill',
    (text: string) => {
      setContentRef.current(text);
    },
    []
  );

  // Shared file handling logic
  const { handleFilesAdded, clearFiles } = useSendBoxFiles({
    atPath,
    uploadFile,
    setAtPath,
    setUploadFile,
  });

  const sendGeminiMessage = useCallback(
    async (message: string, filesToSend: string[]) => {
      if (!currentModel?.useModel) return;

      const msg_id = uuid();
      // Set current active message ID to filter out events from old requests
      setActiveMsgId(msg_id);
      setWaitingResponse(true);

      const hasFiles = filesToSend.length > 0;
      const displayMessage = buildDisplayMessage(message, filesToSend, workspacePath);
      addOrUpdateMessage(
        {
          id: msg_id,
          type: 'text',
          position: 'right',
          conversation_id,
          content: {
            content: displayMessage,
          },
          createdAt: Date.now(),
        },
        true
      );

      await ipcBridge.geminiConversation.sendMessage.invoke({
        input: displayMessage,
        msg_id,
        conversation_id,
        files: filesToSend,
      });
      void checkAndUpdateTitle(conversation_id, message);
      emitter.emit('chat.history.refresh');
      emitter.emit('gemini.selected.file.clear');
      if (hasFiles) {
        emitter.emit('gemini.workspace.refresh');
      }
    },
    [
      addOrUpdateMessage,
      checkAndUpdateTitle,
      conversation_id,
      currentModel?.useModel,
      setActiveMsgId,
      setWaitingResponse,
      workspacePath,
    ]
  );

  const {
    pendingMessages,
    enqueuePendingMessage,
    removePendingMessage,
    restorePendingMessage,
    restoreLatestPendingMessage,
    setPendingMessageMode,
  } = usePendingConversationMessages({
    conversationId: conversation_id,
    canSendNow: Boolean(currentModel?.useModel) && !running,
    canSteerNow: canSteerPendingMessage,
    onDispatch: async (pendingMessage: PendingConversationMessage) => {
      await sendGeminiMessage(pendingMessage.content, pendingMessage.attachments);
    },
    onDispatchError: (error: unknown) => {
      console.error('[GeminiSendBox] Failed to dispatch pending message:', error);
    },
  });

  const stashPendingMessage = useCallback(
    (mode: PendingConversationMessageMode, message: string) => {
      const filesToSend = collectSelectedFiles(uploadFile, atPath);
      clearFiles();
      emitter.emit('gemini.selected.file.clear');
      enqueuePendingMessage(mode, message, filesToSend);
    },
    [atPath, clearFiles, enqueuePendingMessage, uploadFile]
  );

  const restoreMessageToComposer = useCallback(
    (messageId: string) => {
      const pendingMessage = restorePendingMessage(messageId);
      if (!pendingMessage) {
        return;
      }

      setContent(pendingMessage.content);
      setAtPath([]);
      setUploadFile(pendingMessage.attachments);
      emitter.emit('gemini.selected.file.clear');
    },
    [restorePendingMessage, setAtPath, setContent, setUploadFile]
  );

  const restoreLatestMessageToComposer = useCallback(() => {
    const pendingMessage = restoreLatestPendingMessage();
    if (!pendingMessage) {
      return;
    }

    setContent(pendingMessage.content);
    setAtPath([]);
    setUploadFile(pendingMessage.attachments);
    emitter.emit('gemini.selected.file.clear');
  }, [restoreLatestPendingMessage, setAtPath, setContent, setUploadFile]);

  const onSendHandler = async (message: string) => {
    if (!currentModel?.useModel) return;
    const filesToSend = collectSelectedFiles(uploadFile, atPath);
    clearFiles();
    await sendGeminiMessage(message, filesToSend);
  };

  const appendSelectedFiles = useCallback(
    (files: string[]) => {
      setUploadFile((prev) => [...prev, ...files]);
    },
    [setUploadFile]
  );
  const handleUploadStateChange = useCallback((state: { isUploading: boolean; pendingCount: number }) => {
    setPendingUploadCount(state.pendingCount);
  }, []);
  const { openFileSelector, onSlashBuiltinCommand } = useOpenFileSelector({
    onFilesSelected: appendSelectedFiles,
  });

  useAddEventListener('gemini.selected.file', setAtPath);
  useAddEventListener('gemini.selected.file.append', (items: Array<string | FileOrFolderItem>) => {
    const merged = mergeFileSelectionItems(atPathRef.current, items);
    if (merged !== atPathRef.current) {
      setAtPath(merged as Array<string | FileOrFolderItem>);
    }
  });

  // Stop conversation handler
  const handleStop = async (): Promise<void> => {
    // Use finally to ensure UI state is reset even if backend stop fails
    try {
      await ipcBridge.conversation.stop.invoke({ conversation_id });
    } finally {
      resetState();
    }
  };

  return (
    <div className='max-w-800px w-full mx-auto flex flex-col mt-auto mb-16px'>
      {/* Agent Setup Card - only show for new conversation + no auth, auto-switch to available agent */}
      {showSetupCard && isNewConversation && hasNoAuth && (
        <AgentSetupCard
          conversationId={conversation_id}
          currentAgent={currentAgent}
          error={agentError}
          isChecking={agentIsChecking}
          progress={checkProgress}
          availableAgents={availableAgents}
          bestAgent={bestAgent}
          onDismiss={handleDismissSetupCard}
          onRetry={handleRetryCheck}
          autoSwitch={true}
          initialMessage={content}
        />
      )}

      <ThoughtDisplay thought={thought} running={running} onStop={handleStop} />

      <SendBox
        value={content}
        onChange={setContent}
        loading={running}
        disabled={!currentModel?.useModel}
        placeholder={
          currentModel?.useModel
            ? t('conversation.chat.sendMessageTo', { model: getDisplayModelName(currentModel.useModel) })
            : t('conversation.chat.noModelSelected')
        }
        onStop={handleStop}
        className='z-10'
        onFilesAdded={handleFilesAdded}
        pendingUploadCount={pendingUploadCount}
        onUploadStateChange={handleUploadStateChange}
        supportedExts={allSupportedExts}
        defaultMultiLine={true}
        lockMultiLine={true}
        tools={
          <div className='sendbox-tool-cluster'>
            <FileAttachButton
              openFileSelector={openFileSelector}
              onLocalFilesAdded={handleFilesAdded}
              onUploadStateChange={handleUploadStateChange}
            />
            <div className='sendbox-tool-pill-row'>
              <AgentModeSelector
                backend='gemini'
                conversationId={conversation_id}
                compact
                compactLeadingIcon={<Shield theme='outline' size='14' fill={iconColors.secondary} />}
                modeLabelFormatter={(mode) => t(`agentMode.${mode.value}`, { defaultValue: mode.label })}
                compactLabelPrefix={t('agentMode.permission')}
                hideCompactLabelPrefixOnMobile
              />
            </div>
          </div>
        }
        sendButtonPrefix={
          <ContextUsageIndicator
            tokenUsage={tokenUsage}
            contextLimit={getModelContextLimit(currentModel?.useModel)}
            size={24}
          />
        }
        prefix={
          <>
            <PendingMessageBar
              messages={pendingMessages}
              onRemove={removePendingMessage}
              onEdit={restoreMessageToComposer}
              onSetMode={setPendingMessageMode}
            />
            {/* Files on top */}
            {(uploadFile.length > 0 || atPath.some((item) => (typeof item === 'string' ? true : item.isFile))) && (
              <HorizontalFileList>
                {uploadFile.map((path) => (
                  <FilePreview
                    key={path}
                    path={path}
                    onRemove={() => setUploadFile(uploadFile.filter((v) => v !== path))}
                  />
                ))}
                {atPath.map((item) => {
                  const isFile = typeof item === 'string' ? true : item.isFile;
                  const path = typeof item === 'string' ? item : item.path;
                  if (isFile) {
                    return (
                      <FilePreview
                        key={path}
                        path={path}
                        onRemove={() => {
                          const newAtPath = atPath.filter((v) =>
                            typeof v === 'string' ? v !== path : v.path !== path
                          );
                          emitter.emit('gemini.selected.file', newAtPath);
                          setAtPath(newAtPath);
                        }}
                      />
                    );
                  }
                  return null;
                })}
              </HorizontalFileList>
            )}
            {atPath.length > 0 && (
              <div className='flex flex-wrap items-center gap-8px mb-8px'>
                {atPath.map((item) => {
                  const itemPath = typeof item === 'string' ? item : item.path;
                  return (
                    <Tag
                      key={itemPath}
                      color='blue'
                      closable
                      onClose={() => {
                        const newAtPath = atPath.filter((value) =>
                          typeof value === 'string' ? value !== itemPath : value.path !== itemPath
                        );
                        emitter.emit('gemini.selected.file', newAtPath);
                        setAtPath(newAtPath);
                      }}
                    >
                      {buildWorkspaceReferenceLabel(item)}
                    </Tag>
                  );
                })}
              </div>
            )}
          </>
        }
        onSend={onSendHandler}
        onQueue={(message) => stashPendingMessage('queue', message)}
        onSteer={(message) => stashPendingMessage('steer', message)}
        onEditLatestPending={restoreLatestMessageToComposer}
        slashCommands={slashCommands}
        onSlashBuiltinCommand={onSlashBuiltinCommand}
      ></SendBox>
    </div>
  );
};

export default GeminiSendBox;
