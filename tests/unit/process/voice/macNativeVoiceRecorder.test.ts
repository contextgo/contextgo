import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { accessMock, spawnMock } = vi.hoisted(() => ({
  accessMock: vi.fn(),
  spawnMock: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    isPackaged: true,
    getAppPath: vi.fn(() => '/mock/app'),
  },
}));

vi.mock('node:fs/promises', () => ({
  default: {
    access: (...args: unknown[]) => accessMock(...args),
    chmod: vi.fn(),
    mkdir: vi.fn(),
    stat: vi.fn(),
  },
}));

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

import {
  MacNativeVoiceRecorder,
  parseNativeRecorderMessage,
} from '@/process/bridge/services/voice/MacNativeVoiceRecorder';

const flush = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const createMockChildProcess = () => {
  const stdout = Object.assign(new EventEmitter(), { setEncoding: vi.fn() });
  const stderr = Object.assign(new EventEmitter(), { setEncoding: vi.fn() });

  return Object.assign(new EventEmitter(), {
    kill: vi.fn(),
    stderr,
    stdin: {
      end: vi.fn(),
      write: vi.fn(),
    },
    stdout,
  });
};

describe('parseNativeRecorderMessage', () => {
  it('should parse ready messages', () => {
    expect(parseNativeRecorderMessage('{"event":"ready"}')).toEqual({ event: 'ready' });
  });

  it('should parse started messages', () => {
    expect(parseNativeRecorderMessage('{"event":"started"}')).toEqual({ event: 'started' });
  });

  it('should parse result messages', () => {
    expect(parseNativeRecorderMessage('{"event":"result","pcmBase64":"YWJj","durationMs":1280,"bytes":4096}')).toEqual({
      bytes: 4096,
      durationMs: 1280,
      event: 'result',
      pcmBase64: 'YWJj',
    });
  });

  it('should reject malformed payloads', () => {
    expect(parseNativeRecorderMessage('{"event":"result","durationMs":"100"}')).toBeNull();
  });
});

describe('MacNativeVoiceRecorder', () => {
  beforeEach(() => {
    accessMock.mockResolvedValue(undefined);
    spawnMock.mockReset();
    Object.defineProperty(process, 'resourcesPath', {
      configurable: true,
      value: '/mock/resources',
      writable: true,
    });
    (MacNativeVoiceRecorder as unknown as { helperPathPromise: Promise<string> | null }).helperPathPromise = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should reuse a warmed helper process across capture sessions', async () => {
    const child = createMockChildProcess();
    spawnMock.mockReturnValue(child);

    const recorder = new MacNativeVoiceRecorder();
    const warmupPromise = recorder.warmup();
    await flush();

    child.stdout.emit('data', '{"event":"ready"}\n');
    await expect(warmupPromise).resolves.toBeUndefined();
    expect(spawnMock).toHaveBeenCalledTimes(1);

    const firstStartPromise = recorder.start();
    await flush();
    expect(child.stdin.write).toHaveBeenNthCalledWith(1, 'start\n');
    child.stdout.emit('data', '{"event":"started"}\n');
    await expect(firstStartPromise).resolves.toBeUndefined();

    const firstStopPromise = recorder.stop();
    await flush();
    expect(child.stdin.write).toHaveBeenNthCalledWith(2, 'stop\n');
    child.stdout.emit('data', '{"event":"result","pcmBase64":"YWJj","durationMs":120,"bytes":3}\n');
    await expect(firstStopPromise).resolves.toEqual({
      bytes: 3,
      durationMs: 120,
      pcmBase64: 'YWJj',
    });

    const secondStartPromise = recorder.start();
    await flush();
    expect(child.stdin.write).toHaveBeenNthCalledWith(3, 'start\n');
    child.stdout.emit('data', '{"event":"started"}\n');
    await expect(secondStartPromise).resolves.toBeUndefined();

    const secondStopPromise = recorder.stop();
    await flush();
    expect(child.stdin.write).toHaveBeenNthCalledWith(4, 'stop\n');
    child.stdout.emit('data', '{"event":"result","pcmBase64":"ZGVm","durationMs":80,"bytes":3}\n');
    await expect(secondStopPromise).resolves.toEqual({
      bytes: 3,
      durationMs: 80,
      pcmBase64: 'ZGVm',
    });

    expect(spawnMock).toHaveBeenCalledTimes(1);
  });
});
