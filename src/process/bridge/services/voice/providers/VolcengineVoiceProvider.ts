import type { VoiceInputConfig } from '@/common/types/voiceInput';
import { Buffer } from 'node:buffer';
import WebSocket from 'ws';
import {
  decodeVolcengineServerMessage,
  encodeVolcengineAudioRequest,
  encodeVolcengineFullClientRequest,
  extractVolcengineTranscript,
  type VolcengineRecognitionPayload,
} from '../volcengineSocketProtocol';

const RECOGNIZE_URL = 'wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_nostream';
const AUDIO_CHUNK_SIZE = 6_400;
const TASK_TIMEOUT_MS = 20_000;

const toBuffer = (value: WebSocket.RawData): Buffer => {
  if (Buffer.isBuffer(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    return Buffer.concat(value.map((item) => (Buffer.isBuffer(item) ? item : Buffer.from(item))));
  }

  return Buffer.from(value);
};

export class VolcengineVoiceProvider {
  constructor(private readonly config: VoiceInputConfig['providers']['volcengine']) {}

  async transcribe(pcmBuffer: Buffer): Promise<string> {
    if (this.config.appKey.trim().length === 0) {
      throw new Error('VolcEngine app key is required');
    }

    if (this.config.accessKey.trim().length === 0) {
      throw new Error('VolcEngine access key is required');
    }

    if (this.config.resourceId.trim().length === 0) {
      throw new Error('VolcEngine resource ID is required');
    }

    if (pcmBuffer.length === 0) {
      return '';
    }

    const connectId = crypto.randomUUID();
    const hotwords = this.config.hotwords.filter((item) => item.trim().length > 0);
    const boostingTableId = this.config.boostingTableId?.trim() || '';
    const correctTableId = this.config.correctTableId?.trim() || '';
    const corpus =
      boostingTableId.length > 0 || correctTableId.length > 0
        ? {
            ...(boostingTableId.length > 0 ? { boosting_table_id: boostingTableId } : {}),
            ...(correctTableId.length > 0 ? { correct_table_id: correctTableId } : {}),
          }
        : undefined;
    const context =
      hotwords.length > 0
        ? JSON.stringify({
            hot_words_list: hotwords,
          })
        : undefined;
    const requestPayload = {
      user: {
        uid: this.config.appKey,
      },
      audio: {
        format: 'pcm',
        codec: 'raw',
        rate: 16000,
        bits: 16,
        channel: 1,
      },
      request: {
        model_name: this.config.model,
        enable_itn: true,
        enable_punc: true,
        result_type: 'full',
        ...(corpus ? { corpus } : {}),
        ...(context ? { context } : {}),
      },
    } satisfies Record<string, unknown>;

    return new Promise<string>((resolve, reject) => {
      const ws = new WebSocket(RECOGNIZE_URL, {
        headers: {
          'X-Api-App-Key': this.config.appKey,
          'X-Api-Access-Key': this.config.accessKey,
          'X-Api-Resource-Id': this.config.resourceId,
          'X-Api-Connect-Id': connectId,
        },
      });

      let timeoutId: NodeJS.Timeout | null = null;
      let settled = false;
      let latestTranscript = '';
      let logId = '';

      const finish = (callback: () => void): void => {
        if (settled) {
          return;
        }

        settled = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        try {
          ws.close();
        } catch {
          // ignore close failures
        }

        callback();
      };

      const refreshTimeout = (): void => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
          const suffix = logId ? ` (logid: ${logId})` : '';
          finish(() => reject(new Error(`VolcEngine ASR request timed out${suffix}`)));
        }, TASK_TIMEOUT_MS);
      };

      ws.on('upgrade', (response) => {
        const header = response.headers['x-tt-logid'];
        logId = Array.isArray(header) ? (header[0] ?? '') : (header ?? '');
      });

      ws.on('open', () => {
        refreshTimeout();
        ws.send(encodeVolcengineFullClientRequest(requestPayload));

        for (let offset = 0; offset < pcmBuffer.length; offset += AUDIO_CHUNK_SIZE) {
          const chunk = pcmBuffer.subarray(offset, Math.min(offset + AUDIO_CHUNK_SIZE, pcmBuffer.length));
          const isLastChunk = offset + AUDIO_CHUNK_SIZE >= pcmBuffer.length;
          ws.send(encodeVolcengineAudioRequest(chunk, isLastChunk));
        }
      });

      ws.on('message', (payload) => {
        refreshTimeout();

        let frame: ReturnType<typeof decodeVolcengineServerMessage<VolcengineRecognitionPayload>>;
        try {
          frame = decodeVolcengineServerMessage<VolcengineRecognitionPayload>(toBuffer(payload));
        } catch (error) {
          finish(() => reject(error instanceof Error ? error : new Error(String(error))));
          return;
        }

        if (frame.kind === 'error') {
          const suffix = logId ? ` (logid: ${logId})` : '';
          finish(() => reject(new Error(`${frame.code}: ${frame.message}${suffix}`)));
          return;
        }

        const transcript = extractVolcengineTranscript(frame.payload);
        if (transcript.length > 0) {
          latestTranscript = transcript;
        }

        if (frame.isLast) {
          finish(() => resolve(latestTranscript));
        }
      });

      ws.on('error', (error) => {
        finish(() => reject(error));
      });

      ws.on('close', (code, reason) => {
        if (settled) {
          return;
        }

        const reasonText = reason.toString('utf8').trim();
        if (latestTranscript.length > 0) {
          finish(() => resolve(latestTranscript));
          return;
        }

        const suffix = logId ? ` (logid: ${logId})` : '';
        finish(() => reject(new Error(reasonText || `VolcEngine connection closed unexpectedly (${code})${suffix}`)));
      });
    });
  }
}
