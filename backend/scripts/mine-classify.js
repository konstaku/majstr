/**
 * M2 #91 — batch classification runner.
 *
 * RawMessages -> buildThreads (inquiry+reply bundles + announcements) -> Haiku
 * -> Candidate docs (only for units Haiku flags useful). This is what turns the
 * working classifier into a reviewable candidate queue.
 *
 * Resumable & cheap to re-run: every Haiku verdict is cached to
 * ../chat-history/mining-cache/<chatId>.json (gitignored) keyed by the anchor
 * message id + classifier version. A crash or re-run reuses cached verdicts and
 * only calls Haiku for new units. Candidate writes upsert on (chatID,
 * anchorMessageID) — admin-set status is preserved via $setOnInsert.
 *
 * Usage (from backend/):
 *   MONGO_DB_NAME=majstr_mining node scripts/mine-classify.js            # both chats
 *   MONGO_DB_NAME=majstr_mining node scripts/mine-classify.js --chatId 1780497126
 *   MONGO_DB_NAME=majstr_mining node scripts/mine-classify.js --limit 20 # smoke test
 *
 * Cost: full corpus ~1875 units ≈ $2.80. The adapter hard-stops at
 * MINING_BUDGET_USD ($5) per process.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { runDB } = require('../database/db');
const RawMessage = require('../database/schema/RawMessage');
const Candidate = require('../database/schema/Candidate');
const MiningRun = require('../database/schema/MiningRun');
const { buildThreads } = require('../mining/thread');
const haiku = require('../mining/classifier/adapters/haiku');

const arg = (n, d) => {
  const i = process.argv.indexOf(n);
  return i !== -1 ? process.argv[i + 1] : d;
};
const CHAT_REGION = { '1780497126': 'Veneto', '1593295268': 'Milano' };
const CONCURRENCY = 4;

// Flatten a chat's threads + announcements into classifiable candidate units.
function unitsFromChat(all) {
  const { threads, announcements } = buildThreads(all);
  const units = [];
  for (const t of threads) {
    for (const a of t.answers) {
      const ids = a.messageIDs.slice().sort((x, y) => x - y);
      const text = a.messages.map((m) => m.text).join('\n');
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
  return units;
}

async function classifyWithRetry(input) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await haiku.classify(input);
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
  let units = unitsFromChat(all);
  console.log(`[${region}] ${all.length} messages -> ${units.length} candidate units`);
  if (limit) units = units.slice(0, limit);

  const cacheDir = path.resolve('../chat-history/mining-cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  const cacheFile = path.join(cacheDir, chatID + '.json');
  let cache = {};
  if (fs.existsSync(cacheFile)) {
    cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    console.log(`[${region}] ${Object.keys(cache).length} cached verdicts loaded`);
  }

  const run = await MiningRun.create({
    mode: 'research',
    chatID,
    source: `classify:${region}`,
    classifierName: haiku.name,
    classifierVersion: haiku.version,
    startedAt: new Date(),
  });

  let fresh = 0,
    cached = 0,
    failed = 0,
    written = 0;

  for (let i = 0; i < units.length; i += CONCURRENCY) {
    const batch = units.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (u) => {
        const key = String(u.anchorMessageID);
        let cls = cache[key] && cache[key].v === haiku.version ? cache[key] : null;
        if (cls) cached++;
        else {
          try {
            const r = await classifyWithRetry(u.classifyInput);
            cls = { kind: r.kind, score: r.score, extracted: r.extracted, v: haiku.version };
            cache[key] = cls;
            fresh++;
          } catch (e) {
            failed++;
            return;
          }
        }
        if (cls.kind === 'unknown') return; // only useful units become Candidates
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
              classifierName: haiku.name,
              classifierVersion: haiku.version,
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
        `fresh=${fresh} cached=${cached} failed=${failed} candidates=${written}  ` +
        `$${haiku.getCumulativeCost().toFixed(3)}`
    );
  }
  process.stdout.write('\n');

  run.counts = {
    ingested: all.length,
    prefiltered: units.length,
    classified: fresh + cached,
    candidates: written,
  };
  run.costUSD = haiku.getCumulativeCost();
  run.finishedAt = new Date();
  await run.save();
  console.log(
    `[${region}] done — ${written} candidates written, ${failed} failed, run=${run._id}`
  );
}

async function main() {
  const limit = arg('--limit') ? parseInt(arg('--limit'), 10) : null;
  const only = arg('--chatId', null);
  const chats = only ? [only] : ['1780497126', '1593295268'];

  await runDB();
  haiku.resetCost();
  try {
    for (const c of chats) await processChat(c, limit);
  } finally {
    console.log(
      `\nTOTAL: $${haiku.getCumulativeCost().toFixed(3)} across ${haiku.getCumulativeCalls()} Haiku calls`
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
