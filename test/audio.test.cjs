const { test } = require('node:test');
const assert = require('node:assert/strict');
const { AudioRing, encodeWav } = require('../audio.cjs');

test('ring keeps newest audio in chronological order across wrap boundaries', () => {
  const ring = new AudioRing(2, 3);
  ring.push([1, 2, 3]);
  assert.deepEqual([...ring.snapshot()], [1, 2, 3]);
  ring.push([4, 5, 6, 7, 8]);
  assert.deepEqual([...ring.snapshot()], [3, 4, 5, 6, 7, 8]);
  assert.deepEqual([...ring.snapshot(1)], [7, 8]);
  assert.equal(ring.data.length, 6);
});

test('WAV has valid PCM header and clips positive and negative samples', () => {
  const buffer = encodeWav(new Float32Array([-2, -1, 0, 1, 2]), 24000);
  const view = new DataView(buffer);
  assert.equal(Buffer.from(buffer).toString('ascii', 0, 4), 'RIFF');
  assert.equal(view.getUint32(4, true), buffer.byteLength - 8);
  assert.equal(view.getUint32(24, true), 24000);
  assert.equal(view.getUint32(40, true), 10);
  assert.deepEqual(Array.from({ length: 5 }, (_, i) => view.getInt16(44 + i * 2, true)), [-32768, -32768, 0, 32767, 32767]);
});
