import { Alert, Button, Collapse, Input, Message, Space, Tag, Typography } from '@arco-design/web-react';
import { Delete, EditTwo, Plus } from '@icon-park/react';
import React, { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { mutate } from 'swr';
import { acpConversation, shell } from '@/common/adapter/ipcBridge';
import { ConfigStorage, type IConfigStorageRefer } from '@/common/config/storage';
import { ACP_BACKENDS_ALL, type AcpBackend, type AcpBackendConfig } from '@/common/types/acpTypes';
import type { ExternalSessionProvider, ExternalSessionSummary } from '@/common/types/externalSessions';
import ContextGoModal from '@/renderer/components/base/ContextGoModal';
import { copyText } from '@/renderer/utils/ui/clipboard';
import CustomAcpAgentModal from './CustomAcpAgentModal';

type ManagedRuntimeBackend =
  | 'gemini'
  | 'claude'
  | 'codex'
  | 'qwen'
  | 'codebuddy'
  | 'opencode'
  | 'goose'
  | 'auggie'
  | 'kimi'
  | 'iflow'
  | 'droid'
  | 'copilot'
  | 'qoder'
  | 'vibe'
  | 'cursor'
  | 'openclaw-gateway';

type RuntimeHealthState = {
  status: 'idle' | 'checking' | 'ready' | 'error';
  latency?: number;
  message?: string;
};

type AvailableRuntimeAgent = {
  backend: AcpBackend;
  name: string;
  cliPath?: string;
  runtimeSource?: 'builtin' | 'detected' | 'configured';
};

type RuntimeMeta = {
  backend: ManagedRuntimeBackend;
  docsUrl?: string;
  installCommand?: string;
  loginCommand?: string;
  configLocation?: string;
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
  configuredCliPath: string;
  effectiveCliPath: string;
  health: RuntimeHealthState;
  sessionCount: number | null;
  isMissing: boolean;
};

const MANAGED_RUNTIME_BACKENDS: readonly ManagedRuntimeBackend[] = [
  'gemini',
  'claude',
  'codex',
  'qwen',
  'codebuddy',
  'opencode',
  'goose',
  'auggie',
  'kimi',
  'iflow',
  'droid',
  'copilot',
  'qoder',
  'vibe',
  'cursor',
  'openclaw-gateway',
] as const;

const RUNTIME_META: Record<ManagedRuntimeBackend, RuntimeMeta> = {
  gemini: {
    backend: 'gemini',
    docsUrl: 'https://github.com/google-gemini/gemini-cli',
    installCommand: 'npm install -g @google/gemini-cli',
    loginCommand: 'gemini',
    sessionProvider: 'gemini',
    descriptionKey: 'settings.runtimeManager.runtime.gemini.description',
    descriptionDefault: 'Google Gemini CLI runtime.',
  },
  claude: {
    backend: 'claude',
    docsUrl: 'https://docs.anthropic.com/en/docs/claude-code/quickstart',
    installCommand: 'npm install -g @anthropic-ai/claude-code',
    loginCommand: 'claude',
    configLocation: '~/.claude/settings.json',
    sessionProvider: 'claude',
    descriptionKey: 'settings.runtimeManager.runtime.claude.description',
    descriptionDefault: 'Anthropic Claude Code CLI runtime.',
  },
  codex: {
    backend: 'codex',
    docsUrl: 'https://www.npmjs.com/package/@openai/codex',
    installCommand: 'npm install -g @openai/codex',
    loginCommand: 'codex',
    configLocation: '~/.codex/config.toml',
    sessionProvider: 'codex',
    descriptionKey: 'settings.runtimeManager.runtime.codex.description',
    descriptionDefault: 'OpenAI Codex CLI runtime for local coding sessions.',
  },
  qwen: {
    backend: 'qwen',
    docsUrl: 'https://github.com/QwenLM/qwen-code',
    installCommand: 'npm install -g @qwen-code/qwen-code@latest',
    loginCommand: 'qwen',
    configLocation: '~/.qwen/client_config.json',
    descriptionKey: 'settings.runtimeManager.runtime.qwen.description',
    descriptionDefault: 'Qwen Code CLI runtime.',
  },
  codebuddy: {
    backend: 'codebuddy',
    installCommand: 'npm install -g @tencent-ai/codebuddy-code',
    loginCommand: 'codebuddy',
    configLocation: '~/.codebuddy/settings.json',
    descriptionKey: 'settings.runtimeManager.runtime.codebuddy.description',
    descriptionDefault: 'Tencent CodeBuddy Code CLI runtime.',
  },
  opencode: {
    backend: 'opencode',
    docsUrl: 'https://opencode.ai',
    configLocation: '~/.opencode',
    sessionProvider: 'opencode',
    descriptionKey: 'settings.runtimeManager.runtime.opencode.description',
    descriptionDefault: 'OpenCode CLI runtime.',
  },
  goose: {
    backend: 'goose',
    docsUrl: 'https://block.github.io/goose/',
    configLocation: '~/.goose',
    descriptionKey: 'settings.runtimeManager.runtime.goose.description',
    descriptionDefault: 'Block Goose CLI runtime.',
  },
  auggie: {
    backend: 'auggie',
    docsUrl: 'https://docs.augmentcode.com/cli/overview',
    descriptionKey: 'settings.runtimeManager.runtime.auggie.description',
    descriptionDefault: 'Augment Code CLI runtime.',
  },
  kimi: {
    backend: 'kimi',
    configLocation: '~/.kimi',
    descriptionKey: 'settings.runtimeManager.runtime.kimi.description',
    descriptionDefault: 'Kimi CLI runtime.',
  },
  iflow: {
    backend: 'iflow',
    configLocation: '~/.iflow',
    descriptionKey: 'settings.runtimeManager.runtime.iflow.description',
    descriptionDefault: 'iFlow CLI runtime.',
  },
  droid: {
    backend: 'droid',
    configLocation: '~/.factory',
    descriptionKey: 'settings.runtimeManager.runtime.droid.description',
    descriptionDefault: 'Factory Droid CLI runtime.',
  },
  copilot: {
    backend: 'copilot',
    descriptionKey: 'settings.runtimeManager.runtime.copilot.description',
    descriptionDefault: 'GitHub Copilot CLI runtime.',
  },
  qoder: {
    backend: 'qoder',
    descriptionKey: 'settings.runtimeManager.runtime.qoder.description',
    descriptionDefault: 'Qoder CLI runtime.',
  },
  vibe: {
    backend: 'vibe',
    configLocation: '~/.vibe',
    descriptionKey: 'settings.runtimeManager.runtime.vibe.description',
    descriptionDefault: 'Mistral Vibe CLI runtime.',
  },
  cursor: {
    backend: 'cursor',
    configLocation: '~/.cursor',
    descriptionKey: 'settings.runtimeManager.runtime.cursor.description',
    descriptionDefault: 'Cursor Agent CLI runtime.',
  },
  'openclaw-gateway': {
    backend: 'openclaw-gateway',
    docsUrl: 'https://github.com/codefriday-ai/openclaw',
    installCommand: 'npm install -g openclaw',
    loginCommand: 'openclaw',
    sessionProvider: 'openclaw-gateway',
    descriptionKey: 'settings.runtimeManager.runtime.openclaw-gateway.description',
    descriptionDefault: 'OpenClaw gateway runtime.',
  },
};

const CustomAcpAgent: React.FC = () => {
  const { t } = useTranslation();
  const [message, messageContext] = Message.useMessage({ maxCount: 8 });

  const [availableAgents, setAvailableAgents] = useState<AvailableRuntimeAgent[]>([]);
  const [externalSessions, setExternalSessions] = useState<ExternalSessionSummary[]>([]);
  const [healthState, setHealthState] = useState<Partial<Record<ManagedRuntimeBackend, RuntimeHealthState>>>({});
  const [runtimePathDrafts, setRuntimePathDrafts] = useState<Partial<Record<ManagedRuntimeBackend, string>>>({});
  const [acpConfig, setAcpConfig] = useState<IConfigStorageRefer['acp.config'] | null>(null);
  const [codexConfig, setCodexConfig] = useState<IConfigStorageRefer['codex.config'] | null>(null);
  const [customAgents, setCustomAgents] = useState<AcpBackendConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [installingBackend, setInstallingBackend] = useState<ManagedRuntimeBackend | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AcpBackendConfig | null>(null);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<AcpBackendConfig | null>(null);
  const loadingRef = useRef(false);
  const requestSeqRef = useRef(0);

  const refreshAgentDetection = useCallback(async () => {
    try {
      await acpConversation.refreshCustomAgents.invoke();
      await mutate('acp.agents.available');
    } catch {
      // Best-effort refresh; runtime page will reload on next access.
    }
  }, []);

  const loadRuntimeState = useEffectEvent(async () => {
    if (loadingRef.current) {
      return;
    }

    loadingRef.current = true;
    const requestId = requestSeqRef.current + 1;
    requestSeqRef.current = requestId;
    setLoading(true);

    try {
      const [agentsResponse, sessionsResponse, nextAcpConfig, nextCodexConfig, nextCustomAgents] = await Promise.all([
        acpConversation.getAvailableAgents.invoke(),
        acpConversation.listExternalSessions.invoke({}),
        ConfigStorage.get('acp.config'),
        ConfigStorage.get('codex.config'),
        ConfigStorage.get('acp.customAgents'),
      ]);

      if (requestSeqRef.current === requestId) {
        setAvailableAgents(agentsResponse.success && agentsResponse.data ? agentsResponse.data : []);
        setExternalSessions(
          sessionsResponse.success && sessionsResponse.data?.sessions ? sessionsResponse.data.sessions : []
        );
        setAcpConfig(nextAcpConfig);
        setCodexConfig(nextCodexConfig);
        setCustomAgents((nextCustomAgents || []).filter((agent) => !agent.isPreset));

        const nextDrafts: Partial<Record<ManagedRuntimeBackend, string>> = {};
        for (const backend of MANAGED_RUNTIME_BACKENDS) {
          nextDrafts[backend] =
            backend === 'codex'
              ? nextCodexConfig?.cliPath || ''
              : nextAcpConfig?.[backend as AcpBackend]?.cliPath || '';
        }
        setRuntimePathDrafts(nextDrafts);
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

  const externalSessionCountByProvider = useMemo(() => {
    const map = new Map<ExternalSessionProvider, number>();
    for (const session of externalSessions) {
      map.set(session.provider, (map.get(session.provider) || 0) + 1);
    }
    return map;
  }, [externalSessions]);

  const runtimeCards = useMemo<RuntimeCard[]>(() => {
    return [...MANAGED_RUNTIME_BACKENDS]
      .map((backend) => {
        const agent = availableAgentMap.get(backend);
        const meta = RUNTIME_META[backend];
        const backendConfig = ACP_BACKENDS_ALL[backend];
        const configuredCliPath =
          backend === 'codex' ? codexConfig?.cliPath || '' : acpConfig?.[backend as AcpBackend]?.cliPath || '';
        const detected = agent?.runtimeSource === 'detected' || agent?.runtimeSource === 'builtin';
        const configuredOnly = agent?.runtimeSource === 'configured';
        const isMissing = !detected && !configuredCliPath && !configuredOnly;

        return {
          backend,
          meta,
          backendConfig,
          agent,
          detected,
          configuredOnly,
          configuredCliPath,
          effectiveCliPath: configuredCliPath || agent?.cliPath || '',
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
        if (Boolean(left.configuredCliPath) !== Boolean(right.configuredCliPath)) {
          return left.configuredCliPath ? -1 : 1;
        }
        return left.meta.backend.localeCompare(right.meta.backend);
      });
  }, [acpConfig, availableAgentMap, codexConfig, externalSessionCountByProvider, healthState]);

  const activeRuntimeCards = useMemo(() => runtimeCards.filter((card) => !card.isMissing), [runtimeCards]);
  const missingRuntimeCards = useMemo(() => runtimeCards.filter((card) => card.isMissing), [runtimeCards]);

  const summaryStats = useMemo(
    () => ({
      readyCount: runtimeCards.filter((card) => card.health.status === 'ready').length,
      detectedCount: runtimeCards.filter((card) => card.detected).length,
      missingCount: missingRuntimeCards.length,
      externalSessionCount: Array.from(externalSessionCountByProvider.values()).reduce(
        (total, count) => total + count,
        0
      ),
    }),
    [externalSessionCountByProvider, missingRuntimeCards.length, runtimeCards]
  );

  const handleCopy = useCallback(
    async (value: string, successKey: string, successDefault: string) => {
      try {
        await copyText(value);
        message.success(t(successKey, { defaultValue: successDefault }));
      } catch (error) {
        console.error('[RuntimeSettings] Failed to copy text:', error);
        message.error(
          t('settings.runtimeManager.copyFailed', {
            defaultValue: 'Failed to copy to clipboard.',
          })
        );
      }
    },
    [message, t]
  );

  const handleOpenDocs = useCallback(async (url: string | undefined) => {
    if (!url) return;

    try {
      await shell.openExternal.invoke(url);
    } catch (error) {
      console.error('[RuntimeSettings] Failed to open runtime docs:', error);
    }
  }, []);

  const handleRevealPath = useCallback(
    async (targetPath?: string) => {
      if (!targetPath) return;

      try {
        await shell.revealPath.invoke(targetPath);
      } catch (error) {
        console.error('[RuntimeSettings] Failed to reveal path:', error);
        message.error(
          t('settings.runtimeManager.revealPathFailed', {
            defaultValue: 'Failed to open the path in the system file manager.',
          })
        );
      }
    },
    [message, t]
  );

  const handleOpenConfig = useCallback(
    async (targetPath?: string) => {
      if (!targetPath) return;

      try {
        await shell.openFile.invoke(targetPath);
      } catch (error) {
        console.error('[RuntimeSettings] Failed to open runtime config:', error);
        message.error(
          t('settings.runtimeManager.openConfigFailed', {
            defaultValue: 'Failed to open the runtime config location.',
          })
        );
      }
    },
    [message, t]
  );

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

  const handleRuntimePathChange = useCallback((backend: ManagedRuntimeBackend, value: string) => {
    setRuntimePathDrafts((current) => ({
      ...current,
      [backend]: value,
    }));
  }, []);

  const handleSaveRuntimePath = useCallback(
    async (backend: ManagedRuntimeBackend) => {
      const nextPath = runtimePathDrafts[backend]?.trim() || undefined;

      try {
        if (backend === 'codex') {
          const currentConfig = (await ConfigStorage.get('codex.config')) || {};
          await ConfigStorage.set('codex.config', {
            ...currentConfig,
            cliPath: nextPath,
          });
        } else {
          const currentConfig = (await ConfigStorage.get('acp.config')) || {};
          const backendConfig = currentConfig[backend] || {};
          await ConfigStorage.set('acp.config', {
            ...currentConfig,
            [backend]: {
              ...backendConfig,
              cliPath: nextPath,
            },
          });
        }

        await loadRuntimeState();
        message.success(
          t('settings.runtimeManager.pathSaved', {
            defaultValue: 'Runtime path saved.',
          })
        );
      } catch (error) {
        console.error('[RuntimeSettings] Failed to save runtime path:', error);
        message.error(
          t('settings.runtimeManager.pathSaveFailed', {
            defaultValue: 'Failed to save runtime path.',
          })
        );
      }
    },
    [loadRuntimeState, message, runtimePathDrafts, t]
  );

  const handleResetRuntimePath = useCallback(
    async (backend: ManagedRuntimeBackend) => {
      setRuntimePathDrafts((current) => ({
        ...current,
        [backend]: '',
      }));

      try {
        if (backend === 'codex') {
          const currentConfig = (await ConfigStorage.get('codex.config')) || {};
          await ConfigStorage.set('codex.config', {
            ...currentConfig,
            cliPath: undefined,
          });
        } else {
          const currentConfig = (await ConfigStorage.get('acp.config')) || {};
          const backendConfig = currentConfig[backend] || {};
          await ConfigStorage.set('acp.config', {
            ...currentConfig,
            [backend]: {
              ...backendConfig,
              cliPath: undefined,
            },
          });
        }

        await loadRuntimeState();
        message.success(
          t('settings.runtimeManager.pathReset', {
            defaultValue: 'Runtime path reset to automatic detection.',
          })
        );
      } catch (error) {
        console.error('[RuntimeSettings] Failed to reset runtime path:', error);
        message.error(
          t('settings.runtimeManager.pathSaveFailed', {
            defaultValue: 'Failed to save runtime path.',
          })
        );
      }
    },
    [loadRuntimeState, message, t]
  );

  const handleSaveCustomAgent = useCallback(
    async (agentData: AcpBackendConfig) => {
      try {
        const updatedAgents = editingAgent
          ? customAgents.map((agent) => (agent.id === editingAgent.id ? agentData : agent))
          : [...customAgents, agentData];

        await ConfigStorage.set('acp.customAgents', updatedAgents);
        setCustomAgents(updatedAgents);
        setShowModal(false);
        setEditingAgent(null);
        message.success(
          t('settings.customAcpAgentSaved', {
            defaultValue: 'Custom runtime saved.',
          })
        );

        await refreshAgentDetection();
        await loadRuntimeState();
      } catch (error) {
        console.error('[RuntimeSettings] Failed to save custom runtime:', error);
        message.error(
          t('settings.customAcpAgentSaveFailed', {
            defaultValue: 'Failed to save custom runtime.',
          })
        );
      }
    },
    [customAgents, editingAgent, loadRuntimeState, message, refreshAgentDetection, t]
  );

  const handleDeleteCustomAgent = useCallback(async () => {
    if (!agentToDelete) return;

    try {
      const updatedAgents = customAgents.filter((agent) => agent.id !== agentToDelete.id);
      await ConfigStorage.set('acp.customAgents', updatedAgents);
      setCustomAgents(updatedAgents);
      setDeleteConfirmVisible(false);
      setAgentToDelete(null);
      message.success(
        t('settings.customAcpAgentDeleted', {
          defaultValue: 'Custom runtime deleted.',
        })
      );

      await refreshAgentDetection();
      await loadRuntimeState();
    } catch (error) {
      console.error('[RuntimeSettings] Failed to delete custom runtime:', error);
      message.error(
        t('settings.customAcpAgentDeleteFailed', {
          defaultValue: 'Failed to delete custom runtime.',
        })
      );
    }
  }, [agentToDelete, customAgents, loadRuntimeState, message, refreshAgentDetection, t]);

  const renderRuntimeCard = (card: RuntimeCard) => {
    const {
      backend,
      meta,
      backendConfig,
      agent,
      detected,
      configuredOnly,
      configuredCliPath,
      effectiveCliPath,
      health,
      sessionCount,
      isMissing,
    } = card;

    const statusText =
      health.status === 'ready'
        ? t('settings.runtimeManager.status.ready', {
            defaultValue: 'Ready',
          })
        : detected
          ? t('settings.runtimeManager.status.detected', {
              defaultValue: 'Detected',
            })
          : configuredCliPath || configuredOnly
            ? t('settings.runtimeManager.status.configured', {
                defaultValue: 'Configured',
              })
            : t('settings.runtimeManager.status.missing', {
                defaultValue: 'Not Installed',
              });

    const statusSummary =
      health.status === 'ready'
        ? t('settings.runtimeManager.summary.ready', {
            defaultValue: 'The check passed and this runtime is ready to use.',
          })
        : detected
          ? t('settings.runtimeManager.summary.detected', {
              defaultValue:
                'This runtime was found on this device. Run the availability check to confirm it can start.',
            })
          : configuredCliPath || configuredOnly
            ? t('settings.runtimeManager.summary.configured', {
                defaultValue: 'A manual path is set. Save it and run the availability check to verify it.',
              })
            : t('settings.runtimeManager.summary.missing', {
                defaultValue: 'This runtime has not been detected yet. Install it first if you want to use it.',
              });

    const compactMeta = (label: string, value: React.ReactNode, action?: React.ReactNode) => (
      <div className='min-w-0 rounded-14px border border-border-2 bg-fill-1 px-12px py-10px'>
        <div className='flex items-center justify-between gap-8px'>
          <div className='text-11px text-t-secondary leading-4'>{label}</div>
          {action}
        </div>
        <div className='mt-4px break-all text-12px leading-5 text-t-primary'>{value}</div>
      </div>
    );

    return (
      <div
        key={backend}
        className='rounded-18px border border-border-2 bg-[color:color-mix(in_srgb,var(--color-bg-1)_94%,transparent)] p-16px shadow-[0_10px_24px_rgba(15,23,42,0.04)]'
      >
        <div className='flex flex-col gap-12px'>
          <div className='flex flex-col gap-10px xl:flex-row xl:items-start xl:justify-between'>
            <div className='min-w-0 xl:max-w-320px xl:flex-[0_0_320px] space-y-3px'>
              <div className='text-15px font-600 text-t-primary'>{backendConfig.name}</div>
              <div className='text-12px leading-5 text-t-secondary'>{statusSummary}</div>
              <div className='text-12px leading-5 text-t-secondary'>
                {t(meta.descriptionKey, {
                  defaultValue: meta.descriptionDefault,
                })}
              </div>
            </div>

            <Space wrap className='xl:justify-end'>
              <Tag
                color={
                  health.status === 'ready' || detected
                    ? 'green'
                    : configuredCliPath || configuredOnly
                      ? 'orange'
                      : 'gray'
                }
              >
                {statusText}
              </Tag>
              {backendConfig.authRequired ? (
                <Tag color='arcoblue'>
                  {t('settings.runtimeManager.status.authRequired', {
                    defaultValue: 'Needs Login',
                  })}
                </Tag>
              ) : null}
            </Space>
          </div>

          <div className='flex flex-wrap gap-8px'>
            {compactMeta(
              t('settings.runtimeManager.healthTitle', {
                defaultValue: 'Availability check',
              }),
              <>
                {health.status === 'checking'
                  ? t('settings.runtimeManager.health.checking', {
                      defaultValue: 'Checking...',
                    })
                  : health.message || '-'}
                {health.status === 'ready' && health.latency !== undefined ? ` (${health.latency}ms)` : ''}
              </>
            )}
            {compactMeta(
              t('settings.runtimeManager.externalSessionCount', {
                defaultValue: 'Takeover sessions',
              }),
              sessionCount === null
                ? t('settings.runtimeManager.externalSessionUnsupported', {
                    defaultValue: 'Not supported',
                  })
                : sessionCount
            )}
            {compactMeta(
              t('settings.runtimeManager.cliCommand', {
                defaultValue: 'Launch command',
              }),
              backendConfig.cliCommand || '-'
            )}
            {compactMeta(
              t('settings.runtimeManager.currentPath', {
                defaultValue: 'Path in use',
              }),
              effectiveCliPath || backendConfig.cliCommand || '-',
              effectiveCliPath ? (
                <Button type='text' size='mini' onClick={() => void handleRevealPath(effectiveCliPath)}>
                  {t('settings.runtimeManager.revealPath', {
                    defaultValue: 'Reveal',
                  })}
                </Button>
              ) : undefined
            )}
            {compactMeta(
              t('settings.runtimeManager.reportedPath', {
                defaultValue: 'Auto-detected path',
              }),
              agent?.cliPath || '-',
              agent?.cliPath ? (
                <Button type='text' size='mini' onClick={() => void handleRevealPath(agent.cliPath)}>
                  {t('settings.runtimeManager.revealPath', {
                    defaultValue: 'Reveal',
                  })}
                </Button>
              ) : undefined
            )}
            {compactMeta(
              t('settings.runtimeManager.configLocation', {
                defaultValue: 'Config location',
              }),
              meta.configLocation || '-',
              meta.configLocation ? (
                <Button type='text' size='mini' onClick={() => void handleOpenConfig(meta.configLocation)}>
                  {t('settings.runtimeManager.openConfig', {
                    defaultValue: 'Open',
                  })}
                </Button>
              ) : undefined
            )}
          </div>

          <div className='space-y-8px'>
            <div className='text-12px font-500 text-t-primary'>
              {t('settings.runtimeManager.customPathLabel', {
                defaultValue: 'Manually set path',
              })}
            </div>
            <div className='flex flex-col gap-8px xl:flex-row'>
              <Input
                value={runtimePathDrafts[backend] || ''}
                onChange={(value) => handleRuntimePathChange(backend, value)}
                placeholder={backendConfig.cliCommand || backendConfig.defaultCliPath || ''}
              />
              <Space wrap>
                <Button type='outline' shape='round' onClick={() => void handleSaveRuntimePath(backend)}>
                  {t('settings.runtimeManager.savePath', {
                    defaultValue: 'Save path',
                  })}
                </Button>
                <Button type='outline' shape='round' onClick={() => void handleResetRuntimePath(backend)}>
                  {t('settings.runtimeManager.resetPath', {
                    defaultValue: 'Use auto-detect',
                  })}
                </Button>
              </Space>
            </div>
          </div>

          <Space wrap>
            <Button
              type='primary'
              shape='round'
              loading={health.status === 'checking'}
              onClick={() => void handleHealthCheck(backend)}
            >
              {t('settings.runtimeManager.checkHealth', {
                defaultValue: 'Check availability',
              })}
            </Button>
            {meta.installCommand ? (
              <Button
                type={isMissing ? 'primary' : 'outline'}
                shape='round'
                loading={installingBackend === backend}
                onClick={() => void handleInstallRuntime(backend)}
              >
                {t('settings.runtimeManager.installNow', {
                  defaultValue: 'Install locally',
                })}
              </Button>
            ) : null}
            {meta.installCommand ? (
              <Button
                type='outline'
                shape='round'
                onClick={() =>
                  void handleCopy(
                    meta.installCommand!,
                    'settings.runtimeManager.installCommandCopied',
                    'Install command copied.'
                  )
                }
              >
                {t('settings.runtimeManager.copyInstallCommand', {
                  defaultValue: 'Copy install command',
                })}
              </Button>
            ) : null}
            {meta.loginCommand ? (
              <Button
                type='outline'
                shape='round'
                onClick={() =>
                  void handleCopy(
                    meta.loginCommand!,
                    'settings.runtimeManager.loginCommandCopied',
                    'Login command copied.'
                  )
                }
              >
                {t('settings.runtimeManager.copyLoginCommand', {
                  defaultValue: 'Copy login command',
                })}
              </Button>
            ) : null}
            {meta.docsUrl ? (
              <Button type='outline' shape='round' onClick={() => void handleOpenDocs(meta.docsUrl)}>
                {t('settings.runtimeManager.openGuide', {
                  defaultValue: 'Open setup guide',
                })}
              </Button>
            ) : null}
          </Space>
          {meta.installCommand ? (
            <div className='rounded-14px border border-dashed border-border-2 bg-fill-1 px-12px py-10px'>
              <div className='text-11px text-t-secondary'>
                {t('settings.runtimeManager.installCommandLabel', {
                  defaultValue: 'Recommended install command',
                })}
              </div>
              <div className='mt-4px break-all font-mono text-12px leading-5 text-t-primary'>{meta.installCommand}</div>
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
          <div className='space-y-4px'>
            <div className='text-20px text-t-primary font-600 leading-28px'>
              {t('settings.runtimeManager.title', {
                defaultValue: 'Runtime Management',
              })}
            </div>
            <div className='max-w-760px text-14px leading-6 text-t-secondary'>
              {t('settings.runtimeManager.description', {
                defaultValue:
                  'Check which local agent runtimes are already available, how many external sessions can be taken over, where each runtime keeps its config, and install the missing ones when a managed command is available.',
              })}
            </div>
          </div>

          <Button type='outline' shape='round' onClick={() => void loadRuntimeState()} loading={loading}>
            {t('settings.runtimeManager.refresh', {
              defaultValue: 'Refresh status',
            })}
          </Button>
        </div>

        <Alert
          type='info'
          content={t('settings.runtimeManager.note', {
            defaultValue:
              'If you enter a path manually, ContextGo will prefer it over automatic PATH detection. The availability check always uses the saved path to confirm whether the runtime can actually start right now.',
          })}
        />

        <div className='grid grid-cols-2 gap-10px lg:grid-cols-4'>
          <div className='rounded-18px bg-fill-1 px-14px py-12px'>
            <div className='text-12px text-t-secondary'>
              {t('settings.runtimeManager.summaryCards.ready', {
                defaultValue: 'Ready runtimes',
              })}
            </div>
            <div className='mt-6px text-22px font-600 leading-none text-t-primary'>{summaryStats.readyCount}</div>
          </div>
          <div className='rounded-18px bg-fill-1 px-14px py-12px'>
            <div className='text-12px text-t-secondary'>
              {t('settings.runtimeManager.summaryCards.detected', {
                defaultValue: 'Detected locally',
              })}
            </div>
            <div className='mt-6px text-22px font-600 leading-none text-t-primary'>{summaryStats.detectedCount}</div>
          </div>
          <div className='rounded-18px bg-fill-1 px-14px py-12px'>
            <div className='text-12px text-t-secondary'>
              {t('settings.runtimeManager.summaryCards.sessions', {
                defaultValue: 'Takeover sessions',
              })}
            </div>
            <div className='mt-6px text-22px font-600 leading-none text-t-primary'>
              {summaryStats.externalSessionCount}
            </div>
          </div>
          <div className='rounded-18px bg-fill-1 px-14px py-12px'>
            <div className='text-12px text-t-secondary'>
              {t('settings.runtimeManager.summaryCards.missing', {
                defaultValue: 'Not installed',
              })}
            </div>
            <div className='mt-6px text-22px font-600 leading-none text-t-primary'>{summaryStats.missingCount}</div>
          </div>
        </div>

        <div className='space-y-10px'>
          <div className='space-y-2px'>
            <div className='text-16px font-600 leading-6 text-t-primary'>
              {t('settings.runtimeManager.activeSectionTitle', {
                defaultValue: 'Detected or configured',
              })}
            </div>
            <div className='text-13px leading-5 text-t-secondary'>
              {t('settings.runtimeManager.activeSectionDescription', {
                defaultValue: 'These runtimes are already detected locally or have a manual path configured.',
              })}
            </div>
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
          <div className='space-y-2px'>
            <div className='text-16px font-600 leading-6 text-t-primary'>
              {t('settings.runtimeManager.missingSectionTitle', {
                defaultValue: 'Not installed yet',
              })}
            </div>
            <div className='text-13px leading-5 text-t-secondary'>
              {t('settings.runtimeManager.missingSectionDescription', {
                defaultValue:
                  'These runtimes are still missing on this device. Use the managed install action where available.',
              })}
            </div>
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

      <div className='space-y-18px rounded-24px border border-border-2 bg-[color:color-mix(in_srgb,var(--color-bg-1)_90%,transparent)] px-16px py-18px shadow-[0_18px_44px_rgba(15,23,42,0.05)] md:px-[28px]'>
        <div className='flex items-start justify-between gap-16px flex-wrap'>
          <div className='space-y-4px'>
            <div className='text-18px text-t-primary font-600 leading-26px'>
              {t('settings.runtimeManager.customSectionTitle', {
                defaultValue: 'Custom Runtime Adapters',
              })}
            </div>
            <div className='max-w-760px text-14px leading-6 text-t-secondary'>
              {t('settings.runtimeManager.customSectionDescription', {
                defaultValue:
                  'Add custom ACP-compatible runtimes when you want ContextGo to launch a CLI outside the built-in backend catalog.',
              })}
            </div>
          </div>

          <Button
            type='outline'
            icon={<Plus size='14' />}
            shape='round'
            onClick={() => {
              setEditingAgent(null);
              setShowModal(true);
            }}
          >
            {t('settings.addCustomAgent', {
              defaultValue: 'Add',
            })}
          </Button>
        </div>

        {customAgents.length === 0 ? (
          <Alert
            type='warning'
            content={t('settings.noCustomAgentConfigured', {
              defaultValue: 'No custom runtimes configured.',
            })}
          />
        ) : (
          <Collapse defaultActiveKey={['custom-runtime-adapters']}>
            <Collapse.Item
              name='custom-runtime-adapters'
              header={t('settings.customAcpAgent', {
                defaultValue: 'Custom ACP Agents',
              })}
            >
              <div className='space-y-10px'>
                {customAgents.map((agent) => (
                  <div
                    key={agent.id}
                    className='rounded-18px border border-border-2 bg-fill-1 p-16px shadow-[0_10px_24px_rgba(15,23,42,0.04)]'
                  >
                    <div className='mb-2 flex items-center justify-between'>
                      <div className='font-medium'>
                        {agent.name || t('settings.customAcpAgent', { defaultValue: 'Custom Agent' })}
                      </div>
                      <Space>
                        <Button
                          type='text'
                          size='small'
                          icon={<EditTwo size='14' />}
                          onClick={() => {
                            setEditingAgent(agent);
                            setShowModal(true);
                          }}
                        />
                        <Button
                          type='text'
                          size='small'
                          status='danger'
                          icon={<Delete size='14' />}
                          onClick={() => {
                            setAgentToDelete(agent);
                            setDeleteConfirmVisible(true);
                          }}
                        />
                      </Space>
                    </div>
                    <div className='space-y-4px text-sm text-t-secondary'>
                      <div>
                        <span className='font-medium'>
                          {t('settings.runtimeManager.currentPath', {
                            defaultValue: 'Path in use',
                          })}
                          :
                        </span>{' '}
                        {agent.defaultCliPath}
                      </div>
                      {agent.env && Object.keys(agent.env).length > 0 ? (
                        <div>
                          <span className='font-medium'>
                            {t('settings.env', {
                              defaultValue: 'Env',
                            })}
                            :
                          </span>{' '}
                          {Object.keys(agent.env).length}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </Collapse.Item>
          </Collapse>
        )}
      </div>

      <CustomAcpAgentModal
        visible={showModal}
        agent={editingAgent}
        onCancel={() => {
          setShowModal(false);
          setEditingAgent(null);
        }}
        onSubmit={handleSaveCustomAgent}
      />

      <ContextGoModal
        visible={deleteConfirmVisible}
        onCancel={() => setDeleteConfirmVisible(false)}
        onOk={() => void handleDeleteCustomAgent()}
        header={{
          title: t('settings.deleteCustomAgent', {
            defaultValue: 'Delete Custom Agent',
          }),
          showClose: true,
        }}
        okText={t('common.confirm', {
          defaultValue: 'Confirm',
        })}
        cancelText={t('common.cancel', {
          defaultValue: 'Cancel',
        })}
      >
        <Typography.Paragraph className='!mb-0'>
          {t('settings.deleteCustomAgentConfirm', {
            defaultValue: 'Are you sure you want to delete this custom agent?',
          })}
          {agentToDelete ? <strong className='mt-2 block'>{agentToDelete.name}</strong> : null}
        </Typography.Paragraph>
      </ContextGoModal>
    </div>
  );
};

export default CustomAcpAgent;
