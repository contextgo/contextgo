import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  executablePaths: new Set<string>(),
  filePaths: new Set<string>(),
}));

const accessMock = vi.hoisted(() =>
  vi.fn(async (targetPath: string) => {
    if (!mockState.executablePaths.has(targetPath)) {
      const error = new Error(`ENOENT: ${targetPath}`) as Error & { code?: string };
      error.code = 'ENOENT';
      throw error;
    }
  })
);

const statMock = vi.hoisted(() =>
  vi.fn(async (targetPath: string) => {
    if (!mockState.executablePaths.has(targetPath) && !mockState.filePaths.has(targetPath)) {
      const error = new Error(`ENOENT: ${targetPath}`) as Error & { code?: string };
      error.code = 'ENOENT';
      throw error;
    }

    return {
      isFile: () => true,
    };
  })
);

const mkdirMock = vi.hoisted(() => vi.fn(async () => {}));
const writeFileMock = vi.hoisted(() => vi.fn(async () => {}));
const readFileMock = vi.hoisted(() => vi.fn(async () => '  ContextGo  '));
const rmMock = vi.hoisted(() => vi.fn(async () => {}));
const execFileMock = vi.hoisted(() =>
  vi.fn((file: string, args: string[], options: { encoding?: string }, callback: (...params: unknown[]) => void) => {
    callback(null, '', '');
  })
);

vi.mock('node:fs/promises', () => ({
  default: {
    access: accessMock,
    stat: statMock,
    mkdir: mkdirMock,
    writeFile: writeFileMock,
    readFile: readFileMock,
    rm: rmMock,
  },
}));

vi.mock('node:child_process', () => ({
  execFile: execFileMock,
  spawn: vi.fn(),
}));

vi.mock('@process/utils/initStorage', () => ({
  getSystemDir: () => ({
    cacheDir: '/tmp/contextgo-cache',
    workDir: '/tmp/contextgo-data',
  }),
}));

import {
  createOpenWhisperPrompt,
  getOpenWhisperPreferredLanguage,
  OpenWhisperVoiceProvider,
} from '@/process/bridge/services/voice/providers/OpenWhisperVoiceProvider';

describe('OpenWhisperVoiceProvider', () => {
  beforeEach(() => {
    mockState.executablePaths.clear();
    mockState.filePaths.clear();
    execFileMock.mockClear();
    mkdirMock.mockClear();
    writeFileMock.mockClear();
    readFileMock.mockClear();
    rmMock.mockClear();
    process.env.PATH = '/opt/homebrew/bin:/usr/local/bin';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should compose terminology prompts from language hints and hotwords', () => {
    expect(
      createOpenWhisperPrompt({
        cliPath: '',
        modelId: 'base',
        languageHints: ['zh', 'en'],
        hotwords: ['ContextGo', 'OpenClaw'],
      })
    ).toContain('Important terms, names, and jargon: ContextGo, OpenClaw.');

    expect(
      createOpenWhisperPrompt({
        cliPath: '',
        modelId: 'base',
        languageHints: [],
        hotwords: [],
      })
    ).toBeUndefined();
  });

  it('should prefer the first language hint and fall back to auto', () => {
    expect(
      getOpenWhisperPreferredLanguage({
        cliPath: '',
        modelId: 'base',
        languageHints: ['ja', 'en'],
        hotwords: [],
      })
    ).toBe('ja');

    expect(
      getOpenWhisperPreferredLanguage({
        cliPath: '',
        modelId: 'base',
        languageHints: [],
        hotwords: [],
      })
    ).toBe('auto');
  });

  it('should invoke whisper-cli with the selected model, language, and prompt', async () => {
    mockState.executablePaths.add('/opt/homebrew/bin/whisper-cli');
    mockState.filePaths.add('/tmp/contextgo-data/voice-input/open-whisper/models/ggml-base.bin');

    const provider = new OpenWhisperVoiceProvider({
      cliPath: '',
      modelId: 'base',
      languageHints: ['zh', 'en'],
      hotwords: ['ContextGo', 'OpenClaw'],
    });

    await expect(provider.transcribe(Buffer.alloc(16, 0x01))).resolves.toBe('ContextGo');
    expect(execFileMock).toHaveBeenCalledTimes(1);

    const [file, args] = execFileMock.mock.calls[0] as [string, string[]];
    expect(file).toBe('/opt/homebrew/bin/whisper-cli');
    expect(args).toContain('/tmp/contextgo-data/voice-input/open-whisper/models/ggml-base.bin');
    expect(args).toContain('-l');
    expect(args).toContain('zh');
    expect(args).toContain('--prompt');
    expect(args).toContain('Expected languages: zh, en. Important terms, names, and jargon: ContextGo, OpenClaw.');
    expect(writeFileMock).toHaveBeenCalledTimes(1);
    expect(readFileMock).toHaveBeenCalledTimes(1);
  });
});
