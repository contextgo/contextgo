import type {
  VoiceInputOpenWhisperConfig,
  VoiceInputOpenWhisperModelId,
  VoiceInputOpenWhisperModelStatus,
  VoiceInputOpenWhisperState,
} from '@/common/types/voiceInput';
import { createPcm16WavBuffer } from '../wavAudio';
import { getSystemDir } from '@process/utils/initStorage';
import { execFile, spawn } from 'node:child_process';
import type { Buffer } from 'node:buffer';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const WHISPER_RUNTIME_NAME = 'whisper-cli';
const WHISPER_BREW_FORMULA = 'whisper-cpp';
const MODEL_DOWNLOAD_TIMEOUT_MS = 30 * 60 * 1000;
const TRANSCRIBE_TIMEOUT_MS = 10 * 60 * 1000;

type OpenWhisperModelDefinition = {
  id: VoiceInputOpenWhisperModelId;
  fileName: string;
  sizeBytes: number;
  url: string;
};

const OPEN_WHISPER_MODEL_MANIFEST: OpenWhisperModelDefinition[] = [
  {
    id: 'tiny',
    fileName: 'ggml-tiny.bin',
    sizeBytes: 77_691_713,
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
  },
  {
    id: 'base',
    fileName: 'ggml-base.bin',
    sizeBytes: 147_951_465,
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
  },
  {
    id: 'small',
    fileName: 'ggml-small.bin',
    sizeBytes: 487_601_967,
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
  },
  {
    id: 'medium',
    fileName: 'ggml-medium.bin',
    sizeBytes: 1_533_763_059,
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
  },
  {
    id: 'large-v3-turbo',
    fileName: 'ggml-large-v3-turbo.bin',
    sizeBytes: 1_624_555_275,
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin',
  },
] as const;

const DEFAULT_WHISPER_CLI_CANDIDATES = [
  '/opt/homebrew/bin/whisper-cli',
  '/usr/local/bin/whisper-cli',
  '/opt/homebrew/bin/whisper-cpp',
  '/usr/local/bin/whisper-cpp',
];

const DEFAULT_BREW_CANDIDATES = ['/opt/homebrew/bin/brew', '/usr/local/bin/brew'];

const findModelDefinition = (modelId: VoiceInputOpenWhisperModelId): OpenWhisperModelDefinition => {
  const model = OPEN_WHISPER_MODEL_MANIFEST.find((item) => item.id === modelId);

  if (!model) {
    throw new Error(`Unknown Open Whisper model: ${modelId}`);
  }

  return model;
};

const isFile = async (filePath: string): Promise<boolean> => {
  try {
    const stat = await fsPromises.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
};

const isExecutableFile = async (filePath: string): Promise<boolean> => {
  if (!filePath) {
    return false;
  }

  try {
    await fsPromises.access(filePath, fs.constants.X_OK);
    return await isFile(filePath);
  } catch {
    return false;
  }
};

const findFirstExecutable = async (candidates: string[]): Promise<string | null> => {
  const results = await Promise.all(
    candidates.map(async (candidate) => ((await isExecutableFile(candidate)) ? candidate : null))
  );

  return results.find((candidate) => candidate !== null) ?? null;
};

const findExecutableOnPath = async (fileName: string): Promise<string | null> => {
  const pathEntries = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);
  return findFirstExecutable(pathEntries.map((entry) => path.join(entry, fileName)));
};

const detectBrewPath = async (): Promise<string | null> => {
  return (await findFirstExecutable(DEFAULT_BREW_CANDIDATES)) ?? findExecutableOnPath('brew');
};

export const detectOpenWhisperCliPath = async (customCliPath?: string): Promise<string | null> => {
  const normalizedCustomCliPath = customCliPath?.trim() ?? '';
  if (normalizedCustomCliPath.length > 0 && (await isExecutableFile(normalizedCustomCliPath))) {
    return normalizedCustomCliPath;
  }

  const runtimeOnPath = await findExecutableOnPath(WHISPER_RUNTIME_NAME);
  if (runtimeOnPath) {
    return runtimeOnPath;
  }

  return findFirstExecutable(DEFAULT_WHISPER_CLI_CANDIDATES);
};

const getModelDirectory = (): string => path.join(getSystemDir().workDir, 'voice-input', 'open-whisper', 'models');

const getTempDirectory = (): string => path.join(getSystemDir().cacheDir, 'voice-input', 'open-whisper');

const getModelFilePath = (modelId: VoiceInputOpenWhisperModelId): string =>
  path.join(getModelDirectory(), findModelDefinition(modelId).fileName);

const createModelStatus = async (model: OpenWhisperModelDefinition): Promise<VoiceInputOpenWhisperModelStatus> => {
  const filePath = getModelFilePath(model.id);
  const installed = await isFile(filePath);

  return {
    id: model.id,
    sizeBytes: model.sizeBytes,
    installed,
    filePath,
  };
};

const ensureDirectory = async (directoryPath: string): Promise<void> => {
  await fsPromises.mkdir(directoryPath, { recursive: true });
};

const composeTermPrompt = (config: VoiceInputOpenWhisperConfig): string | undefined => {
  const hotwords = config.hotwords.map((item) => item.trim()).filter(Boolean);
  const languageHints = config.languageHints.map((item) => item.trim()).filter(Boolean);
  const parts: string[] = [];

  if (languageHints.length > 0) {
    parts.push(`Expected languages: ${languageHints.join(', ')}.`);
  }

  if (hotwords.length > 0) {
    parts.push(`Important terms, names, and jargon: ${hotwords.join(', ')}.`);
  }

  if (parts.length === 0) {
    return undefined;
  }

  return parts.join(' ');
};

