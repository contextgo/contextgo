declare module 'silk-wasm' {
  export function decode(
    input: Uint8Array | Buffer,
    sampleRate: number
  ): Promise<{
    data: Uint8Array;
    duration: number;
  }>;
}
