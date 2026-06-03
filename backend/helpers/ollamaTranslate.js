'use strict';

// Ollama-backed translation of reference-data names (profession / category /
// city) for the mining review tool. The admin types the Ukrainian name and we
// auto-fill the other language fields so they don't translate by hand.
//
// Reuses the local Ollama server already used by the classifier
// (mining/classifier/adapters/ollama.js) — zero cost, fully offline, no new
// dependency. JSON-schema structured output constrains decoding so the
// response is always parseable.
//
// Quality note: descriptions and common nouns translate well; proper-noun city
// names are weaker, so the review UI keeps every field editable before save.

const MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:14b';
const HOST = (process.env.OLLAMA_HOST || 'http://localhost:11434').replace(/\/$/, '');
const TIMEOUT_MS = Number(process.env.OLLAMA_TRANSLATE_TIMEOUT_MS || 60000);

const LANG_NAMES = {
  en: 'English',
  ru: 'Russian',
  it: 'Italian',
  pt: 'Portuguese',
  de: 'German',
  fr: 'French',
  tr: 'Turkish',
  es: 'Spanish',
};

// Translate a Ukrainian term into the requested target languages.
// Returns an object keyed by lang code, e.g. { en, ru, it }. On any failure
// (Ollama down, timeout, bad JSON) returns {} — the caller falls back to the
// admin filling fields manually.
async function translateName(uaText, langs = ['en', 'ru', 'it']) {
  const text = String(uaText || '').trim();
  if (!text) return {};
  const targets = langs.filter((l) => LANG_NAMES[l]);
  if (!targets.length) return {};

  const schema = {
    type: 'object',
    additionalProperties: false,
    required: targets,
    properties: targets.reduce((acc, l) => ((acc[l] = { type: 'string' }), acc), {}),
  };

  const system =
    'You translate a single short term (a profession, service category, or ' +
    'city name) from Ukrainian into other languages for a tradespeople ' +
    'directory. Return ONLY the translated term, no articles, no extra words, ' +
    'no explanations. For city/place names use the conventional local spelling ' +
    '(e.g. Рим → Rome / Roma). Respond strictly in the JSON schema.';
  const user =
    `Ukrainian term: "${text}"\nTranslate into: ` +
    targets.map((l) => LANG_NAMES[l]).join(', ') +
    `.\nReturn keys: ${targets.join(', ')}.`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(HOST + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        format: schema,
        options: { temperature: 0 },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) return {};
    const data = await res.json();
    const content = data && data.message && data.message.content;
    if (!content) return {};
    const parsed = JSON.parse(content);
    const out = {};
    for (const l of targets) {
      const v = String(parsed[l] || '').trim();
      if (v) out[l] = v;
    }
    return out;
  } catch (_) {
    return {};
  } finally {
    clearTimeout(timer);
  }
}

// Translate a list of Ukrainian short terms (e.g. service tags) into one
// target language, preserving order. Returns string[] (same length as input);
// on any failure returns [] so the caller can skip best-effort fields.
async function translateList(uaItems, lang = 'en') {
  const items = (uaItems || []).map((s) => String(s || '').trim()).filter(Boolean);
  if (!items.length || !LANG_NAMES[lang]) return [];

  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['items'],
    properties: {
      items: { type: 'array', items: { type: 'string' } },
    },
  };
  const system =
    `You translate short service tags from Ukrainian into ${LANG_NAMES[lang]} ` +
    'for a tradespeople directory. Return ONLY the translated tags, same order, ' +
    'same count, no extra words. Respond strictly in the JSON schema.';
  const user = `Tags (Ukrainian):\n${items.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(HOST + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        format: schema,
        options: { temperature: 0 },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const content = data && data.message && data.message.content;
    if (!content) return [];
    const parsed = JSON.parse(content);
    const out = (parsed.items || []).map((s) => String(s || '').trim()).filter(Boolean);
    return out.length === items.length ? out : [];
  } catch (_) {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { translateName, translateList };
