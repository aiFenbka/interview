'use strict';

// Retry only broken connections, once, on the same proxy and destination.
// A POST may already have reached the service when its response is lost.
async function fetchJson(network, url, options, onReconnect = () => {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    options.signal?.throwIfAborted();
    try {
      const response = await network.fetch(url, options);
      let body;
      try { body = await response.json(); }
      catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        throw new Error(`Сервис вернул ответ не в формате JSON (HTTP ${response.status}). Проверьте подключение и прокси.`);
      }
      return { response, body };
    } catch (error) {
      if (options.signal?.aborted) throw options.signal.reason;
      const code = /ERR_[A-Z0-9_]+/.exec(error.message)?.[0];
      if (attempt === 0 && ['ERR_CONNECTION_CLOSED', 'ERR_CONNECTION_RESET', 'ERR_SOCKET_NOT_CONNECTED', 'ERR_NETWORK_CHANGED'].includes(code)) {
        onReconnect();
        await network.closeAllConnections();
        continue;
      }
      if (code) throw new Error(`${code}: соединение с ${new URL(url).hostname} не удалось. Проверьте прокси и нажмите «Проверить подключение».`);
      throw error;
    }
  }
}

module.exports = { fetchJson };
