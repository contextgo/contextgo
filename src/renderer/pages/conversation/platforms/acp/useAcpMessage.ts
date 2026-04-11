/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { IResponseMessage } from '@/common/adapter/ipcBridge';
import { shouldSuppressAgentLifecycleStreamMessage, transformMessage } from '@/common/chat/chatLib';
import type { TokenUsageData } from '@/common/config/storage';
import type { AgentRunTrace } from '@/renderer/components/chat/AgentRunStatus/types';
import type { RuntimePlanEntry } from '@/renderer/components/chat/runtimePlanTypes';
import type { ThoughtData } from '@/renderer/components/chat/ThoughtDisplay';
import { useAddOrUpdateMessage } from '@/renderer/pages/conversation/Messages/hooks';
import { readConversationUiState, writeConversationUiState } from '@/renderer/pages/conversation/hooks/conversationUiStateCache';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type UseAcpMessageReturn = {
  thought: ThoughtData;
  setThought: React.Dispatch<React.SetStateAction<ThoughtData>>;
  running: boolean;
  runtimePlanEntries: RuntimePlanEntry[];
  acpStatus: 'connecting' | 'connected' | 'authenticated' | 'session_active' | 'disconnected' | 'error' | null;
  aiProcessing: boolean;
  canSteerPendingMessage: boolean;
  setAiProcessing: React.Dispatch<React.SetStateAction<boolean>>;
  resetState: () => void;
  tokenUsage: TokenUsageData | null;
  contextLimit: number;
  runTrace: AgentRunTrace | null;
  beginRun: (input: string, files?: string[]) => void;
};

type AcpUiStateSnapshot = {
  running: boolean;
  aiProcessing: boolean;
  acpStatus: UseAcpMessageReturn['acpStatus'];
  thought: ThoughtData;
  runTrace: AgentRunTrace | null;
  runtimePlanEntries: RuntimePlanEntry[];
  tokenUsage: TokenUsageData | null;
  contextLimit: number;
};

const ACP_UI_STATE_SCOPE = 'acp';

const createDefaultAcpUiState = (): AcpUiStateSnapshot => ({
    running: false,
    aiProcessing: false,
    acpStatus: null,
    thought: { subject: '', description: '' },
    runTrace: null,
    runtimePlanEntries: [],
    tokenUsage: null,
    contextLimit: 0,
  });

const buildRunTaskText = (input: string, files: string[] = []): string => {
  const normalizedInput = input.trim();
  const normalizedFiles = [...new Set(files.filter(Boolean))];

  if (normalizedFiles.length === 0) {
    return normalizedInput;
  }

  const fileSection = ['[Files]', ...normalizedFiles.map((file) => `- ${file}`)].join('\n');
  return normalizedInput ? `${normalizedInput}\n\n${fileSection}` : fileSection;
};

const resolveThoughtText = (previous: string, incoming: string): string => {
  const next = incoming.trim();
  if (!next) {
    return previous;
  }

  return incoming;
};

const extractThoughtSubject = (content: string): string => {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const firstLine = lines[0] || '';

  const heading = firstLine.match(/^\*\*(.+?)\*\*$/);
  if (heading) {
    return heading[1];
  }

  if (firstLine && firstLine.length <= 80 && !firstLine.endsWith('.')) {
    return firstLine;
  }

  const firstSentence = content.split('.')[0]?.trim();
  if (firstSentence && firstSentence.length <= 100) {
    return firstSentence;
  }

  return 'Thinking';
};

const createBaseRunTrace = (rawTask: string, startedAt = Date.now()): AgentRunTrace => ({
  rawTask,
  startedAt,
  phase: 'preparing',
  liveThoughtText: '',
  activeToolCount: 0,
  planEntries: [],
});

const toRuntimePlanEntries = (
  entries: Array<{ content: string; status: 'pending' | 'in_progress' | 'completed' }> = []
): RuntimePlanEntry[] => entries.map((entry) => ({ content: entry.content, status: entry.status }));

