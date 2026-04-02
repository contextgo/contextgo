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
import type { ThoughtData } from '@/renderer/components/chat/ThoughtDisplay';
import { useAddOrUpdateMessage } from '@/renderer/pages/conversation/Messages/hooks';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type UseAcpMessageReturn = {
  thought: ThoughtData;
  setThought: React.Dispatch<React.SetStateAction<ThoughtData>>;
  running: boolean;
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

const buildRunTaskText = (input: string, files: string[] = []): string => {
  const normalizedInput = input.trim();
  const normalizedFiles = [...new Set(files.filter(Boolean))];

  if (normalizedFiles.length === 0) {
    return normalizedInput;
  }

  const fileSection = ['[Files]', ...normalizedFiles.map((file) => `- ${file}`)].join('\n');
  return normalizedInput ? `${normalizedInput}\n\n${fileSection}` : fileSection;
};

const mergeThoughtText = (previous: string, incoming: string): string => {
  const next = incoming.trim();
  if (!next) {
    return previous;
  }

  if (!previous) {
    return incoming;
  }

  if (incoming.startsWith(previous)) {
    return incoming;
  }

  if (previous.endsWith(incoming)) {
    return previous;
  }

  return `${previous}${incoming}`;
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
});

export const useAcpMessage = (conversation_id: string): UseAcpMessageReturn => {
  const addOrUpdateMessage = useAddOrUpdateMessage();
  const [running, setRunning] = useState(false);
  const [thought, setThought] = useState<ThoughtData>({ description: '', subject: '' });
  const [runTrace, setRunTrace] = useState<AgentRunTrace | null>(null);
  const [acpStatus, setAcpStatus] = useState<
    'connecting' | 'connected' | 'authenticated' | 'session_active' | 'disconnected' | 'error' | null
  >(null);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [hasActiveToolCalls, setHasActiveToolCalls] = useState(false);
  const [sawToolActivityInTurn, setSawToolActivityInTurn] = useState(false);
  const [tokenUsage, setTokenUsage] = useState<TokenUsageData | null>(null);
  const [contextLimit, setContextLimit] = useState<number>(0);

  const runningRef = useRef(running);
  const aiProcessingRef = useRef(aiProcessing);
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
          const mergedThoughtText = mergeThoughtText(
            thoughtTextRef.current,
            incomingThought.description || incomingThought.subject || ''
          );
          thoughtTextRef.current = mergedThoughtText;

          const nextThought = {
            subject: extractThoughtSubject(mergedThoughtText),
            description: mergedThoughtText,
          };

          throttledSetThought(nextThought);
          setRunTrace((current) => ({
            ...(current || createBaseRunTrace(pendingTaskRef.current)),
            rawTask: current?.rawTask || pendingTaskRef.current,
            phase: 'reasoning',
            liveThoughtText: mergedThoughtText,
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
    setThought({ subject: '', description: '' });
    setAcpStatus(null);
    setTokenUsage(null);
    setContextLimit(0);
    setRunTrace(null);
    hasContentInTurnRef.current = false;
    pendingTaskRef.current = '';
    thoughtTextRef.current = '';

    void ipcBridge.conversation.get.invoke({ id: conversation_id }).then((res) => {
      if (!res) {
        setRunning(false);
        runningRef.current = false;
        setAiProcessing(false);
        aiProcessingRef.current = false;
        clearTransientState();
        return;
      }

      const isRunning = res.status === 'running';
      setRunning(isRunning);
      runningRef.current = isRunning;
      setAiProcessing(isRunning);
      aiProcessingRef.current = isRunning;
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
    beginRun,
  };
};
