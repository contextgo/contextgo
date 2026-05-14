import { ipcBridge } from '@/common';
import type {
  VoiceInputConfig,
  VoiceInputExternalOption,
  VoiceInputOpenWhisperModelId,
  VoiceInputOpenWhisperState,
  VoiceInputState,
  VoiceInputStats,
} from '@/common/types/voiceInput';
import { DEFAULT_VOICE_INPUT_CONFIG, EMPTY_VOICE_INPUT_STATS } from '@/common/types/voiceInput';
import { Alert, Button, Form, Input, Select, Space, Switch, Tag, Typography } from '@arco-design/web-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './VoiceInputSection.module.css';

const OPEN_WHISPER_MODELS: Array<{
  id: VoiceInputOpenWhisperModelId;
  sizeBytes: number;
  recommendedMemoryGb: number;
}> = [
  { id: 'tiny', sizeBytes: 77_691_713, recommendedMemoryGb: 4 },
  { id: 'base', sizeBytes: 147_951_465, recommendedMemoryGb: 8 },
  { id: 'small', sizeBytes: 487_601_967, recommendedMemoryGb: 8 },
  { id: 'medium', sizeBytes: 1_533_763_059, recommendedMemoryGb: 16 },
  { id: 'large-v3-turbo', sizeBytes: 1_624_555_275, recommendedMemoryGb: 16 },
];

const splitListInput = (value: string): string[] => {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter((item, index, list) => item.length > 0 && list.indexOf(item) === index);
};

const formatNumber = (value: number): string => {
  return new Intl.NumberFormat().format(value);
};

const formatDuration = (translate: (key: string) => string, durationMs: number): string => {
  const totalSeconds = Math.floor(durationMs / 1000);
  if (totalSeconds <= 0) {
    return translate('settings.voiceInput.durationLessThanSecond');
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours}${translate('settings.voiceInput.durationHoursShort')}`);
  }

  if (minutes > 0) {
    parts.push(`${minutes}${translate('settings.voiceInput.durationMinutesShort')}`);
  }

  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds}${translate('settings.voiceInput.durationSecondsShort')}`);
  }

  return parts.join(' ');
};

