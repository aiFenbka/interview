const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fetchJson } = require('../network.cjs');
const url = 'https://api.groq.com/openai/v1/chat/completions';

test('closed connection reconnects once without changing URL, credentials or payload', async () => {
  let calls = 0, closed = 0;
  const options = { method: 'POST', headers: { Authorization: 'Bearer fake' }, body: 'payload' };
  const network = {
    closeAllConnections: async () => { closed++; },
    fetch: async (target, request) => {
      assert.equal(target, url); assert.equal(request, options);
      if (++calls === 1) throw new Error('net::ERR_CONNECTION_CLOSED');
      return { status: 200, json: async () => ({ ok: true }) };
    }
  };
  assert.deepEqual((await fetchJson(network, url, options)).body, { ok: true });
  assert.equal(calls, 2); assert.equal(closed, 1);
});

test('persistent reset stops after two tries and returns a safe diagnostic', async () => {
  let calls = 0;
  const network = { closeAllConnections: async () => {}, fetch: async () => { calls++; throw new Error('net::ERR_CONNECTION_RESET'); } };
  await assert.rejects(fetchJson(network, url, {}), /ERR_CONNECTION_RESET.*api.groq.com/);
  assert.equal(calls, 2);
});

test('cancel during reconnection prevents another POST', async () => {
  let calls = 0;
  const controller = new AbortController();
  const network = { closeAllConnections: async () => controller.abort(), fetch: async () => { calls++; throw new Error('net::ERR_CONNECTION_CLOSED'); } };
  await assert.rejects(fetchJson(network, url, { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(calls, 1);
});

test('HTTP errors and invalid JSON are not retried', async () => {
  let calls = 0;
  const network = { fetch: async () => { calls++; return { status: 429, json: async () => ({ error: 'quota' }) }; } };
  assert.equal((await fetchJson(network, url, {})).response.status, 429);
  assert.equal(calls, 1);
  network.fetch = async () => { calls++; return { status: 502, json: async () => { throw new SyntaxError('invalid'); } }; };
  await assert.rejects(fetchJson(network, url, {}), /HTTP 502/);
  assert.equal(calls, 2);
});
