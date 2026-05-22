'use strict';

// Ollama local-LLM adapter — zero-cost, fully-offline classifier (issue #114).
//
// Realizes the "Ollama = pluggable offline fallback" path from ADR 0001: once
// the $5 Anthropic key is spent, re-classification (prompt tweaks, new chats,
// watcher mode) runs locally with no API cost. It is a drop-in for the Haiku
// adapter — same prompt, same JSON schema, same {kind, score, extracted} shape —
// so nothing downstream (mine-classify, mine-review) changes.
//
// Reuses haiku.js's SYSTEM_PROMPT / SCHEMA / buildUserContent / mapResult
// verbatim, keeping a single source of truth for classification behavior.
// Ollama's `format` field accepts the JSON schema directly and constrains
// decoding, so the response always parses.
//
// Config (env): OLLAMA_MODEL (default 'qwen2.5:14b'), OLLAMA_HOST
// (default http://localhost:11434).
//
// Model choice (validated 2026-05-22, issue #114, 326 labeled units):
//   qwen2.5:14b — precision/recall ≈67%/67%, PARITY with Haiku 4.5. ~9 GB,
//                 fits 16 GB comfortably. The default and recommended model.
//   mistral (7B) — REJECTED: 18.9% precision, flagged 86% of messages useful
//                 and fabricated contacts. Do not use.
//
// Local run: `ollama serve` then `CLASSIFIER=ollama node scripts/mine-classify.js`.

const haiku = require('./haiku');

// 1.1.0 — tracks the shared SYSTEM_PROMPT change in haiku.js v1.3.0
// (private-contact-promise replies are no longer classified useful).
const VERSION = '1.1.0';
const MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:14b';
const HOST = (process.env.OLLAMA_HOST || 'http://localhost:11434').replace(/\/$/, '');
const TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 120000);

async function classify(message) {
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
        format: haiku._SCHEMA,
        // Deterministic, schema-faithful output for a classification task.
        options: { temperature: 0 },
        messages: [
          { role: 'system', content: haiku._SYSTEM_PROMPT },
          { role: 'user', content: haiku._buildUserContent(message) },
        ],
      }),
    });
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new Error(`ollama: no response within ${TIMEOUT_MS}ms (model "${MODEL}")`);
    }
    throw new Error(
      `ollama: cannot reach ${HOST} — is \`ollama serve\` running? (${e.message})`
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`ollama: HTTP ${res.status} — ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data && data.message && data.message.content;
  if (!content) {
    throw new Error('ollama: empty response (no message.content)');
  }
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (_) {
    throw new Error('ollama: response was not valid JSON: ' + String(content).slice(0, 200));
  }
  return haiku._mapResult(parsed);
}

module.exports = {
  name: 'ollama',
  // Model is part of the version so Candidate provenance and the verdict cache
  // distinguish e.g. mistral from qwen2.5:14b — they classify very differently.
  version: VERSION + '+' + MODEL,
  classify,
  // No getCumulativeCost/resetCost: local inference is free. Callers detect
  // the absence and skip cost reporting (see mine-classify.js / mine-eval.js).
  _MODEL: MODEL,
};