const formatFileSize = (value: number): string => {
  if (value >= 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  return `${Math.round(value / (1024 * 1024))} MB`;
};

const statusColorMap: Record<string, string> = {
  idle: 'gray',
  recording: 'red',
  transcribing: 'orange',
  inserted: 'green',
  copied: 'arcoblue',
  error: 'orangered',
  unsupported: 'gray',
  granted: 'green',
  denied: 'red',
  restricted: 'orange',
  'not-determined': 'gray',
  copied_status: 'arcoblue',
  recorded: 'gray',
  failed: 'red',
};

const VoiceInputSection: React.FC = () => {
  const { t } = useTranslation();
  const voiceInputApi = ipcBridge.voiceInput;
  const [draft, setDraft] = useState<VoiceInputConfig>(DEFAULT_VOICE_INPUT_CONFIG);
  const [state, setState] = useState<VoiceInputState | null>(null);
  const [stats, setStats] = useState<VoiceInputStats>(EMPTY_VOICE_INPUT_STATS);
  const [externalOptions, setExternalOptions] = useState<VoiceInputExternalOption[]>([]);
  const [openWhisperState, setOpenWhisperState] = useState<VoiceInputOpenWhisperState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<
    'permissions' | 'start' | 'stop' | 'install-runtime' | 'install-model' | null
  >(null);

  const dashScopeConfig = draft.providers.dashscope;
  const volcengineConfig = draft.providers.volcengine;
  const openWhisperConfig = draft.providers.openWhisper;
  const dashScopeLanguageHintsText = useMemo(
    () => dashScopeConfig.languageHints.join(', '),
    [dashScopeConfig.languageHints]
  );
  const volcengineHotwordsText = useMemo(() => volcengineConfig.hotwords.join('\n'), [volcengineConfig.hotwords]);
  const openWhisperLanguageHintsText = useMemo(
    () => openWhisperConfig.languageHints.join(', '),
    [openWhisperConfig.languageHints]
  );
  const openWhisperHotwordsText = useMemo(() => openWhisperConfig.hotwords.join('\n'), [openWhisperConfig.hotwords]);
  const openWhisperSelectedModelStatus = useMemo(() => {
    return openWhisperState?.models.find((item) => item.id === openWhisperConfig.modelId) ?? null;
  }, [openWhisperConfig.modelId, openWhisperState]);
  const openWhisperSelectedModelDefinition = useMemo(() => {
    return OPEN_WHISPER_MODELS.find((item) => item.id === openWhisperConfig.modelId) ?? null;
  }, [openWhisperConfig.modelId]);
  const wechatInputMethodOption = useMemo(() => {
    return externalOptions.find((item) => item.id === 'wechat-input-method') ?? null;
  }, [externalOptions]);
  const providerOptions = useMemo(
    () => [
      { label: t('settings.voiceInput.providers.dashscope'), value: 'dashscope' },
      { label: t('settings.voiceInput.providers.volcengine'), value: 'volcengine' },
      { label: t('settings.voiceInput.providers.openWhisper'), value: 'openWhisper' },
    ],
    [t]
  );
  const openWhisperModelOptions = useMemo(
    () =>
      OPEN_WHISPER_MODELS.map((item) => ({
        label: `${t(`settings.voiceInput.openWhisper.models.${item.id}.label`)} · ${formatFileSize(item.sizeBytes)}`,
        value: item.id,
      })),
    [t]
  );
  const statItems = useMemo(
    () => [
      {
        label: t('settings.voiceInput.totalTranscriptions'),
        value: formatNumber(stats.totalTranscriptionCount),
      },
      {
        label: t('settings.voiceInput.totalRecordingDuration'),
        value: formatDuration(t, stats.totalRecordingDurationMs),
      },
      {
        label: t('settings.voiceInput.totalTranscribedCharacters'),
        value: formatNumber(stats.totalTranscribedCharacterCount),
      },
    ],
    [stats, t]
  );

  const refreshRuntimeData = async (): Promise<void> => {
    if (!voiceInputApi) {
      setState({
        supported: false,
        enabled: false,
        providerId: DEFAULT_VOICE_INPUT_CONFIG.providerId,
        triggerMode: DEFAULT_VOICE_INPUT_CONFIG.triggerMode,
        status: 'unsupported',
        permissions: {
          microphone: 'unsupported',
          accessibility: 'unsupported',
        },
        updatedAt: Date.now(),
      });
      setStats(EMPTY_VOICE_INPUT_STATS);
      return;
    }

    const [nextState, nextStats] = await Promise.all([
      voiceInputApi.getState.invoke(),
      voiceInputApi.getStats.invoke(),
    ]);
    setState(nextState);
    setStats(nextStats);
  };

  const refreshOpenWhisper = async (): Promise<void> => {
    if (!voiceInputApi) {
      setOpenWhisperState(null);
      return;
    }

    const nextState = await voiceInputApi.getOpenWhisperState.invoke();
    setOpenWhisperState(nextState);
  };

  const refreshExternalOptions = async (): Promise<void> => {
    if (!voiceInputApi) {
      setExternalOptions([]);
      return;
    }

    const nextOptions = await voiceInputApi.getExternalOptions.invoke();
    setExternalOptions(nextOptions);
  };

  const refresh = async (): Promise<void> => {
    if (!voiceInputApi) {
      setDraft(DEFAULT_VOICE_INPUT_CONFIG);
      await Promise.all([refreshRuntimeData(), refreshOpenWhisper(), refreshExternalOptions()]);
      return;
    }

    const config = await voiceInputApi.getConfig.invoke();
    setDraft(config);
    await Promise.all([refreshRuntimeData(), refreshOpenWhisper(), refreshExternalOptions()]);
  };

  const persistDraft = async (): Promise<VoiceInputConfig | null> => {
    if (!voiceInputApi) {
      return null;
    }

    const saved = await voiceInputApi.setConfig.invoke({ config: draft });
    setDraft(saved);
    await refreshOpenWhisper();
    return saved;
  };

  useEffect(() => {
    let disposed = false;

    void refresh()
      .catch((error) => {
        console.error('[VoiceInputSection] Failed to load voice input data:', error);
      })
      .finally(() => {
        if (!disposed) {
          setLoading(false);
        }
      });

    const unsubscribe = voiceInputApi?.stateChanged.on((nextState) => {
      if (!disposed) {
        setState(nextState);
        void voiceInputApi.getStats
          .invoke()
          .then((nextStats) => {
            if (!disposed) {
              setStats(nextStats);
            }
          })
          .catch(() => {});
      }
    });

    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [voiceInputApi]);

  const updateDraft = (updater: (current: VoiceInputConfig) => VoiceInputConfig): void => {
    setDraft((current) => updater(current));
  };

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    try {
      await persistDraft();
      await Promise.all([refreshRuntimeData(), refreshOpenWhisper()]);
    } finally {
      setSaving(false);
    }
  };

  const handleRequestPermissions = async (): Promise<void> => {
    setActionLoading('permissions');
    try {
      await voiceInputApi?.requestPermissions.invoke();
      await refreshRuntimeData();
    } finally {
      setActionLoading(null);
    }
  };

  const handleStart = async (): Promise<void> => {
    setActionLoading('start');
    try {
      await persistDraft();
      await voiceInputApi?.startManualCapture.invoke();
      await refreshRuntimeData();
    } finally {
      setActionLoading(null);
    }
  };

  const handleStop = async (): Promise<void> => {
    setActionLoading('stop');
    try {
      await voiceInputApi?.stopManualCapture.invoke();
      await refreshRuntimeData();
    } finally {
      setActionLoading(null);
    }
  };

  const handleInstallOpenWhisperRuntime = async (): Promise<void> => {
    if (!voiceInputApi) {
      return;
    }

    setActionLoading('install-runtime');
    try {
      await persistDraft();
      const nextState = await voiceInputApi.installOpenWhisperRuntime.invoke();
      setOpenWhisperState(nextState);
    } finally {
      setActionLoading(null);
    }
  };

  const handleInstallOpenWhisperModel = async (): Promise<void> => {
    if (!voiceInputApi) {
      return;
    }

    setActionLoading('install-model');
    try {
      await persistDraft();
      const nextState = await voiceInputApi.installOpenWhisperModel.invoke({
        modelId: openWhisperConfig.modelId,
      });
      setOpenWhisperState(nextState);
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenExternalOptionUrl = async (url: string | undefined): Promise<void> => {
    if (!url) {
      return;
    }

    try {
      await ipcBridge.shell.openExternal.invoke(url);
    } catch (error) {
      console.error('[VoiceInputSection] Failed to open external voice input URL:', error);
    }
  };

  const handleRevealInstalledApp = async (path: string | undefined): Promise<void> => {
    if (!path) {
      return;
    }

    try {
      await ipcBridge.shell.showItemInFolder.invoke(path);
    } catch (error) {
      console.error('[VoiceInputSection] Failed to reveal installed app:', error);
    }
  };

  const renderPermissionTag = (label: string, value: string | undefined) => (
    <div className='flex items-center justify-between gap-12px'>
      <span className='text-13px text-t-secondary'>{label}</span>
      <Tag color={statusColorMap[value || 'gray'] || 'gray'}>
        {t(`settings.voiceInput.permissions.${value || 'unsupported'}`)}
      </Tag>
    </div>
  );

  return (
    <div className={`${styles.voiceInputSection} px-[12px] md:px-[32px] py-16px bg-2 rd-16px space-y-16px`}>
      <div className='flex items-start justify-between gap-16px'>
        <div className='space-y-4px'>
          <div className='text-15px text-t-primary font-600'>{t('settings.voiceInput.title')}</div>
          <div className='text-13px text-t-secondary'>{t('settings.voiceInput.description')}</div>
        </div>
        <Switch
          checked={draft.enabled}
          onChange={(checked) =>
            updateDraft((current) => ({
              ...current,
              enabled: checked,
            }))
          }
        />
      </div>

      {state?.supported === false && <Alert type='warning' content={t('settings.voiceInput.platformNotSupported')} />}

      {wechatInputMethodOption ? (
        <div className='rd-12px bg-fill-2 p-12px space-y-8px'>
          <div className='flex items-center justify-between gap-12px flex-wrap'>
            <div className='space-y-4px'>
              <div className='text-14px text-t-primary font-600'>{t('settings.voiceInput.externalOptions.title')}</div>
              <Typography.Paragraph className='!mb-0 text-13px text-t-secondary whitespace-pre-wrap'>
                {t('settings.voiceInput.externalOptions.optionalDescription')}
              </Typography.Paragraph>
            </div>
            <Tag color={wechatInputMethodOption.detected ? 'green' : 'arcoblue'}>
              {t(
                wechatInputMethodOption.detected
                  ? 'settings.voiceInput.externalOptions.statuses.detected'
                  : 'settings.voiceInput.externalOptions.statuses.available'
              )}
            </Tag>
          </div>

          <div className='space-y-4px'>
            <div className='text-13px text-t-primary font-600'>
              {t('settings.voiceInput.externalOptions.wechatInputMethod.label')}
            </div>
            <Typography.Paragraph className='!mb-0 text-13px text-t-secondary whitespace-pre-wrap'>
              {t(
                wechatInputMethodOption.detected
                  ? 'settings.voiceInput.externalOptions.wechatInputMethod.detectedDescription'
                  : 'settings.voiceInput.externalOptions.wechatInputMethod.availableDescription'
              )}
            </Typography.Paragraph>
          </div>

          {wechatInputMethodOption.installedPath ? (
            <div className='flex items-center justify-between gap-12px'>
              <span className='text-13px text-t-secondary'>
                {t('settings.voiceInput.externalOptions.installedPath')}
              </span>
              <span className='text-13px text-t-primary text-right break-all'>
                {wechatInputMethodOption.installedPath}
              </span>
            </div>
          ) : null}

          <Space wrap>
            {wechatInputMethodOption.installedPath ? (
              <>
                <Button
                  size='small'
                  onClick={() => void handleRevealInstalledApp(wechatInputMethodOption.installedPath)}
                >
                  {t('settings.voiceInput.externalOptions.showInstalledApp')}
                </Button>
                {wechatInputMethodOption.downloadUrl ? (
                  <Button
                    size='small'
                    onClick={() => void handleOpenExternalOptionUrl(wechatInputMethodOption.downloadUrl)}
                  >
                    {t('common.website')}
                  </Button>
                ) : null}
              </>
            ) : (
              <Button
                size='small'
                type='primary'
                onClick={() => void handleOpenExternalOptionUrl(wechatInputMethodOption.downloadUrl)}
              >
                {t('common.download')}
              </Button>
            )}
          </Space>
        </div>
      ) : null}

      {loading ? null : (
        <Form layout='vertical' className='space-y-12px'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-12px'>
            <Form.Item label={t('settings.voiceInput.provider')}>
              <Select
                value={draft.providerId}
                options={providerOptions}
                onChange={(value) =>
                  updateDraft((current) => ({
                    ...current,
                    providerId: value as VoiceInputConfig['providerId'],
                  }))
                }
              />
            </Form.Item>
            <Form.Item label={t('settings.voiceInput.triggerMode')}>
              <Select
                value={draft.triggerMode}
                options={[
                  {
                    label: t('settings.voiceInput.triggerModes.right_command_hold'),
                    value: 'right_command_hold',
                  },
                  { label: t('settings.voiceInput.triggerModes.fn_hold'), value: 'fn_hold' },
                ]}
                onChange={(value) =>
                  updateDraft((current) => ({
                    ...current,
                    triggerMode: value as VoiceInputConfig['triggerMode'],
                  }))
                }
              />
            </Form.Item>
          </div>

          {draft.providerId === 'dashscope' ? (
            <>
              <Alert type='info' content={t('settings.voiceInput.providerHints.dashscope')} />
              <div className='grid grid-cols-1 md:grid-cols-2 gap-12px'>
                <Form.Item label={t('settings.voiceInput.dashscopeApiKey')}>
                  <Input.Password
                    value={dashScopeConfig.apiKey}
                    placeholder={t('settings.voiceInput.placeholders.dashscopeApiKey')}
                    onChange={(value) =>
                      updateDraft((current) => ({
                        ...current,
                        providers: {
                          ...current.providers,
                          dashscope: {
                            ...current.providers.dashscope,
                            apiKey: value,
                          },
                        },
                      }))
                    }
                  />
                </Form.Item>
                <Form.Item label={t('settings.voiceInput.model')}>
                  <Input
                    value={dashScopeConfig.model}
                    placeholder={t('settings.voiceInput.placeholders.dashscopeModel')}
                    onChange={(value) =>
                      updateDraft((current) => ({
                        ...current,
                        providers: {
                          ...current.providers,
                          dashscope: {
                            ...current.providers.dashscope,
                            model: value,
                          },
                        },
                      }))
                    }
                  />
                </Form.Item>
              </div>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-12px'>
                <Form.Item label={t('settings.voiceInput.region')}>
                  <Select
                    value={dashScopeConfig.region}
                    options={[
                      { label: t('settings.voiceInput.regions.beijing'), value: 'beijing' },
                      { label: t('settings.voiceInput.regions.singapore'), value: 'singapore' },
                    ]}
                    onChange={(value) =>
                      updateDraft((current) => ({
                        ...current,
                        providers: {
                          ...current.providers,
                          dashscope: {
                            ...current.providers.dashscope,
                            region: value as VoiceInputConfig['providers']['dashscope']['region'],
                          },
                        },
                      }))
                    }
                  />
                </Form.Item>
                <Form.Item label={t('settings.voiceInput.vocabularyId')}>
                  <Input
                    value={dashScopeConfig.vocabularyId}
                    placeholder={t('settings.voiceInput.placeholders.vocabularyId')}
                    onChange={(value) =>
                      updateDraft((current) => ({
                        ...current,
                        providers: {
                          ...current.providers,
                          dashscope: {
                            ...current.providers.dashscope,
                            vocabularyId: value,
                          },
                        },
                      }))
                    }
                  />
                </Form.Item>
              </div>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-12px'>
                <Form.Item label={t('settings.voiceInput.phraseId')}>
                  <Input
                    value={dashScopeConfig.phraseId}
                    placeholder={t('settings.voiceInput.placeholders.phraseId')}
                    onChange={(value) =>
                      updateDraft((current) => ({
                        ...current,
                        providers: {
                          ...current.providers,
                          dashscope: {
                            ...current.providers.dashscope,
                            phraseId: value,
                          },
                        },
                      }))
                    }
                  />
                </Form.Item>
                <Form.Item label={t('settings.voiceInput.languageHints')}>
                  <Input
                    value={dashScopeLanguageHintsText}
                    placeholder={t('settings.voiceInput.placeholders.languageHints')}
                    onChange={(value) =>
                      updateDraft((current) => ({
                        ...current,
                        providers: {
                          ...current.providers,
                          dashscope: {
                            ...current.providers.dashscope,
                            languageHints: splitListInput(value),
                          },
                        },
                      }))
                    }
                  />
                </Form.Item>
              </div>
            </>
          ) : null}

          {draft.providerId === 'volcengine' ? (
            <>
              <Alert type='info' content={t('settings.voiceInput.providerHints.volcengine')} />
              <div className='grid grid-cols-1 md:grid-cols-2 gap-12px'>
                <Form.Item label={t('settings.voiceInput.appKey')}>
                  <Input
                    value={volcengineConfig.appKey}
                    placeholder={t('settings.voiceInput.placeholders.volcengineAppKey')}
                    onChange={(value) =>
                      updateDraft((current) => ({
                        ...current,
                        providers: {
                          ...current.providers,
                          volcengine: {
                            ...current.providers.volcengine,
                            appKey: value,
                          },
                        },
                      }))
                    }
                  />
                </Form.Item>
                <Form.Item label={t('settings.voiceInput.accessKey')}>
                  <Input.Password
                    value={volcengineConfig.accessKey}
                    placeholder={t('settings.voiceInput.placeholders.volcengineAccessKey')}
                    onChange={(value) =>
                      updateDraft((current) => ({
                        ...current,
                        providers: {
                          ...current.providers,
                          volcengine: {
                            ...current.providers.volcengine,
                            accessKey: value,
                          },
                        },
                      }))
                    }
                  />
                </Form.Item>
              </div>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-12px'>
                <Form.Item label={t('settings.voiceInput.resourceId')}>
                  <Input
                    value={volcengineConfig.resourceId}
                    placeholder={t('settings.voiceInput.placeholders.resourceId')}
                    onChange={(value) =>
                      updateDraft((current) => ({
                        ...current,
                        providers: {
                          ...current.providers,
                          volcengine: {
                            ...current.providers.volcengine,
                            resourceId: value,
                          },
                        },
                      }))
                    }
                  />
                </Form.Item>
                <Form.Item label={t('settings.voiceInput.model')}>
                  <Input
                    value={volcengineConfig.model}
                    placeholder={t('settings.voiceInput.placeholders.volcengineModel')}
                    onChange={(value) =>
                      updateDraft((current) => ({
                        ...current,
                        providers: {
                          ...current.providers,
                          volcengine: {
                            ...current.providers.volcengine,
                            model: value,
                          },
                        },
                      }))
                    }
                  />
                </Form.Item>
              </div>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-12px'>
                <Form.Item label={t('settings.voiceInput.boostingTableId')}>
                  <Input
                    value={volcengineConfig.boostingTableId}
                    placeholder={t('settings.voiceInput.placeholders.boostingTableId')}
                    onChange={(value) =>
                      updateDraft((current) => ({
                        ...current,
                        providers: {
                          ...current.providers,
                          volcengine: {
                            ...current.providers.volcengine,
                            boostingTableId: value,
                          },
                        },
                      }))
                    }
                  />
                </Form.Item>
                <Form.Item label={t('settings.voiceInput.correctTableId')}>
                  <Input
                    value={volcengineConfig.correctTableId}
                    placeholder={t('settings.voiceInput.placeholders.correctTableId')}
                    onChange={(value) =>
                      updateDraft((current) => ({
                        ...current,
                        providers: {
                          ...current.providers,
                          volcengine: {
                            ...current.providers.volcengine,
                            correctTableId: value,
                          },
                        },
                      }))
                    }
                  />
                </Form.Item>
              </div>

              <Form.Item label={t('settings.voiceInput.hotwords')}>
                <Input.TextArea
                  autoSize={{ minRows: 3, maxRows: 6 }}
                  value={volcengineHotwordsText}
                  placeholder={t('settings.voiceInput.hotwordsPlaceholder')}
                  onChange={(value) =>
                    updateDraft((current) => ({
                      ...current,
                      providers: {
                        ...current.providers,
                        volcengine: {
                          ...current.providers.volcengine,
                          hotwords: splitListInput(value),
                        },
                      },
                    }))
                  }
                />
              </Form.Item>
            </>
          ) : null}

          {draft.providerId === 'openWhisper' ? (
            <>
              <Alert type='info' content={t('settings.voiceInput.providerHints.openWhisper')} />
              <div className='grid grid-cols-1 md:grid-cols-2 gap-12px'>
                <Form.Item label={t('settings.voiceInput.cliPath')}>
                  <Input
                    value={openWhisperConfig.cliPath}
                    placeholder={t('settings.voiceInput.placeholders.openWhisperCliPath')}
                    onChange={(value) =>
                      updateDraft((current) => ({
                        ...current,
                        providers: {
                          ...current.providers,
                          openWhisper: {
                            ...current.providers.openWhisper,
                            cliPath: value,
                          },
                        },
                      }))
                    }
                  />
                </Form.Item>
                <Form.Item label={t('settings.voiceInput.model')}>
                  <Select
                    value={openWhisperConfig.modelId}
                    options={openWhisperModelOptions}
                    onChange={(value) =>
                      updateDraft((current) => ({
                        ...current,
                        providers: {
                          ...current.providers,
                          openWhisper: {
                            ...current.providers.openWhisper,
                            modelId: value as VoiceInputOpenWhisperModelId,
                          },
                        },
                      }))
                    }
                  />
                </Form.Item>
              </div>

              <Form.Item label={t('settings.voiceInput.languageHints')}>
                <Input
                  value={openWhisperLanguageHintsText}
                  placeholder={t('settings.voiceInput.placeholders.languageHints')}
                  onChange={(value) =>
                    updateDraft((current) => ({
                      ...current,
                      providers: {
                        ...current.providers,
                        openWhisper: {
                          ...current.providers.openWhisper,
                          languageHints: splitListInput(value),
                        },
                      },
                    }))
                  }
                />
              </Form.Item>

              <Form.Item label={t('settings.voiceInput.hotwords')}>
                <Input.TextArea
                  autoSize={{ minRows: 3, maxRows: 6 }}
                  value={openWhisperHotwordsText}
                  placeholder={t('settings.voiceInput.hotwordsPlaceholder')}
                  onChange={(value) =>
                    updateDraft((current) => ({
                      ...current,
                      providers: {
                        ...current.providers,
                        openWhisper: {
                          ...current.providers.openWhisper,
                          hotwords: splitListInput(value),
                        },
                      },
                    }))
                  }
                />
              </Form.Item>

              <div className='rd-12px bg-fill-2 p-12px space-y-8px'>
                <div className='flex items-center justify-between gap-12px flex-wrap'>
                  <div className='text-14px text-t-primary font-600'>{t('settings.voiceInput.localRuntime')}</div>
                  <Tag
                    color={
                      openWhisperState?.runtimeInstalled && openWhisperSelectedModelStatus?.installed
                        ? 'green'
                        : 'orange'
                    }
                  >
                    {openWhisperState?.runtimeInstalled
                      ? t('settings.voiceInput.runtimeReady')
                      : t('settings.voiceInput.runtimeMissing')}
                  </Tag>
                </div>

                {draft.enabled &&
                (!openWhisperState?.runtimeInstalled || openWhisperSelectedModelStatus?.installed !== true) ? (
                  <Alert type='warning' content={t('settings.voiceInput.enableRequiresInstall')} />
                ) : null}

                <div className='grid grid-cols-1 md:grid-cols-2 gap-8px'>
                  <div className='flex items-center justify-between gap-12px'>
                    <span className='text-13px text-t-secondary'>{t('settings.voiceInput.runtimePath')}</span>
                    <span className='text-13px text-t-primary text-right break-all'>
                      {openWhisperState?.cliPath || '-'}
                    </span>
                  </div>
                  <div className='flex items-center justify-between gap-12px'>
                    <span className='text-13px text-t-secondary'>{t('settings.voiceInput.modelDirectory')}</span>
                    <span className='text-13px text-t-primary text-right break-all'>
                      {openWhisperState?.modelDirectory || '-'}
                    </span>
                  </div>
                  <div className='flex items-center justify-between gap-12px'>
                    <span className='text-13px text-t-secondary'>{t('settings.voiceInput.selectedModelStatus')}</span>
                    <Tag color={openWhisperSelectedModelStatus?.installed ? 'green' : 'orange'}>
                      {openWhisperSelectedModelStatus?.installed
                        ? t('settings.voiceInput.modelInstalled')
                        : t('settings.voiceInput.modelNotInstalled')}
                    </Tag>
                  </div>
                  <div className='flex items-center justify-between gap-12px'>
                    <span className='text-13px text-t-secondary'>{t('settings.voiceInput.modelSummary')}</span>
                    <span className='text-13px text-t-primary text-right break-all'>
                      {t(`settings.voiceInput.openWhisper.models.${openWhisperConfig.modelId}.label`)}
                    </span>
                  </div>
                </div>

                <Typography.Paragraph className='!mb-0 text-12px text-t-secondary whitespace-pre-wrap'>
                  {t(`settings.voiceInput.openWhisper.models.${openWhisperConfig.modelId}.description`)}
                </Typography.Paragraph>

                <div className='rd-12px bg-[var(--color-fill-1)] p-12px space-y-8px'>
                  <div className='text-13px text-t-primary font-600'>
                    {t('settings.voiceInput.hardwareRequirements')}
                  </div>
                  <Typography.Paragraph className='!mb-0 text-12px text-t-secondary whitespace-pre-wrap'>
                    {t('settings.voiceInput.localProcessingNotice')}
                  </Typography.Paragraph>
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-8px'>
                    <div className='flex items-center justify-between gap-12px'>
                      <span className='text-12px text-t-secondary'>{t('settings.voiceInput.estimatedStorage')}</span>
                      <span className='text-12px text-t-primary'>
                        {openWhisperSelectedModelDefinition
                          ? formatFileSize(openWhisperSelectedModelDefinition.sizeBytes)
                          : '-'}
                      </span>
                    </div>
                    <div className='flex items-center justify-between gap-12px'>
                      <span className='text-12px text-t-secondary'>{t('settings.voiceInput.recommendedMemory')}</span>
                      <span className='text-12px text-t-primary'>
                        {openWhisperSelectedModelDefinition
                          ? `${openWhisperSelectedModelDefinition.recommendedMemoryGb} GB+`
                          : '-'}
                      </span>
                    </div>
                  </div>
                  <Typography.Paragraph className='!mb-0 text-12px text-t-secondary whitespace-pre-wrap'>
                    {t('settings.voiceInput.cpuLoadNotice')}
                  </Typography.Paragraph>
                  <Typography.Paragraph className='!mb-0 text-12px text-t-secondary whitespace-pre-wrap'>
                    {t('settings.voiceInput.installOnDemandHint')}
                  </Typography.Paragraph>
                </div>

                {!openWhisperState?.brewAvailable && !openWhisperState?.runtimeInstalled ? (
                  <Alert type='warning' content={t('settings.voiceInput.brewRequired')} />
                ) : null}

                {openWhisperState?.lastError ? <Alert type='error' content={openWhisperState.lastError} /> : null}

                <Space wrap>
                  <Button
                    loading={actionLoading === 'install-runtime'}
                    disabled={openWhisperState?.runtimeInstalled === true}
                    onClick={() => void handleInstallOpenWhisperRuntime()}
                  >
                    {t('settings.voiceInput.installRuntime')}
                  </Button>
                  <Button
                    loading={actionLoading === 'install-model'}
                    disabled={openWhisperSelectedModelStatus?.installed === true}
                    onClick={() => void handleInstallOpenWhisperModel()}
                  >
                    {t('settings.voiceInput.installSelectedModel')}
                  </Button>
                </Space>
              </div>
            </>
          ) : null}

          <div className='flex items-center justify-between gap-12px flex-wrap'>
            <div className='flex items-center gap-8px'>
              <span className='text-13px text-t-secondary'>{t('settings.voiceInput.autoInsert')}</span>
              <Switch
                checked={draft.autoInsert}
                onChange={(checked) =>
                  updateDraft((current) => ({
                    ...current,
                    autoInsert: checked,
                  }))
                }
              />
            </div>
            <Space wrap>
              <Button loading={saving} type='primary' onClick={() => void handleSave()}>
                {t('common.save')}
              </Button>
              <Button loading={actionLoading === 'permissions'} onClick={() => void handleRequestPermissions()}>
                {t('settings.voiceInput.requestPermissions')}
              </Button>
              <Button loading={actionLoading === 'start'} onClick={() => void handleStart()}>
                {t('settings.voiceInput.startTest')}
              </Button>
              <Button loading={actionLoading === 'stop'} onClick={() => void handleStop()}>
                {t('settings.voiceInput.stopTest')}
              </Button>
            </Space>
          </div>
        </Form>
      )}

      {state && (
        <div className='space-y-8px'>
          <div className='text-14px text-t-primary font-600'>{t('settings.voiceInput.runtime')}</div>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-8px'>
            <div className='flex items-center justify-between gap-12px'>
              <span className='text-13px text-t-secondary'>{t('settings.voiceInput.currentStatus')}</span>
              <Tag color={statusColorMap[state.status] || 'gray'}>
                {t(`settings.voiceInput.statuses.${state.status}`)}
              </Tag>
            </div>
            {renderPermissionTag(t('settings.voiceInput.microphonePermission'), state.permissions.microphone)}
            {renderPermissionTag(t('settings.voiceInput.accessibilityPermission'), state.permissions.accessibility)}
            <div className='flex items-center justify-between gap-12px'>
              <span className='text-13px text-t-secondary'>{t('settings.voiceInput.sourceApp')}</span>
              <span className='text-13px text-t-primary'>{state.sourceAppName || '-'}</span>
            </div>
          </div>

          {state.lastTranscript && (
            <div className='space-y-4px'>
              <div className='text-13px text-t-secondary'>{t('settings.voiceInput.lastTranscript')}</div>
              <Typography.Paragraph className='!mb-0 text-13px text-t-primary whitespace-pre-wrap'>
                {state.lastTranscript}
              </Typography.Paragraph>
            </div>
          )}

          {state.lastError && <Alert type='error' content={state.lastError} />}
        </div>
      )}

      <div className='space-y-8px'>
        <div className='flex items-center justify-between gap-12px'>
          <div className='text-14px text-t-primary font-600'>{t('settings.voiceInput.activity')}</div>
          <Button size='mini' onClick={() => void refresh()}>
            {t('common.refresh')}
          </Button>
        </div>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-8px'>
          {statItems.map((item) => (
            <div key={item.label} className='rd-12px bg-fill-2 p-12px space-y-6px'>
              <div className='text-12px text-t-secondary'>{item.label}</div>
              <div className='text-22px leading-[1.2] font-600 text-t-primary break-words'>{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VoiceInputSection;
