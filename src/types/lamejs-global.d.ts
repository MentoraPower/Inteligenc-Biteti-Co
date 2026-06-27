export {};

declare global {
  interface Window {
    lamejs?: {
      Mp3Encoder: new (channels: number, sampleRate: number, kbps: number) => {
        encodeBuffer: (left: Int16Array, right?: Int16Array) => Int8Array;
        flush: () => Int8Array;
      };
    };
  }
}
