/**
 * M2 #91 — batch classification runner.
 *
 * RawMessages -> buildThreads (inquiry+reply bundles + announcements) ->
 * prefilter (drop pure-ack / no-thread-signal answers) -> classifier -> Candidate
 * (only for units flagged useful). This is what turns the working classifier
 * into a reviewable candidate queue.
 *
 * The classifier engine is pluggable via the CLASSIFIER env var (issue #114):
 *   CLASSIFIER=haiku   — Claude Haiku 4.5, costs API budget
 *   CLASSIFIER=ollama  — local Qwen2.5 14B via Ollama, zero cost/offline
 *                        (≈67%/67% — parity with Haiku; OLLAMA_MODEL overrides)
 * Nothing else changes — both produce identical Candidate docs.
 *
 * Resumable & cheap to re-run: every verdict is cached to
 * ../chat-history/mining-cache/<chatId>.json (gitignored) keyed by the anchor
 * message id + classifier version. A crash or re-run reuses cached verdicts and
 * only re-classifies new units. Each entry also stores a content hash, so a
 * reposted advert (identical text, new message id) reuses one verdict instead
 * of a fresh classifier call. The cache is keyed by version, so switching
 * engines (haiku<->ollama) does not collide. Candidate writes upsert on
 * (chatID, anchorMessageID) — admin-set status is preserved via $setOnInsert.
 *
 * Usage (from backend/):
 *   MONGO_DB_NAME=majstr_mining node scripts/mine-classify.js            # both chats
 *   MONGO_DB_NAME=majstr_mining node scripts/mine-classify.js --chatId 1780497126
 *   MONGO_DB_NAME=majstr_mining node scripts/mine-classify.js --limit 20 # smoke test
 *   MONGO_DB_NAME=majstr_mining CLASSIFIER=ollama node scripts/mine-classify.js
 *
 * Cost: with Haiku, full corpus ~1875 units ≈ $2.80, hard-stopping at
 * MINING_BUDGET_USD ($5) per process. With Ollama it is free (and offline).
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { runDB } = require('../database/db');
const RawMessage = require('../database/schema/RawMessage');
const Candidate = require('../database/schema/Candidate');
const MiningRun = require('../database/schema/MiningRun');
const { buildThreads } = require('../mining/thread');
const { getClassifier } = require('../mining/classifier');
const { keepAnswerUnit } = require('../mining/prefilter');

const arg = (n, d) => {
  const i = process.argv.indexOf(n);
  return i !== -1 ? process.argv[i + 1] : d;
};
// Pan-Italian national chat uses a stricter gate (announcements only — no
// third-party recommendations). Regional chats keep recommendations.
const ITALIA_CHAT_ID = '1441030224';

const CHAT_REGION = {
  '1780497126': 'Veneto',
  '1593295268': 'Milano',
  '1310497068': 'Torino',
  '1786184772': 'Napoli',
  '1513619004': 'Roma',
  '1685394644': 'Florence', // Українці в Тоскані — Tuscany regional capital
  '1441030224': 'Italia',   // УКРАЇНЦІ В ІТАЛІЇ — national chat (pre-filtered via italy-prefilter.js)
  '1620936389': 'Genova',   // Українці в Генуї | Ucraini a Genova
  '1739258156': 'Genova',   // Українці в Генуя 🇮🇹
  '1698155646': 'Sanremo',  // Украинцы в Сан-Ремо
  '2181477220': 'Sanremo',  // Наші в Санремо
  '1678212416': 'Nice',     // УКРАЇНСЬКІ КРАСУНІ — Côte d'Azur beauty services (FR)
};
const CONCURRENCY = 4;

// Stable fingerprint of a classifier input — lets reposted text (identical
// content under a new message id) reuse one verdict instead of a fresh call.
const hashInput = (input) =>
  crypto.createHash('sha1').update(JSON.stringify(input)).digest('hex').slice(0, 16);

// Selected by the CLASSIFIER env var (default 'heuristic' — pass 'haiku' or
// 'ollama' for real classification). Cost helpers are no-ops for free local
// adapters (ollama) that do not implement cost tracking.
const classifier = getClassifier();
const costOf = () => (classifier.getCumulativeCost ? classifier.getCumulativeCost() : 0);
const callsOf = () => (classifier.getCumulativeCalls ? classifier.getCumulativeCalls() : 0);

// Flatten a chat's threads + announcements into classifiable candidate units.
// Thread answers run through the pre-filter (mining/prefilter.js) — pure-ack and
// no-thread-signal replies are dropped here so they never reach the classifier.
// Announcements already cleared the heuristic announcement gate and pass through.
function unitsFromChat(all) {
  const { threads, announcements } = buildThreads(all);
  const units = [];
  const dropped = { pureAck: 0, noLead: 0 };
  for (const t of threads) {
    for (const a of t.answers) {
      const ids = a.messageIDs.slice().sort((x, y) => x - y);
      const text = a.messages.map((m) => m.text).join('\n');
      const verdict = keepAnswerUnit(t.inquiry.text, text);
      if (!verdict.keep) {
        if (verdict.reason === 'pure-ack') dropped.pureAck++;
        else dropped.noLead++;
        continue;
      }
      units.push({
        sourceType: 'thread_answer',
        anchorMessageID: ids[0],
        messageIDs: ids,
        inquiryMessageID: t.inquiryID,
        inquiryText: t.inquiry.text,
        responderName: a.responderName,
        text,
        classifyInput: { inquiry: t.inquiry.text, responderName: a.responderName, text },
      });
    }
  }
  for (const an of announcements) {
    units.push({
      sourceType: 'announcement',
      anchorMessageID: an.messageID,
      messageIDs: [an.messageID],
      inquiryMessageID: null,
      inquiryText: null,
      responderName: null,
      text: an.text,
      classifyInput: { text: an.text },
    });
  }
  return { units, dropped };
}

async function classifyWithRetry(input) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await classifier.classify(input);
    } catch (e) {
      if (attempt === 2) throw e;
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }
}

async function processChat(chatID, limit) {
  const region = CHAT_REGION[chatID] || chatID;
  const all = await RawMessage.find({ chatID })
    .select('messageID replyToID fromHash fromName date text lang')
    .lean();
  if (!all.length) {
    console.log(`[${region}] no messages — skipping`);
    return;
  }
  const { units: builtUnits, dropped } = unitsFromChat(all);
  let units = builtUnits;
  console.log(
    `[${region}] ${all.length} messages -> ${units.length} units to classify ` +
      `(prefilter dropped ${dropped.pureAck + dropped.noLead}: ` +
      `pure-ack ${dropped.pureAck}, no-thread-signal ${dropped.noLead})`
  );
  if (limit) units = units.slice(0, limit);

  // Per-classifier cache file so haiku and ollama verdicts never overwrite
  // each other. Haiku keeps the original unsuffixed name (`<chatId>.json`) so
  // the existing, budget-funded Haiku cache is reused as-is, not re-classified.
  const cacheDir = path.resolve('../chat-history/mining-cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  const cacheSuffix = classifier.name === 'haiku' ? '' : '.' + classifier.name;
  const cacheFile = path.join(cacheDir, chatID + cacheSuffix + '.json');
  let cache = {};
  if (fs.existsSync(cacheFile)) {
    cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    console.log(`[${region}] ${Object.keys(cache).length} cached verdicts loaded`);
  }

  // Content-hash index over the cache — a reposted advert (identical text under
  // a new message id) reuses one verdict instead of a fresh classifier call.
  const byHash = new Map();
  for (const k of Object.keys(cache)) {
    const e = cache[k];
    if (e && e.h && e.v === classifier.version) byHash.set(e.h, e);
  }

  const run = await MiningRun.create({
    mode: 'research',
    chatID,
    source: `classify:${region}`,
    classifierName: classifier.name,
    classifierVersion: classifier.version,
    startedAt: new Date(),
  });

  let fresh = 0,
    cached = 0,
    deduped = 0,
    failed = 0,
    written = 0;

  for (let i = 0; i < units.length; i += CONCURRENCY) {
    const batch = units.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (u) => {
        const key = String(u.anchorMessageID);
        const hash = hashInput(u.classifyInput);
        let cls = cache[key] && cache[key].v === classifier.version ? cache[key] : null;
        if (cls) cached++;
        else if (byHash.has(hash)) {
          // Identical content already classified (a repost) — reuse, no call.
          const hit = byHash.get(hash);
          cls = { kind: hit.kind, score: hit.score, extracted: hit.extracted, v: classifier.version, h: hash };
          cache[key] = cls;
          deduped++;
        } else {
          try {
            const r = await classifyWithRetry(u.classifyInput);
            cls = { kind: r.kind, score: r.score, extracted: r.extracted, v: classifier.version, h: hash };
            cache[key] = cls;
            byHash.set(hash, cls);
            fresh++;
          } catch (e) {
            failed++;
            return;
          }
        }
        const useful = chatID === ITALIA_CHAT_ID ? cls.kind === 'announcement' : cls.kind !== 'unknown';
        if (!useful) return;
        const extracted = { ...(cls.extracted || {}) };
        if (!extracted.city) extracted.city = region; // default city from chat region
        await Candidate.updateOne(
          { chatID, anchorMessageID: u.anchorMessageID },
          {
            $set: {
              chatID,
              sourceType: u.sourceType,
              anchorMessageID: u.anchorMessageID,
              messageIDs: u.messageIDs,
              inquiryMessageID: u.inquiryMessageID,
              inquiryText: u.inquiryText,
              responderName: u.responderName,
              text: u.text,
              kind: cls.kind,
              score: cls.score,
              extracted,
              classifierName: classifier.name,
              classifierVersion: classifier.version,
              runRef: run._id,
            },
            $setOnInsert: { status: 'new' },
          },
          { upsert: true }
        );
        written++;
      })
    );
    fs.writeFileSync(cacheFile, JSON.stringify(cache)); // crash-safe checkpoint
    process.stdout.write(
      `\r[${region}] ${Math.min(i + CONCURRENCY, units.length)}/${units.length}  ` +
        `fresh=${fresh} cached=${cached} dedup=${deduped} failed=${failed} ` +
        `candidates=${written}  $${costOf().toFixed(3)}`
    );
  }
  process.stdout.write('\n');

  run.counts = {
    ingested: all.length,
    prefiltered: units.length,
    classified: fresh + cached + deduped,
    candidates: written,
  };
  run.costUSD = costOf();
  run.finishedAt = new Date();
  await run.save();
  console.log(
    `[${region}] done — ${written} candidates written, ` +
      `${fresh} classified / ${deduped} repost-deduped / ${failed} failed, run=${run._id}`
  );
}

async function main() {
  const limit = arg('--limit') ? parseInt(arg('--limit'), 10) : null;
  const only = arg('--chatId', null);
  const chats = only
    ? [only]
    : ['1780497126', '1593295268', '1310497068', '1786184772', '1513619004', '1685394644', '1620936389', '1739258156', '1698155646', '2181477220'];

  await runDB();
  if (classifier.resetCost) classifier.resetCost();
  console.log(`classifier: ${classifier.name} v${classifier.version}`);
  try {
    for (const c of chats) await processChat(c, limit);
  } finally {
    console.log(
      classifier.getCumulativeCost
        ? `\nTOTAL: $${costOf().toFixed(3)} across ${callsOf()} ${classifier.name} calls`
        : `\nTOTAL: ${classifier.name} ran free (local — no API cost)`
    );
    await mongoose.disconnect();
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('mine-classify failed:', e.message);
    process.exit(1);
  });
