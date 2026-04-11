/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  extensions,
  type IExtensionAgentActivityItem,
  type IExtensionAgentActivitySnapshot,
  type IExtensionSystemRunItem,
} from '@/common/adapter/ipcBridge';
import { useEffect, useMemo, useState } from 'react';

export type ContextEngineActivityStatus = 'checking' | 'active' | 'idle' | 'error';

type ActivitySnapshotCache = {
  at: number;
  snapshot: IExtensionAgentActivitySnapshot | null;
};

const ACTIVITY_SNAPSHOT_CACHE_TTL_MS = 4000;

let activitySnapshotCache: ActivitySnapshotCache | null = null;

export function collectMaintenanceAgents(
  snapshot?: IExtensionAgentActivitySnapshot | null
): IExtensionAgentActivityItem[] {
  return (snapshot?.agents ?? []).filter(
    agent => agent.runType === 'maintenance' || agent.systemManaged === true || agent.backend === 'context-engine'
  );
}

export function collectSystemRuns(snapshot?: IExtensionAgentActivitySnapshot | null): IExtensionSystemRunItem[] {
  return [...(snapshot?.systemRuns ?? [])].sort((left, right) => right.lastActiveAt - left.lastActiveAt);
}

export function resolveContextEngineActivityStatus(
  agents: readonly IExtensionAgentActivityItem[],
  systemRuns: readonly IExtensionSystemRunItem[] = []
): ContextEngineActivityStatus {
  return agents.some(
    agent => agent.activeConversations > 0 || agent.runtimeStatus === 'running' || agent.runtimeStatus === 'pending'
  ) || systemRuns.some(run => run.runtimeStatus === 'running' || run.runtimeStatus === 'pending')
    ? 'active'
    : 'idle';
}

function readCachedSnapshot(): IExtensionAgentActivitySnapshot | null {
  return activitySnapshotCache?.snapshot ?? null;
}

export type UseContextEngineActivityResult = {
  activeMaintenanceCount: number;
  maintenanceAgents: IExtensionAgentActivityItem[];
  systemRuns: IExtensionSystemRunItem[];
  status: ContextEngineActivityStatus;
  lastCheckedAt: number | null;
};

export function useContextEngineActivity(): UseContextEngineActivityResult {
  const initialSnapshot = readCachedSnapshot();
  const initialMaintenanceAgents = collectMaintenanceAgents(initialSnapshot);
  const initialSystemRuns = collectSystemRuns(initialSnapshot);
  const initialLastCheckedAt = initialSnapshot?.generatedAt ?? activitySnapshotCache?.at ?? null;
  const [maintenanceAgents, setMaintenanceAgents] = useState<IExtensionAgentActivityItem[]>(initialMaintenanceAgents);
  const [systemRuns, setSystemRuns] = useState<IExtensionSystemRunItem[]>(initialSystemRuns);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(initialLastCheckedAt);
  const [status, setStatus] = useState<ContextEngineActivityStatus>(
    activitySnapshotCache ? resolveContextEngineActivityStatus(initialMaintenanceAgents, initialSystemRuns) : 'checking'
  );

  useEffect(() => {
    let alive = true;

    const applySnapshot = (snapshot: IExtensionAgentActivitySnapshot | null) => {
      const nextMaintenanceAgents = collectMaintenanceAgents(snapshot);
      const nextSystemRuns = collectSystemRuns(snapshot);
      setMaintenanceAgents(nextMaintenanceAgents);
      setSystemRuns(nextSystemRuns);
      setLastCheckedAt(snapshot?.generatedAt ?? null);
      setStatus(resolveContextEngineActivityStatus(nextMaintenanceAgents, nextSystemRuns));
    };

    const loadActivitySnapshot = async (forceRefresh = false) => {
      const now = Date.now();
      if (!forceRefresh && activitySnapshotCache && now - activitySnapshotCache.at < ACTIVITY_SNAPSHOT_CACHE_TTL_MS) {
        if (!alive) {
          return;
        }
        applySnapshot(activitySnapshotCache.snapshot);
        return;
      }

      setStatus('checking');

      try {
        const snapshot = await extensions.getAgentActivitySnapshot.invoke();
        if (!alive) {
          return;
        }
        activitySnapshotCache = { snapshot, at: Date.now() };
        applySnapshot(snapshot);
      } catch {
        if (!alive) {
          return;
        }
        setMaintenanceAgents([]);
        setSystemRuns([]);
        setLastCheckedAt(activitySnapshotCache?.snapshot?.generatedAt ?? activitySnapshotCache?.at ?? null);
        setStatus('error');
      }
    };

    void loadActivitySnapshot();

    const handleFocus = () => {
      void loadActivitySnapshot(true);
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      alive = false;
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const activeMaintenanceCount = useMemo(
    () => maintenanceAgents.reduce((sum, agent) => sum + agent.activeConversations, 0),
    [maintenanceAgents]
  );

  return {
    activeMaintenanceCount,
    maintenanceAgents,
    systemRuns,
    status,
    lastCheckedAt,
  };
}
