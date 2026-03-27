import { Buffer } from 'node:buffer';
import { gunzipSync, gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  decodeVolcengineServerMessage,
  encodeVolcengineAudioRequest,
  encodeVolcengineFullClientRequest,
  extractVolcengineTranscript,
} from '@/process/bridge/services/voice/volcengineSocketProtocol';

const readPayload = (frame: Buffer): Buffer => {
  const payloadSize = frame.readUInt32BE(4);
  return frame.subarray(8, 8 + payloadSize);
};

describe('volcengineSocketProtocol', () => {
  it('should encode full client requests as gzipped json frames', () => {
    const frame = encodeVolcengineFullClientRequest({
      request: {
        model_name: 'bigmodel',
      },
    });

    expect(frame.subarray(0, 4)).toEqual(Buffer.from([0x11, 0x10, 0x11, 0x00]));
    expect(
      JSON.parse(gunzipSync(readPayload(frame)).toString('utf8')) as {
        request: { model_name: string };
      }
    ).toEqual({
      request: {
        model_name: 'bigmodel',
      },
    });
  });

  it('should mark the last audio frame with the final packet flag', () => {
    const frame = encodeVolcengineAudioRequest(Buffer.from([0x00, 0x01]), true);

    expect(frame.subarray(0, 4)).toEqual(Buffer.from([0x11, 0x22, 0x01, 0x00]));
    expect(gunzipSync(readPayload(frame))).toEqual(Buffer.from([0x00, 0x01]));
  });

  it('should decode gzipped server responses and extract the transcript', () => {
    const payload = gzipSync(
      Buffer.from(
        JSON.stringify({
          result: {
            text: '火山转写完成',
          },
        }),
        'utf8'
      )
    );
    const frame = Buffer.concat([
      Buffer.from([0x11, 0x93, 0x11, 0x00]),
      Buffer.from([0x00, 0x00, 0x00, 0x02]),
      Buffer.from([0x00, 0x00, 0x00, payload.length]),
      payload,
    ]);

    const message = decodeVolcengineServerMessage<{ result?: { text?: string } }>(frame);

    expect(message.kind).toBe('response');
    if (message.kind !== 'response') {
      throw new Error('Expected a response frame');
    }
    expect(message.isLast).toBe(true);
    expect(message.sequence).toBe(2);
    expect(extractVolcengineTranscript(message.payload)).toBe('火山转写完成');
  });

  it('should decode error frames into code and message', () => {
    const payload = Buffer.from(JSON.stringify({ message: 'Server Busy' }), 'utf8');
    const codeBuffer = Buffer.alloc(4);
    codeBuffer.writeUInt32BE(55_000_063, 0);
    const frame = Buffer.concat([
      Buffer.from([0x11, 0xf0, 0x10, 0x00]),
      codeBuffer,
      Buffer.from([0x00, 0x00, 0x00, payload.length]),
      payload,
    ]);

    const message = decodeVolcengineServerMessage(frame);

    expect(message).toEqual({
      kind: 'error',
      code: 55_000_063,
      payload: {
        message: 'Server Busy',
      },
      message: 'Server Busy',
    });
  });

  it('should reject unsupported server frame types', () => {
    const frame = Buffer.from([0x11, 0x30, 0x00, 0x00]);

    expect(() => decodeVolcengineServerMessage(frame)).toThrow('Unsupported Volcengine message type: 3');
  });
});
