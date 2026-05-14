import { Alert, Avatar, Button, Message, Select, Tag, type SelectProps } from '@arco-design/web-react';
import React, { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { acpConversation, cloud, mode, shell } from '@/common/adapter/ipcBridge';
import type { IProvider } from '@/common/config/storage';
import {
  ACP_BACKENDS_ALL,
  isManagedRuntimeInstallableBackend,
  type AcpBackend,
  type LocalTokenUsageReport,
  type LocalTokenUsageRuntimeReport,
  type LocalTokenUsageStatus,
  type ManagedRuntimeConfigEntry,
  type ManagedRuntimeInstallEvent,
  type ManagedRuntimeTokenGroup,
} from '@/common/types/acpTypes';
import type { ExternalSessionProvider, ExternalSessionSummary } from '@/common/types/externalSessions';
import type { CloudAuthProviderId, CloudStatus } from '@/common/types/cloud';
import RuntimeConfigDock from '@/renderer/pages/settings/components/RuntimeConfigDock';
import { SettingsSubModal } from '@/renderer/components/settings';
import { useLayoutContext } from '@/renderer/hooks/context/LayoutContext';
import { PRODUCT_VISIBLE_RUNTIME_BACKENDS } from '@/renderer/utils/model/availableAgents';
import { getAgentLogo } from '@/renderer/utils/model/agentLogo';

type ManagedRuntimeBackend = (typeof PRODUCT_VISIBLE_RUNTIME_BACKENDS)[number];

type RuntimeHealthState = {
  status: 'idle' | 'checking' | 'ready' | 'error';
  latency?: number;
  message?: string;
};

type RuntimeInstallState = {
  stage: ManagedRuntimeInstallEvent['stage'];
  command: string;
  log: string;
  message?: string;
  exitCode?: number | null;
};

type RuntimeConfigLocation = {
  entries: ManagedRuntimeConfigEntry[];
};

type LegacyRuntimeConfigLocation = {
  configPath?: string;
  exists?: boolean;
};

type AvailableRuntimeAgent = {
  backend: AcpBackend;
  name: string;
  cliPath?: string;
  resolvedCliPath?: string;
  runtimeSource?: 'builtin' | 'detected' | 'configured';
};

type RuntimeMeta = {
  backend: ManagedRuntimeBackend;
  docsUrl?: string;
  sessionProvider?: ExternalSessionProvider;
  descriptionKey: string;
  descriptionDefault: string;
};

type RuntimeCard = {
  backend: ManagedRuntimeBackend;
  meta: RuntimeMeta;
  backendConfig: (typeof ACP_BACKENDS_ALL)[ManagedRuntimeBackend];
  agent?: AvailableRuntimeAgent;
  detected: boolean;
  configuredOnly: boolean;
  effectiveCliPath: string;
  health: RuntimeHealthState;
  sessionCount: number | null;
  isMissing: boolean;
};

type RuntimeConfigDockState = {
  backend: ManagedRuntimeBackend;
  runtimeName: string;
  entries: ManagedRuntimeConfigEntry[];
};

const hasRuntimeAuthIssue = (message?: string): boolean => {
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();

  return [
    'auth',
    'login',
    'credential',
    'api key',
    'unauthorized',
    'forbidden',
    'not authenticated',
    '认证',
    '登录',
    '授權',
    '授权',
    '密钥',
  ].some((keyword) => normalized.includes(keyword));
};

const MANAGED_RUNTIME_BACKENDS: readonly ManagedRuntimeBackend[] = PRODUCT_VISIBLE_RUNTIME_BACKENDS;
const CONFIGURABLE_RUNTIME_BACKENDS = new Set<ManagedRuntimeBackend>(['gemini', 'claude', 'codex', 'opencode']);
const INFERMESH_MANAGED_PROVIDER_ID = 'infermesh-cloud-managed';
const DEFAULT_INFERMESH_TOKEN_GROUP: ManagedRuntimeTokenGroup = {
  name: 'default',
  displayName: 'default',
};

type RuntimeProtocol = 'openai' | 'anthropic' | 'gemini';

const RUNTIME_PROTOCOLS: Record<ManagedRuntimeBackend, RuntimeProtocol> = {
  gemini: 'gemini',
  claude: 'anthropic',
  codex: 'openai',
  opencode: 'openai',
};

const INFERMESH_SELECT_POPUP_Z_INDEX = 1105;
const INFERMESH_SELECT_TRIGGER_PROPS = {
  autoFitPosition: true,
  style: { zIndex: INFERMESH_SELECT_POPUP_Z_INDEX },
} satisfies SelectProps['triggerProps'];
const INFERMESH_MODEL_SELECT_TRIGGER_PROPS = {
  ...INFERMESH_SELECT_TRIGGER_PROPS,
  position: 'top',
} satisfies SelectProps['triggerProps'];
const INFERMESH_SELECT_MENU_STYLE = {
  maxHeight: 'min(360px, calc(100vh - 160px))',
} satisfies React.CSSProperties;

const getInfermeshSelectPopupContainer = (): HTMLElement => document.body;

const RUNTIME_GROUP_HINTS: Record<ManagedRuntimeBackend, readonly string[]> = {
  gemini: ['gemini'],
  claude: ['claude'],
  codex: ['openai-codex', 'codex', 'openai'],
  opencode: ['openai-codex', 'codex', 'openai'],
};

const RUNTIME_META: Record<ManagedRuntimeBackend, RuntimeMeta> = {
  gemini: {
    backend: 'gemini',
    docsUrl: 'https://geminicli.com/docs/get-started/installation/',
    sessionProvider: 'gemini',
    descriptionKey: 'settings.runtimeManager.runtime.gemini.description',
    descriptionDefault: 'Google Gemini CLI runtime.',
  },
  claude: {
    backend: 'claude',
    docsUrl: 'https://docs.anthropic.com/en/docs/claude-code/quickstart',
    sessionProvider: 'claude',
    descriptionKey: 'settings.runtimeManager.runtime.claude.description',
    descriptionDefault: 'Anthropic Claude Code CLI runtime.',
  },
  codex: {
    backend: 'codex',
    docsUrl: 'https://developers.openai.com/codex/cli',
    sessionProvider: 'codex',
    descriptionKey: 'settings.runtimeManager.runtime.codex.description',
    descriptionDefault: 'OpenAI Codex CLI runtime for local coding sessions.',
  },
  opencode: {
    backend: 'opencode',
    docsUrl: 'https://opencode.ai/docs/cli/',
    sessionProvider: 'opencode',
    descriptionKey: 'settings.runtimeManager.runtime.opencode.description',
    descriptionDefault: 'OpenCode CLI runtime.',
  },
};

const dedupePaths = (paths: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const path of paths) {
    const trimmed = path.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    result.push(trimmed);
  }

  return result;
};

const getPathDirectory = (filePath: string): string | null => {
  const trimmed = filePath.trim().replace(/[\\/]+$/, '');
  if (!trimmed) {
    return null;
  }

  const separatorIndex = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  if (separatorIndex < 0) {
    return null;
  }

  if (separatorIndex === 0) {
    return trimmed.slice(0, 1);
  }

  return trimmed.slice(0, separatorIndex);
};

const getRuntimeConfigPaths = (location: RuntimeConfigLocation | null): string[] =>
  dedupePaths(location?.entries?.map((entry) => entry.path) ?? []);

const normalizeRuntimeConfigLocation = (value: unknown): RuntimeConfigLocation | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const typedValue = value as { entries?: unknown } & LegacyRuntimeConfigLocation;
  if (Array.isArray(typedValue.entries)) {
    return {
      entries: typedValue.entries
        .filter((entry): entry is ManagedRuntimeConfigEntry => {
          if (!entry || typeof entry !== 'object') {
            return false;
          }

          const candidate = entry as Partial<ManagedRuntimeConfigEntry>;
          return typeof candidate.path === 'string';
        })
        .map((entry) => ({
          kind: entry.kind ?? 'other',
          path: entry.path,
          exists: entry.exists === true,
        })),
    };
  }

  if (typeof typedValue.configPath === 'string' && typedValue.configPath.trim()) {
    return {
      entries: [
        {
          kind: 'config',
          path: typedValue.configPath,
          exists: typedValue.exists === true,
        },
      ],
    };
  }

  return null;
};

