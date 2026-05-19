/**
 * Build a reproducible, thread-aware labeling sample (issue #92, v2).
 *
 * Labeling atom = ONE screen:
 *   - 'answer'       : an inquiry + ONE responder's bundled reply (mark useful)
 *   - 'announcement' : a standalone specialist advert (mark relevant)
 *
 * Sample is stratified so labeling is productive but recall stays measurable:
 *   promising threads (inquiry has a profession OR an answer has contact/prof)
 *   + a random slice of the rest + standalone announcements.
 *
 * Usage (from backend/):
 *   MONGO_DB_NAME=majstr_mining node scripts/mine-sample.js \
 *     --threads 60 --rand 20 --ann 40 --seed 42
 * Writes (gitignored): ../chat-history/italy/veneto/label-sample.json
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
function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function main() {
  const nThreads = parseInt(arg('--threads', '60'), 10);
  const nRand = parseInt(arg('--rand', '20'), 10);
  const nAnn = parseInt(arg('--ann', '40'), 10);
  const seed = parseInt(arg('--seed', '42'), 10);
  const chatId = arg('--chatId', null); // scope to one chat (default: all)
  const out = path.resolve(arg('--out', '../chat-history/italy/veneto/label-sample.json'));

  await runDB();
  const q = chatId ? { chatID: chatId } : {};
  const all = await RawMessage.find(q)
    .select('messageID replyToID fromHash date text lang')
    .lean();
  if (!all.length) throw new Error(`No messages for chatId=${chatId}`);
  const { threads, announcements } = buildThreads(all);
  const rng = mulberry32(seed);

  const promising = (t) =>
    t.profession || t.answers.some((a) => a.extracted.contacts || a.extracted.profession);
  const hot = shuffle(threads.filter(promising), rng).slice(0, nThreads);
  const hotIds = new Set(hot.map((t) => t.inquiryID));
  const cold = shuffle(threads.filter((t) => !hotIds.has(t.inquiryID)), rng).slice(0, nRand);
  const pickedThreads = shuffle([...hot, ...cold], rng);
  const pickedAnn = shuffle([...announcements], rng).slice(0, nAnn);

  const units = [];
  let uid = 0;
  for (const t of pickedThreads) {
    t.answers.forEach((a, idx) => {
      units.push({
        uid: uid++,
        type: 'answer',
        inquiryID: t.inquiryID,
        inquiryText: t.inquiry.text,
        inquiryLang: t.inquiry.lang,
        profession: t.profession,
        answerIndex: idx,
        answerCount: t.answers.length,
        responderHash: a.responderHash.slice(0, 8),
        messages: a.messages,
        extracted: a.extracted,
        useful: null,
      });
    });
  }
  for (const an of pickedAnn) {
    units.push({
      uid: uid++,
      type: 'announcement',
      messageID: an.messageID,
      text: an.text,
      lang: an.lang,
      extracted: an.extracted,
      label: null,
    });
  }
  shuffle(units, rng);

  const sample = {
    meta: {
      seed,
      builtAt: new Date().toISOString(),
      counts: {
        threadsPicked: pickedThreads.length,
        answerUnits: units.filter((u) => u.type === 'answer').length,
        announcementUnits: pickedAnn.length,
        totalUnits: units.length,
      },
      instructions:
        "answer: useful=1 if this reply gives usable master data (name/contact/recommendation) for the question above; else 0. " +
        'announcement: label=1 if a real specialist offering services; else 0. Space=skip.',
    },
    units,
  };
  fs.writeFileSync(out, JSON.stringify(sample, null, 2));
  console.log(`Wrote ${units.length} units -> ${out}`);
  console.log(JSON.stringify(sample.meta.counts));
  await mongoose.disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('mine-sample failed:', e.message);
    process.exit(1);
  });
