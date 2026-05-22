/**
 * Measure the pre-classification filters (mining/prefilter.js) against the
 * human-labeled fixtures — how much volume they cut vs. how much recall they
 * cost. Run this whenever the filter rules or the profession lexicon change.
 *
 * The filters govern thread-ANSWER units, so this evaluates `type: 'answer'`
 * fixture units only. For each: apply keepAnswerUnit(inquiry, reply) and
 * compare the drop decision against the human useful/not-useful label.
 *
 *   recall loss   — answer units labeled useful (1) that the filter DROPS.
 *                   These are real masters the pipeline would never see. Keep ~0.
 *   noise removed — units labeled not-useful (0) that the filter drops. The win.
 *
 * No DB, no classifier calls — instant.
 *
 * Usage (from backend/):
 *   node scripts/mine-prefilter-eval.js
 */
const fs = require('fs');
const path = require('path');
const { keepAnswerUnit } = require('../mining/prefilter');

const FIXTURES = [
  { name: 'Veneto', file: '../chat-history/italy/veneto/label-sample.json' },
  { name: 'Milano', file: '../chat-history/italy/lombardia/milano/label-sample.json' },
  { name: 'Recall', file: '../chat-history/recall/label-sample.json' },
];

function evalFixture(fx) {
  const p = path.resolve(fx.file);
  if (!fs.existsSync(p)) {
    console.log(`[${fx.name}] missing ${p} — skipping`);
    return null;
  }
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  const answers = (data.units || []).filter(
    (u) => u.type === 'answer' && (u.useful === 0 || u.useful === 1)
  );

  const rows = [];
  for (const u of answers) {
    const text = (u.messages || []).map((m) => m.text).join('\n');
    const verdict = keepAnswerUnit(u.inquiryText, text);
    rows.push({ uid: u.uid, useful: u.useful, keep: verdict.keep, reason: verdict.reason });
  }
  return { name: fx.name, rows };
}

function report(name, rows) {
  const useful = rows.filter((r) => r.useful === 1);
  const noise = rows.filter((r) => r.useful === 0);
  const usefulDropped = useful.filter((r) => !r.keep);
  const noiseDropped = noise.filter((r) => !r.keep);
  const dropped = rows.filter((r) => !r.keep);
  const recallKept = useful.length ? (useful.length - usefulDropped.length) / useful.length : 1;

  console.log(
    `[${name}] ${rows.length} answer units | ` +
      `dropped ${dropped.length} (${((dropped.length / (rows.length || 1)) * 100).toFixed(0)}%): ` +
      `${noiseDropped.length} noise removed, ${usefulDropped.length} useful LOST | ` +
      `recall kept ${(recallKept * 100).toFixed(1)}%`
  );
  for (const r of usefulDropped) {
    console.log(`    ✗ recall loss: uid=${r.uid} reason=${r.reason}`);
  }
}

function main() {
  console.log('Pre-filter recall/volume check (mining/prefilter.js)\n');
  const results = [];
  for (const fx of FIXTURES) {
    const r = evalFixture(fx);
    if (r) {
      report(r.name, r.rows);
      results.push(r);
    }
  }
  if (results.length > 1) {
    const all = results.flatMap((r) => r.rows);
    console.log('');
    report('COMBINED', all);
  }
}

main();