const getRuntimeConfigRevealPath = (location: RuntimeConfigLocation | null): string | null => {
  const configPaths = getRuntimeConfigPaths(location);
  if (configPaths.length === 0) {
    return null;
  }

  const directories = dedupePaths(configPaths.map((path) => getPathDirectory(path) || '').filter(Boolean));
  if (directories.length === 1) {
    return directories[0] ?? null;
  }

  return configPaths[0] ?? null;
};

const inferModelProtocol = (provider: IProvider, modelName: string): RuntimeProtocol => {
  const explicit = provider.modelProtocols?.[modelName];
  if (explicit === 'openai' || explicit === 'anthropic' || explicit === 'gemini') {
    return explicit;
  }

  const normalized = modelName.toLowerCase();
  if (normalized.includes('claude') || normalized.includes('anthropic')) {
    return 'anthropic';
  }
  if (normalized.includes('gemini')) {
    return 'gemini';
  }
  return 'openai';
};

const getInfermeshModelsForRuntime = (provider: IProvider | null, backend: ManagedRuntimeBackend): string[] => {
  if (!provider) {
    return [];
  }

  const protocol = RUNTIME_PROTOCOLS[backend];
  return provider.model.filter((modelName) => inferModelProtocol(provider, modelName) === protocol);
};

const chooseInfermeshGroup = (
  groups: ManagedRuntimeTokenGroup[],
  backend: ManagedRuntimeBackend,
  currentGroup?: string
): string | undefined => {
  if (currentGroup && groups.some((group) => group.name === currentGroup)) {
    return currentGroup;
  }

  const hints = RUNTIME_GROUP_HINTS[backend];
  const hintedGroup = groups.find((group) => {
    const normalized = `${group.name} ${group.displayName}`.toLowerCase();
    return hints.some((hint) => normalized.includes(hint));
  });
  if (hintedGroup) {
    return hintedGroup.name;
  }

  return groups.find((group) => group.name === 'default')?.name ?? groups[0]?.name;
};

const ensureDefaultInfermeshTokenGroup = (groups: ManagedRuntimeTokenGroup[]): ManagedRuntimeTokenGroup[] => {
  if (groups.some((group) => group.name === DEFAULT_INFERMESH_TOKEN_GROUP.name)) {
    return groups;
  }

  return [DEFAULT_INFERMESH_TOKEN_GROUP, ...groups];
};

const getInstallStageLabel = (
  stage: ManagedRuntimeInstallEvent['stage'],
  t: ReturnType<typeof useTranslation>['t']
): string => {
  switch (stage) {
    case 'starting':
      return t('settings.runtimeManager.installStage.starting', {
        defaultValue: 'Preparing install',
      });
    case 'running':
      return t('settings.runtimeManager.installStage.running', {
        defaultValue: 'Installing',
      });
    case 'refreshing':
      return t('settings.runtimeManager.installStage.refreshing', {
        defaultValue: 'Refreshing detection',
      });
    case 'completed':
      return t('settings.runtimeManager.installStage.completed', {
        defaultValue: 'Install completed',
      });
    case 'failed':
      return t('settings.runtimeManager.installStage.failed', {
        defaultValue: 'Install failed',
      });
  }
};

const formatTokenCount = (value: number): string =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);

const formatCost = (value: number): string =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 10 ? 2 : 4,
  }).format(value);

const getLocalUsageStatusLabel = (status: LocalTokenUsageStatus, t: ReturnType<typeof useTranslation>['t']): string => {
  switch (status) {
    case 'ok':
      return t('settings.runtimeManager.localUsage.status.ok', {
        defaultValue: 'Available',
      });
    case 'empty':
      return t('settings.runtimeManager.localUsage.status.empty', {
        defaultValue: 'No local data',
      });
    case 'unsupported':
      return t('settings.runtimeManager.localUsage.status.unsupported', {
        defaultValue: 'Unsupported',
      });
    case 'error':
      return t('settings.runtimeManager.localUsage.status.error', {
        defaultValue: 'Read failed',
      });
  }
};

const getLocalUsageStatusColor = (status: LocalTokenUsageStatus): 'green' | 'gray' | 'orange' | 'red' => {
  switch (status) {
    case 'ok':
      return 'green';
    case 'empty':
      return 'gray';
    case 'unsupported':
      return 'orange';
    case 'error':
      return 'red';
  }
};

const renderLocalUsageMetric = (label: string, value: string) => (
  <div className='min-w-0 rounded-12px bg-fill-1 px-12px py-10px'>
    <div className='text-11px font-600 uppercase text-t-tertiary'>{label}</div>
    <div className='mt-4px truncate text-15px font-600 text-t-primary'>{value}</div>
  </div>
);

