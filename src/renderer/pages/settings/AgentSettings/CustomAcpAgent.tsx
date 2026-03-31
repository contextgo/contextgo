import { Alert, Button, Collapse, Input, Message, Space, Tag, Typography } from '@arco-design/web-react';
import { Delete, EditTwo, Plus } from '@icon-park/react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { mutate } from 'swr';
import { acpConversation, shell } from '@/common/adapter/ipcBridge';
import { ConfigStorage, type IConfigStorageRefer } from '@/common/config/storage';
import { ACP_BACKENDS_ALL, type AcpBackend, type AcpBackendConfig } from '@/common/types/acpTypes';
import { copyText } from '@/renderer/utils/ui/clipboard';
import ContextGoModal from '@/renderer/components/base/ContextGoModal';
import CustomAcpAgentModal from './CustomAcpAgentModal';

type ManagedRuntimeBackend =
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
  | 'cursor';

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
  descriptionKey: string;
  descriptionDefault: string;
};

const MANAGED_RUNTIME_BACKENDS: readonly ManagedRuntimeBackend[] = [
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
] as const;

const RUNTIME_META: Record<ManagedRuntimeBackend, RuntimeMeta> = {
  claude: {
    backend: 'claude',
    docsUrl: 'https://docs.anthropic.com/en/docs/claude-code/quickstart',
    installCommand: 'npm install -g @anthropic-ai/claude-code',
    loginCommand: 'claude',
    descriptionKey: 'settings.runtimeManager.runtime.claude.description',
    descriptionDefault: 'Anthropic Claude Code CLI runtime.',
  },
  codex: {
    backend: 'codex',
    docsUrl: 'https://www.npmjs.com/package/@openai/codex',
    installCommand: 'npm install -g @openai/codex',
    loginCommand: 'codex',
    descriptionKey: 'settings.runtimeManager.runtime.codex.description',
    descriptionDefault: 'OpenAI Codex CLI runtime for local coding sessions.',
  },
  qwen: {
    backend: 'qwen',
    docsUrl: 'https://github.com/QwenLM/qwen-code',
    installCommand: 'npm install -g @qwen-code/qwen-code@latest',
    loginCommand: 'qwen',
    descriptionKey: 'settings.runtimeManager.runtime.qwen.description',
    descriptionDefault: 'Qwen Code CLI runtime.',
  },
  codebuddy: {
    backend: 'codebuddy',
    installCommand: 'npm install -g @tencent-ai/codebuddy-code',
    loginCommand: 'codebuddy',
    descriptionKey: 'settings.runtimeManager.runtime.codebuddy.description',
    descriptionDefault: 'Tencent CodeBuddy Code CLI runtime.',
  },
  opencode: {
    backend: 'opencode',
    docsUrl: 'https://opencode.ai',
    descriptionKey: 'settings.runtimeManager.runtime.opencode.description',
    descriptionDefault: 'OpenCode CLI runtime.',
  },
  goose: {
    backend: 'goose',
    docsUrl: 'https://block.github.io/goose/',
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
    descriptionKey: 'settings.runtimeManager.runtime.kimi.description',
    descriptionDefault: 'Kimi CLI runtime.',
  },
  iflow: {
    backend: 'iflow',
    descriptionKey: 'settings.runtimeManager.runtime.iflow.description',
    descriptionDefault: 'iFlow CLI runtime.',
  },
  droid: {
    backend: 'droid',
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
    descriptionKey: 'settings.runtimeManager.runtime.vibe.description',
    descriptionDefault: 'Mistral Vibe CLI runtime.',
  },
  cursor: {
    backend: 'cursor',
    descriptionKey: 'settings.runtimeManager.runtime.cursor.description',
    descriptionDefault: 'Cursor Agent CLI runtime.',
  },
};

