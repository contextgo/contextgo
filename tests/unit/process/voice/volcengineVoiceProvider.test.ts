import { Buffer } from 'node:buffer';
import { gunzipSync, gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';

type WebSocketOptions = {
  headers?: Record<string, string>;
};

const wsMock = vi.hoisted(() => {
  class MockWebSocket {
    static instances: MockWebSocket[] = [];

    readonly sentFrames: Buffer[] = [];
    readonly handlers = new Map<string, Array<(...args: unknown[]) => void>>();

    constructor(
      readonly url: string,
      readonly options?: WebSocketOptions
    ) {
      MockWebSocket.instances.push(this);
    }

    on(event: string, handler: (...args: unknown[]) => void): this {
      const handlers = this.handlers.get(event) ?? [];
      handlers.push(handler);
      this.handlers.set(event, handlers);
      return this;
    }

    send(data: Buffer): void {
      this.sentFrames.push(Buffer.from(data));
    }

    close(): void {
      // no-op for tests
    }

    emitOpen(logId = 'test-logid'): void {
      this.emitEvent('upgrade', { headers: { 'x-tt-logid': logId } });
      this.emitEvent('open');
    }

    emitMessage(frame: Buffer): void {
      this.emitEvent('message', frame, true);
    }

    emitClose(code = 1000, reason = ''): void {
      this.emitEvent('close', code, Buffer.from(reason, 'utf8'));
    }

    private emitEvent(event: string, ...args: unknown[]): void {
      for (const handler of this.handlers.get(event) ?? []) {
        handler(...args);
      }
    }
  }

  return { MockWebSocket };
});

vi.mock('ws', () => ({ default: wsMock.MockWebSocket }));

import { VolcengineVoiceProvider } from '@/process/bridge/services/voice/providers/VolcengineVoiceProvider';

const decodeClientRequestPayload = (frame: Buffer): Record<string, unknown> => {
  const payloadSize = frame.readUInt32BE(4);
  const payload = frame.subarray(8, 8 + payloadSize);
  return JSON.parse(gunzipSync(payload).toString('utf8')) as Record<string, unknown>;
};

const createServerResponseFrame = ({
  text,
  isLast,
  sequence = 1,
}: {
  text: string;
  isLast: boolean;
  sequence?: number;
}): Buffer => {
  const payload = gzipSync(
    Buffer.from(
      JSON.stringify({
        result: {
          text,
        },
      }),
      'utf8'
    )
  );
  const header = Buffer.from([0x11, isLast ? 0x93 : 0x91, 0x11, 0x00]);
  const sequenceBuffer = Buffer.alloc(4);
  const payloadSizeBuffer = Buffer.alloc(4);
  sequenceBuffer.writeInt32BE(sequence, 0);
  payloadSizeBuffer.writeUInt32BE(payload.length, 0);
  return Buffer.concat([header, sequenceBuffer, payloadSizeBuffer, payload]);
};

const createErrorFrame = (code: number, message: string): Buffer => {
  const payload = Buffer.from(JSON.stringify({ message }), 'utf8');
  const header = Buffer.from([0x11, 0xf0, 0x10, 0x00]);
  const codeBuffer = Buffer.alloc(4);
  const payloadSizeBuffer = Buffer.alloc(4);
  codeBuffer.writeUInt32BE(code, 0);
  payloadSizeBuffer.writeUInt32BE(payload.length, 0);
  return Buffer.concat([header, codeBuffer, payloadSizeBuffer, payload]);
};

const getLastWebSocketInstance = (): MockWebSocket => {
  const instance = wsMock.MockWebSocket.instances.at(-1);

  if (!instance) {
    throw new Error('Expected a mock websocket instance');
  }

  return instance;
};

describe('VolcengineVoiceProvider', () => {
  afterEach(() => {
    wsMock.MockWebSocket.instances.length = 0;
    vi.clearAllMocks();
  });

  it('should return the final transcript from websocket responses', async () => {
    const provider = new VolcengineVoiceProvider({
      appKey: 'app-id',
      accessKey: 'access-token',
      resourceId: 'volc.bigasr.sauc.duration',
      model: 'bigmodel',
      hotwords: [],
    });

    const transcription = provider.transcribe(Buffer.alloc(7_000, 0x01));
    const socket = getLastWebSocketInstance();
    socket.emitOpen();
    socket.emitMessage(createServerResponseFrame({ text: '关闭透传。', isLast: true }));

    await expect(transcription).resolves.toBe('关闭透传。');
  });

  it('should send sauc websocket frames with the required auth headers', async () => {
    const provider = new VolcengineVoiceProvider({
      appKey: 'app-id',
      accessKey: 'access-token',
      resourceId: 'volc.bigasr.sauc.duration',
      model: 'bigmodel',
      hotwords: [],
    });

    const transcription = provider.transcribe(Buffer.alloc(7_000, 0x01));
    const socket = getLastWebSocketInstance();
    socket.emitOpen();
    socket.emitMessage(createServerResponseFrame({ text: 'done', isLast: true }));
    await transcription;

    expect(socket.url).toBe('wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_nostream');
    expect(socket.options?.headers).toMatchObject({
      'X-Api-App-Key': 'app-id',
      'X-Api-Access-Key': 'access-token',
      'X-Api-Resource-Id': 'volc.bigasr.sauc.duration',
    });
    expect(socket.options?.headers?.['X-Api-Connect-Id']).toBeTypeOf('string');
    expect(socket.sentFrames).toHaveLength(3);
    expect(socket.sentFrames[0]?.subarray(0, 4)).toEqual(Buffer.from([0x11, 0x10, 0x11, 0x00]));
    expect(socket.sentFrames[1]?.subarray(0, 4)).toEqual(Buffer.from([0x11, 0x20, 0x01, 0x00]));
    expect(socket.sentFrames[2]?.subarray(0, 4)).toEqual(Buffer.from([0x11, 0x22, 0x01, 0x00]));
  });

  it('should surface server protocol errors with logid context', async () => {
    const provider = new VolcengineVoiceProvider({
      appKey: 'app-id',
      accessKey: 'access-token',
      resourceId: 'volc.bigasr.sauc.duration',
      model: 'bigmodel',
      hotwords: [],
    });

    const transcription = provider.transcribe(Buffer.alloc(1_024, 0x01));
    const socket = getLastWebSocketInstance();
    socket.emitOpen('busy-logid');
    socket.emitMessage(createErrorFrame(55_000_031, 'Server Busy'));

    await expect(transcription).rejects.toThrow('55000031: Server Busy (logid: busy-logid)');
  });

  it('should reject when required credentials are missing', async () => {
    const provider = new VolcengineVoiceProvider({
      appKey: '',
      accessKey: 'access-token',
      resourceId: 'volc.bigasr.sauc.duration',
      model: 'bigmodel',
      hotwords: [],
    });

    await expect(provider.transcribe(Buffer.alloc(2))).rejects.toThrow('VolcEngine app key is required');
    expect(wsMock.MockWebSocket.instances).toHaveLength(0);
  });

  it('should include hotword and corpus hints when they are configured', async () => {
    const provider = new VolcengineVoiceProvider({
      appKey: 'app-id',
      accessKey: 'access-token',
      resourceId: 'volc.bigasr.sauc.duration',
      model: 'bigmodel',
      boostingTableId: 'boosting-table',
      correctTableId: 'correction-table',
      hotwords: ['ContextGo', 'OpenClaw'],
    });

    const transcription = provider.transcribe(Buffer.alloc(2_048, 0x01));
    const socket = getLastWebSocketInstance();
    socket.emitOpen();
    socket.emitMessage(createServerResponseFrame({ text: 'done', isLast: true }));
    await transcription;

    const requestPayload = decodeClientRequestPayload(socket.sentFrames[0]!);
    expect(requestPayload.request).toMatchObject({
      corpus: {
        boosting_table_id: 'boosting-table',
        correct_table_id: 'correction-table',
      },
      context: JSON.stringify({
        hot_words_list: ['ContextGo', 'OpenClaw'],
      }),
    });
  });
});
