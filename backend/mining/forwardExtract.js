'use strict';

// Recommendation-friendly extractor for messages a human FORWARDS to the bot.
//
// Runs ENTIRELY on a local Ollama model — zero API cost, fully offline — the
// same engine the auto-miner uses via classifier/adapters/ollama.js. A
// forwarded lead is almost always a third-party recommendation ("ask Georgy,
// +39…"); the admin already decided it's worth capturing by forwarding it, so
// we do NOT gate on usefulness — we extract the recommended specialist's
// details and let the review queue be the quality gate.
//
// Output mirrors Candidate.extracted (name/profession/city/contacts/description)
// plus suggested tags. `description` is ALWAYS written in Ukrainian regardless
// of the source language, matching the rest of the system.
//
// Config (env): OLLAMA_MODEL (default 'qwen2.5:14b'), OLLAMA_HOST
// (default http://localhost:11434), OLLAMA_TIMEOUT_MS (default 120000).

// 1.1.0 — local Ollama engine (was Anthropic Haiku in 1.0.0). No API spend.
const VERSION = '1.1.0';
const NAME = 'forward';
const MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:14b';
const HOST = (process.env.OLLAMA_HOST || 'http://localhost:11434').replace(/\/$/, '');
const TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 120000);

const SYSTEM_PROMPT =
  'You extract a tradesperson / specialist ("master") lead from message(s) a ' +
  'user forwarded from a Ukrainian-diaspora community chat in Italy. Languages ' +
  'mix freely: Ukrainian, Russian, Italian, sometimes English.\n\n' +
  'Unlike automated scraping, a HUMAN chose to forward this because it points ' +
  'to a specific specialist worth listing. The forwarded content is USUALLY a ' +
  'THIRD-PARTY RECOMMENDATION — someone answering "who can fix X?" with "ask ' +
  'Georgy, +39…" or "contact @handle, he does this". TREAT THESE AS THE LEAD: ' +
  'the recommended person is the master, even though the forwarder is not that ' +
  'person.\n\n' +
  'The bundle may contain a QUESTION (the inquiry that establishes the ' +
  'profession/need) followed by one or more ANSWERS (the recommendation). Use ' +
  'the question for context (it often states the profession) and the answer for ' +
  'the name and contact.\n\n' +
  'Extract VERBATIM from the text:\n' +
  '- name: the recommended specialist\'s name if stated ("Georgy", "Olena", a ' +
  '@handle owner\'s name). null if only a phone/handle is given with no name.\n' +
  '- profession: what they do, taken from the question or the answer ("screen ' +
  'repair", "ремонт iPhone", "electrician"). null if truly unclear.\n' +
  '- city: the city if named in the text. If absent, use the ORIGIN CHAT HINT ' +
  'provided below (a chat titled "Українці в Мілано" / "Ukrainians in Milano" ' +
  'implies Milano) — but only when the text gives no more specific city. null ' +
  'if neither yields a city.\n' +
  '- contacts: every phone / @handle / wa.me / t.me / instagram link present. ' +
  'CONTACT TYPE RULES — never mix phone and telegram: a phone number (digits, ' +
  'optional +country code, spaces/dashes) → contactType:"phone" even if labelled ' +
  '"Telegram"; a @username (letters/digits/underscore, 5–32 chars, no +) → ' +
  'contactType:"telegram". whatsapp/viber/other as appropriate. Empty array if ' +
  'no contact appears — never invent one.\n' +
  '- tags: 1–5 short service tags describing the specific work (e.g. "screen ' +
  'replacement", "battery"). Provide both `ua` (Ukrainian) and `en` (English) ' +
  'arrays, same concepts, parallel order. Empty arrays if nothing specific.\n' +
  '- description: a concise 1–2 sentence summary of the service, ALWAYS WRITTEN ' +
  'IN UKRAINIAN (українською мовою). If the source is Russian/Italian/English, ' +
  'TRANSLATE the summary into Ukrainian. This is the ONE field you do not copy ' +
  'verbatim. null if there is nothing to summarize.\n\n' +
  'Set is_useful=false ONLY when the forward contains no specialist lead at all ' +
  '(pure chatter, a question with no answer, an unrelated message). Even then, ' +
  'still fill whatever fields you can. confidence is your 0..1 certainty that ' +
  'this is a real, actionable specialist lead.\n\n' +
  'Respond strictly in the JSON schema.';

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['is_useful', 'confidence', 'extracted'],
  properties: {
    is_useful: { type: 'boolean' },
    confidence: { type: 'number' },
    extracted: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'profession', 'city', 'contacts', 'description', 'tags'],
      properties: {
        name: { type: ['string', 'null'] },
        profession: { type: ['string', 'null'] },
        city: { type: ['string', 'null'] },
        contacts: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['contactType', 'value'],
            properties: {
              contactType: {
                type: 'string',
                enum: ['phone', 'telegram', 'whatsapp', 'viber', 'other'],
              },
              value: { type: 'string' },
            },
          },
        },
        description: { type: ['string', 'null'] },
        tags: {
          type: 'object',
          additionalProperties: false,
          required: ['ua', 'en'],
          properties: {
            ua: { type: 'array', items: { type: 'string' } },
            en: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  },
};

