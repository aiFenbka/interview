'use strict';
const fs = require('node:fs');
const { parseEnv } = require('node:util');

function loadKeys(file, env = process.env) {
  let local = {};
  try {
    local = parseEnv(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error('Не удалось прочитать local.env. Проверьте файл и права доступа.');
  }
  return Object.fromEntries(Object.entries({ groq: 'GROQ_API_KEY', openai: 'OPENAI_API_KEY', gemini: 'GEMINI_API_KEY' })
    .map(([provider, name]) => [provider, env[name] || local[name] || '']));
}

module.exports = { loadKeys };
