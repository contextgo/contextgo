/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { IContextSchedule } from '@/common/adapter/ipcBridge';
import { emitter } from '@/renderer/utils/emitter';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type ScheduleStatus = 'none' | 'active' | 'paused' | 'error' | 'unread';

type ScheduleActionsResult = {
  pauseJob: (scheduleId: string) => Promise<void>;
  resumeJob: (scheduleId: string) => Promise<void>;
  runJobNow: (scheduleId: string) => Promise<IContextSchedule>;
  deleteJob: (scheduleId: string) => Promise<void>;
  updateJob: (scheduleId: string, updates: Partial<IContextSchedule>) => Promise<IContextSchedule>;
};

type ScheduleEventHandlers = {
  onScheduleCreated: (schedule: IContextSchedule) => void;
  onScheduleUpdated: (schedule: IContextSchedule) => void;
  onScheduleRemoved: (data: { scheduleId: string }) => void;
};

function getConversationId(schedule: IContextSchedule): string | undefined {
  return (
    schedule.scope.conversationId ??
    (schedule.target.kind === 'send_query' ? schedule.target.conversationId : undefined)
  );
}

function useScheduleActions(
  onScheduleUpdated?: (scheduleId: string, schedule: IContextSchedule) => void,
  onScheduleDeleted?: (scheduleId: string) => void
): ScheduleActionsResult {
  const pauseJob = useCallback(
    async (scheduleId: string) => {
      const updated = await ipcBridge.schedule.updateSchedule.invoke({ scheduleId, updates: { enabled: false } });
      onScheduleUpdated?.(scheduleId, updated);
    },
    [onScheduleUpdated]
  );

  const resumeJob = useCallback(
    async (scheduleId: string) => {
      const updated = await ipcBridge.schedule.updateSchedule.invoke({ scheduleId, updates: { enabled: true } });
      onScheduleUpdated?.(scheduleId, updated);
    },
    [onScheduleUpdated]
  );

  const deleteJob = useCallback(
    async (scheduleId: string) => {
      await ipcBridge.schedule.removeSchedule.invoke({ scheduleId });
      onScheduleDeleted?.(scheduleId);
    },
    [onScheduleDeleted]
  );

  const runJobNow = useCallback(
    async (scheduleId: string) => {
      const updated = await ipcBridge.schedule.runScheduleNow.invoke({ scheduleId });
      onScheduleUpdated?.(scheduleId, updated);
      return updated;
    },
    [onScheduleUpdated]
  );

  const updateJob = useCallback(
    async (scheduleId: string, updates: Partial<IContextSchedule>) => {
      const updated = await ipcBridge.schedule.updateSchedule.invoke({ scheduleId, updates });
      onScheduleUpdated?.(scheduleId, updated);
      return updated;
    },
    [onScheduleUpdated]
  );

  return { pauseJob, resumeJob, runJobNow, deleteJob, updateJob };
}

function useScheduleSubscription(handlers: ScheduleEventHandlers) {
  useEffect(() => {
    const unsubCreate = ipcBridge.schedule.onScheduleCreated.on(handlers.onScheduleCreated);
    const unsubUpdate = ipcBridge.schedule.onScheduleUpdated.on(handlers.onScheduleUpdated);
    const unsubRemove = ipcBridge.schedule.onScheduleRemoved.on(handlers.onScheduleRemoved);

    return () => {
      unsubCreate();
      unsubUpdate();
      unsubRemove();
    };
  }, [handlers.onScheduleCreated, handlers.onScheduleRemoved, handlers.onScheduleUpdated]);
}

