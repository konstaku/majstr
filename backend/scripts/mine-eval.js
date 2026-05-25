/**
 * Evaluate the thread-aware pipeline against the human-labeled sample
 * (issue #92, v2) and project full-corpus Haiku cost.
 *
 * Threads bypass the score gate by design (every reply to an inquiry is kept —
 * that's where scarce master data hides), so this measures the *yield* of the
 * approach, not a score threshold:
 *   - answer units: how many human-confirmed-useful replies the net surfaced
 *   - announcement units: precision of the standalone-advert detector
 *   - projected Haiku spend if every thread+announcement in the FULL corpus is
 *     sent for extraction
 *
 * Usage (from backend/):
 *   MONGO_DB_NAME=majstr_mining node scripts/mine-eval.js
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
// Haiku-ish: a bundle averages ~400 input tok + ~150 output tok.
const haikuCost = (units) => units * ((400 * 0.8) / 1e6 + (150 * 4) / 1e6);

async function main() {
  const labelsPath = path.resolve(
    arg('--labels', '../chat-history/italy/veneto/label-sample.json')
  );
  const data = JSON.parse(fs.readFileSync(labelsPath, 'utf8'));
  const ans = data.units.filter((u) => u.type === 'answer');
  const annU = data.units.filter((u) => u.type === 'announcement');
  const ansL = ans.filter((u) => u.useful === 0 || u.useful === 1);
  const annL = annU.filter((u) => u.label === 0 || u.label === 1);

  console.log('=== Labeled sample ===');
  console.log(
    `answers: ${ansL.length}/${ans.length} labeled — useful ${
      ansL.filter((u) => u.useful === 1).length
    }, not ${ansL.filter((u) => u.useful === 0).length}`
  );
  console.log(
    `announcements: ${annL.length}/${annU.length} labeled — real ${
      annL.filter((u) => u.label === 1).length
    }, not ${annL.filter((u) => u.label === 0).length}`
  );

  // Yield: of inquiries that produced >=1 human-useful reply, the thread is a
  // real lead. Precision of the answer net = useful / labeled.
  if (ansL.length) {
    const p = ansL.filter((u) => u.useful === 1).length / ansL.length;
    const threadsWithUseful = new Set(
      ansL.filter((u) => u.useful === 1).map((u) => u.inquiryID)
    ).size;
    console.log(
      `\nanswer precision: ${(p * 100).toFixed(1)}%  ` +
        `| inquiries yielding >=1 useful reply: ${threadsWithUseful}`
    );
  }
  if (annL.length) {
    const p = annL.filter((u) => u.label === 1).length / annL.length;
    console.log(`announcement precision: ${(p * 100).toFixed(1)}%`);
  }

  // Full-corpus volume + cost.
  await runDB();
  const chatId = arg('--chatId', null);
  const q = chatId ? { chatID: chatId } : {};
  const all = await RawMessage.find(q)
    .select('messageID replyToID fromHash fromName date text lang')
    .lean();
  const { threads, announcements } = buildThreads(all);
  const answerBundles = threads.reduce((s, t) => s + t.answers.length, 0);
  const total = answerBundles + announcements.length;
  console.log('\n=== Full corpus projection ===');
  console.log(
    `threads ${threads.length} (answer bundles ${answerBundles}) + ` +
      `announcements ${announcements.length} = ${total} Haiku calls`
  );
  console.log(
    `projected Haiku spend: ~$${haikuCost(total).toFixed(2)} of $5 budget`
  );
  if (ansL.length) {
    const p = ansL.filter((u) => u.useful === 1).length / ansL.length;
    console.log(
      `\nGo/no-go: at ~${(p * 100).toFixed(0)}% answer precision, Haiku ` +
        `cleans the rest for ~$${haikuCost(total).toFixed(
          2
        )}. ${p >= 0.15 ? 'PROCEED to Haiku.' : 'Tune inquiry net first.'}`
    );
  }
  await mongoose.disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('mine-eval failed:', e.message);
    process.exit(1);
  });