// Build the user turn from a forwarded bundle.
//   bundle.text          — combined forwarded message text (required)
//   bundle.originChatTitle — origin chat title for the city hint (optional)
function buildUserContent(bundle) {
  const hint = bundle && bundle.originChatTitle
    ? `ORIGIN CHAT HINT (use only if the text gives no city): ${String(
        bundle.originChatTitle
      ).trim()}\n\n`
    : '';
  return (
    hint +
    'FORWARDED MESSAGE(S) — extract the recommended specialist:\n' +
    String((bundle && bundle.text) || '').trim()
  );
}

// Normalize the model response into the shape the intake service stores.
function normalize(parsed) {
  const ex = (parsed && parsed.extracted) || {};
  const tags = ex.tags || {};
  let score = typeof parsed.confidence === 'number' ? parsed.confidence : 0;
  if (score > 1) score = score / 100;
  score = Math.max(0, Math.min(1, score));
  return {
    isUseful: !!parsed.is_useful,
    score,
    extracted: {
      name: ex.name || null,
      profession: ex.profession || null,
      city: ex.city || null,
      contacts: Array.isArray(ex.contacts) ? ex.contacts : [],
      description: ex.description || null,
      tags: {
        ua: Array.isArray(tags.ua) ? tags.ua : [],
        en: Array.isArray(tags.en) ? tags.en : [],
      },
    },
    classifierName: NAME,
    classifierVersion: VERSION + '+' + MODEL,
  };
}

async function extract(bundle) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(HOST + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        // JSON-schema structured output: Ollama constrains decoding to the
        // schema, so message.content is guaranteed parseable JSON.
        format: SCHEMA,
        options: { temperature: 0 },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserContent(bundle) },
        ],
      }),
    });
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new Error(`forwardExtract: ollama no response within ${TIMEOUT_MS}ms (model "${MODEL}")`);
    }
    throw new Error(
      `forwardExtract: cannot reach ollama at ${HOST} — is \`ollama serve\` running? (${e.message})`
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`forwardExtract: ollama HTTP ${res.status} — ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data && data.message && data.message.content;
  if (!content) throw new Error('forwardExtract: empty ollama response');
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (_) {
    throw new Error('forwardExtract: ollama response not valid JSON: ' + String(content).slice(0, 200));
  }
  return normalize(parsed);
}

module.exports = {
  name: NAME,
  version: VERSION + '+' + MODEL,
  extract,
  // Exposed for tests / introspection.
  _SYSTEM_PROMPT: SYSTEM_PROMPT,
  _SCHEMA: SCHEMA,
  _buildUserContent: buildUserContent,
  _normalize: normalize,
  _MODEL: MODEL,
};
