import { Alert, Button, Message, Space, Tag } from '@arco-design/web-react';
import React, { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { acpConversation, shell } from '@/common/adapter/ipcBridge';
import {
  ACP_BACKENDS_ALL,
  isManagedRuntimeInstallableBackend,
  type AcpBackend,
  type ManagedRuntimeInstallEvent,
} from '@/common/types/acpTypes';
import type { ExternalSessionProvider, ExternalSessionSummary } from '@/common/types/externalSessions';
import { useFilePreviewOpener } from '@/renderer/hooks/file/useFilePreviewOpener';
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
  configPath: string;
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
const CONFIGURABLE_RUNTIME_BACKENDS = new Set<ManagedRuntimeBackend>(['gemini', 'claude', 'codex', 'openclaw-gateway']);

const RUNTIME_META: Record<ManagedRuntimeBackend, RuntimeMeta> = {
  gemini: {
    backend: 'gemini',
    docsUrl: 'https://github.com/google-gemini/gemini-cli',
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
    docsUrl: 'https://github.com/openai/codex',
    sessionProvider: 'codex',
    descriptionKey: 'settings.runtimeManager.runtime.codex.description',
    descriptionDefault: 'OpenAI Codex CLI runtime for local coding sessions.',
  },
  opencode: {
    backend: 'opencode',
    docsUrl: 'https://opencode.ai',
    sessionProvider: 'opencode',
    descriptionKey: 'settings.runtimeManager.runtime.opencode.description',
    descriptionDefault: 'OpenCode CLI runtime.',
  },
  'openclaw-gateway': {
    backend: 'openclaw-gateway',
    docsUrl: 'https://github.com/openclaw/openclaw',
    sessionProvider: 'openclaw-gateway',
    descriptionKey: 'settings.runtimeManager.runtime.openclaw-gateway.description',
    descriptionDefault: 'OpenClaw gateway runtime.',
  },
  nanobot: {
    backend: 'nanobot',
    docsUrl: 'https://github.com/HKUDS/nanobot',
    descriptionKey: 'settings.runtimeManager.runtime.nanobot.description',
    descriptionDefault: 'Nanobot CLI runtime.',
  },
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

const CustomAcpAgent: React.FC = () => {
  const { t } = useTranslation();
  const [message, messageContext] = Message.useMessage({ maxCount: 8 });
  const { openFilePreview } = useFilePreviewOpener();

  const [availableAgents, setAvailableAgents] = useState<AvailableRuntimeAgent[]>([]);
  const [externalSessions, setExternalSessions] = useState<ExternalSessionSummary[]>([]);
  const [healthState, setHealthState] = useState<Partial<Record<ManagedRuntimeBackend, RuntimeHealthState>>>({});
  const [installState, setInstallState] = useState<Partial<Record<ManagedRuntimeBackend, RuntimeInstallState>>>({});
  const [loading, setLoading] = useState(false);
  const [installingBackend, setInstallingBackend] = useState<ManagedRuntimeBackend | null>(null);
  const [configActionState, setConfigActionState] = useState<Partial<Record<ManagedRuntimeBackend, 'open' | 'reveal'>>>(
    {}
  );
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
      const [agentsResponse, sessionsResponse] = await Promise.all([
        acpConversation.getAvailableAgents.invoke(),
        acpConversation.listExternalSessions.invoke({}),
      ]);

      if (requestSeqRef.current === requestId) {
        setAvailableAgents(agentsResponse.success && agentsResponse.data ? agentsResponse.data : []);
        setExternalSessions(
          sessionsResponse.success && sessionsResponse.data?.sessions ? sessionsResponse.data.sessions : []
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

  useEffect(() => {
    void loadRuntimeState();
  }, []);

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
      .sort((left, right) => {
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

      if (!result.data) {
        return null;
      }

      return {
        configPath: result.data.configPath,
      };
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
        if (!configLocation?.configPath) {
          throw new Error(
            t('settings.runtimeManager.openConfigFailed', {
              defaultValue: 'Failed to open the runtime config location.',
            })
          );
        }

        const opened = await openFilePreview({ path: configLocation.configPath });
        if (!opened) {
          await shell.openFile.invoke(configLocation.configPath);
        }
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
    [getRuntimeConfigLocation, message, openFilePreview, t]
  );

  const handleRevealConfigPath = useCallback(
    async (backend: ManagedRuntimeBackend) => {
      setConfigActionState((current) => ({
        ...current,
        [backend]: 'reveal',
      }));

      try {
        const configLocation = await getRuntimeConfigLocation(backend);
        if (!configLocation?.configPath) {
          throw new Error(
            t('settings.runtimeManager.revealPathFailed', {
              defaultValue: 'Failed to open the path in the system file manager.',
            })
          );
        }

        await shell.revealPath.invoke(configLocation.configPath);
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
          <div className='flex flex-wrap items-start justify-between gap-8px'>
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

            <Space wrap>
              {showInstallAction ? (
                <Button
                  type='primary'
                  shape='round'
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
                  onClick={() => void handleOpenDocs(meta.docsUrl)}
                >
                  {t('settings.runtimeManager.openGuide', {
                    defaultValue: 'Official page',
                  })}
                </Button>
              ) : null}
            </Space>
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
                <Tag color={installProgress.stage === 'failed' ? 'red' : installProgress.stage === 'completed' ? 'green' : 'arcoblue'}>
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

      <div className='space-y-18px rounded-24px border border-border-2 bg-[color:color-mix(in_srgb,var(--color-bg-1)_90%,transparent)] px-16px py-18px shadow-[0_18px_44px_rgba(15,23,42,0.05)] md:px-[28px]'>
        <div className='flex items-start justify-between gap-16px flex-wrap'>
          <div>
            <div className='text-20px text-t-primary font-600 leading-28px'>
              {t('settings.runtimeManager.title', {
                defaultValue: 'Runtime Management',
              })}
            </div>
          </div>

          <Button type='outline' shape='round' onClick={() => void refreshRuntimeState()} loading={loading}>
            {t('settings.runtimeManager.refresh', {
              defaultValue: 'Refresh status',
            })}
          </Button>
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
