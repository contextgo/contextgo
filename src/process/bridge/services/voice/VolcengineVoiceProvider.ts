import type { VoiceInputConfig } from '@/common/types/voiceInput';
import { createPcm16WavBuffer } from './wavAudio';

type VolcengineRecognizeResponse = {
  result?: {
    text?: string;
  };
};

const RECOGNIZE_URL = 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash';
const SUCCESS_STATUS_CODE = '20000000';

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

    if (typeof globalThis.fetch !== 'function') {
      throw new Error('Fetch API is unavailable in the current runtime');
    }

    const requestId = crypto.randomUUID();
    const wavBuffer = createPcm16WavBuffer(pcmBuffer);
    const response = await globalThis.fetch(RECOGNIZE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-App-Key': this.config.appKey,
        'X-Api-Access-Key': this.config.accessKey,
        'X-Api-Resource-Id': this.config.resourceId,
        'X-Api-Request-Id': requestId,
        'X-Api-Sequence': '-1',
      },
      body: JSON.stringify({
        user: {
          uid: this.config.appKey,
        },
        audio: {
          data: wavBuffer.toString('base64'),
        },
        request: {
          model_name: this.config.model,
        },
      }),
    });

    const statusCode = response.headers.get('X-Api-Status-Code')?.trim() ?? '';
    const statusMessage = response.headers.get('X-Api-Message')?.trim() ?? '';
    const logId = response.headers.get('X-Tt-Logid')?.trim() ?? '';
    const responseText = await response.text();

    let payload: VolcengineRecognizeResponse | null = null;
    if (responseText.trim().length > 0) {
      try {
        payload = JSON.parse(responseText) as VolcengineRecognizeResponse;
      } catch {
        payload = null;
      }
    }

    if (statusCode !== SUCCESS_STATUS_CODE) {
      const detail = statusCode || `HTTP ${response.status}`;
      const message = statusMessage || 'VolcEngine ASR failed';
      const logSuffix = logId ? ` (logid: ${logId})` : '';
      throw new Error(`${detail}: ${message}${logSuffix}`);
    }

    return payload?.result?.text?.trim() ?? '';
  }
}
