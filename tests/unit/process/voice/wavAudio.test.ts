import { describe, expect, it } from 'vitest';
import { createPcm16WavBuffer } from '@/process/bridge/services/voice/wavAudio';

describe('createPcm16WavBuffer', () => {
  it('should prepend a valid mono 16k PCM wav header', () => {
    const pcmBuffer = Buffer.from([0x01, 0x00, 0xff, 0x7f]);

    const wavBuffer = createPcm16WavBuffer(pcmBuffer);

    expect(wavBuffer.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(wavBuffer.subarray(8, 12).toString('ascii')).toBe('WAVE');
    expect(wavBuffer.subarray(12, 16).toString('ascii')).toBe('fmt ');
    expect(wavBuffer.subarray(36, 40).toString('ascii')).toBe('data');
    expect(wavBuffer.readUInt16LE(22)).toBe(1);
    expect(wavBuffer.readUInt32LE(24)).toBe(16_000);
    expect(wavBuffer.readUInt16LE(34)).toBe(16);
    expect(wavBuffer.readUInt32LE(40)).toBe(pcmBuffer.length);
    expect(wavBuffer.subarray(44)).toEqual(pcmBuffer);
  });
});
