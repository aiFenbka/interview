'use strict';
const $ = id => document.getElementById(id);
const { AudioRing, encodeWav } = window.AudioTools;
let stream, audioContext, processor, source, silence, ring, busy = false, starting = false;
let history = [];
let lastMeter = 0;
let savedKeys = { groq: false, gemini: false, openai: false };
const providerNames = { groq: 'Groq', gemini: 'Google Gemini', openai: 'OpenAI' };
let settingsDirty = false;
const showSettings = visible => {
  const wasVisible = !$('settings').hidden;
  $('settings').hidden = !visible;
  if (visible) $('settings').open = true;
  $('settingsToggle').textContent = visible ? 'Закрыть' : 'Настройки';
  $('settingsToggle').setAttribute('aria-expanded', String(visible));
  if (!visible && wasVisible) {
    $('settingsToggle').focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
};
$('settingsToggle').onclick = () => showSettings($('settings').hidden);
const updateProvider = () => {
  const gemini = $('provider').value === 'gemini';
  const groq = $('provider').value === 'groq';
  $('keyLabel').textContent = `${providerNames[$('provider').value]} API-ключ`;
  $('groqModelField').hidden = !groq;
  $('groqTranscriptionModelField').hidden = !groq;
  $('geminiModelField').hidden = !gemini;
  $('transcriptionModelField').hidden = gemini || groq;
  $('answerModelField').hidden = gemini || groq;
  $('planNotice').textContent = groq
    ? 'Нужен ключ из console.groq.com/keys. Free Plan работает в пределах квоты; при исчерпании запрос отклоняется. Аудио и текст обрабатываются Groq.'
    : gemini
    ? 'Нужен ключ из Google AI Studio. Подписка Google AI Pro не заменяет тариф API. Для бесплатного использования проверьте Free Tier проекта. На Free Tier данные могут использоваться Google для улучшения продуктов.'
    : 'Нужен API-ключ OpenAI. Запросы оплачиваются отдельно от подписки ChatGPT.';
  $('keyStatus').textContent = savedKeys[$('provider').value] ? 'Ключ задан (доступ ещё не проверен)' : 'Ключ не задан';
};
const status = (message, error = false) => { $('status').textContent = message; $('status').classList.toggle('error', error); };
const setBusy = value => {
  busy = value;
  for (const id of ['askAudio', 'askText', 'clear', 'save', 'checkConnection', 'provider', 'key', 'groqModel', 'groqTranscriptionModel', 'geminiModel', 'transcriptionModel', 'answerModel', 'proxy', 'proxyUser', 'proxyPassword']) $(id).disabled = value;
  $('cancel').disabled = !value;
};

async function stopCapture() {
  if (processor) processor.onaudioprocess = null;
  processor?.disconnect(); source?.disconnect(); silence?.disconnect();
  stream?.getTracks().forEach(track => track.stop());
  stream = null;
  if (audioContext && audioContext.state !== 'closed') await audioContext.close();
  audioContext = null; processor = null; source = null; silence = null; ring = null;
  $('listen').textContent = 'Слушать';
  $('listen').classList.remove('listening');
  $('captureStatus').textContent = 'Звук выключен'; $('level').value = 0;
}

$('listen').onclick = async () => {
  if (starting) return;
  if (stream) { await stopCapture(); return; }
  starting = true; $('listen').disabled = true;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 1 }, audio: true });
    if (!stream.getAudioTracks().length) throw new Error('Windows не предоставила системный звук. Проверьте устройство вывода.');
    audioContext = new AudioContext({ sampleRate: 24000 });
    await audioContext.resume();
    ring = new AudioRing(audioContext.sampleRate, 60);
    source = audioContext.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
    // A small PCM tap; output is muted to avoid echoing captured system audio.
    processor = audioContext.createScriptProcessor(4096, 1, 1);
    silence = audioContext.createGain(); silence.gain.value = 0;
    source.connect(processor); processor.connect(silence); silence.connect(audioContext.destination);
    processor.onaudioprocess = event => {
      const samples = event.inputBuffer.getChannelData(0);
      ring.push(samples);
      if (performance.now() - lastMeter > 150) {
        let sum = 0; for (const value of samples) sum += value * value;
        $('level').value = Math.min(1, Math.sqrt(sum / samples.length) * 8);
        $('captureStatus').textContent = `Слушаю · ${Math.floor(ring.length / ring.sampleRate)} с`;
        lastMeter = performance.now();
      }
    };
    stream.getAudioTracks()[0].onended = () => { stopCapture(); status('Источник звука отключён. Включите захват снова.', true); };
    $('listen').textContent = 'Стоп';
    $('listen').classList.add('listening');
    status('Захват включён. После вопроса нажмите Ctrl+Alt+Space.');
  } catch (error) { await stopCapture(); status(error.message, true); }
  finally { starting = false; $('listen').disabled = false; }
};