export const useAcpMessage = (conversation_id: string): UseAcpMessageReturn => {
  const addOrUpdateMessage = useAddOrUpdateMessage();
  const initialUiState = readConversationUiState(ACP_UI_STATE_SCOPE, conversation_id, createDefaultAcpUiState());
  const [running, setRunning] = useState(initialUiState.running);
  const [thought, setThought] = useState<ThoughtData>(initialUiState.thought);
  const [runTrace, setRunTrace] = useState<AgentRunTrace | null>(initialUiState.runTrace);
  const [runtimePlanEntries, setRuntimePlanEntries] = useState<RuntimePlanEntry[]>(initialUiState.runtimePlanEntries);
  const [acpStatus, setAcpStatus] = useState<
    'connecting' | 'connected' | 'authenticated' | 'session_active' | 'disconnected' | 'error' | null
  >(initialUiState.acpStatus);
  const [aiProcessing, setAiProcessing] = useState(initialUiState.aiProcessing);
  const [hasActiveToolCalls, setHasActiveToolCalls] = useState(false);
  const [sawToolActivityInTurn, setSawToolActivityInTurn] = useState(false);
  const [tokenUsage, setTokenUsage] = useState<TokenUsageData | null>(initialUiState.tokenUsage);
  const [contextLimit, setContextLimit] = useState<number>(initialUiState.contextLimit);

  const runningRef = useRef(initialUiState.running);
  const aiProcessingRef = useRef(initialUiState.aiProcessing);
  const activeToolCallIdsRef = useRef<Set<string>>(new Set());
  const hasContentInTurnRef = useRef(false);
  const pendingTaskRef = useRef('');
  const thoughtTextRef = useRef('');

  const requestTraceRef = useRef<{
    startTime: number;
    backend: string;
    modelId: string;
    sessionMode?: string;
  } | null>(null);

  const thoughtThrottleRef = useRef<{
    lastUpdate: number;
    pending: ThoughtData | null;
    timer: ReturnType<typeof setTimeout> | null;
  }>({ lastUpdate: 0, pending: null, timer: null });

  const throttledSetThought = useMemo(() => {
    const THROTTLE_MS = 50;
    return (data: ThoughtData) => {
      const now = Date.now();
      const ref = thoughtThrottleRef.current;
      if (now - ref.lastUpdate >= THROTTLE_MS) {
        ref.lastUpdate = now;
        ref.pending = null;
        if (ref.timer) {
          clearTimeout(ref.timer);
          ref.timer = null;
        }
        setThought(data);
      } else {
        ref.pending = data;
        if (!ref.timer) {
          ref.timer = setTimeout(
            () => {
              ref.lastUpdate = Date.now();
              ref.timer = null;
              if (ref.pending) {
                setThought(ref.pending);
                ref.pending = null;
              }
            },
            THROTTLE_MS - (now - ref.lastUpdate)
          );
        }
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (thoughtThrottleRef.current.timer) {
        clearTimeout(thoughtThrottleRef.current.timer);
      }
    };
  }, []);

  const clearTransientState = useCallback(() => {
    activeToolCallIdsRef.current = new Set();
    setHasActiveToolCalls(false);
    setSawToolActivityInTurn(false);
    thoughtTextRef.current = '';
    pendingTaskRef.current = '';
  }, []);

  const beginRun = useCallback((input: string, files: string[] = []) => {
    const rawTask = buildRunTaskText(input, files);
    pendingTaskRef.current = rawTask;
    thoughtTextRef.current = '';
    activeToolCallIdsRef.current = new Set();
    setHasActiveToolCalls(false);
    setSawToolActivityInTurn(false);
    setThought({ subject: '', description: '' });
    setRunTrace(createBaseRunTrace(rawTask));
    setRuntimePlanEntries([]);
  }, []);

  const handleResponseMessage = useCallback(
    (message: IResponseMessage) => {
      if (conversation_id !== message.conversation_id) {
        return;
      }

      const transformedMessage = transformMessage(message);
      const shouldSuppressLifecycleMessage = shouldSuppressAgentLifecycleStreamMessage(message);

      switch (message.type) {
        case 'thought': {
          if (!runningRef.current) {
            setRunning(true);
            runningRef.current = true;
          }

          const incomingThought = message.data as ThoughtData;
          const latestThoughtText = resolveThoughtText(
            thoughtTextRef.current,
            incomingThought.description || incomingThought.subject || ''
          );
          thoughtTextRef.current = latestThoughtText;

          const nextThought = {
            subject: extractThoughtSubject(latestThoughtText),
            description: latestThoughtText,
          };

          throttledSetThought(nextThought);
          setRunTrace((current) => ({
            ...(current || createBaseRunTrace(pendingTaskRef.current)),
            rawTask: current?.rawTask || pendingTaskRef.current,
            phase: 'reasoning',
            liveThoughtText: latestThoughtText,
            activeToolCount: activeToolCallIdsRef.current.size,
            endedAt: undefined,
            errorMessage: undefined,
          }));
          break;
        }
        case 'start': {
          setRunning(true);
          runningRef.current = true;
          setRunTrace((current) => ({
            ...(current || createBaseRunTrace(pendingTaskRef.current)),
            rawTask: current?.rawTask || pendingTaskRef.current,
            phase: 'preparing',
            endedAt: undefined,
            errorMessage: undefined,
          }));
          break;
        }
        case 'finish': {
          setRunning(false);
          runningRef.current = false;
          setAiProcessing(false);
          aiProcessingRef.current = false;
          setThought({ subject: '', description: '' });
          hasContentInTurnRef.current = false;
          setRunTrace((current) =>
            current
              ? {
                  ...current,
                  phase: current.phase === 'error' ? 'error' : 'completed',
                  activeToolCount: 0,
                  endedAt: Date.now(),
                }
              : current
          );

          if (requestTraceRef.current) {
            const duration = Date.now() - requestTraceRef.current.startTime;
            console.log(
              `%c[RequestTrace]%c FINISH | ${requestTraceRef.current.backend} → ${requestTraceRef.current.modelId} | ${duration}ms | ${new Date().toISOString()}`,
              'color: #52c41a; font-weight: bold',
              'color: inherit'
            );
            requestTraceRef.current = null;
          }

          clearTransientState();
          setRuntimePlanEntries([]);
          break;
        }
        case 'interrupted': {
          setRunning(false);
          runningRef.current = false;
          setAiProcessing(false);
          aiProcessingRef.current = false;
          setThought({ subject: '', description: '' });
          hasContentInTurnRef.current = false;
          setRunTrace((current) =>
            current
              ? {
                  ...current,
                  phase: current.phase === 'error' ? 'error' : 'completed',
                  activeToolCount: 0,
                  endedAt: Date.now(),
                }
              : current
          );
          clearTransientState();
          setRuntimePlanEntries([]);
          if (!shouldSuppressLifecycleMessage) {
            addOrUpdateMessage(transformedMessage);
          }
          break;
        }
        case 'content': {
          hasContentInTurnRef.current = true;
          if (!runningRef.current) {
            setRunning(true);
            runningRef.current = true;
          }
          setThought({ subject: '', description: '' });
          setRunTrace((current) =>
            current
              ? {
                  ...current,
                  phase: 'composing',
                  activeToolCount: activeToolCallIdsRef.current.size,
                  endedAt: undefined,
                }
              : current
          );
          if (!shouldSuppressLifecycleMessage) {
            addOrUpdateMessage(transformedMessage);
          }
          break;
        }
        case 'agent_status': {
          if (!runningRef.current) {
            setRunning(true);
            runningRef.current = true;
          }
          const agentData = message.data as {
            status?: 'connecting' | 'connected' | 'authenticated' | 'session_active' | 'disconnected' | 'error';
          };
          if (agentData?.status) {
            setAcpStatus(agentData.status);
            if (['authenticated', 'session_active'].includes(agentData.status)) {
              setRunning(false);
              runningRef.current = false;
            }
            if (['error', 'disconnected'].includes(agentData.status)) {
              setRunning(false);
              runningRef.current = false;
              setAiProcessing(false);
              aiProcessingRef.current = false;
              setHasActiveToolCalls(false);
              setSawToolActivityInTurn(false);
              setRuntimePlanEntries([]);
            }
          }
          if (!shouldSuppressLifecycleMessage) {
            addOrUpdateMessage(transformedMessage);
          }
          break;
        }
        case 'user_content':
          addOrUpdateMessage(transformedMessage);
          break;
        case 'plan': {
          const planEntries = toRuntimePlanEntries(
            (message.data as { entries?: Array<{ content: string; status: 'pending' | 'in_progress' | 'completed' }> })
              ?.entries ?? []
          );
          setRuntimePlanEntries(planEntries);
          setRunTrace((current) =>
            current
              ? {
                  ...current,
                  planEntries,
                }
              : current
          );
          addOrUpdateMessage(transformedMessage);
          break;
        }
        case 'acp_tool_call': {
          const update = (message.data as { update?: { toolCallId?: string; status?: string } })?.update;
          const toolCallId = update?.toolCallId;
          const status = update?.status;
          let activeToolCount = activeToolCallIdsRef.current.size;

          if (toolCallId) {
            const nextActiveToolCallIds = new Set(activeToolCallIdsRef.current);
            setSawToolActivityInTurn(true);

            if (status === 'pending' || status === 'in_progress') {
              nextActiveToolCallIds.add(toolCallId);
            } else {
              nextActiveToolCallIds.delete(toolCallId);
            }

            activeToolCallIdsRef.current = nextActiveToolCallIds;
            activeToolCount = nextActiveToolCallIds.size;
            setHasActiveToolCalls(activeToolCount > 0);
          }

          setRunTrace((current) =>
            current
              ? {
                  ...current,
                  phase: activeToolCount > 0 ? 'tool_running' : current.phase,
                  activeToolCount,
                  endedAt: undefined,
                }
              : current
          );

          addOrUpdateMessage(transformedMessage);
          break;
        }
        case 'acp_permission': {
          if (!runningRef.current) {
            setRunning(true);
            runningRef.current = true;
          }
          setRunTrace((current) =>
            current
              ? {
                  ...current,
                  phase: 'waiting_permission',
                  activeToolCount: activeToolCallIdsRef.current.size,
                  endedAt: undefined,
                }
              : current
          );
          addOrUpdateMessage(transformedMessage);
          break;
        }
        case 'acp_model_info':
          break;
        case 'acp_context_usage': {
          const usageData = message.data as { used: number; size: number };
          if (usageData && typeof usageData.used === 'number') {
            setTokenUsage({ totalTokens: usageData.used });
            if (usageData.size > 0) {
              setContextLimit(usageData.size);
            }
          }
          break;
        }
        case 'request_trace': {
          const trace = message.data as Record<string, unknown>;
          const startTime = Number(trace.timestamp) || Date.now();
          requestTraceRef.current = {
            startTime,
            backend: String(trace.backend || 'unknown'),
            modelId: String(trace.modelId || 'unknown'),
            sessionMode: trace.sessionMode as string | undefined,
          };

          setRunTrace((current) => ({
            ...(current || createBaseRunTrace(pendingTaskRef.current, startTime)),
            rawTask: current?.rawTask || pendingTaskRef.current,
            startedAt: startTime,
            backend: String(trace.backend || 'unknown'),
            modelId: String(trace.modelId || 'unknown'),
            sessionMode: trace.sessionMode as string | undefined,
            phase: current?.phase || 'preparing',
            liveThoughtText: current?.liveThoughtText || '',
            activeToolCount: current?.activeToolCount || activeToolCallIdsRef.current.size,
            endedAt: undefined,
          }));

          console.log(
            `%c[RequestTrace]%c START | ${trace.backend} → ${trace.modelId} | ${new Date().toISOString()}`,
            'color: #1890ff; font-weight: bold',
            'color: inherit',
            trace
          );
          break;
        }
        case 'error': {
          setRunning(false);
          runningRef.current = false;
          setAiProcessing(false);
          aiProcessingRef.current = false;
          setHasActiveToolCalls(false);
          setSawToolActivityInTurn(false);
          if (!shouldSuppressLifecycleMessage) {
            addOrUpdateMessage(transformedMessage);
          }
          setRunTrace((current) =>
            current
              ? {
                  ...current,
                  phase: 'error',
                  activeToolCount: 0,
                  endedAt: Date.now(),
                  errorMessage: typeof message.data === 'string' ? message.data : JSON.stringify(message.data),
                }
              : current
          );
          if (requestTraceRef.current) {
            const duration = Date.now() - requestTraceRef.current.startTime;
            console.log(
              `%c[RequestTrace]%c ERROR | ${requestTraceRef.current.backend} → ${requestTraceRef.current.modelId} | ${duration}ms | ${new Date().toISOString()}`,
              'color: #ff4d4f; font-weight: bold',
              'color: inherit',
              message.data
            );
            requestTraceRef.current = null;
          }
          clearTransientState();
          setRuntimePlanEntries([]);
          break;
        }
        default:
          if (!runningRef.current) {
            setRunning(true);
            runningRef.current = true;
          }
          if (!shouldSuppressLifecycleMessage) {
            addOrUpdateMessage(transformedMessage);
          }
          break;
      }
    },
    [addOrUpdateMessage, clearTransientState, conversation_id, throttledSetThought]
  );

  useEffect(() => {
    return ipcBridge.acpConversation.responseStream.on(handleResponseMessage);
  }, [handleResponseMessage]);

  useEffect(() => {
    writeConversationUiState(ACP_UI_STATE_SCOPE, conversation_id, {
      running,
      aiProcessing,
      acpStatus,
      thought,
      runTrace,
      runtimePlanEntries,
      tokenUsage,
      contextLimit,
    });
  }, [acpStatus, aiProcessing, contextLimit, conversation_id, runTrace, running, runtimePlanEntries, thought, tokenUsage]);

  useEffect(() => {
    hasContentInTurnRef.current = false;
    pendingTaskRef.current = '';
    thoughtTextRef.current = '';

    const cachedState = readConversationUiState(ACP_UI_STATE_SCOPE, conversation_id, createDefaultAcpUiState());

    setRunning(cachedState.running);
    runningRef.current = cachedState.running;
    setAiProcessing(cachedState.aiProcessing);
    aiProcessingRef.current = cachedState.aiProcessing;
    setAcpStatus(cachedState.acpStatus);
    setThought(cachedState.thought);
    setRunTrace(cachedState.runTrace);
    setRuntimePlanEntries(cachedState.runtimePlanEntries);
    setTokenUsage(cachedState.tokenUsage);
    setContextLimit(cachedState.contextLimit);

    void ipcBridge.conversation.get.invoke({ id: conversation_id }).then((res) => {
      if (!res) {
        setRunning(false);
        runningRef.current = false;
        setAiProcessing(false);
        aiProcessingRef.current = false;
        setRuntimePlanEntries([]);
        clearTransientState();
        return;
      }

      const isRunning = res.status === 'running';
      setRunning(isRunning);
      runningRef.current = isRunning;
      setAiProcessing(isRunning);
      aiProcessingRef.current = isRunning;
      if (!isRunning) {
        setRuntimePlanEntries([]);
      }
      activeToolCallIdsRef.current = new Set();
      setHasActiveToolCalls(false);
      setSawToolActivityInTurn(false);

      if (res.type === 'acp' && res.extra?.lastTokenUsage) {
        const { lastTokenUsage, lastContextLimit } = res.extra;
        if (lastTokenUsage.totalTokens > 0) {
          setTokenUsage(lastTokenUsage);
        }
        if (lastContextLimit && lastContextLimit > 0) {
          setContextLimit(lastContextLimit);
        }
      }
    });
  }, [clearTransientState, conversation_id]);

  const resetState = useCallback(() => {
    setRunning(false);
    runningRef.current = false;
    setAiProcessing(false);
    aiProcessingRef.current = false;
    setThought({ subject: '', description: '' });
    setRunTrace(null);
    setRuntimePlanEntries([]);
    hasContentInTurnRef.current = false;
    clearTransientState();
  }, [clearTransientState]);

  return {
    thought,
    setThought,
    running,
    acpStatus,
    aiProcessing,
    canSteerPendingMessage: (running || aiProcessing) && sawToolActivityInTurn && !hasActiveToolCalls,
    setAiProcessing,
    resetState,
    tokenUsage,
    contextLimit,
    runTrace,
    runtimePlanEntries,
    beginRun,
  };
};
