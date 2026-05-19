/**
 * Evaluate the heuristic pre-filter against the human-labeled sample and
 * recommend a gate threshold (issue #92).
 *
 * Sweeps thresholds, reporting precision / recall / F1 on the labeled set plus
 * the projected volume + Haiku cost when that threshold is applied to the FULL
 * corpus. Because Haiku is the precision stage and is cheap, the recommended
 * threshold favors RECALL (don't miss real masters) over a tight gate.
 *
 * Usage (from backend/):
 *   MONGO_DB_NAME=majstr_mining node scripts/mine-eval.js \
 *     --labels ../chat-history/italy/veneto/label-sample.json
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { runDB } = require('../database/db');
const RawMessage = require('../database/schema/RawMessage');
const { classify } = require('../mining/classifier/adapters/heuristic');

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : def;
}

// Haiku price-ish per message (avg ~142B text): ~250 in tok, ~120 out tok.
function haikuCost(count) {
  return count * ((250 * 0.8) / 1e6 + (120 * 4) / 1e6);
}

async function main() {
  const labelsPath = path.resolve(
    arg('--labels', '../chat-history/italy/veneto/label-sample.json')
  );
  const data = JSON.parse(fs.readFileSync(labelsPath, 'utf8'));
  const rows = data.rows.filter((r) => r.label === 0 || r.label === 1);
  if (!rows.length) throw new Error('No labeled rows (set "label" to 1/0 first)');

  const pos = rows.filter((r) => r.label === 1).length;
  console.log(
    `Labeled: ${rows.length} (positives ${pos}, negatives ${rows.length - pos}, ` +
      `skipped ${data.rows.length - rows.length})`
  );
  if (pos < 10) {
    console.log(
      `⚠ Only ${pos} positives — recall estimate is weak. Consider a larger sample.`
    );
  }

  const scored = [];
  for (const r of rows) {
    const c = await classify({ text: r.text });
    scored.push({ y: r.label, s: c.score });
  }

  await runDB();
  const corpus = await RawMessage.find().select('text').lean();
  const corpusScores = [];
  for (const m of corpus) corpusScores.push((await classify({ text: m.text })).score);
  const N = corpusScores.length;

  console.log('\nthresh  precision  recall    F1     labeledPass  corpusPass   ~Haiku$');
  let best = null;
  for (const t of [0.1, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.6, 0.75]) {
    let tp = 0, fp = 0, fn = 0;
    for (const x of scored) {
      const pred = x.s >= t;
      if (pred && x.y === 1) tp++;
      else if (pred && x.y === 0) fp++;
      else if (!pred && x.y === 1) fn++;
    }
    const prec = tp + fp ? tp / (tp + fp) : 0;
    const rec = tp + fn ? tp / (tp + fn) : 0;
    const f1 = prec + rec ? (2 * prec * rec) / (prec + rec) : 0;
    const corpusPass = corpusScores.filter((s) => s >= t).length;
    console.log(
      `${t.toFixed(2)}    ${prec.toFixed(3)}     ${rec.toFixed(3)}   ${f1.toFixed(3)}   ` +
        `${String(tp + fp).padStart(6)}      ${String(corpusPass).padStart(6)}   ` +
        `$${haikuCost(corpusPass).toFixed(2)}`
    );
    // Recall-first pick: highest threshold that still keeps recall >= 0.90.
    if (rec >= 0.9) best = { t, prec, rec, corpusPass };
  }

  if (best) {
    console.log(
      `\nRecommended gate: ${best.t.toFixed(2)} ` +
        `(recall ${best.rec.toFixed(2)}, precision ${best.prec.toFixed(2)}, ` +
        `${best.corpusPass}/${N} -> Haiku ~$${haikuCost(best.corpusPass).toFixed(2)})`
    );
  } else {
    console.log('\nNo threshold reaches recall 0.90 — heuristic needs tuning before Haiku.');
  }
  await mongoose.disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('mine-eval failed:', e.message);
    process.exit(1);
  });
