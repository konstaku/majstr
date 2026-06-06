'use strict';

// Claude Haiku 4.5 classifier + structured extractor.
//
// Runs ONLY on pre-filter / thread-builder survivors — never on the raw
// corpus. JSON-schema structured output guarantees the response parses;
// prompt caching is wired on the system prompt (no-op below 4096 tokens but
// harmless and lets longer system prompts cache automatically later).
//
// Hard budget guard: cumulative spend is tracked in-process against
// MINING_BUDGET_USD (default $5). Calls throw before exceeding the ceiling —
// nothing slips through silently. Per-run cost is exposed for the eval
// scripts and the batch runner (M2 #91).

const Anthropic = require('@anthropic-ai/sdk');

// 2.0.0 — third-party recommendations are USEFUL again (kind:'recommendation').
// The earlier announcement-only rule was only ever meant for the one huge chat
// (ITALIA_CHAT_ID); that scope still lives in mine-classify.js, so this prompt
// no longer rejects recommendations globally.
// 1.7.0 — contact-type disambiguation: phone numbers are always contactType:'phone',
// Telegram @usernames are always contactType:'telegram' — never mix them.
// 1.6.0 — announcement-only (third-party recs excluded).
// 1.5.0 — description always Ukrainian. 1.4.0 — cross-border excluded. 1.3.0 — DM promise excluded.
const VERSION = '2.0.0';
const MODEL = 'claude-haiku-4-5';
const MAX_TOKENS = 512;

// Haiku 4.5 list price per million tokens (see shared/models.md).
const PRICE = {
  input: 1.0 / 1e6,
  output: 5.0 / 1e6,
  cacheRead: 0.10 / 1e6,
  cacheWrite: 1.25 / 1e6, // 5-minute ephemeral
};

const SYSTEM_PROMPT =
  'You evaluate messages from Ukrainian-diaspora community chats in Italy to ' +
  'find leads for a directory of INDIVIDUAL tradespeople / specialists ' +
  '("masters"). Languages mix freely: Ukrainian, Russian, Italian, sometimes ' +
  'English.\n\n' +
  'USEFUL = a lead pointing to a specific INDIVIDUAL specialist. Two useful ' +
  'kinds:\n' +
  '- ANNOUNCEMENT (kind:"announcement"): an individual specialist personally ' +
  'declaring their OWN service ("я майстер", "роблю це сам", a self-advert).\n' +
  '- RECOMMENDATION (kind:"recommendation"): someone naming or linking to a ' +
  'specific specialist, usually in reply to an inquiry ("ask Georgy, +39…", ' +
  '"contact Olena", "Maxim is great, @handle", "there\'s a master who does this"). ' +
  'The recommended person is the lead — extract THEIR name/contact, not the ' +
  'recommender\'s.\n' +
  'Minimum bar: a profession + EITHER a contact (phone, @handle, t.me/, wa.me/, ' +
  'Instagram/profile link) OR enough to identify the specialist (a name, or a ' +
  'clear self-description of the service). Service-list adverts with profession + ' +
  'location count as useful even without a phone (an admin can fetch the contact ' +
  'from the original post).\n\n' +
  'When the input is an inquiry + a bundled reply, use the inquiry for context ' +
  '(it usually states the profession) and the reply for the lead. A reply where ' +
  'the responder offers their OWN service is an ANNOUNCEMENT (set extracted.name ' +
  'to the RESPONDER display name); a reply naming someone else is a ' +
  'RECOMMENDATION (extract the named person). Never invent a contact — leave ' +
  'contacts empty if none is in the text.\n' +
  'A reply that only PROMISES to share a contact privately with NO name and NO ' +
  'link ("написала вам", "пишу в особисті", "скину в приват") is NOT useful — ' +
  'there is no identifiable specialist to card.\n\n' +
  'NOT USEFUL — exclude all of these even if a phone or link appears:\n' +
  '- Job listings (employer hiring workers, "потрібен/шукаємо", "робота в...")\n' +
  '- Courses, schools, training programs, autoshcools\n' +
  '- Retail shops / store recommendations / generic product tips\n' +
  '- Out-of-context contacts (a phone number with no profession or context)\n' +
  '- General chatter, greetings, complaints, thanks/praise without naming a specialist\n' +
  '- A bare promise to share a contact privately, with no specialist named and no link\n' +
  '- Cross-border passenger or parcel transport between countries — buses / drivers / ' +
  'couriers running Ukraine ↔ Italy / Europe routes, "посилки в Україну", "автобус до Львова", ' +
  '"передачі додому", "забираю з України", trips and parcel handovers across borders. ' +
  'These are scam-prone and not local. LOCAL moving services within Italy (a trasloco, ' +
  'помічу з переїздом квартири, перевезу меблі по місту) ARE useful — keep those.\n' +
  '- Unanswered questions; comments unrelated to finding a specialist\n\n' +
  'Extract name / profession / city / contacts VERBATIM from the source text; ' +
  'use null when absent.\n' +
  'CONTACT TYPE RULES — never mix phone and telegram:\n' +
  '- A phone number (digits, optional country code, spaces/dashes) → contactType:"phone". ' +
  'Even if the source says "+380 50 123 4567 — Telegram", the value is a phone number → phone.\n' +
  '- A Telegram @username (letters/digits/underscore, 5–32 chars, no +, no dashes, ' +
  'does not start with a digit) → contactType:"telegram".\n' +
  '- Never assign contactType:"telegram" to a phone-shaped value, and never assign ' +
  'contactType:"phone" to a @handle.\n' +
  'CRITICAL — the `description` field is the ONE field you must NOT copy ' +
  'verbatim: ALWAYS write `description` in UKRAINIAN (українською мовою), a ' +
  'concise 1–2 sentence summary of the service offered. If the source message ' +
  'is in Russian, Italian or English, TRANSLATE the summary into Ukrainian — ' +
  'never leave the description in the original language. name/profession/city/' +
  'contacts stay verbatim; only `description` is translated.\n' +
  'Respond strictly in the JSON schema.';

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['is_useful', 'kind', 'confidence', 'extracted'],
  properties: {
    is_useful: { type: 'boolean' },
    kind: { type: 'string', enum: ['announcement', 'recommendation', 'none'] },
    confidence: { type: 'number' },
    extracted: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'profession', 'city', 'contacts', 'description'],
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
      },
    },
  },
};