const CustomAcpAgent: React.FC = () => {
  const { t } = useTranslation();
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const [message, messageContext] = Message.useMessage({ maxCount: 8 });

  const [availableAgents, setAvailableAgents] = useState<AvailableRuntimeAgent[]>([]);
  const [externalSessions, setExternalSessions] = useState<ExternalSessionSummary[]>([]);
  const [healthState, setHealthState] = useState<Partial<Record<ManagedRuntimeBackend, RuntimeHealthState>>>({});
  const [installState, setInstallState] = useState<Partial<Record<ManagedRuntimeBackend, RuntimeInstallState>>>({});
  const [loading, setLoading] = useState(false);
  const [installingBackend, setInstallingBackend] = useState<ManagedRuntimeBackend | null>(null);
  const [configuringInfermeshBackend, setConfiguringInfermeshBackend] = useState<ManagedRuntimeBackend | null>(null);
  const [infermeshDialogBackend, setInfermeshDialogBackend] = useState<ManagedRuntimeBackend | null>(null);
  const [infermeshProvider, setInfermeshProvider] = useState<IProvider | null>(null);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus | null>(null);
  const [cloudLoading, setCloudLoading] = useState(true);
  const [authLoadingProvider, setAuthLoadingProvider] = useState<CloudAuthProviderId | null>(null);
  const [infermeshTokenGroups, setInfermeshTokenGroups] = useState<ManagedRuntimeTokenGroup[]>([]);
  const [infermeshTokenGroupsLoading, setInfermeshTokenGroupsLoading] = useState(false);
  const [syncingInfermeshProvider, setSyncingInfermeshProvider] = useState(false);
  const [selectedInfermeshGroup, setSelectedInfermeshGroup] = useState<string | undefined>(undefined);
  const [selectedInfermeshModels, setSelectedInfermeshModels] = useState<
    Partial<Record<ManagedRuntimeBackend, string>>
  >({});
  const [configActionState, setConfigActionState] = useState<Partial<Record<ManagedRuntimeBackend, 'open' | 'reveal'>>>(
    {}
  );
  const [runtimeConfigDock, setRuntimeConfigDock] = useState<RuntimeConfigDockState | null>(null);
  const [localUsageVisible, setLocalUsageVisible] = useState(false);
  const [localUsageLoading, setLocalUsageLoading] = useState(false);
  const [localUsageReport, setLocalUsageReport] = useState<LocalTokenUsageReport | null>(null);
  const loadingRef = useRef(false);
  const requestSeqRef = useRef(0);

  const loadRuntimeState = useEffectEvent(async () => {
    if (loadingRef.current) {
      return;
    }

    loadingRef.current = true;
    const requestId = requestSeqRef.current + 1;
    requestSeqRef.current = requestId;
    setLoading(true);

    try {
      const [agentsResponse, sessionsResponse, modelProviders] = await Promise.all([
        acpConversation.getAvailableAgents.invoke(),
        acpConversation.listExternalSessions.invoke({}),
        mode.getModelConfig.invoke().catch(() => [] as IProvider[]),
      ]);

      if (requestSeqRef.current === requestId) {
        setAvailableAgents(agentsResponse.success && agentsResponse.data ? agentsResponse.data : []);
        setExternalSessions(
          sessionsResponse.success && sessionsResponse.data?.sessions ? sessionsResponse.data.sessions : []
        );
        setInfermeshProvider(
          (Array.isArray(modelProviders) ? modelProviders : []).find(
            (provider) => provider.id === INFERMESH_MANAGED_PROVIDER_ID
          ) ?? null
        );
      }
    } catch (error) {
      console.error('[RuntimeSettings] Failed to load runtime state:', error);
      if (requestSeqRef.current === requestId) {
        message.error(
          t('settings.runtimeManager.loadFailed', {
            defaultValue: 'Failed to load runtime status.',
          })
        );
      }
    } finally {
      if (requestSeqRef.current === requestId) {
        setLoading(false);
      }
      loadingRef.current = false;
    }
  });

  const refreshRuntimeState = useEffectEvent(async () => {
    try {
      const refreshResult = await acpConversation.refreshDetectedAgents.invoke();
      if (!refreshResult.success) {
        throw new Error(
          refreshResult.msg ||
            t('settings.runtimeManager.refreshFailed', {
              defaultValue: 'Failed to refresh runtime detection.',
            })
        );
      }
    } catch (error) {
      console.error('[RuntimeSettings] Failed to refresh detected runtimes:', error);
      message.error(
        error instanceof Error
          ? error.message
          : t('settings.runtimeManager.refreshFailed', {
              defaultValue: 'Failed to refresh runtime detection.',
            })
      );
    }

    await loadRuntimeState();
  });

  const refreshCloudStatus = useCallback(async (): Promise<CloudStatus | null> => {
    setCloudLoading(true);
    try {
      const result = await cloud.getStatus.invoke();
      if (result.success && result.data) {
        setCloudStatus(result.data);
        return result.data;
      }
    } catch (error) {
      console.error('[RuntimeSettings] Failed to load cloud status:', error);
    } finally {
      setCloudLoading(false);
    }

    return null;
  }, []);

  useEffect(() => {
    void loadRuntimeState();
  }, []);

  useEffect(() => {
    void refreshCloudStatus();
    const unsubscribe = cloud.statusChanged.on((nextStatus) => {
      setCloudStatus(nextStatus);
      setCloudLoading(false);
      setAuthLoadingProvider(null);
    });

    return () => {
      unsubscribe();
    };
  }, [refreshCloudStatus]);

  useEffect(() => {
    const unsubscribe = acpConversation.managedRuntimeInstallEvent.on((event) => {
      if (!MANAGED_RUNTIME_BACKENDS.includes(event.backend as ManagedRuntimeBackend)) {
        return;
      }

      setInstallState((current) => {
        const backend = event.backend as ManagedRuntimeBackend;
        const previous = current[backend];
        const nextLog = `${previous?.log || ''}${event.chunk || ''}`;

        return {
          ...current,
          [backend]: {
            stage: event.stage,
            command: event.command,
            log: nextLog,
            message: event.message,
            exitCode: event.exitCode,
          },
        };
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const externalSessionCountByProvider = useMemo(() => {
    const map = new Map<ExternalSessionProvider, number>();
    for (const session of externalSessions) {
      map.set(session.provider, (map.get(session.provider) || 0) + 1);
    }
    return map;
  }, [externalSessions]);

  const availableAgentMap = useMemo(() => {
    const map = new Map<ManagedRuntimeBackend, AvailableRuntimeAgent>();
    for (const agent of availableAgents) {
      if (
        MANAGED_RUNTIME_BACKENDS.includes(agent.backend as ManagedRuntimeBackend) &&
        !map.has(agent.backend as ManagedRuntimeBackend)
      ) {
        map.set(agent.backend as ManagedRuntimeBackend, agent);
      }
    }
    return map;
  }, [availableAgents]);

  const runtimeCards = useMemo<RuntimeCard[]>(() => {
    return [...MANAGED_RUNTIME_BACKENDS]
      .map((backend) => {
        const agent = availableAgentMap.get(backend);
        const meta = RUNTIME_META[backend];
        const backendConfig = ACP_BACKENDS_ALL[backend];
        const detected = agent?.runtimeSource === 'detected' || agent?.runtimeSource === 'builtin';
        const configuredOnly = agent?.runtimeSource === 'configured';
        const isMissing = !agent;

        return {
          backend,
          meta,
          backendConfig,
          agent,
          detected,
          configuredOnly,
          effectiveCliPath: agent?.resolvedCliPath || agent?.cliPath || '',
          health: healthState[backend] || { status: 'idle' },
          sessionCount: meta.sessionProvider ? externalSessionCountByProvider.get(meta.sessionProvider) || 0 : null,
          isMissing,
        };
      })
      .toSorted((left, right) => {
        if (left.isMissing !== right.isMissing) {
          return left.isMissing ? 1 : -1;
        }
        if ((left.health.status === 'ready') !== (right.health.status === 'ready')) {
          return left.health.status === 'ready' ? -1 : 1;
        }
        if (left.detected !== right.detected) {
          return left.detected ? -1 : 1;
        }
        if (left.configuredOnly !== right.configuredOnly) {
          return left.configuredOnly ? -1 : 1;
        }
        return left.meta.backend.localeCompare(right.meta.backend);
      });
  }, [availableAgentMap, externalSessionCountByProvider, healthState]);

  const activeRuntimeCards = useMemo(() => runtimeCards.filter((card) => !card.isMissing), [runtimeCards]);
  const missingRuntimeCards = useMemo(() => runtimeCards.filter((card) => card.isMissing), [runtimeCards]);
  const canUseInfermeshCloud = cloudStatus?.authenticated === true && cloudStatus.deviceTokenAvailable === true;
  const cloudUserDisplayName = cloudStatus?.user?.displayName || cloudStatus?.user?.username || '';
  const infermeshDialogModels = useMemo(
    () => (infermeshDialogBackend ? getInfermeshModelsForRuntime(infermeshProvider, infermeshDialogBackend) : []),
    [infermeshDialogBackend, infermeshProvider]
  );
  const infermeshDialogSelectedModel = infermeshDialogBackend
    ? selectedInfermeshModels[infermeshDialogBackend] || infermeshDialogModels[0]
    : undefined;
  const infermeshDialogRuntimeName = infermeshDialogBackend ? ACP_BACKENDS_ALL[infermeshDialogBackend].name : '';
  const infermeshDialogProtocol = infermeshDialogBackend ? RUNTIME_PROTOCOLS[infermeshDialogBackend] : null;

  const getRuntimeConfigLocation = useCallback(
    async (backend: ManagedRuntimeBackend): Promise<RuntimeConfigLocation | null> => {
      const result = await acpConversation.getManagedRuntimeConfigLocation.invoke({ backend });
      if (!result.success) {
        throw new Error(
          result.msg ||
            t('settings.runtimeManager.openConfigFailed', {
              defaultValue: 'Failed to open the runtime config location.',
            })
        );
      }

      return normalizeRuntimeConfigLocation(result.data);
    },
    [t]
  );

  const handleOpenDocs = useCallback(async (url: string | undefined) => {
    if (!url) return;

    try {
      await shell.openExternal.invoke(url);
    } catch (error) {
      console.error('[RuntimeSettings] Failed to open runtime docs:', error);
    }
  }, []);

  const handleOpenConfig = useCallback(
    async (backend: ManagedRuntimeBackend) => {
      setConfigActionState((current) => ({
        ...current,
        [backend]: 'open',
      }));

      try {
        const configLocation = await getRuntimeConfigLocation(backend);
        const configPaths = getRuntimeConfigPaths(configLocation);
        if (configPaths.length === 0) {
          throw new Error(
            t('settings.runtimeManager.openConfigFailed', {
              defaultValue: 'Failed to open the runtime config location.',
            })
          );
        }

        setRuntimeConfigDock({
          backend,
          runtimeName: ACP_BACKENDS_ALL[backend].name,
          entries: configLocation?.entries ?? [],
        });
      } catch (error) {
        console.error('[RuntimeSettings] Failed to open runtime config:', error);
        message.error(
          error instanceof Error
            ? error.message
            : t('settings.runtimeManager.openConfigFailed', {
                defaultValue: 'Failed to open the runtime config location.',
              })
        );
      } finally {
        setConfigActionState((current) => {
          const next = { ...current };
          delete next[backend];
          return next;
        });
      }
    },
    [getRuntimeConfigLocation, message, t]
  );

  const handleRevealConfigPath = useCallback(
    async (backend: ManagedRuntimeBackend) => {
      setConfigActionState((current) => ({
        ...current,
        [backend]: 'reveal',
      }));

      try {
        const configLocation = await getRuntimeConfigLocation(backend);
        const revealPath = getRuntimeConfigRevealPath(configLocation);
        if (!revealPath) {
          throw new Error(
            t('settings.runtimeManager.revealPathFailed', {
              defaultValue: 'Failed to open the path in the system file manager.',
            })
          );
        }

        await shell.revealPath.invoke(revealPath);
      } catch (error) {
        console.error('[RuntimeSettings] Failed to reveal runtime config path:', error);
        message.error(
          error instanceof Error
            ? error.message
            : t('settings.runtimeManager.revealPathFailed', {
                defaultValue: 'Failed to open the path in the system file manager.',
              })
        );
      } finally {
        setConfigActionState((current) => {
          const next = { ...current };
          delete next[backend];
          return next;
        });
      }
    },
    [getRuntimeConfigLocation, message, t]
  );

  const handleInstallRuntime = useCallback(
    async (backend: ManagedRuntimeBackend) => {
      setInstallingBackend(backend);
      setInstallState((current) => ({
        ...current,
        [backend]: {
          stage: 'starting',
          command: '',
          log: '',
        },
      }));

      try {
        const result = await acpConversation.installManagedRuntime.invoke({ backend });
        if (!result.success || !result.data) {
          throw new Error(
            result.msg ||
              t('settings.runtimeManager.installFailed', {
                defaultValue: 'Failed to install this runtime.',
              })
          );
        }

        await loadRuntimeState();
        message.success(
          t('settings.runtimeManager.installSuccess', {
            defaultValue: 'Runtime installed. Detection status has been refreshed.',
          })
        );
      } catch (error) {
        console.error('[RuntimeSettings] Failed to install runtime:', error);
        message.error(error instanceof Error ? error.message : String(error));
      } finally {
        setInstallingBackend(null);
      }
    },
    [loadRuntimeState, message, t]
  );

  const loadInfermeshTokenGroups = useCallback(
    async (backend: ManagedRuntimeBackend, options?: { skipCloudGuard?: boolean }) => {
      if (!options?.skipCloudGuard && !canUseInfermeshCloud) {
        setInfermeshTokenGroups([]);
        setSelectedInfermeshGroup(undefined);
        return;
      }

      setInfermeshTokenGroupsLoading(true);
      try {
        const result = await acpConversation.listManagedRuntimeTokenGroups.invoke({ provider: 'infermesh' });
        if (!result.success || !result.data) {
          throw new Error(
            result.msg ||
              t('settings.runtimeManager.infermesh.groupLoadFailed', {
                defaultValue: 'Failed to load InferMesh token groups.',
              })
          );
        }

        const groups = ensureDefaultInfermeshTokenGroup(result.data.groups);
        setInfermeshTokenGroups(groups);
        setSelectedInfermeshGroup((current) => chooseInfermeshGroup(groups, backend, current));
      } catch (error) {
        console.error('[RuntimeSettings] Failed to load InferMesh token groups:', error);
        message.error(
          error instanceof Error
            ? error.message
            : t('settings.runtimeManager.infermesh.groupLoadFailed', {
                defaultValue: 'Failed to load InferMesh token groups.',
              })
        );
      } finally {
        setInfermeshTokenGroupsLoading(false);
      }
    },
    [canUseInfermeshCloud, message, t]
  );

  const handleCloudLogin = useCallback(
    async (provider: CloudAuthProviderId): Promise<void> => {
      setAuthLoadingProvider(provider);
      try {
        const result = await cloud.startLogin.invoke({ provider });
        if (!result.success || !result.data) {
          throw new Error(
            result.msg ||
              t('settings.cloud.actionFailed', {
                defaultValue: 'The cloud action could not be completed',
              })
          );
        }

        setCloudStatus(result.data);
        message.success(
          t('settings.cloud.loginSuccess', {
            defaultValue: 'Cloud account connected',
          })
        );
        if (infermeshDialogBackend && result.data.deviceTokenAvailable) {
          await loadInfermeshTokenGroups(infermeshDialogBackend, { skipCloudGuard: true });
        }
      } catch (error) {
        console.error('[RuntimeSettings] Cloud login failed:', error);
        const latestStatus = await refreshCloudStatus();
        if (latestStatus?.user) {
          message.success(
            t('settings.cloud.loginSuccess', {
              defaultValue: 'Cloud account connected',
            })
          );
          if (infermeshDialogBackend && latestStatus.deviceTokenAvailable) {
            await loadInfermeshTokenGroups(infermeshDialogBackend, { skipCloudGuard: true });
          }
          return;
        }

        message.error(
          error instanceof Error
            ? error.message
            : t('settings.cloud.actionFailed', {
                defaultValue: 'The cloud action could not be completed',
              })
        );
      } finally {
        setAuthLoadingProvider(null);
      }
    },
    [infermeshDialogBackend, loadInfermeshTokenGroups, message, refreshCloudStatus, t]
  );

  const handleSyncInfermeshProvider = useCallback(
    async (backend: ManagedRuntimeBackend): Promise<boolean> => {
      if (!canUseInfermeshCloud) {
        message.error(
          t('settings.runtimeManager.infermesh.cloudRequired', {
            defaultValue: 'Sign in to ContextGo Cloud before configuring InferMesh.',
          })
        );
        return false;
      }

      if (!selectedInfermeshGroup) {
        return false;
      }

      setSyncingInfermeshProvider(true);

      try {
        const result = await acpConversation.syncManagedRuntimeModelProvider.invoke({
          provider: 'infermesh',
          group: selectedInfermeshGroup,
        });

        if (!result.success || !result.data) {
          throw new Error(
            result.msg ||
              t('settings.runtimeManager.infermesh.syncFailed', {
                defaultValue: 'Failed to sync InferMesh token and models.',
              })
          );
        }

        await loadRuntimeState();
        message.success(
          t('settings.runtimeManager.infermesh.syncSuccess', {
            defaultValue: 'InferMesh token group synced. {{count}} models loaded.',
            count: result.data.modelCount,
          })
        );
        setSelectedInfermeshModels((current) => {
          const next = { ...current };
          delete next[backend];
          return next;
        });
        return true;
      } catch (error) {
        console.error('[RuntimeSettings] Failed to sync InferMesh provider:', error);
        message.error(
          error instanceof Error
            ? error.message
            : t('settings.runtimeManager.infermesh.syncFailed', {
                defaultValue: 'Failed to sync InferMesh token and models.',
              })
        );
        return false;
      } finally {
        setSyncingInfermeshProvider(false);
      }
    },
    [canUseInfermeshCloud, loadRuntimeState, message, selectedInfermeshGroup, t]
  );

  const handleConfigureInfermesh = useCallback(
    async (backend: ManagedRuntimeBackend, selectedModel?: string): Promise<boolean> => {
      setConfiguringInfermeshBackend(backend);

      try {
        const result = await acpConversation.configureManagedRuntimeModel.invoke({
          backend,
          provider: 'infermesh',
          model: selectedModel,
          group: selectedInfermeshGroup,
        });

        if (!result.success || !result.data) {
          throw new Error(
            result.msg ||
              t('settings.runtimeManager.infermesh.configureFailed', {
                defaultValue: 'Failed to configure InferMesh for this runtime.',
              })
          );
        }

        await loadRuntimeState();
        message.success(
          t('settings.runtimeManager.infermesh.configureSuccess', {
            defaultValue: 'InferMesh configured for {{runtime}} with {{model}}.',
            runtime: ACP_BACKENDS_ALL[backend].name,
            model: result.data.model,
          })
        );
        return true;
      } catch (error) {
        console.error('[RuntimeSettings] Failed to configure InferMesh runtime model:', error);
        message.error(
          error instanceof Error
            ? error.message
            : t('settings.runtimeManager.infermesh.configureFailed', {
                defaultValue: 'Failed to configure InferMesh for this runtime.',
              })
        );
        return false;
      } finally {
        setConfiguringInfermeshBackend(null);
      }
    },
    [loadRuntimeState, message, selectedInfermeshGroup, t]
  );

  const handleOpenInfermeshDialog = useCallback(
    (backend: ManagedRuntimeBackend) => {
      const models = getInfermeshModelsForRuntime(infermeshProvider, backend);
      setSelectedInfermeshModels((current) => ({
        ...current,
        [backend]: current[backend] || models[0],
      }));
      setSelectedInfermeshGroup((current) => chooseInfermeshGroup(infermeshTokenGroups, backend, current));
      setInfermeshDialogBackend(backend);
      if (canUseInfermeshCloud) {
        void loadInfermeshTokenGroups(backend);
        return;
      }

      void refreshCloudStatus().then((nextStatus) => {
        if (nextStatus?.authenticated && nextStatus.deviceTokenAvailable) {
          void loadInfermeshTokenGroups(backend, { skipCloudGuard: true });
        }
      });
    },
    [canUseInfermeshCloud, infermeshProvider, infermeshTokenGroups, loadInfermeshTokenGroups, refreshCloudStatus]
  );

  const loadLocalTokenUsage = useCallback(
    async (options?: { forceRefresh?: boolean }) => {
      setLocalUsageLoading(true);
      try {
        const result = await acpConversation.getLocalTokenUsage.invoke({
          forceRefresh: options?.forceRefresh === true,
        });
        if (!result.success || !result.data) {
          throw new Error(
            result.msg ||
              t('settings.runtimeManager.localUsage.loadFailed', {
                defaultValue: 'Failed to load local token usage.',
              })
          );
        }

        setLocalUsageReport(result.data);
      } catch (error) {
        console.error('[RuntimeSettings] Failed to load local token usage:', error);
        message.error(
          error instanceof Error
            ? error.message
            : t('settings.runtimeManager.localUsage.loadFailed', {
                defaultValue: 'Failed to load local token usage.',
              })
        );
      } finally {
        setLocalUsageLoading(false);
      }
    },
    [message, t]
  );

  const handleOpenLocalUsage = useCallback(() => {
    setLocalUsageVisible(true);
    void loadLocalTokenUsage();
  }, [loadLocalTokenUsage]);

  const handleConfirmInfermeshDialog = useCallback(async () => {
    if (!infermeshDialogBackend || !infermeshDialogSelectedModel) {
      return;
    }

    const success = await handleConfigureInfermesh(infermeshDialogBackend, infermeshDialogSelectedModel);
    if (success) {
      setInfermeshDialogBackend(null);
    }
  }, [handleConfigureInfermesh, infermeshDialogBackend, infermeshDialogSelectedModel]);

  const handleHealthCheck = useCallback(
    async (backend: ManagedRuntimeBackend) => {
      setHealthState((current) => ({
        ...current,
        [backend]: {
          status: 'checking',
        },
      }));

      try {
        const result = await acpConversation.checkAgentHealth.invoke({
          backend,
        });

        if (result.success && result.data?.available) {
          setHealthState((current) => ({
            ...current,
            [backend]: {
              status: 'ready',
              latency: result.data.latency,
              message: t('settings.runtimeManager.health.ready', {
                defaultValue: 'Runtime is ready.',
              }),
            },
          }));
          return;
        }

        const errorMessage =
          result.data?.error ||
          result.msg ||
          t('settings.runtimeManager.health.failed', {
            defaultValue: 'Runtime check failed.',
          });

        setHealthState((current) => ({
          ...current,
          [backend]: {
            status: 'error',
            message: errorMessage,
          },
        }));
      } catch (error) {
        setHealthState((current) => ({
          ...current,
          [backend]: {
            status: 'error',
            message:
              error instanceof Error
                ? error.message
                : t('settings.runtimeManager.health.failed', {
                    defaultValue: 'Runtime check failed.',
                  }),
          },
        }));
      }
    },
    [t]
  );

  const renderLocalUsageRuntime = (runtime: LocalTokenUsageRuntimeReport) => (
    <div key={runtime.backend} className='rounded-14px border border-border-2 bg-[var(--color-bg-1)] p-12px'>
      <div className='flex flex-wrap items-start justify-between gap-10px'>
        <div className='min-w-0'>
          <div className='flex flex-wrap items-center gap-8px'>
            <div className='text-14px font-600 text-t-primary'>{runtime.label}</div>
            <Tag color={getLocalUsageStatusColor(runtime.status)}>{getLocalUsageStatusLabel(runtime.status, t)}</Tag>
          </div>
          <div className='mt-4px break-all text-12px text-t-secondary'>
            {runtime.sourcePath ||
              t('settings.runtimeManager.localUsage.sourceUnavailable', {
                defaultValue: 'No local source path.',
              })}
          </div>
        </div>
        <div className='text-right text-12px text-t-secondary'>
          <div>{formatTokenCount(runtime.totals.totalTokens)}</div>
          <div>{formatCost(runtime.totals.totalCostUsd)}</div>
        </div>
      </div>

      {runtime.status === 'ok' || runtime.status === 'empty' ? (
        <div className='mt-10px grid grid-cols-2 gap-8px md:grid-cols-4'>
          {renderLocalUsageMetric(
            t('settings.runtimeManager.localUsage.inputTokens', {
              defaultValue: 'Input',
            }),
            formatTokenCount(runtime.totals.inputTokens)
          )}
          {renderLocalUsageMetric(
            t('settings.runtimeManager.localUsage.outputTokens', {
              defaultValue: 'Output',
            }),
            formatTokenCount(runtime.totals.outputTokens)
          )}
          {renderLocalUsageMetric(
            t('settings.runtimeManager.localUsage.cacheTokens', {
              defaultValue: 'Cache',
            }),
            formatTokenCount(
              runtime.totals.cacheCreationTokens + runtime.totals.cacheReadTokens + runtime.totals.cachedInputTokens
            )
          )}
          {renderLocalUsageMetric(
            t('settings.runtimeManager.localUsage.todayTokens', {
              defaultValue: 'Today',
            }),
            formatTokenCount(runtime.today.totalTokens)
          )}
        </div>
      ) : null}

      {runtime.error ? <div className='mt-10px text-12px leading-5 text-t-secondary'>{runtime.error}</div> : null}

      {runtime.days.length > 0 ? (
        <div className='mt-10px space-y-6px'>
          <div className='text-12px font-600 text-t-primary'>
            {t('settings.runtimeManager.localUsage.recentDays', {
              defaultValue: 'Recent days',
            })}
          </div>
          <div className='max-h-170px overflow-auto rounded-10px bg-fill-1'>
            {runtime.days.toReversed().map((day) => (
              <div
                key={`${runtime.backend}-${day.date}`}
                className='grid grid-cols-[96px_minmax(0,1fr)_auto] gap-8px border-b border-border-1 px-10px py-7px text-12px last:border-b-0'
              >
                <span className='text-t-secondary'>{day.date}</span>
                <span className='truncate text-t-primary'>
                  {day.modelsUsed.length > 0 ? day.modelsUsed.join(', ') : runtime.label}
                </span>
                <span className='font-mono text-t-primary'>{formatTokenCount(day.totals.totalTokens)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );

  const renderRuntimeCard = (card: RuntimeCard) => {
    const {
      backend,
      meta,
      backendConfig,
      detected,
      configuredOnly,
      effectiveCliPath,
      health,
      sessionCount,
      isMissing,
    } = card;
    const guideLogo = getAgentLogo(backend);
    const supportsConfig = CONFIGURABLE_RUNTIME_BACKENDS.has(backend);
    const configAction = configActionState[backend];
    const installProgress = installState[backend];
    const supportsManagedInstall = isManagedRuntimeInstallableBackend(backend);

    const statusText =
      health.status === 'ready'
        ? t('settings.runtimeManager.status.ready', {
            defaultValue: 'Ready',
          })
        : detected
          ? t('settings.runtimeManager.status.detected', {
              defaultValue: 'Detected',
            })
          : configuredOnly
            ? t('settings.runtimeManager.status.configured', {
                defaultValue: 'Configured',
              })
            : t('settings.runtimeManager.status.missing', {
                defaultValue: 'Not Installed',
              });
    const showInstallAction = isMissing && supportsManagedInstall;
    const showHealthAction = !isMissing;
    const emphasizeGuideAction = isMissing && !supportsManagedInstall && Boolean(meta.docsUrl);
    const showAuthRequiredTag =
      backendConfig.authRequired && health.status === 'error' && hasRuntimeAuthIssue(health.message);
    const pathSummary =
      effectiveCliPath ||
      t('settings.runtimeManager.pathUnavailable', {
        defaultValue: 'No path is being used yet.',
      });

    return (
      <div
        key={backend}
        data-testid={`runtime-card-${backend}`}
        className='rounded-18px border border-border-2 bg-[color:color-mix(in_srgb,var(--color-bg-1)_94%,transparent)] p-14px shadow-[0_10px_24px_rgba(15,23,42,0.04)]'
      >
        <div className='flex flex-col gap-10px'>
          <div className={isMobile ? 'flex flex-col gap-10px' : 'flex flex-wrap items-start justify-between gap-8px'}>
            <div className='min-w-0 flex-1'>
              <div className='flex flex-wrap items-center gap-8px'>
                <div className='app-icon-row min-w-0'>
                  {guideLogo ? (
                    <span className='app-icon-slot app-icon-slot--lg'>
                      <img src={guideLogo} alt='' aria-hidden='true' />
                    </span>
                  ) : null}
                  <div className='truncate text-15px font-600 text-t-primary'>{backendConfig.name}</div>
                </div>
                {sessionCount !== null ? (
                  <Tag color='gray'>
                    {t('settings.runtimeManager.externalSessionCount', {
                      defaultValue: 'Takeover sessions',
                    })}
                    {` ${sessionCount}`}
                  </Tag>
                ) : null}
                <Tag color={health.status === 'ready' || detected ? 'green' : configuredOnly ? 'orange' : 'gray'}>
                  {statusText}
                </Tag>
                {showAuthRequiredTag ? (
                  <Tag color='arcoblue'>
                    {t('settings.runtimeManager.status.authRequired', {
                      defaultValue: 'Needs Login',
                    })}
                  </Tag>
                ) : null}
                <Tag color={health.status === 'ready' ? 'green' : health.status === 'error' ? 'red' : 'gray'}>
                  {health.status === 'ready'
                    ? t('settings.runtimeManager.health.ready', { defaultValue: 'Usable' })
                    : health.status === 'error'
                      ? t('settings.runtimeManager.health.failed', { defaultValue: 'Failed' })
                      : health.status === 'checking'
                        ? t('settings.runtimeManager.health.checking', { defaultValue: 'Checking' })
                        : t('settings.runtimeManager.health.idle', { defaultValue: 'Unchecked' })}
                </Tag>
              </div>
            </div>

            <div
              data-testid={`runtime-card-actions-${backend}`}
              className={isMobile ? 'flex w-full flex-col gap-8px' : 'flex flex-wrap justify-end gap-8px'}
            >
              {showInstallAction ? (
                <Button
                  type='primary'
                  shape='round'
                  className={isMobile ? 'w-full justify-center' : undefined}
                  loading={installingBackend === backend}
                  onClick={() => void handleInstallRuntime(backend)}
                >
                  {t('settings.runtimeManager.installNow', {
                    defaultValue: 'Install locally',
                  })}
                </Button>
              ) : null}
              {showHealthAction ? (
                <Button
                  type={showInstallAction ? 'outline' : 'primary'}
                  shape='round'
                  className={isMobile ? 'w-full justify-center' : undefined}
                  loading={health.status === 'checking'}
                  onClick={() => void handleHealthCheck(backend)}
                >
                  {t('settings.runtimeManager.checkHealth', {
                    defaultValue: 'Check availability',
                  })}
                </Button>
              ) : null}
              {supportsConfig ? (
                <Button
                  type='outline'
                  shape='round'
                  className={isMobile ? 'w-full justify-center' : undefined}
                  loading={configuringInfermeshBackend === backend}
                  onClick={() => handleOpenInfermeshDialog(backend)}
                >
                  {t('settings.runtimeManager.infermesh.configure', {
                    defaultValue: 'Configure InferMesh',
                  })}
                </Button>
              ) : null}
              {supportsConfig ? (
                <Button
                  type='outline'
                  shape='round'
                  className={isMobile ? 'w-full justify-center' : undefined}
                  loading={configAction === 'open'}
                  onClick={() => void handleOpenConfig(backend)}
                >
                  {t('settings.runtimeManager.openConfig', {
                    defaultValue: 'Open config',
                  })}
                </Button>
              ) : null}
              {supportsConfig ? (
                <Button
                  type='outline'
                  shape='round'
                  className={isMobile ? 'w-full justify-center' : undefined}
                  loading={configAction === 'reveal'}
                  onClick={() => void handleRevealConfigPath(backend)}
                >
                  {t('settings.runtimeManager.revealPath', {
                    defaultValue: 'Reveal',
                  })}
                </Button>
              ) : null}
              {meta.docsUrl ? (
                <Button
                  type={emphasizeGuideAction ? 'primary' : 'outline'}
                  shape='round'
                  className={isMobile ? 'w-full justify-center' : undefined}
                  onClick={() => void handleOpenDocs(meta.docsUrl)}
                >
                  {t('settings.runtimeManager.openGuide', {
                    defaultValue: 'Official page',
                  })}
                </Button>
              ) : null}
            </div>
          </div>

          {!isMissing ? (
            <div className='space-y-8px rounded-14px bg-fill-1 px-12px py-10px'>
              <div className='text-12px leading-5 text-t-secondary'>
                {t('settings.runtimeManager.currentPath', {
                  defaultValue: 'Path in use',
                })}
                {': '}
                <span className='break-all font-mono text-t-primary'>{pathSummary}</span>
              </div>
            </div>
          ) : null}

          {installProgress ? (
            <div className='space-y-8px rounded-14px bg-fill-1 px-12px py-10px'>
              <div className='flex flex-wrap items-center justify-between gap-8px'>
                <div className='text-12px font-600 text-t-primary'>
                  {t('settings.runtimeManager.installProgressTitle', {
                    defaultValue: 'Install progress',
                  })}
                </div>
                <Tag
                  color={
                    installProgress.stage === 'failed'
                      ? 'red'
                      : installProgress.stage === 'completed'
                        ? 'green'
                        : 'arcoblue'
                  }
                >
                  {getInstallStageLabel(installProgress.stage, t)}
                </Tag>
              </div>

              {installProgress.command ? (
                <div className='text-12px leading-5 text-t-secondary'>
                  {t('settings.runtimeManager.installCommandLabel', {
                    defaultValue: 'Recommended install command',
                  })}
                  {': '}
                  <span className='break-all font-mono text-t-primary'>{installProgress.command}</span>
                </div>
              ) : null}

              {installProgress.message ? (
                <div className='text-12px leading-5 text-t-secondary'>{installProgress.message}</div>
              ) : null}

              {typeof installProgress.exitCode === 'number' ? (
                <div className='text-12px leading-5 text-t-secondary'>
                  {t('settings.runtimeManager.installExitCode', {
                    defaultValue: 'Exit code',
                  })}
                  {`: ${installProgress.exitCode}`}
                </div>
              ) : null}

              <pre className='max-h-220px overflow-auto whitespace-pre-wrap break-words rounded-12px bg-[var(--color-bg-1)] p-10px text-11px leading-5 text-t-secondary'>
                {installProgress.log ||
                  t('settings.runtimeManager.installWaitingLog', {
                    defaultValue: 'Waiting for installer output...',
                  })}
              </pre>
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className='space-y-16px'>
      {messageContext}
      {runtimeConfigDock ? (
        <RuntimeConfigDock
          runtimeName={runtimeConfigDock.runtimeName}
          entries={runtimeConfigDock.entries}
          onClose={() => setRuntimeConfigDock(null)}
        />
      ) : null}
      <div className='rounded-16px border border-border-2 bg-fill-1 px-16px py-14px'>
        <div className='flex flex-col gap-12px md:flex-row md:items-center md:justify-between'>
          <div className='flex min-w-0 items-center gap-12px'>
            <Avatar size={40}>
              {cloudStatus?.user?.avatarUrl ? (
                <img src={cloudStatus.user.avatarUrl} alt={cloudUserDisplayName} />
              ) : (
                (cloudUserDisplayName || 'C').slice(0, 1).toUpperCase()
              )}
            </Avatar>
            <div className='min-w-0'>
              <div className='flex flex-wrap items-center gap-8px'>
                <span className='text-14px font-600 text-t-primary'>
                  {cloudUserDisplayName ||
                    t('settings.cloud.title', {
                      defaultValue: 'ContextGo Account',
                    })}
                </span>
                {cloudStatus?.authenticated ? (
                  <Tag color='green'>
                    {t('settings.cloud.sessionActive', {
                      defaultValue: 'Browser session active',
                    })}
                  </Tag>
                ) : (
                  <Tag color='orange'>
                    {t('settings.cloud.sessionExpired', {
                      defaultValue: 'Browser session expired',
                    })}
                  </Tag>
                )}
                <Tag color={cloudStatus?.deviceTokenAvailable ? 'arcoblue' : 'gray'}>
                  {cloudStatus?.deviceTokenAvailable
                    ? t('settings.cloud.deviceLinked', {
                        defaultValue: 'Host linked',
                      })
                    : t('settings.cloud.deviceMissing', {
                        defaultValue: 'Host not linked',
                      })}
                </Tag>
              </div>
              <div className='mt-3px truncate text-12px text-t-secondary'>
                {cloudStatus?.user?.email ||
                  t('settings.runtimeManager.infermesh.cloudRequiredDesc', {
                    defaultValue:
                      'InferMesh runtime setup uses your ContextGo Cloud account to sync the managed token and load models.',
                  })}
              </div>
            </div>
          </div>
          <div className='flex flex-wrap gap-8px'>
            <Button size='small' type='secondary' loading={cloudLoading} onClick={() => void refreshCloudStatus()}>
              {t('common.refresh', {
                defaultValue: 'Refresh',
              })}
            </Button>
            {!canUseInfermeshCloud ? (
              <>
                <Button
                  size='small'
                  type='primary'
                  loading={authLoadingProvider === 'github'}
                  disabled={Boolean(authLoadingProvider)}
                  onClick={() => void handleCloudLogin('github')}
                >
                  {t('settings.cloud.loginWithGithub', {
                    defaultValue: 'Continue with GitHub',
                  })}
                </Button>
                <Button
                  size='small'
                  type='secondary'
                  loading={authLoadingProvider === 'google'}
                  disabled={Boolean(authLoadingProvider)}
                  onClick={() => void handleCloudLogin('google')}
                >
                  {t('settings.cloud.loginWithGoogle', {
                    defaultValue: 'Continue with Google',
                  })}
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </div>
      <SettingsSubModal
        visible={Boolean(infermeshDialogBackend)}
        onCancel={() => setInfermeshDialogBackend(null)}
        title={t('settings.runtimeManager.infermesh.configureTitle', {
          defaultValue: 'Configure InferMesh for {{runtime}}',
          runtime: infermeshDialogRuntimeName,
        })}
        onOk={() => void handleConfirmInfermeshDialog()}
        okText={t('settings.runtimeManager.infermesh.apply', {
          defaultValue: 'Apply',
        })}
        confirmLoading={Boolean(infermeshDialogBackend && configuringInfermeshBackend === infermeshDialogBackend)}
        okButtonProps={{
          disabled:
            !canUseInfermeshCloud ||
            infermeshDialogModels.length === 0 ||
            !infermeshDialogSelectedModel ||
            syncingInfermeshProvider,
        }}
        style={{ width: 'min(620px, calc(100vw - 32px))' }}
        contentStyle={{ padding: '12px 24px 24px' }}
      >
        {infermeshDialogBackend ? (
          <div className='flex flex-col gap-16px'>
            <div className='grid grid-cols-1 gap-10px rounded-12px bg-fill-1 p-12px md:grid-cols-3'>
              <div className='min-w-0'>
                <div className='text-11px font-600 uppercase text-t-tertiary'>
                  {t('settings.runtimeManager.infermesh.runtimeLabel', {
                    defaultValue: 'Runtime',
                  })}
                </div>
                <div className='mt-4px truncate text-13px font-600 text-t-primary'>{infermeshDialogRuntimeName}</div>
              </div>
              <div className='min-w-0'>
                <div className='text-11px font-600 uppercase text-t-tertiary'>
                  {t('settings.runtimeManager.infermesh.providerLabel', {
                    defaultValue: 'Provider',
                  })}
                </div>
                <div className='mt-4px truncate text-13px font-600 text-t-primary'>InferMesh</div>
              </div>
              <div className='min-w-0'>
                <div className='text-11px font-600 uppercase text-t-tertiary'>
                  {t('settings.runtimeManager.infermesh.protocolLabel', {
                    defaultValue: 'Protocol',
                  })}
                </div>
                <div className='mt-4px truncate text-13px font-600 text-t-primary'>
                  {infermeshDialogProtocol ?? '-'}
                </div>
              </div>
            </div>

            {!canUseInfermeshCloud ? (
              <Alert
                type='warning'
                content={t('settings.runtimeManager.infermesh.cloudRequired', {
                  defaultValue: 'Sign in to ContextGo Cloud before configuring InferMesh.',
                })}
              />
            ) : null}

            <div className='grid grid-cols-1 gap-10px md:grid-cols-[minmax(0,1fr)_auto]'>
              <div className='min-w-0'>
                <div className='mb-8px text-13px font-600 text-t-primary'>
                  {t('settings.runtimeManager.infermesh.groupLabel', {
                    defaultValue: 'Token group',
                  })}
                </div>
                <Select
                  showSearch
                  loading={infermeshTokenGroupsLoading}
                  placeholder={t('settings.runtimeManager.infermesh.groupPlaceholder', {
                    defaultValue: 'InferMesh token group',
                  })}
                  value={selectedInfermeshGroup}
                  disabled={!canUseInfermeshCloud || infermeshTokenGroupsLoading || syncingInfermeshProvider}
                  className='w-full'
                  getPopupContainer={getInfermeshSelectPopupContainer}
                  triggerProps={INFERMESH_SELECT_TRIGGER_PROPS}
                  dropdownMenuStyle={INFERMESH_SELECT_MENU_STYLE}
                  onChange={(value) => {
                    setSelectedInfermeshGroup(value);
                    setSelectedInfermeshModels((current) => {
                      const next = { ...current };
                      delete next[infermeshDialogBackend];
                      return next;
                    });
                  }}
                >
                  {infermeshTokenGroups.map((group) => (
                    <Select.Option key={group.name} value={group.name}>
                      {group.displayName === group.name ? group.name : `${group.displayName} (${group.name})`}
                    </Select.Option>
                  ))}
                </Select>
              </div>
              <div className='flex items-end'>
                <Button
                  className='w-full md:w-auto'
                  loading={syncingInfermeshProvider}
                  disabled={!canUseInfermeshCloud || !selectedInfermeshGroup || infermeshTokenGroupsLoading}
                  onClick={() => void handleSyncInfermeshProvider(infermeshDialogBackend)}
                >
                  {t('settings.runtimeManager.infermesh.syncModels', {
                    defaultValue: 'Sync token and models',
                  })}
                </Button>
              </div>
            </div>

            {infermeshDialogModels.length === 0 ? (
              <Alert
                type='warning'
                content={t('settings.runtimeManager.infermesh.noCompatibleModels', {
                  defaultValue: 'Choose a token group, then sync the managed token and model list.',
                })}
              />
            ) : null}

            <div>
              <div className='mb-8px text-13px font-600 text-t-primary'>
                {t('settings.runtimeManager.infermesh.modelLabel', {
                  defaultValue: 'Model',
                })}
              </div>
              <Select
                showSearch
                placeholder={t('settings.runtimeManager.infermesh.modelPlaceholder', {
                  defaultValue: 'InferMesh model',
                })}
                value={infermeshDialogSelectedModel}
                disabled={infermeshDialogModels.length === 0}
                className='w-full'
                getPopupContainer={getInfermeshSelectPopupContainer}
                triggerProps={INFERMESH_MODEL_SELECT_TRIGGER_PROPS}
                dropdownMenuStyle={INFERMESH_SELECT_MENU_STYLE}
                onChange={(value) =>
                  setSelectedInfermeshModels((current) => ({
                    ...current,
                    [infermeshDialogBackend]: value,
                  }))
                }
              >
                {infermeshDialogModels.map((modelName) => (
                  <Select.Option key={modelName} value={modelName}>
                    {modelName}
                  </Select.Option>
                ))}
              </Select>
            </div>
          </div>
        ) : null}
      </SettingsSubModal>
      <SettingsSubModal
        visible={localUsageVisible}
        onCancel={() => setLocalUsageVisible(false)}
        title={t('settings.runtimeManager.localUsage.title', {
          defaultValue: 'Local token usage',
        })}
        footer={null}
        style={{ width: 'min(820px, calc(100vw - 32px))' }}
        contentStyle={{ padding: '12px 24px 24px' }}
      >
        <div className='space-y-14px'>
          <div className='flex flex-wrap items-center justify-between gap-10px'>
            <div className='text-12px leading-5 text-t-secondary'>
              {t('settings.runtimeManager.localUsage.description', {
                defaultValue:
                  'Shows the latest archived local snapshot. Background refresh runs periodically; Refresh recalculates now. No cloud usage data is included.',
              })}
            </div>
            <Button
              size='small'
              type='secondary'
              loading={localUsageLoading}
              onClick={() => void loadLocalTokenUsage({ forceRefresh: true })}
            >
              {t('common.refresh', {
                defaultValue: 'Refresh',
              })}
            </Button>
          </div>

          {localUsageReport ? (
            <>
              <div className='grid grid-cols-2 gap-10px md:grid-cols-4'>
                {renderLocalUsageMetric(
                  t('settings.runtimeManager.localUsage.totalTokens', {
                    defaultValue: 'Total tokens',
                  }),
                  formatTokenCount(localUsageReport.totals.totalTokens)
                )}
                {renderLocalUsageMetric(
                  t('settings.runtimeManager.localUsage.todayTokens', {
                    defaultValue: 'Today',
                  }),
                  formatTokenCount(localUsageReport.today.totalTokens)
                )}
                {renderLocalUsageMetric(
                  t('settings.runtimeManager.localUsage.totalCost', {
                    defaultValue: 'Estimated cost',
                  }),
                  formatCost(localUsageReport.totals.totalCostUsd)
                )}
                {renderLocalUsageMetric(
                  t('settings.runtimeManager.localUsage.updatedAt', {
                    defaultValue: 'Updated',
                  }),
                  new Date(localUsageReport.generatedAt).toLocaleString()
                )}
              </div>

              <div className='space-y-10px'>{localUsageReport.runtimes.map(renderLocalUsageRuntime)}</div>
            </>
          ) : (
            <div className='rounded-12px bg-fill-1 px-12px py-18px text-center text-13px text-t-secondary'>
              {localUsageLoading
                ? t('settings.runtimeManager.localUsage.loading', {
                    defaultValue: 'Loading local usage...',
                  })
                : t('settings.runtimeManager.localUsage.empty', {
                    defaultValue: 'No local usage report has been loaded yet.',
                  })}
            </div>
          )}
        </div>
      </SettingsSubModal>

      <div className='space-y-18px rounded-24px border border-border-2 bg-[color:color-mix(in_srgb,var(--color-bg-1)_90%,transparent)] px-16px py-18px shadow-[0_18px_44px_rgba(15,23,42,0.05)] md:px-[28px]'>
        <div className={isMobile ? 'flex flex-col gap-12px' : 'flex items-start justify-between gap-16px flex-wrap'}>
          <div>
            <div className='text-20px text-t-primary font-600 leading-28px'>
              {t('settings.runtimeManager.title', {
                defaultValue: 'Runtime Management',
              })}
            </div>
          </div>

          <div
            data-testid='runtime-page-refresh-action'
            className={isMobile ? 'flex w-full flex-col gap-8px' : 'flex flex-wrap justify-end gap-8px'}
          >
            <Button
              type='outline'
              shape='round'
              className={isMobile ? 'w-full justify-center' : undefined}
              loading={localUsageLoading}
              onClick={handleOpenLocalUsage}
            >
              {t('settings.runtimeManager.localUsage.open', {
                defaultValue: 'Local token usage',
              })}
            </Button>
            <Button
              type='outline'
              shape='round'
              className={isMobile ? 'w-full justify-center' : undefined}
              onClick={() => void refreshRuntimeState()}
              loading={loading}
            >
              {t('settings.runtimeManager.refresh', {
                defaultValue: 'Refresh status',
              })}
            </Button>
          </div>
        </div>

        <div className='space-y-10px'>
          <div className='text-16px font-600 leading-6 text-t-primary'>
            {t('settings.runtimeManager.activeSectionTitle', {
              defaultValue: 'Detected or configured',
            })}
          </div>

          {activeRuntimeCards.length === 0 ? (
            <Alert
              type='warning'
              content={t('settings.runtimeManager.emptyActive', {
                defaultValue: 'No runtime has been detected or configured yet.',
              })}
            />
          ) : (
            <div className='grid grid-cols-1 gap-12px'>{activeRuntimeCards.map(renderRuntimeCard)}</div>
          )}
        </div>

        <div className='space-y-10px'>
          <div className='text-16px font-600 leading-6 text-t-primary'>
            {t('settings.runtimeManager.missingSectionTitle', {
              defaultValue: 'Not installed yet',
            })}
          </div>

          {missingRuntimeCards.length === 0 ? (
            <Alert
              type='success'
              content={t('settings.runtimeManager.emptyMissing', {
                defaultValue: 'All built-in managed runtimes are already detected or manually configured.',
              })}
            />
          ) : (
            <div className='grid grid-cols-1 gap-12px'>{missingRuntimeCards.map(renderRuntimeCard)}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomAcpAgent;
