import { Buffer } from 'node:buffer';

const WAV_HEADER_SIZE = 44;
const PCM_AUDIO_FORMAT = 1;
const PCM_16_BIT_DEPTH = 16;

const writeAscii = (buffer: Buffer, offset: number, value: string): void => {
  buffer.write(value, offset, 'ascii');
};

export const createPcm16WavBuffer = (
  pcmBuffer: Buffer,
  options: {
    sampleRate?: number;
    channels?: number;
  } = {}
): Buffer => {
  const sampleRate = options.sampleRate ?? 16_000;
  const channels = options.channels ?? 1;
  const bytesPerSample = PCM_16_BIT_DEPTH / 8;
  const byteRate = sampleRate * channels * bytesPerSample;
  const blockAlign = channels * bytesPerSample;
  const wavBuffer = Buffer.allocUnsafe(WAV_HEADER_SIZE + pcmBuffer.length);

  writeAscii(wavBuffer, 0, 'RIFF');
  wavBuffer.writeUInt32LE(WAV_HEADER_SIZE + pcmBuffer.length - 8, 4);
  writeAscii(wavBuffer, 8, 'WAVE');
  writeAscii(wavBuffer, 12, 'fmt ');
  wavBuffer.writeUInt32LE(16, 16);
  wavBuffer.writeUInt16LE(PCM_AUDIO_FORMAT, 20);
  wavBuffer.writeUInt16LE(channels, 22);
  wavBuffer.writeUInt32LE(sampleRate, 24);
  wavBuffer.writeUInt32LE(byteRate, 28);
  wavBuffer.writeUInt16LE(blockAlign, 32);
  wavBuffer.writeUInt16LE(PCM_16_BIT_DEPTH, 34);
  writeAscii(wavBuffer, 36, 'data');
  wavBuffer.writeUInt32LE(pcmBuffer.length, 40);
  pcmBuffer.copy(wavBuffer, WAV_HEADER_SIZE);

  return wavBuffer;
};