export function useScheduleJobs(conversationId?: string) {
  const [jobs, setJobs] = useState<IContextSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchJobs = useCallback(async () => {
    if (!conversationId) {
      setJobs([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await ipcBridge.schedule.listConversationSchedules.invoke({ conversationId });
      setJobs(result || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch schedules'));
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  const eventHandlers = useMemo<ScheduleEventHandlers>(
    () => ({
      onScheduleCreated: (schedule) => {
        if (getConversationId(schedule) === conversationId) {
          setJobs((prev) => (prev.some((item) => item.id === schedule.id) ? prev : [...prev, schedule]));
        }
      },
      onScheduleUpdated: (schedule) => {
        if (getConversationId(schedule) === conversationId) {
          setJobs((prev) => prev.map((item) => (item.id === schedule.id ? schedule : item)));
        }
      },
      onScheduleRemoved: ({ scheduleId }) => {
        setJobs((prev) => prev.filter((item) => item.id !== scheduleId));
      },
    }),
    [conversationId]
  );

  useScheduleSubscription(eventHandlers);

  const actions = useScheduleActions();

  return {
    jobs,
    loading,
    error,
    hasJobs: jobs.length > 0,
    activeJobsCount: jobs.filter((job) => job.enabled).length,
    hasError: jobs.some((job) => job.state.lastStatus === 'error'),
    refetch: fetchJobs,
    ...actions,
  };
}

export function useAllScheduleJobs() {
  const [jobs, setJobs] = useState<IContextSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const allJobs = await ipcBridge.schedule.listSchedules.invoke();
      setJobs(allJobs || []);
    } catch (err) {
      console.error('[useAllScheduleJobs] Failed to fetch schedules:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  const eventHandlers = useMemo<ScheduleEventHandlers>(
    () => ({
      onScheduleCreated: (schedule) => {
        setJobs((prev) => (prev.some((item) => item.id === schedule.id) ? prev : [...prev, schedule]));
      },
      onScheduleUpdated: (schedule) => {
        setJobs((prev) => prev.map((item) => (item.id === schedule.id ? schedule : item)));
      },
      onScheduleRemoved: ({ scheduleId }) => {
        setJobs((prev) => prev.filter((item) => item.id !== scheduleId));
      },
    }),
    []
  );

  useScheduleSubscription(eventHandlers);

  const handleScheduleUpdated = useCallback((scheduleId: string, schedule: IContextSchedule) => {
    setJobs((prev) => prev.map((item) => (item.id === scheduleId ? schedule : item)));
  }, []);

  const handleScheduleDeleted = useCallback((scheduleId: string) => {
    setJobs((prev) => prev.filter((item) => item.id !== scheduleId));
  }, []);

  const actions = useScheduleActions(handleScheduleUpdated, handleScheduleDeleted);

  return {
    jobs,
    loading,
    refetch: fetchJobs,
    ...actions,
  };
}

export function useScheduleJobsMap() {
  const [jobsMap, setJobsMap] = useState<Map<string, IContextSchedule[]>>(new Map());
  const [unreadConversations, setUnreadConversations] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const activeConversationIdRef = useRef<string | null>(null);
  const lastRunAtMapRef = useRef<Map<string, number>>(new Map());

  const fetchAllJobs = useCallback(async () => {
    setLoading(true);
    try {
      const allJobs = await ipcBridge.schedule.listSchedules.invoke();
      const map = new Map<string, IContextSchedule[]>();

      lastRunAtMapRef.current.clear();

      for (const job of allJobs || []) {
        const conversationId = getConversationId(job);
        if (!conversationId) {
          continue;
        }

        if (!map.has(conversationId)) {
          map.set(conversationId, []);
        }
        map.get(conversationId)?.push(job);

        if (job.state.lastRunAtMs) {
          lastRunAtMapRef.current.set(job.id, job.state.lastRunAtMs);
        }
      }

      setJobsMap(map);
    } catch (err) {
      console.error('[useScheduleJobsMap] Failed to fetch schedules:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAllJobs();
  }, [fetchAllJobs]);

  const eventHandlers = useMemo<ScheduleEventHandlers>(
    () => ({
      onScheduleCreated: (schedule) => {
        const conversationId = getConversationId(schedule);
        if (!conversationId) {
          return;
        }

        setJobsMap((prev) => {
          const existing = prev.get(conversationId) || [];
          if (existing.some((item) => item.id === schedule.id)) {
            return prev;
          }

          const next = new Map(prev);
          next.set(conversationId, [...existing, schedule]);
          return next;
        });
        emitter.emit('chat.history.refresh');
      },
      onScheduleUpdated: (schedule) => {
        const conversationId = getConversationId(schedule);
        if (!conversationId) {
          return;
        }

        const prevLastRunAt = lastRunAtMapRef.current.get(schedule.id);
        const nextLastRunAt = schedule.state.lastRunAtMs;
        if (nextLastRunAt && nextLastRunAt !== prevLastRunAt) {
          lastRunAtMapRef.current.set(schedule.id, nextLastRunAt);

          if (activeConversationIdRef.current !== conversationId) {
            setUnreadConversations((prev) => {
              if (prev.has(conversationId)) {
                return prev;
              }

              const next = new Set(prev);
              next.add(conversationId);
              return next;
            });
          }

          emitter.emit('chat.history.refresh');
        }

        setJobsMap((prev) => {
          const next = new Map(prev);
          const existing = next.get(conversationId) || [];
          if (existing.some((item) => item.id === schedule.id)) {
            next.set(
              conversationId,
              existing.map((item) => (item.id === schedule.id ? schedule : item))
            );
          } else {
            next.set(conversationId, [...existing, schedule]);
          }
          return next;
        });
      },
      onScheduleRemoved: ({ scheduleId }) => {
        setJobsMap((prev) => {
          const next = new Map(prev);
          for (const [conversationId, schedules] of next.entries()) {
            const filtered = schedules.filter((item) => item.id !== scheduleId);
            if (filtered.length === 0) {
              next.delete(conversationId);
            } else if (filtered.length !== schedules.length) {
              next.set(conversationId, filtered);
            }
          }
          return next;
        });
      },
    }),
    []
  );

  useScheduleSubscription(eventHandlers);

  const hasJobsForConversation = useCallback(
    (conversationId: string) => {
      return (jobsMap.get(conversationId)?.length ?? 0) > 0;
    },
    [jobsMap]
  );

  const getJobsForConversation = useCallback(
    (conversationId: string): IContextSchedule[] => {
      return jobsMap.get(conversationId) || [];
    },
    [jobsMap]
  );

  const getJobStatus = useCallback(
    (conversationId: string): ScheduleStatus => {
      const schedules = jobsMap.get(conversationId);
      if (!schedules || schedules.length === 0) {
        return 'none';
      }
      if (unreadConversations.has(conversationId)) {
        return 'unread';
      }
      if (schedules.some((item) => item.state.lastStatus === 'error')) {
        return 'error';
      }
      if (schedules.every((item) => !item.enabled)) {
        return 'paused';
      }
      return 'active';
    },
    [jobsMap, unreadConversations]
  );

  const markAsRead = useCallback((conversationId: string) => {
    activeConversationIdRef.current = conversationId;
    setUnreadConversations((prev) => {
      if (!prev.has(conversationId)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(conversationId);
      return next;
    });
  }, []);

  const setActiveConversation = useCallback((conversationId: string) => {
    activeConversationIdRef.current = conversationId;
  }, []);

  const hasUnread = useCallback(
    (conversationId: string) => {
      return unreadConversations.has(conversationId);
    },
    [unreadConversations]
  );

  return useMemo(
    () => ({
      jobsMap,
      loading,
      hasJobsForConversation,
      getJobsForConversation,
      getJobStatus,
      markAsRead,
      setActiveConversation,
      hasUnread,
      refetch: fetchAllJobs,
    }),
    [
      fetchAllJobs,
      getJobStatus,
      getJobsForConversation,
      hasJobsForConversation,
      hasUnread,
      jobsMap,
      loading,
      markAsRead,
      setActiveConversation,
    ]
  );
}

export default useScheduleJobs;
