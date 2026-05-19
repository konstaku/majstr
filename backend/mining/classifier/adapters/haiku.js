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

const VERSION = '1.1.0';
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
  'USEFUL = an individual specialist offering their personal service ' +
  '(announcement), OR a specific named master being recommended (recommendation). ' +
  'Minimum bar: a profession + EITHER a contact (phone, @handle, t.me/, wa.me/, ' +
  'Instagram/profile link) OR a clear personal recommendation with a name. ' +
  'Service-list adverts with profession + location count as useful even without ' +
  'a phone (an admin can fetch the contact from the original post).\n\n' +
  'When the input is an inquiry + a bundled reply, ALSO flag as useful when ' +
  'the responder clearly indicates they have a specific master to share — ' +
  'naming a person ("Maxim is great"), attaching a profile/URL, or saying ' +
  'they will send the contact privately ("пишу в особисті", "написала вам", ' +
  '"можу дати контакт"). The asker would consider the answer valuable even ' +
  'if the contact itself is shared off-channel.\n\n' +
  'NOT USEFUL — exclude all of these even if a phone or link appears:\n' +
  '- Job listings (employer hiring workers, "потрібен/шукаємо", "робота в...")\n' +
  '- Courses, schools, training programs, autoshcools\n' +
  '- Retail shops / store recommendations / generic product tips\n' +
  '- Out-of-context contacts (a phone number with no profession or context)\n' +
  '- General chatter, greetings, complaints, thanks/praise without naming a specialist\n' +
  '- Unanswered questions; comments unrelated to finding a specialist\n\n' +
  'Extract fields verbatim from the source text; use null when absent. Respond ' +
  'strictly in the JSON schema.';

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

function buildUserContent(message) {
  if (message && message.inquiry) {
    return (
      'QUESTION ASKED (for context only):\n' +
      String(message.inquiry).trim() +
      "\n\nBUNDLED REPLY (assess THIS):\n" +
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

  // Map onto the classifier interface: kind ∈ {recommendation, announcement,
  // unknown}; not-useful collapses to 'unknown' so downstream gating treats
  // it as "do not surface".
  let kind = 'unknown';
  if (parsed.is_useful && (parsed.kind === 'announcement' || parsed.kind === 'recommendation')) {
    kind = parsed.kind;
  }
  return {
    kind,
    score: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
    extracted: parsed.extracted || {},
  };
}

module.exports = {
  name: 'haiku',
  version: VERSION,
  classify,
  getCumulativeCost,
  getCumulativeCalls,
  resetCost,
  // Exposed for tests / introspection.
  _SYSTEM_PROMPT: SYSTEM_PROMPT,
  _MODEL: MODEL,
};
