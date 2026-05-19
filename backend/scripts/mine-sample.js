/**
 * Draw a reproducible random sample of RawMessages for human labeling. The
 * label set is what makes the precision/recall numbers real (issue #92).
 *
 * Seeded + deterministic: same --seed always yields the same sample, so the
 * eval is reproducible and a re-draw won't shuffle your work.
 *
 * Usage (from backend/):
 *   MONGO_DB_NAME=majstr_mining node scripts/mine-sample.js --n 200 --seed 42
 * Writes (gitignored — contains message text): the --out path, default
 *   ../chat-history/italy/veneto/label-sample.json
 *
 * Then: open the file, set each "label" to 1 or 0:
 *   1 = this is a specialist RECOMMENDATION or a specialist ANNOUNCING services
 *   0 = anything else (chatter, questions w/o a master, spam, off-topic)
 * Leave "label" as null only if genuinely undecidable (excluded from metrics).
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { runDB } = require('../database/db');
const RawMessage = require('../database/schema/RawMessage');

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : def;
}

// Mulberry32 — tiny deterministic PRNG.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function main() {
  const n = parseInt(arg('--n', '200'), 10);
  const seed = parseInt(arg('--seed', '42'), 10);
  const out = path.resolve(
    arg('--out', '../chat-history/italy/veneto/label-sample.json')
  );

  await runDB();
  const ids = await RawMessage.find().select('_id').lean();
  if (ids.length < n) throw new Error(`Only ${ids.length} messages available`);

  // Deterministic Fisher–Yates pick of n indices.
  const rng = mulberry32(seed);
  const idx = ids.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const pick = idx.slice(0, n).map((i) => ids[i]._id);
  const docs = await RawMessage.find({ _id: { $in: pick } })
    .select('messageID text lang')
    .lean();

  const sample = {
    meta: {
      seed,
      n: docs.length,
      drawnAt: new Date().toISOString(),
      instructions:
        '1 = specialist recommendation OR specialist announcing services; 0 = everything else; null = undecidable',
    },
    rows: docs.map((d) => ({
      messageID: d.messageID,
      lang: d.lang,
      text: d.text,
      label: null,
    })),
  };
  fs.writeFileSync(out, JSON.stringify(sample, null, 2));
  console.log(`Wrote ${docs.length} rows -> ${out}`);
  console.log('Label each row (1/0), then: node scripts/mine-eval.js');
  await mongoose.disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('mine-sample failed:', e.message);
    process.exit(1);
  });
