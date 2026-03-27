import { describe, expect, it } from 'vitest';
import {
  createVoiceInputState,
  getDashScopeWebSocketUrl,
  getTriggerPressedState,
  isVoiceInputConfigured,
  normalizeVoiceInputConfig,
} from '@/process/bridge/services/voice/voiceInputConfig';

describe('normalizeVoiceInputConfig', () => {
  it('should fall back to defaults when the stored value is invalid', () => {
    const config = normalizeVoiceInputConfig({
      enabled: true,
      providerId: 'unknown',
      triggerMode: 'bad_mode',
      autoInsert: false,
      providers: {
        dashscope: {
          apiKey: '  test-key  ',
          region: 'singapore',
          model: '',
          languageHints: ['zh', 'zh', '', 'en'],
          vocabularyId: ' vocab-1 ',
          hotwords: ['aionui', 'aionui', 'voice'],
        },
        volcengine: {
          appKey: '  app-1  ',
          accessKey: '  access-1  ',
          resourceId: '  volc.custom.resource  ',
          model: '  ',
        },
      },
    });

    expect(config.providerId).toBe('dashscope');
    expect(config.triggerMode).toBe('right_command_hold');
    expect(config.autoInsert).toBe(false);
    expect(config.providers.dashscope.apiKey).toBe('test-key');
    expect(config.providers.dashscope.region).toBe('singapore');
    expect(config.providers.dashscope.model).toBe('fun-asr-realtime');
    expect(config.providers.dashscope.languageHints).toEqual(['zh', 'en']);
    expect(config.providers.dashscope.vocabularyId).toBe('vocab-1');
    expect(config.providers.dashscope.hotwords).toEqual(['aionui', 'voice']);
    expect(config.providers.volcengine.appKey).toBe('app-1');
    expect(config.providers.volcengine.accessKey).toBe('access-1');
    expect(config.providers.volcengine.resourceId).toBe('volc.custom.resource');
    expect(config.providers.volcengine.model).toBe('bigmodel');
  });

  it('should mark a config as unusable when the provider api key is missing', () => {
    const config = normalizeVoiceInputConfig(undefined);

    expect(isVoiceInputConfigured(config)).toBe(false);
    expect(createVoiceInputState({}, config).status).toBe('idle');
  });

  it('should treat volcengine as configured when required credentials are present', () => {
    const config = normalizeVoiceInputConfig({
      providerId: 'volcengine',
      providers: {
        volcengine: {
          appKey: 'app-key',
          accessKey: 'access-key',
          resourceId: '',
          model: 'custom-model',
        },
      },
    });

    expect(config.providerId).toBe('volcengine');
    expect(config.providers.volcengine.resourceId).toBe('volc.bigasr.sauc.duration');
    expect(config.providers.volcengine.model).toBe('custom-model');
    expect(isVoiceInputConfigured(config)).toBe(true);
  });
});

describe('getTriggerPressedState', () => {
  it('should detect fn hold transitions from modifier state', () => {
    expect(
      getTriggerPressedState('fn_hold', {
        keyCode: 63,
        modifiers: { command: false, option: false, fn: true },
      })
    ).toBe(true);
  });

  it('should detect right command hold from device flags when key code is missing', () => {
    expect(
      getTriggerPressedState('right_command_hold', {
        flags: 0x00000010,
        modifiers: { command: true, option: false, fn: false },
      })
    ).toBe(true);
  });

  it('should ignore unrelated modifier events', () => {
    expect(
      getTriggerPressedState('right_command_hold', {
        keyCode: 61,
        modifiers: { command: false, option: true, fn: false },
      })
    ).toBeNull();
  });
});

describe('getDashScopeWebSocketUrl', () => {
  it('should resolve regional websocket endpoints', () => {
    expect(getDashScopeWebSocketUrl('beijing')).toContain('dashscope.aliyuncs.com');
    expect(getDashScopeWebSocketUrl('singapore')).toContain('dashscope-intl.aliyuncs.com');
  });
});
