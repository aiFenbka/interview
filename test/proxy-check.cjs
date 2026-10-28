// Read-only connectivity check. No API key, audio, or user text is sent.
const { app, session } = require('electron');
app.whenReady().then(async () => {
  try {
    const network = session.fromPartition('proxy-connectivity-test', { cache: false });
    await network.setProxy({ mode: 'fixed_servers', proxyRules: 'http://127.0.0.1:9697' });
    console.log('Route:', await network.resolveProxy('https://api.groq.com'));
    for (const [endpoint, options] of [
      ['models', {}],
      ['chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer diagnostic-invalid-key' }, body: JSON.stringify({ model: 'openai/gpt-oss-120b', messages: [{ role: 'user', content: 'connection test' }], max_completion_tokens: 16 }) }]
    ]) {
      const response = await network.fetch(`https://api.groq.com/openai/v1/${endpoint}`, { ...options, signal: AbortSignal.timeout(20000), redirect: 'error' });
      const body = await response.json();
      console.log(endpoint, 'HTTP:', response.status, 'Message:', body.error?.message || 'API reachable');
      if (![200, 400, 401, 403].includes(response.status)) throw new Error('Unexpected response');
    }
    app.exit(0);
  } catch (error) { console.error(error.message); app.exit(1); }
});
