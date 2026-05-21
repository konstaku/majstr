/**
 * Recall-check sampler: draw random messages from the "missed" set — i.e.
 * messages NOT surfaced as part of any thread bundle or announcement by the
 * current pipeline. Labels here measure what we are *failing* to catch.
 *
 * One labeled positive in this sample is meaningful: it's a useful piece of
 * master data we'd have shipped past. Zero positives ≈ broad net catches it.
 *
 * Usage (from backend/):
 *   MONGO_DB_NAME=majstr_mining node scripts/mine-recall-sample.js \
 *     --chatIds 1780497126,1593295268 --n 25 --seed 42
 * Default out: ../chat-history/recall/label-sample.json  (gitignored)
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { runDB } = require('../database/db');
const RawMessage = require('../database/schema/RawMessage');
const { buildThreads } = require('../mining/thread');

const arg = (n, d) => {
  const i = process.argv.indexOf(n);
  return i !== -1 ? process.argv[i + 1] : d;
};
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CHAT_LABEL = {
  '1780497126': 'Veneto',
  '1593295268': 'Milano',
};

async function main() {
  const chatIds = arg('--chatIds', '1780497126,1593295268').split(',').map((s) => s.trim());
  const n = parseInt(arg('--n', '25'), 10);
  const seed = parseInt(arg('--seed', '42'), 10);
  const out = path.resolve(arg('--out', '../chat-history/recall/label-sample.json'));
  fs.mkdirSync(path.dirname(out), { recursive: true });

  await runDB();
  const rng = mulberry32(seed);
  const units = [];
  let uid = 0;
  const stats = {};

  for (const chatID of chatIds) {
    const all = await RawMessage.find({ chatID })
      .select('messageID replyToID fromHash fromName date text lang')
      .lean();
    const byId = new Map(all.map((m) => [m.messageID, m]));
    const { threads, announcements } = buildThreads(all);

    const surfaced = new Set();
    for (const t of threads) {
      surfaced.add(t.inquiryID);
      for (const a of t.answers) for (const m of a.messages) surfaced.add(m.messageID);
    }
    for (const an of announcements) surfaced.add(an.messageID);

    const missed = all.filter((m) => !surfaced.has(m.messageID));
    // Fisher–Yates with shared rng so the cross-chat order is deterministic.
    const idx = missed.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    const picked = idx.slice(0, n).map((i) => missed[i]);

    // Build a replies index once for this chat for cheap context lookup.
    const repliesByParent = new Map();
    for (const m of all) {
      if (m.replyToID != null && byId.has(m.replyToID)) {
        if (!repliesByParent.has(m.replyToID)) repliesByParent.set(m.replyToID, []);
        repliesByParent.get(m.replyToID).push(m);
      }
    }

    for (const m of picked) {
      const parent = m.replyToID != null ? byId.get(m.replyToID) : null;
      const replies = repliesByParent.get(m.messageID) || [];
      units.push({
        uid: uid++,
        type: 'random',
        chatID,
        chatLabel: CHAT_LABEL[chatID] || chatID,
        messageID: m.messageID,
        lang: m.lang,
        text: m.text,
        context: {
          parent: parent ? { messageID: parent.messageID, text: parent.text } : null,
          replies: replies.slice(0, 5).map((r) => ({ messageID: r.messageID, text: r.text })),
        },
        useful: null,
      });
    }

    stats[CHAT_LABEL[chatID] || chatID] = {
      total: all.length,
      surfaced: surfaced.size,
      missed: missed.length,
      picked: picked.length,
    };
  }

  // Shuffle units across chats so labeling alternates and isn't chat-batched.
  for (let i = units.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [units[i], units[j]] = [units[j], units[i]];
  }

  const sample = {
    meta: {
      mode: 'recall',
      seed,
      builtAt: new Date().toISOString(),
      stats,
      instructions:
        '1 = this message (in its little context) contains usable master data we should NOT have missed; 0 = noise/chatter; Space = skip.',
    },
    units,
  };
  fs.writeFileSync(out, JSON.stringify(sample, null, 2));
  console.log(`Wrote ${units.length} recall units -> ${out}`);
  console.log('stats:', JSON.stringify(stats));
  await mongoose.disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('mine-recall-sample failed:', e.message);
    process.exit(1);
  });