async function ask(fromAudio, clearInput = false) {
  if (busy) return;
  if (settingsDirty) return status('Сначала нажмите «Применить» в настройках подключения.', true);
  let audio;
  const text = $('question').value.trim();
  if (fromAudio) {
    if (!ring || ring.length < ring.sampleRate) return status('Сначала включите захват и дождитесь вопроса.', true);
    const samples = ring.snapshot(Number($('seconds').value));
    let energy = 0; for (const value of samples) energy += value * value;
    if (Math.sqrt(energy / samples.length) < 0.0005) return status('В буфере тишина. Проверьте индикатор и устройство вывода Jazz.', true);
    audio = encodeWav(samples, ring.sampleRate);
  } else if (!text) return status('Введите вопрос.', true);
  if (!fromAudio && clearInput) {
    $('question').value = '';
    $('question').focus({ preventScroll: true });
    $('transcript').textContent = text;
  }
  setBusy(true); status('Отправляю запрос…');
  $('answer').textContent = 'Готовлю новый ответ…';
  try {
    const result = await window.assistant.ask({ audio, text: fromAudio ? '' : text, context: history.join('\n\n') });
    if (result.error) { $('answer').textContent = 'Ответ не получен.'; return status(result.error, true); }
    window.renderAnswer(result.answer);
    showSettings(false);
    $('transcript').textContent = result.transcript;
    history.push(result.transcript); history = history.slice(-4);
    status('Готово');
  } catch (error) { $('answer').textContent = 'Ответ не получен.'; status(error.message, true); }
  finally { setBusy(false); }
}

$('askAudio').onclick = () => ask(true);
$('askText').onclick = () => ask(false);
$('question').addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    if (!event.repeat) ask(false, true);
  }
});
$('checkConnection').onclick = async () => {
  if (busy) return;
  if (settingsDirty) return status('Сначала нажмите «Применить» в настройках подключения.', true);
  setBusy(true); status('Проверяю подключение…');
  try {
    const result = await window.assistant.checkConnection();
    if (!result.error) showSettings(false);
    status(result.error || result.message, Boolean(result.error));
  } catch (error) { status(error.message, true); }
  finally { setBusy(false); }
};
$('cancel').onclick = () => window.assistant.cancel();
$('pin').onchange = () => window.assistant.pin($('pin').checked);
$('clear').onclick = () => {
  history = []; if (ring) ring = new AudioRing(ring.sampleRate, 60);
  $('answer').textContent = 'Здесь появятся суть, аргументы и пример.';
  $('transcript').textContent = 'Пока пусто.'; $('question').value = '';
  status('Контекст и аудиобуфер очищены.');
};
$('save').onclick = async () => {
  setBusy(true);
  try {
    const input = { key: $('key').value };
    for (const name of ['provider', 'groqModel', 'groqTranscriptionModel', 'transcriptionModel', 'answerModel', 'geminiModel', 'proxy', 'proxyUser']) input[name] = $(name).value.trim();
    if ($('proxyPassword').value || !$('proxyUser').value) input.proxyPassword = $('proxyPassword').value;
    const result = await window.assistant.settings(input);
    $('key').value = '';
    $('proxyPassword').value = '';
    savedKeys = result.keyStatus; settingsDirty = false;
    updateProvider();
    $('providerNotice').textContent = `Локальное окно · ${providerNames[result.provider]}. По запросу аудио и текст отправляются этому сервису. Используйте на тренировках или с согласия участников.`;
    if (result.hasKey) {
      status('Проверяю ключ…');
      const check = await window.assistant.checkConnection();
      showSettings(Boolean(check.error));
      status(check.error || 'Ключ принят. Можно задавать вопрос.', Boolean(check.error));
    } else {
      showSettings(true);
      status('Введите API-ключ.', true);
    }
  } catch (error) { status(error.message, true); }
  finally { setBusy(false); }
};
for (const id of ['provider', 'key', 'groqModel', 'groqTranscriptionModel', 'geminiModel', 'transcriptionModel', 'answerModel', 'proxy', 'proxyUser', 'proxyPassword']) {
  $(id).addEventListener('input', () => { settingsDirty = true; });
}
$('provider').onchange = () => { $('key').value = ''; settingsDirty = true; updateProvider(); };
window.assistant.onStage(message => status(message));
window.assistant.onTranscript(text => { $('transcript').textContent = text; });
window.assistant.onShortcut(() => ask(true));
window.assistant.onShortcutStatus(registered => { if (!registered) status('Горячая клавиша занята. Используйте кнопку подсказки.', true); });
window.assistant.settings().then(result => {
  for (const name of ['provider', 'groqModel', 'groqTranscriptionModel', 'transcriptionModel', 'answerModel', 'geminiModel', 'proxy', 'proxyUser']) $(name).value = result[name];
  savedKeys = result.keyStatus; updateProvider();
  if (result.hasKey) {
    showSettings(false);
    status('Ключ загружен. Можно задавать вопрос.');
  }
  $('providerNotice').textContent = `Локальное окно · ${providerNames[result.provider]}. По запросу аудио и текст отправляются этому сервису. Используйте на тренировках или с согласия участников.`;
}).catch(error => status(error.message, true));
