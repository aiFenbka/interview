'use strict';

function proxyConfig(address) {
  if (!address) return { mode: 'system' };
  let url;
  try { url = new URL(address); } catch { throw new Error('Прокси: нужен адрес вида http://127.0.0.1:7890 или socks5://127.0.0.1:1080.'); }
  if (!['http:', 'https:', 'socks5:'].includes(url.protocol) || !url.hostname || url.username || url.password || url.search || url.hash || (url.pathname && url.pathname !== '/')) {
    throw new Error('Прокси: используйте HTTP, HTTPS или SOCKS5; логин и пароль вводятся отдельно.');
  }
  return { mode: 'fixed_servers', proxyRules: `${url.protocol}//${url.host}` };
}

function geminiRequest(input, instructions) {
  const parts = [{ text: `Предыдущий контекст:\n${String(input.context || '').slice(-12000)}\n\n${input.audio ? 'Прослушай запись. Выдели последний вопрос и ответь на него.' : String(input.text || '').slice(0, 12000)}` }];
  if (input.audio) parts.push({ inlineData: { mimeType: 'audio/wav', data: Buffer.from(input.audio).toString('base64') } });
  return {
    systemInstruction: { parts: [{ text: `${instructions}\nВерни JSON с двумя строками: question — последний вопрос (не полная расшифровка), answer — краткий ответ. Если речи нет, укажи это, не выдумывай вопрос.` }] },
    contents: [{ role: 'user', parts }],
    generationConfig: { maxOutputTokens: 4096, responseMimeType: 'application/json', responseSchema: {
      type: 'OBJECT', properties: { question: { type: 'STRING' }, answer: { type: 'STRING' } }, required: ['question', 'answer']
    } }
  };
}

function geminiResult(body) {
  const candidate = body.candidates?.[0];
  if (body.promptFeedback?.blockReason || (candidate?.finishReason && candidate.finishReason !== 'STOP')) {
    throw new Error(candidate?.finishReason === 'MAX_TOKENS' ? 'Ответ Gemini оборвался по лимиту длины. Попробуйте ещё раз или выберите другую модель.' : 'Gemini не завершил ответ: запрос отклонён или остановлен.');
  }
  const text = candidate?.content?.parts?.filter(part => !part.thought).map(part => part.text || '').join('');
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('Gemini вернул ответ в неожиданном формате. Попробуйте ещё раз.'); }
  if (typeof parsed.question !== 'string' || typeof parsed.answer !== 'string' || !parsed.answer.trim()) throw new Error('Gemini не вернул текст ответа.');
  return { transcript: parsed.question, answer: parsed.answer };
}

module.exports = { proxyConfig, geminiRequest, geminiResult };
