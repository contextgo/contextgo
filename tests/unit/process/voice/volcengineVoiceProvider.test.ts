import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VolcengineVoiceProvider } from '@/process/bridge/services/voice/VolcengineVoiceProvider';

describe('VolcengineVoiceProvider', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('should submit wav audio and return the recognized text', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          result: {
            text: '关闭透传。',
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Status-Code': '20000000',
            'X-Api-Message': 'OK',
            'X-Tt-Logid': 'test-logid',
          },
        }
      )
    );

    const provider = new VolcengineVoiceProvider({
      appKey: 'app-id',
      accessKey: 'access-token',
      resourceId: 'volc.bigasr.auc_turbo',
      model: 'bigmodel',
    });

    const transcript = await provider.transcribe(Buffer.from([0x00, 0x00, 0xff, 0x7f]));

    expect(transcript).toBe('关闭透传。');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash');
    expect(options.method).toBe('POST');
    expect(options.headers).toMatchObject({
      'Content-Type': 'application/json',
      'X-Api-App-Key': 'app-id',
      'X-Api-Access-Key': 'access-token',
      'X-Api-Resource-Id': 'volc.bigasr.auc_turbo',
      'X-Api-Sequence': '-1',
    });

    const body = JSON.parse(String(options.body)) as {
      user: { uid: string };
      audio: { data: string };
      request: { model_name: string };
    };
    const wavBuffer = Buffer.from(body.audio.data, 'base64');
    expect(body.user.uid).toBe('app-id');
    expect(body.request.model_name).toBe('bigmodel');
    expect(wavBuffer.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(wavBuffer.subarray(8, 12).toString('ascii')).toBe('WAVE');
  });

  it('should surface provider errors from response headers', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: 'busy',
        }),
        {
          status: 503,
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Status-Code': '55000031',
            'X-Api-Message': 'Server Busy',
            'X-Tt-Logid': 'busy-logid',
          },
        }
      )
    );

    const provider = new VolcengineVoiceProvider({
      appKey: 'app-id',
      accessKey: 'access-token',
      resourceId: 'volc.bigasr.auc_turbo',
      model: 'bigmodel',
    });

    await expect(provider.transcribe(Buffer.from([0x00, 0x00]))).rejects.toThrow(
      '55000031: Server Busy (logid: busy-logid)'
    );
  });

  it('should reject when required credentials are missing', async () => {
    const provider = new VolcengineVoiceProvider({
      appKey: '',
      accessKey: 'access-token',
      resourceId: 'volc.bigasr.auc_turbo',
      model: 'bigmodel',
    });

    await expect(provider.transcribe(Buffer.from([0x00, 0x00]))).rejects.toThrow('VolcEngine app key is required');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
