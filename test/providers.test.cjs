const { test } = require('node:test');
const assert = require('node:assert/strict');
const { proxyConfig, geminiRequest, geminiResult } = require('../providers.cjs');

test('proxy accepts local HTTP/SOCKS endpoints and rejects credentials and URL paths', () => {
  assert.deepEqual(proxyConfig(''), { mode: 'system' });
  assert.equal(proxyConfig('http://127.0.0.1:9697').proxyRules, 'http://127.0.0.1:9697');
  assert.equal(proxyConfig('socks5://127.0.0.1:9697').proxyRules, 'socks5://127.0.0.1:9697');
  for (const address of ['file:///tmp', 'http://user:secret@host:80', 'http://host/path', 'http://host?secret=x', 'not-a-proxy']) assert.throws(() => proxyConfig(address));
});

test('Gemini keeps context bounded and sends audio as WAV', () => {
  const body = geminiRequest({ context: 'a'.repeat(15000), audio: new Uint8Array([1, 2, 3]).buffer }, 'instructions');
  assert.ok(body.contents[0].parts[0].text.length < 13000);
  assert.deepEqual(body.contents[0].parts[1].inlineData, { mimeType: 'audio/wav', data: 'AQID' });
});

test('Gemini rejects blocked, truncated, malformed and empty answers', () => {
  assert.throws(() => geminiResult({ promptFeedback: { blockReason: 'SAFETY' } }));
  assert.throws(() => geminiResult({ candidates: [{ finishReason: 'MAX_TOKENS' }] }), /оборвался/);
  for (const text of ['not json', '{}', '{"question":"q","answer":""}']) assert.throws(() => geminiResult({ candidates: [{ content: { parts: [{ text }] } }] }));
  assert.deepEqual(geminiResult({ candidates: [{ finishReason: 'STOP', content: { parts: [{ thought: true, text: 'hidden reasoning' }, { text: '{"question":"q","answer":"a"}' }] } }] }), { transcript: 'q', answer: 'a' });
});