const CustomAcpAgent: React.FC = () => {
  const { t } = useTranslation();
  const [message, messageContext] = Message.useMessage({ maxCount: 8 });

  const [availableAgents, setAvailableAgents] = useState<AvailableRuntimeAgent[]>([]);
  const [healthState, setHealthState] = useState<Partial<Record<ManagedRuntimeBackend, RuntimeHealthState>>>({});
  const [runtimePathDrafts, setRuntimePathDrafts] = useState<Partial<Record<ManagedRuntimeBackend, string>>>({});
  const [acpConfig, setAcpConfig] = useState<IConfigStorageRefer['acp.config'] | null>(null);
  const [codexConfig, setCodexConfig] = useState<IConfigStorageRefer['codex.config'] | null>(null);
  const [customAgents, setCustomAgents] = useState<AcpBackendConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AcpBackendConfig | null>(null);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<AcpBackendConfig | null>(null);

  const refreshAgentDetection = useCallback(async () => {
    try {
      await acpConversation.refreshCustomAgents.invoke();
      await mutate('acp.agents.available');
    } catch {
      // Best-effort refresh; runtime page will reload on next access.
    }
  }, []);

  const loadRuntimeState = useCallback(async () => {
    setLoading(true);
    try {
      const [agentsResponse, nextAcpConfig, nextCodexConfig, nextCustomAgents] = await Promise.all([
        acpConversation.getAvailableAgents.invoke(),
        ConfigStorage.get('acp.config'),
        ConfigStorage.get('codex.config'),
        ConfigStorage.get('acp.customAgents'),
      ]);

      if (agentsResponse.success && agentsResponse.data) {
        setAvailableAgents(agentsResponse.data);
      } else {
        setAvailableAgents([]);
      }

      setAcpConfig(nextAcpConfig);
      setCodexConfig(nextCodexConfig);
      setCustomAgents((nextCustomAgents || []).filter((agent) => !agent.isPreset));

      const nextDrafts: Partial<Record<ManagedRuntimeBackend, string>> = {};
      for (const backend of MANAGED_RUNTIME_BACKENDS) {
        nextDrafts[backend] =
          backend === 'codex' ? nextCodexConfig?.cliPath || '' : nextAcpConfig?.[backend as AcpBackend]?.cliPath || '';
      }
      setRuntimePathDrafts(nextDrafts);
    } catch (error) {
      console.error('[RuntimeSettings] Failed to load runtime state:', error);
      message.error(
        t('settings.runtimeManager.loadFailed', {
          defaultValue: 'Failed to load runtime status.',
        })
      );
    } finally {
      setLoading(false);
    }
  }, [message, t]);

  useEffect(() => {
    void loadRuntimeState();
  }, [loadRuntimeState]);

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

  const runtimeCards = useMemo(() => {
    return [...MANAGED_RUNTIME_BACKENDS]
      .map((backend) => {
        const agent = availableAgentMap.get(backend);
        const meta = RUNTIME_META[backend];
        const backendConfig = ACP_BACKENDS_ALL[backend];
        const configuredCliPath =
          backend === 'codex' ? codexConfig?.cliPath || '' : acpConfig?.[backend as AcpBackend]?.cliPath || '';

        return {
          backend,
          meta,
          backendConfig,
          agent,
          detected: agent?.runtimeSource === 'detected' || agent?.runtimeSource === 'builtin',
          configuredOnly: agent?.runtimeSource === 'configured',
          configuredCliPath,
          effectiveCliPath: configuredCliPath || agent?.cliPath || '',
          health: healthState[backend] || { status: 'idle' },
        };
      })
      .sort((left, right) => {
        if (left.detected !== right.detected) {
          return left.detected ? -1 : 1;
        }
        if (Boolean(left.configuredCliPath) !== Boolean(right.configuredCliPath)) {
          return left.configuredCliPath ? -1 : 1;
        }
        return left.meta.backend.localeCompare(right.meta.backend);
      });
  }, [acpConfig, availableAgentMap, codexConfig, healthState]);

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

  return (
    <div className='space-y-16px'>
      {messageContext}

      <div className='px-[12px] md:px-[32px] py-16px bg-2 rd-16px space-y-16px'>
        <div className='flex items-start justify-between gap-16px flex-wrap'>
          <div className='space-y-4px'>
            <div className='text-15px text-t-primary font-600'>
              {t('settings.runtimeManager.title', {
                defaultValue: 'Runtime Management',
              })}
            </div>
            <div className='text-13px text-t-secondary max-w-720px'>
              {t('settings.runtimeManager.description', {
                defaultValue:
                  'Manage local coding runtimes such as Claude Code and Codex. Backend identifiers stay unchanged; this page only manages installation guidance, CLI paths, authentication readiness, and health checks.',
              })}
            </div>
          </div>

          <Button onClick={() => void loadRuntimeState()} loading={loading}>
            {t('settings.runtimeManager.refresh', {
              defaultValue: 'Refresh',
            })}
          </Button>
        </div>

        <Alert
          type='info'
          content={t('settings.runtimeManager.note', {
            defaultValue:
              'Configured CLI paths override automatic PATH detection. Health checks use the saved path and are the final source of truth for whether a runtime can actually start.',
          })}
        />

        <div className='grid grid-cols-1 xl:grid-cols-2 gap-12px'>
          {runtimeCards.map(
            ({
              backend,
              meta,
              backendConfig,
              agent,
              detected,
              configuredOnly,
              configuredCliPath,
              effectiveCliPath,
              health,
            }) => (
              <div key={backend} className='rd-16px border border-border-2 bg-bg-1 p-16px space-y-12px'>
                <div className='flex items-start justify-between gap-12px flex-wrap'>
                  <div className='space-y-4px'>
                    <div className='text-15px font-600 text-t-primary'>{backendConfig.name}</div>
                    <div className='text-13px text-t-secondary'>
                      {t(meta.descriptionKey, {
                        defaultValue: meta.descriptionDefault,
                      })}
                    </div>
                  </div>

                  <Space wrap>
                    <Tag
                      color={
                        health.status === 'ready' || detected
                          ? 'green'
                          : configuredCliPath || configuredOnly
                            ? 'orange'
                            : 'gray'
                      }
                    >
                      {health.status === 'ready'
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
                              })}
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

                <div className='grid grid-cols-1 md:grid-cols-2 gap-10px text-13px'>
                  <div>
                    <div className='text-t-secondary'>
                      {t('settings.runtimeManager.cliCommand', {
                        defaultValue: 'CLI Command',
                      })}
                    </div>
                    <div className='text-t-primary break-all'>{backendConfig.cliCommand || '-'}</div>
                  </div>
                  <div>
                    <div className='text-t-secondary'>
                      {t('settings.runtimeManager.currentPath', {
                        defaultValue: 'Current Runtime Path',
                      })}
                    </div>
                    <div className='text-t-primary break-all'>
                      {effectiveCliPath || backendConfig.cliCommand || '-'}
                    </div>
                  </div>
                  <div>
                    <div className='text-t-secondary'>
                      {t('settings.runtimeManager.reportedPath', {
                        defaultValue: 'Reported Runtime Path',
                      })}
                    </div>
                    <div className='text-t-primary break-all'>{agent?.cliPath || '-'}</div>
                  </div>
                  <div>
                    <div className='text-t-secondary'>
                      {t('settings.runtimeManager.healthTitle', {
                        defaultValue: 'Health Status',
                      })}
                    </div>
                    <div className='text-t-primary break-all'>
                      {health.status === 'checking'
                        ? t('settings.runtimeManager.health.checking', {
                            defaultValue: 'Checking...',
                          })
                        : health.message || '-'}
                      {health.status === 'ready' && health.latency !== undefined ? ` (${health.latency}ms)` : ''}
                    </div>
                  </div>
                </div>

                <div className='space-y-8px'>
                  <div className='text-13px font-500 text-t-primary'>
                    {t('settings.runtimeManager.customPathLabel', {
                      defaultValue: 'Custom CLI Path',
                    })}
                  </div>
                  <div className='flex flex-col md:flex-row gap-8px'>
                    <Input
                      value={runtimePathDrafts[backend] || ''}
                      onChange={(value) => handleRuntimePathChange(backend, value)}
                      placeholder={backendConfig.cliCommand || backendConfig.defaultCliPath || ''}
                    />
                    <Space wrap>
                      <Button onClick={() => void handleSaveRuntimePath(backend)}>
                        {t('settings.runtimeManager.savePath', {
                          defaultValue: 'Save Path',
                        })}
                      </Button>
                      <Button onClick={() => void handleResetRuntimePath(backend)}>
                        {t('settings.runtimeManager.resetPath', {
                          defaultValue: 'Reset',
                        })}
                      </Button>
                    </Space>
                  </div>
                </div>

                <Space wrap>
                  <Button loading={health.status === 'checking'} onClick={() => void handleHealthCheck(backend)}>
                    {t('settings.runtimeManager.checkHealth', {
                      defaultValue: 'Check Health',
                    })}
                  </Button>
                  {meta.installCommand ? (
                    <Button
                      onClick={() =>
                        void handleCopy(
                          meta.installCommand!,
                          'settings.runtimeManager.installCommandCopied',
                          'Install command copied.'
                        )
                      }
                    >
                      {t('settings.runtimeManager.copyInstallCommand', {
                        defaultValue: 'Copy Install Command',
                      })}
                    </Button>
                  ) : null}
                  {meta.loginCommand ? (
                    <Button
                      onClick={() =>
                        void handleCopy(
                          meta.loginCommand!,
                          'settings.runtimeManager.loginCommandCopied',
                          'Login command copied.'
                        )
                      }
                    >
                      {t('settings.runtimeManager.copyLoginCommand', {
                        defaultValue: 'Copy Login Command',
                      })}
                    </Button>
                  ) : null}
                  {meta.docsUrl ? (
                    <Button onClick={() => void handleOpenDocs(meta.docsUrl)}>
                      {t('settings.runtimeManager.openGuide', {
                        defaultValue: 'Open Guide',
                      })}
                    </Button>
                  ) : null}
                </Space>

                {meta.installCommand ? (
                  <Alert
                    type='info'
                    content={`${t('settings.runtimeManager.installCommandLabel', {
                      defaultValue: 'Suggested Install Command',
                    })}: ${meta.installCommand}`}
                  />
                ) : null}
              </div>
            )
          )}
        </div>
      </div>

      <div className='px-[12px] md:px-[32px] py-16px bg-2 rd-16px space-y-16px'>
        <div className='flex items-start justify-between gap-16px flex-wrap'>
          <div className='space-y-4px'>
            <div className='text-15px text-t-primary font-600'>
              {t('settings.runtimeManager.customSectionTitle', {
                defaultValue: 'Custom Runtime Adapters',
              })}
            </div>
            <div className='text-13px text-t-secondary max-w-720px'>
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
                  <div key={agent.id} className='p-4 bg-fill-2 rounded-lg'>
                    <div className='flex items-center justify-between mb-2'>
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
                    <div className='text-sm text-t-secondary space-y-2px'>
                      <div>
                        <span className='font-medium'>
                          {t('settings.runtimeManager.currentPath', {
                            defaultValue: 'Current Runtime Path',
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
          {agentToDelete ? <strong className='block mt-2'>{agentToDelete.name}</strong> : null}
        </Typography.Paragraph>
      </ContextGoModal>
    </div>
  );
};

export default CustomAcpAgent;
