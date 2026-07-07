'use strict';

// Demo seed for the master-recommendations feature — decorates a few existing
// approved masters in the STAGING db with recommendations so dev.majstr.xyz
// shows the count badge, the "<N> рекомендацій" card label, recommended-first
// ordering, and the modal quote carousel.
//
// Guarded to majstr_staging ONLY (never prod). Run via Railway staging env:
//   railway run node scripts/seed-demo-recommendations.js
// (railway injects MONGO_PASSWORD + MONGO_DB_NAME=majstr_staging + REVALIDATE_SECRET)

require('dotenv').config();
const mongoose = require('mongoose');
const { runDB } = require('../database/db');
const Master = require('../database/schema/Master');
const Recommendation = require('../database/schema/Recommendation');
const { attachRecommendation, recountMaster } = require('../helpers/recommendations');

// Per-master recommendation sets. `text: ''` (or omitted) = count-only (moves the
// number, no quote). One long quote to exercise the "більше" clamp toggle.
const SETS = [
  [
    { author: 'Ірина П.', text: 'Золоті руки! Приїхав того ж дня, полагодив швидко і чисто. Пояснив, що було не так, і як доглядати далі. Нарешті знайшла свого майстра — більше нікого не шукаю, рекомендую всім у місті.' },
    { author: 'Богдан С.', text: 'Рекомендую, зробив якісно і за адекватні гроші.' },
    { author: 'Ната Д.', text: 'Виручив терміново ввечері, дуже вдячна.' },
    { author: 'Олена К.', text: '' },
    { author: 'Юрій Ф.', text: '' },
  ],
  [
    { author: 'Катерина Б.', text: 'Все зробили акуратно і вчасно, залишилась задоволена.' },
    { author: 'Тарас В.', text: 'Професійно, по-людськи пояснив усі нюанси.' },
    { author: 'Марина Г.', text: '' },
  ],
  [
    { author: 'Оксана М.', text: 'Дуже уважний майстер, все чітко і охайно.' },
    { author: 'Павло Н.', text: '' },
  ],
];

async function main() {
  const dbName = process.env.MONGO_DB_NAME || '';
  if (dbName !== 'majstr_staging') {
    console.error(`Refusing: MONGO_DB_NAME is "${dbName || '(unset)'}" — this seed only runs on majstr_staging.`);
    process.exit(1);
  }
  await runDB();

  const masters = await Master.find({ status: 'approved' })
    .sort({ _id: 1 })
    .limit(SETS.length)
    .lean();
  if (!masters.length) {
    console.error('No approved masters in majstr_staging — run seed-staging-masters.js first.');
    process.exit(1);
  }

  let chatSeq = 1001500000000;
  for (let i = 0; i < masters.length && i < SETS.length; i++) {
    const m = masters[i];
    // Fresh start for an idempotent re-run.
    await Recommendation.deleteMany({ masterID: m._id });
    let msgId = 100;
    for (const rec of SETS[i]) {
      await attachRecommendation({
        masterID: m._id,
        authorKey: 'name:' + rec.author.trim().toLowerCase(),
        authorName: rec.author,
        text: rec.text || '',
        sourceType: 'thread_answer',
        sourceChatID: '-' + chatSeq, // numeric → forms a t.me/c link
        sourceMessageID: msgId++,
      });
    }
    const count = await recountMaster(m._id);
    console.log(`  ${m.name || m._id}: ${count} recommendations (${SETS[i].filter((r) => r.text).length} with text)`);
    chatSeq += 1;
  }

  // Bust the dev site's ISR cache so the changes show immediately.
  const base = process.env.PUBLIC_WEB_URL;
  const secret = process.env.REVALIDATE_SECRET;
  if (base && secret) {
    try {
      const r = await fetch(`${base}/api/revalidate?secret=${secret}`, { method: 'POST' });
      console.log(`Revalidate ${base}: ${r.status}`);
    } catch (e) {
      console.log(`Revalidate skipped: ${e.message}`);
    }
  }

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((e) => {
  console.error('seed-demo-recommendations failed:', e.message);
  process.exit(1);
});