let _client = null;
function getClient() {
  if (_client) return _client;
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not set (backend/.env)');
  }
  // Bumped retries/timeout to ride out transient connection blips. The SDK
  // retries 408/409/429/5xx by default; connection errors get the same
  // treatment with maxRetries set explicitly.
  _client = new Anthropic({ maxRetries: 5, timeout: 60000 });
  return _client;
}

let cumulativeCostUSD = 0;
let cumulativeCalls = 0;
const getCumulativeCost = () => cumulativeCostUSD;
const getCumulativeCalls = () => cumulativeCalls;
function resetCost() {
  cumulativeCostUSD = 0;
  cumulativeCalls = 0;
}

function getBudget() {
  const b = Number(process.env.MINING_BUDGET_USD || 5);
  return Number.isFinite(b) ? b : 5;
}

function tallyCost(usage) {
  if (!usage) return 0;
  const cost =
    (usage.input_tokens || 0) * PRICE.input +
    (usage.output_tokens || 0) * PRICE.output +
    (usage.cache_read_input_tokens || 0) * PRICE.cacheRead +
    (usage.cache_creation_input_tokens || 0) * PRICE.cacheWrite;
  cumulativeCostUSD += cost;
  cumulativeCalls += 1;
  return cost;
}

// Map the schema-constrained JSON response onto the classifier interface:
// kind ∈ {recommendation, announcement, unknown}; not-useful collapses to
// 'unknown' so downstream gating treats it as "do not surface". Shared with the
// ollama adapter so both engines map identically.
function mapResult(parsed) {
  let kind = 'unknown';
  if (parsed.is_useful) {
    if (parsed.kind === 'announcement') kind = 'announcement';
    else if (parsed.kind === 'recommendation') kind = 'recommendation';
  }
  // Normalize confidence to the 0..1 the classifier interface promises. Haiku
  // emits 0..1 already; some local models (e.g. Qwen) emit a 0..100 percentage
  // — rescale those, then clamp anything still out of range.
  let score = typeof parsed.confidence === 'number' ? parsed.confidence : 0;
  if (score > 1) score = score / 100;
  score = Math.max(0, Math.min(1, score));
  return { kind, score, extracted: parsed.extracted || {} };
}

function buildUserContent(message) {
  if (message && message.inquiry) {
    const responder = message.responderName
      ? `\n\nRESPONDER (Telegram display name): ${String(message.responderName).trim()}`
      : '';
    return (
      'QUESTION ASKED (for context only):\n' +
      String(message.inquiry).trim() +
      responder +
      '\n\nBUNDLED REPLY (assess THIS):\n' +
      String(message.text || '').trim()
    );
  }
  return 'SPECIALIST POST (assess this):\n' + String((message && message.text) || '').trim();
}

async function classify(message) {
  const budget = getBudget();
  if (cumulativeCostUSD >= budget) {
    throw new Error(
      `MINING_BUDGET_USD=$${budget} exhausted ` +
        `(spent=$${cumulativeCostUSD.toFixed(4)}, calls=${cumulativeCalls})`
    );
  }
  const client = getClient();
  const params = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    // Cache the stable system prompt. Harmless if below the model's caching
    // minimum (4096 tokens for Haiku 4.5) — will activate automatically once
    // the prompt grows past the threshold.
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: buildUserContent(message) }],
  };

  let parsed = null;
  let lastText = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await client.messages.create(params);
    tallyCost(response.usage);
    const textBlock = (response.content || []).find((b) => b.type === 'text');
    lastText = (textBlock && textBlock.text) || '';
    try {
      parsed = JSON.parse(lastText);
      break;
    } catch (_) {
      if (attempt === 1) {
        throw new Error('Haiku returned malformed JSON twice: ' + lastText.slice(0, 200));
      }
    }
  }

  return mapResult(parsed);
}

module.exports = {
  name: 'haiku',
  version: VERSION,
  classify,
  getCumulativeCost,
  getCumulativeCalls,
  resetCost,
  // Exposed for tests / introspection and reuse by the ollama adapter, which
  // shares the prompt, schema, input format and result mapping verbatim.
  _SYSTEM_PROMPT: SYSTEM_PROMPT,
  _SCHEMA: SCHEMA,
  _MODEL: MODEL,
  _buildUserContent: buildUserContent,
  _mapResult: mapResult,
};
