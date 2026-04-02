import { Alert, Button, Message, Space, Tag } from '@arco-design/web-react';
import React, { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { acpConversation, shell } from '@/common/adapter/ipcBridge';
import { ACP_BACKENDS_ALL, type AcpBackend } from '@/common/types/acpTypes';
import type { ExternalSessionProvider, ExternalSessionSummary } from '@/common/types/externalSessions';
import { PRODUCT_VISIBLE_RUNTIME_BACKENDS } from '@/renderer/utils/model/availableAgents';
import { getAgentLogo } from '@/renderer/utils/model/agentLogo';

type ManagedRuntimeBackend = (typeof PRODUCT_VISIBLE_RUNTIME_BACKENDS)[number];

type RuntimeHealthState = {
  status: 'idle' | 'checking' | 'ready' | 'error';
  latency?: number;
  message?: string;
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
  installCommand?: string;
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

const RUNTIME_META: Record<ManagedRuntimeBackend, RuntimeMeta> = {
  gemini: {
    backend: 'gemini',
    docsUrl: 'https://github.com/google-gemini/gemini-cli',
    installCommand: 'npm install -g @google/gemini-cli',
    sessionProvider: 'gemini',
    descriptionKey: 'settings.runtimeManager.runtime.gemini.description',
    descriptionDefault: 'Google Gemini CLI runtime.',
  },
  claude: {
    backend: 'claude',
    docsUrl: 'https://docs.anthropic.com/en/docs/claude-code/quickstart',
    installCommand: 'npm install -g @anthropic-ai/claude-code',
    sessionProvider: 'claude',
    descriptionKey: 'settings.runtimeManager.runtime.claude.description',
    descriptionDefault: 'Anthropic Claude Code CLI runtime.',
  },
  codex: {
    backend: 'codex',
    docsUrl: 'https://github.com/openai/codex',
    installCommand: 'npm install -g @openai/codex',
    sessionProvider: 'codex',
    descriptionKey: 'settings.runtimeManager.runtime.codex.description',
    descriptionDefault: 'OpenAI Codex CLI runtime for local coding sessions.',
  },
  opencode: {
    backend: 'opencode',
    docsUrl: 'https://opencode.ai',
    installCommand: 'npm install -g @opencode-ai/cli',
    sessionProvider: 'opencode',
    descriptionKey: 'settings.runtimeManager.runtime.opencode.description',
    descriptionDefault: 'OpenCode CLI runtime.',
  },
  'openclaw-gateway': {
    backend: 'openclaw-gateway',
    docsUrl: 'https://github.com/openclaw/openclaw',
    installCommand: 'npm install -g openclaw',
    sessionProvider: 'openclaw-gateway',
    descriptionKey: 'settings.runtimeManager.runtime.openclaw-gateway.description',
    descriptionDefault: 'OpenClaw gateway runtime.',
  },
  nanobot: {
    backend: 'nanobot',
    docsUrl: 'https://github.com/HKUDS/nanobot',
    installCommand: 'python3 -m pip install -U nanobot-ai',
    descriptionKey: 'settings.runtimeManager.runtime.nanobot.description',
    descriptionDefault: 'Nanobot CLI runtime.',
  },
};

const CustomAcpAgent: React.FC = () => {
  const { t } = useTranslation();
  const [message, messageContext] = Message.useMessage({ maxCount: 8 });

  const [availableAgents, setAvailableAgents] = useState<AvailableRuntimeAgent[]>([]);
  const [externalSessions, setExternalSessions] = useState<ExternalSessionSummary[]>([]);
  const [healthState, setHealthState] = useState<Partial<Record<ManagedRuntimeBackend, RuntimeHealthState>>>({});
  const [loading, setLoading] = useState(false);
  const [installingBackend, setInstallingBackend] = useState<ManagedRuntimeBackend | null>(null);
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

  useEffect(() => {
    void loadRuntimeState();
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

  const handleOpenDocs = useCallback(async (url: string | undefined) => {
    if (!url) return;

    try {
      await shell.openExternal.invoke(url);
    } catch (error) {
      console.error('[RuntimeSettings] Failed to open runtime docs:', error);
    }
  }, []);

  const handleInstallRuntime = useCallback(
    async (backend: ManagedRuntimeBackend) => {
      setInstallingBackend(backend);

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
    const { backend, meta, backendConfig, detected, configuredOnly, effectiveCliPath, health, sessionCount, isMissing } = card;
    const guideLogo = getAgentLogo(backend);

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
    const showInstallAction = isMissing && Boolean(meta.installCommand);
    const showHealthAction = !isMissing;
    const emphasizeGuideAction = isMissing && !meta.installCommand && Boolean(meta.docsUrl);
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
                <Tag
                  color={
                    health.status === 'ready' || detected
                      ? 'green'
                      : configuredOnly
                        ? 'orange'
                        : 'gray'
                  }
                >
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
              {meta.docsUrl ? (
                <Button type={emphasizeGuideAction ? 'primary' : 'outline'} shape='round' onClick={() => void handleOpenDocs(meta.docsUrl)}>
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

          <Button type='outline' shape='round' onClick={() => void loadRuntimeState()} loading={loading}>
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
