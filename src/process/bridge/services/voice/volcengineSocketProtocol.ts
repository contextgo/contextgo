import { Buffer } from 'node:buffer';
import { gunzipSync, gzipSync } from 'node:zlib';

const PROTOCOL_VERSION = 0b0001;
const HEADER_WORD_SIZE = 0b0001;
const HEADER_SIZE_BYTES = HEADER_WORD_SIZE * 4;

const enum VolcengineMessageType {
  FullClientRequest = 0b0001,
  AudioOnlyRequest = 0b0010,
  FullServerResponse = 0b1001,
  ErrorResponse = 0b1111,
}

const enum VolcengineSerialization {
  None = 0b0000,
  Json = 0b0001,
}

const enum VolcengineCompression {
  None = 0b0000,
  Gzip = 0b0001,
}

const enum VolcengineMessageFlag {
  None = 0b0000,
  Sequence = 0b0001,
  LastPacket = 0b0010,
  LastPacketWithSequence = 0b0011,
}

export type VolcengineRecognitionPayload = {
  result?: {
    text?: string;
  };
};

export type DecodedVolcengineServerResponse<T = unknown> = {
  kind: 'response';
  payload: T | null;
  sequence: number | null;
  isLast: boolean;
};

export type DecodedVolcengineErrorResponse = {
  kind: 'error';
  code: number;
  payload: unknown;
  message: string;
};

export type DecodedVolcengineServerMessage<T = unknown> =
  | DecodedVolcengineServerResponse<T>
  | DecodedVolcengineErrorResponse;

const createHeader = ({
  messageType,
  messageFlag,
  serialization,
  compression,
}: {
  messageType: VolcengineMessageType;
  messageFlag: VolcengineMessageFlag;
  serialization: VolcengineSerialization;
  compression: VolcengineCompression;
}): Buffer => {
  return Buffer.from([
    (PROTOCOL_VERSION << 4) | HEADER_WORD_SIZE,
    (messageType << 4) | messageFlag,
    (serialization << 4) | compression,
    0x00,
  ]);
};

const encodePayloadFrame = ({ header, payload }: { header: Buffer; payload: Buffer }): Buffer => {
  const payloadSize = Buffer.alloc(4);
  payloadSize.writeUInt32BE(payload.length, 0);
  return Buffer.concat([header, payloadSize, payload]);
};

const decodePayload = (payload: Buffer, serialization: number, compression: number): unknown => {
  const body = compression === VolcengineCompression.Gzip ? gunzipSync(payload) : Buffer.from(payload);

  if (serialization === VolcengineSerialization.Json) {
    return JSON.parse(body.toString('utf8')) as unknown;
  }

  if (serialization === VolcengineSerialization.None) {
    return body;
  }

  throw new Error(`Unsupported Volcengine serialization method: ${serialization}`);
};

const ensureFrameLength = (frame: Buffer, minimumLength: number): void => {
  if (frame.length < minimumLength) {
    throw new Error(`Malformed Volcengine frame: expected at least ${minimumLength} bytes, got ${frame.length}`);
  }
};

const toMessageString = (payload: unknown, fallback: string): string => {
  if (typeof payload === 'string' && payload.trim().length > 0) {
    return payload.trim();
  }

  if (payload && typeof payload === 'object') {
    const value = payload as Record<string, unknown>;
    const candidates = [value.message, value.error, value.error_message, value.status_message];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }
  }

  return fallback;
};

export const encodeVolcengineFullClientRequest = (payload: Record<string, unknown>): Buffer => {
  const body = gzipSync(Buffer.from(JSON.stringify(payload), 'utf8'));
  const header = createHeader({
    messageType: VolcengineMessageType.FullClientRequest,
    messageFlag: VolcengineMessageFlag.None,
    serialization: VolcengineSerialization.Json,
    compression: VolcengineCompression.Gzip,
  });

  return encodePayloadFrame({ header, payload: body });
};

export const encodeVolcengineAudioRequest = (audioChunk: Buffer, isLastChunk: boolean): Buffer => {
  const body = gzipSync(audioChunk);
  const header = createHeader({
    messageType: VolcengineMessageType.AudioOnlyRequest,
    messageFlag: isLastChunk ? VolcengineMessageFlag.LastPacket : VolcengineMessageFlag.None,
    serialization: VolcengineSerialization.None,
    compression: VolcengineCompression.Gzip,
  });

  return encodePayloadFrame({ header, payload: body });
};

export const decodeVolcengineServerMessage = <T = unknown>(frame: Buffer): DecodedVolcengineServerMessage<T> => {
  ensureFrameLength(frame, HEADER_SIZE_BYTES);

  const headerSize = (frame[0] & 0x0f) * 4;
  const protocolVersion = frame[0] >> 4;
  const messageType = frame[1] >> 4;
  const messageFlag = frame[1] & 0x0f;
  const serialization = frame[2] >> 4;
  const compression = frame[2] & 0x0f;

  if (protocolVersion !== PROTOCOL_VERSION) {
    throw new Error(`Unsupported Volcengine protocol version: ${protocolVersion}`);
  }

  ensureFrameLength(frame, headerSize);
  let offset = headerSize;

  if (messageType === VolcengineMessageType.FullServerResponse) {
    let sequence: number | null = null;

    if (
      messageFlag === VolcengineMessageFlag.Sequence ||
      messageFlag === VolcengineMessageFlag.LastPacketWithSequence
    ) {
      ensureFrameLength(frame, offset + 4);
      sequence = frame.readInt32BE(offset);
      offset += 4;
    }

    ensureFrameLength(frame, offset + 4);
    const payloadSize = frame.readUInt32BE(offset);
    offset += 4;
    ensureFrameLength(frame, offset + payloadSize);
    const payload = decodePayload(frame.subarray(offset, offset + payloadSize), serialization, compression) as T;

    return {
      kind: 'response',
      payload,
      sequence,
      isLast:
        messageFlag === VolcengineMessageFlag.LastPacket ||
        messageFlag === VolcengineMessageFlag.LastPacketWithSequence,
    };
  }

  if (messageType === VolcengineMessageType.ErrorResponse) {
    ensureFrameLength(frame, offset + 8);
    const code = frame.readUInt32BE(offset);
    offset += 4;
    const payloadSize = frame.readUInt32BE(offset);
    offset += 4;
    ensureFrameLength(frame, offset + payloadSize);
    const rawPayload = frame.subarray(offset, offset + payloadSize);
    const payload = decodePayload(rawPayload, serialization, compression);
    const fallback = Buffer.isBuffer(payload) ? payload.toString('utf8').trim() : rawPayload.toString('utf8').trim();

    return {
      kind: 'error',
      code,
      payload,
      message: toMessageString(payload, fallback || 'Volcengine ASR failed'),
    };
  }

  throw new Error(`Unsupported Volcengine message type: ${messageType}`);
};

export const extractVolcengineTranscript = (payload: VolcengineRecognitionPayload | null | undefined): string => {
  return payload?.result?.text?.trim() ?? '';
};
