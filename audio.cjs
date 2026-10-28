'use strict';
(() => {

// A fixed-size mono PCM buffer: audio never grows with call duration.
class AudioRing {
  constructor(sampleRate, seconds = 60) {
    this.sampleRate = sampleRate;
    this.data = new Float32Array(sampleRate * seconds);
    this.position = 0;
    this.length = 0;
  }
  push(samples) {
    for (const value of samples) {
      this.data[this.position] = value;
      this.position = (this.position + 1) % this.data.length;
      this.length = Math.min(this.length + 1, this.data.length);
    }
  }
  snapshot(seconds = 60) {
    const size = Math.min(this.length, Math.round(seconds * this.sampleRate));
    const result = new Float32Array(size);
    const start = (this.position - size + this.data.length) % this.data.length;
    for (let i = 0; i < size; i++) result[i] = this.data[(start + i) % this.data.length];
    return result;
  }
}

function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const string = (offset, value) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  string(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true);
  string(8, 'WAVE'); string(12, 'fmt '); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  string(36, 'data'); view.setUint32(40, samples.length * 2, true);
  samples.forEach((value, i) => {
    const clamped = Math.max(-1, Math.min(1, value));
    view.setInt16(44 + i * 2, Math.round(clamped * (clamped < 0 ? 32768 : 32767)), true);
  });
  return buffer;
}

if (typeof module !== 'undefined') module.exports = { AudioRing, encodeWav };
else window.AudioTools = { AudioRing, encodeWav };
})();