export const getOpenWhisperPreferredLanguage = (config: VoiceInputOpenWhisperConfig): string => {
  const firstHint = config.languageHints
    .find((item) => item.trim().length > 0)
    ?.trim()
    .toLowerCase();

  if (!firstHint || firstHint === 'auto') {
    return 'auto';
  }

  return firstHint;
};

const downloadFile = async (url: string, filePath: string): Promise<void> => {
  const tempPath = `${filePath}.partial`;
  let stream: fs.WriteStream | null = null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MODEL_DOWNLOAD_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Failed to download model (${response.status}): ${body || response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Model download response has no body');
    }

    stream = fs.createWriteStream(tempPath);
    await pipeline(Readable.fromWeb(response.body as unknown as NodeReadableStream<Uint8Array>), stream);

    await fsPromises.rename(tempPath, filePath);
  } catch (error) {
    try {
      stream?.close();
    } catch {
      // ignore cleanup failures
    }

    await fsPromises.rm(tempPath, { force: true }).catch(() => {});
    throw error instanceof Error ? error : new Error(String(error));
  } finally {
    clearTimeout(timeoutId);
  }
};

const runBrewInstall = async (brewPath: string): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(brewPath, ['install', WHISPER_BREW_FORMULA], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      output += chunk;
    });
    child.on('error', (error) => {
      reject(error);
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(output.trim() || `brew install exited with code ${code ?? -1}`));
    });
  });
};

export const getOpenWhisperState = async (config: VoiceInputOpenWhisperConfig): Promise<VoiceInputOpenWhisperState> => {
  const brewPath = await detectBrewPath();
  const cliPath = await detectOpenWhisperCliPath(config.cliPath);
  const modelDirectory = getModelDirectory();
  await ensureDirectory(modelDirectory);

  const models = await Promise.all(OPEN_WHISPER_MODEL_MANIFEST.map((item) => createModelStatus(item)));
  const selectedModel = models.find((item) => item.id === config.modelId);

  return {
    supported: process.platform === 'darwin',
    brewAvailable: Boolean(brewPath),
    runtimeInstalled: Boolean(cliPath),
    cliPath: cliPath ?? undefined,
    brewPath: brewPath ?? undefined,
    modelDirectory,
    selectedModelId: config.modelId,
    selectedModelInstalled: selectedModel?.installed === true,
    models,
  };
};

export const installOpenWhisperRuntime = async (
  config: VoiceInputOpenWhisperConfig
): Promise<VoiceInputOpenWhisperState> => {
  const existingCliPath = await detectOpenWhisperCliPath(config.cliPath);
  if (existingCliPath) {
    return getOpenWhisperState(config);
  }

  const brewPath = await detectBrewPath();
  if (!brewPath) {
    throw new Error('Homebrew is required to install whisper.cpp automatically.');
  }

  await runBrewInstall(brewPath);
  return getOpenWhisperState(config);
};

export const installOpenWhisperModel = async (
  modelId: VoiceInputOpenWhisperModelId,
  config: VoiceInputOpenWhisperConfig
): Promise<VoiceInputOpenWhisperState> => {
  const definition = findModelDefinition(modelId);
  const filePath = getModelFilePath(modelId);
  await ensureDirectory(getModelDirectory());

  if (!(await isFile(filePath))) {
    await downloadFile(definition.url, filePath);
  }

  return getOpenWhisperState(config);
};

export const createOpenWhisperPrompt = composeTermPrompt;

export class OpenWhisperVoiceProvider {
  constructor(private readonly config: VoiceInputOpenWhisperConfig) {}

  async getRuntimeState(): Promise<VoiceInputOpenWhisperState> {
    return getOpenWhisperState(this.config);
  }

  async transcribe(pcmBuffer: Buffer): Promise<string> {
    const cliPath = await detectOpenWhisperCliPath(this.config.cliPath);
    if (!cliPath) {
      throw new Error('Open Whisper runtime is not installed. Install whisper.cpp or configure a CLI path.');
    }

    const modelPath = getModelFilePath(this.config.modelId);
    if (!(await isFile(modelPath))) {
      throw new Error('Selected Open Whisper model is not installed.');
    }

    if (pcmBuffer.length === 0) {
      return '';
    }

    const tempDirectory = getTempDirectory();
    await ensureDirectory(tempDirectory);

    const tempBaseName = `voice-input-${crypto.randomUUID()}`;
    const wavPath = path.join(tempDirectory, `${tempBaseName}.wav`);
    const outputPrefix = path.join(tempDirectory, tempBaseName);
    const textOutputPath = `${outputPrefix}.txt`;
    const args = ['-m', modelPath, '-f', wavPath, '-of', outputPrefix, '-otxt', '-np', '-nt'];
    const preferredLanguage = getOpenWhisperPreferredLanguage(this.config);

    if (preferredLanguage.length > 0) {
      args.push('-l', preferredLanguage);
    }

    const prompt = composeTermPrompt(this.config);
    if (prompt) {
      args.push('--prompt', prompt);
    }

    try {
      await fsPromises.writeFile(wavPath, createPcm16WavBuffer(pcmBuffer));
      const result = await execFileAsync(cliPath, args, {
        encoding: 'utf8',
        timeout: TRANSCRIBE_TIMEOUT_MS,
        maxBuffer: 1024 * 1024,
      });
      const transcript = (await fsPromises.readFile(textOutputPath, 'utf8').catch(() => result.stdout ?? '')).trim();

      if (!transcript) {
        throw new Error(result.stderr?.trim() || 'Open Whisper did not return a transcript.');
      }

      return transcript;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }

      throw new Error(String(error), { cause: error });
    } finally {
      await Promise.all([
        fsPromises.rm(wavPath, { force: true }).catch(() => {}),
        fsPromises.rm(textOutputPath, { force: true }).catch(() => {}),
      ]);
    }
  }
}
