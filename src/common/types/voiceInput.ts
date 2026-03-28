export const VOICE_INPUT_PROVIDER_IDS = ['dashscope', 'volcengine', 'openWhisper'] as const;

export type VoiceInputProviderId = (typeof VOICE_INPUT_PROVIDER_IDS)[number];

export const VOICE_INPUT_EXTERNAL_OPTION_IDS = ['wechat-input-method'] as const;

export type VoiceInputExternalOptionId = (typeof VOICE_INPUT_EXTERNAL_OPTION_IDS)[number];

export const VOICE_INPUT_OPEN_WHISPER_MODEL_IDS = ['tiny', 'base', 'small', 'medium', 'large-v3-turbo'] as const;

export type VoiceInputOpenWhisperModelId = (typeof VOICE_INPUT_OPEN_WHISPER_MODEL_IDS)[number];

export const VOICE_INPUT_TRIGGER_MODES = ['fn_hold', 'right_command_hold'] as const;

export type VoiceInputTriggerMode = (typeof VOICE_INPUT_TRIGGER_MODES)[number];

export const VOICE_INPUT_REGIONS = ['beijing', 'singapore'] as const;

export type VoiceInputRegion = (typeof VOICE_INPUT_REGIONS)[number];

export type VoiceInputExternalOption = {
  id: VoiceInputExternalOptionId;
  detected: boolean;
  installedPath?: string;
  bundleId?: string;
  downloadUrl?: string;
};

export type VoiceInputDashScopeConfig = {
  apiKey: string;
  region: VoiceInputRegion;
  model: string;
  languageHints: string[];
  vocabularyId?: string;
  phraseId?: string;
  hotwords: string[];
};

export type VoiceInputVolcengineConfig = {
  appKey: string;
  accessKey: string;
  resourceId: string;
  model: string;
  boostingTableId?: string;
  correctTableId?: string;
  hotwords: string[];
};

export type VoiceInputOpenWhisperConfig = {
  cliPath: string;
  modelId: VoiceInputOpenWhisperModelId;
  languageHints: string[];
  hotwords: string[];
};

export type VoiceInputConfig = {
  enabled: boolean;
  providerId: VoiceInputProviderId;
  triggerMode: VoiceInputTriggerMode;
  autoInsert: boolean;
  providers: {
    dashscope: VoiceInputDashScopeConfig;
    volcengine: VoiceInputVolcengineConfig;
    openWhisper: VoiceInputOpenWhisperConfig;
  };
};

export type VoiceInputOpenWhisperModelStatus = {
  id: VoiceInputOpenWhisperModelId;
  sizeBytes: number;
  installed: boolean;
  filePath: string;
};

export type VoiceInputOpenWhisperState = {
  supported: boolean;
  brewAvailable: boolean;
  runtimeInstalled: boolean;
  cliPath?: string;
  brewPath?: string;
  modelDirectory: string;
  selectedModelId: VoiceInputOpenWhisperModelId;
  selectedModelInstalled: boolean;
  models: VoiceInputOpenWhisperModelStatus[];
  lastError?: string;
};

export type VoiceInputRuntimeStatus =
  | 'idle'
  | 'recording'
  | 'transcribing'
  | 'inserted'
  | 'copied'
  | 'error'
  | 'unsupported';

export type VoiceInputPermissionState = 'granted' | 'denied' | 'restricted' | 'not-determined' | 'unsupported';

export type VoiceInputPermissions = {
  microphone: VoiceInputPermissionState;
  accessibility: VoiceInputPermissionState;
};

export type VoiceInputState = {
  supported: boolean;
  enabled: boolean;
  providerId: VoiceInputProviderId;
  triggerMode: VoiceInputTriggerMode;
  status: VoiceInputRuntimeStatus;
  permissions: VoiceInputPermissions;
  lastTranscript?: string;
  lastError?: string;
  sourceAppName?: string;
  updatedAt: number;
};

export type VoiceInputRecordStatus = 'inserted' | 'copied' | 'recorded' | 'failed';

export type VoiceInputRecord = {
  id: string;
  providerId: VoiceInputProviderId;
  triggerMode: VoiceInputTriggerMode;
  status: VoiceInputRecordStatus;
  transcript: string;
  transcriptLength: number;
  sourceAppName?: string;
  sourceBundleId?: string;
  model?: string;
  languageHints: string[];
  vocabularyId?: string;
  hotwords: string[];
  durationMs?: number;
  errorMessage?: string;
  createdAt: number;
};

export type VoiceInputStats = {
  totalTranscriptionCount: number;
  totalRecordingDurationMs: number;
  totalTranscribedCharacterCount: number;
};

export const EMPTY_VOICE_INPUT_STATS: VoiceInputStats = {
  totalTranscriptionCount: 0,
  totalRecordingDurationMs: 0,
  totalTranscribedCharacterCount: 0,
};

export const DEFAULT_VOICE_INPUT_CONFIG: VoiceInputConfig = {
  enabled: false,
  providerId: 'dashscope',
  triggerMode: 'right_command_hold',
  autoInsert: true,
  providers: {
    dashscope: {
      apiKey: '',
      region: 'beijing',
      model: 'fun-asr-realtime',
      languageHints: ['zh'],
      vocabularyId: '',
      phraseId: '',
      hotwords: [],
    },
    volcengine: {
      appKey: '',
      accessKey: '',
      resourceId: 'volc.bigasr.sauc.duration',
      model: 'bigmodel',
      boostingTableId: '',
      correctTableId: '',
      hotwords: [],
    },
    openWhisper: {
      cliPath: '',
      modelId: 'base',
      languageHints: ['zh'],
      hotwords: [],
    },
  },
};
