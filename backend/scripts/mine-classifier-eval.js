/**
 * Evaluate a classifier against the three human-labeled fixtures and produce
 * the precision/recall numbers that decide whether it is good enough for
 * human-in-loop review (issue #90, extended for #114).
 *
 * The classifier is pluggable via the CLASSIFIER env var:
 *   CLASSIFIER=haiku   — Claude Haiku 4.5 (baseline ≈67%/69%)
 *   CLASSIFIER=ollama  — local Qwen2.5 14B via Ollama (≈67%/67%, free/offline)
 *
 * For each unit, the classifier is called with:
 *   - 'answer'       : inquiry text as context + the bundled reply
 *   - 'announcement' : the message text
 *   - 'random'       : the message text, with parent (if any) as context
 *
 * It "predicts positive" iff kind != 'unknown'. We compare against the human
 * 1/0 label and report precision / recall / F1 per fixture and overall. Cost is
 * reported only for adapters that track it (Haiku); local adapters run free.
 *
 * Usage (from backend/):
 *   node scripts/mine-classifier-eval.js                       # Haiku, all 3 fixtures
 *   CLASSIFIER=ollama node scripts/mine-classifier-eval.js     # local Mistral
 *   CLASSIFIER=ollama node scripts/mine-classifier-eval.js --limit 10 --only veneto
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getClassifier } = require('../mining/classifier');

const arg = (n, d) => {
  const i = process.argv.indexOf(n);
  return i !== -1 ? process.argv[i + 1] : d;
};

// Selected by CLASSIFIER env (default 'heuristic' — pass 'haiku' or 'ollama').
// Cost helpers are no-ops for free local adapters that omit cost tracking.
const classifier = getClassifier();
const costOf = () => (classifier.getCumulativeCost ? classifier.getCumulativeCost() : 0);
const callsOf = () => (classifier.getCumulativeCalls ? classifier.getCumulativeCalls() : 0);

const FIXTURES = [
  { name: 'Veneto', file: '../chat-history/italy/veneto/label-sample.json' },
  { name: 'Milano', file: '../chat-history/italy/lombardia/milano/label-sample.json' },
  { name: 'Recall', file: '../chat-history/recall/label-sample.json' },
];

function unitLabel(u) {
  if (u.type === 'answer' || u.type === 'random') return u.useful;
  return u.label;
}

function unitInput(u) {
  if (u.type === 'answer') {
    const text = (u.messages || []).map((m) => m.text).join('\n');
    return { inquiry: u.inquiryText, responderName: u.responderName || null, text };
  }
  if (u.type === 'announcement') return { text: u.text };
  if (u.type === 'random') {
    const inquiry = u.context && u.context.parent ? u.context.parent.text : null;
    return inquiry ? { inquiry, text: u.text } : { text: u.text };
  }
  throw new Error('unknown unit type: ' + u.type);
}

function metrics(rows) {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const r of rows) {
    if (r.pred && r.y === 1) tp++;
    else if (r.pred && r.y === 0) fp++;
    else if (!r.pred && r.y === 1) fn++;
    else tn++;
  }
  const prec = tp + fp ? tp / (tp + fp) : 0;
  const rec = tp + fn ? tp / (tp + fn) : 0;
  const f1 = prec + rec ? (2 * prec * rec) / (prec + rec) : 0;
  return { tp, fp, fn, tn, prec, rec, f1 };
}

async function evalFixture(fx, limit) {
  const labelsPath = path.resolve(fx.file);
  if (!fs.existsSync(labelsPath)) {
    console.log(`[${fx.name}] missing ${labelsPath} — skipping`);
    return null;
  }
  const data = JSON.parse(fs.readFileSync(labelsPath, 'utf8'));
  const units = (data.units || []).filter(
    (u) => unitLabel(u) === 0 || unitLabel(u) === 1
  );
  const slice = limit ? units.slice(0, limit) : units;

  console.log(
    `\n[${fx.name}] running ${slice.length}/${units.length} labeled units` +
      (limit ? ` (--limit ${limit})` : '')
  );

  const rows = [];
  const failed = [];
  let startCost = costOf();
  let i = 0;
  for (const u of slice) {
    const y = unitLabel(u);
    let r = null;
    // Local retry on top of any the adapter does — a stubborn blip still gets a shot.
    for (let attempt = 0; attempt < 3 && !r; attempt++) {
      try {
        r = await classifier.classify(unitInput(u));
      } catch (e) {
        if (attempt === 2) {
          failed.push({ uid: u.uid, error: e.message });
          break;
        }
        await new Promise((res) => setTimeout(res, 500 * (attempt + 1)));
      }
    }
    if (r) {
      rows.push({
        uid: u.uid,
        type: u.type,
        y,
        pred: r.kind !== 'unknown',
        kind: r.kind,
        score: r.score,
      });
    }
    i++;
    if (i % 25 === 0) {
      process.stdout.write(
        `\r  ${i}/${slice.length}  ok=${rows.length} failed=${failed.length}  cost: $${(costOf() - startCost).toFixed(3)}`
      );
    }
    // Light rate hygiene — keeps the connection pool calm without slowing us much.
    await new Promise((res) => setTimeout(res, 50));
  }
  process.stdout.write('\n');

  if (failed.length) {
    console.log(`[${fx.name}] ⚠ ${failed.length} calls failed after retries — excluded from metrics`);
  }
  const m = metrics(rows);
  console.log(
    `[${fx.name}] precision ${(m.prec * 100).toFixed(1)}%  ` +
      `recall ${(m.rec * 100).toFixed(1)}%  F1 ${m.f1.toFixed(2)}  ` +
      `(tp=${m.tp} fp=${m.fp} fn=${m.fn} tn=${m.tn} of ${rows.length} scored)  ` +
      `Δcost $${(costOf() - startCost).toFixed(3)}`
  );
  return { name: fx.name, rows, failed, metrics: m };
}

async function main() {
  const limit = arg('--limit') ? parseInt(arg('--limit'), 10) : null;
  const only = arg('--only', null);
  const targets = only ? FIXTURES.filter((f) => f.name.toLowerCase() === only.toLowerCase()) : FIXTURES;
  if (!targets.length) throw new Error('no fixtures matched --only ' + only);

  console.log(`classifier: ${classifier.name} v${classifier.version}`);
  if (classifier.resetCost) classifier.resetCost();
  const results = [];
  for (const fx of targets) {
    const r = await evalFixture(fx, limit);
    if (r) results.push(r);
  }

  if (results.length > 1) {
    const all = results.flatMap((r) => r.rows);
    const m = metrics(all);
    console.log(
      `\n=== COMBINED (${all.length} units) ===\n` +
        `precision ${(m.prec * 100).toFixed(1)}%  recall ${(m.rec * 100).toFixed(1)}%  ` +
        `F1 ${m.f1.toFixed(2)}  (tp=${m.tp} fp=${m.fp} fn=${m.fn} tn=${m.tn})`
    );
  }
  console.log(
    classifier.getCumulativeCost
      ? `\nTotal: $${costOf().toFixed(3)} across ${callsOf()} ${classifier.name} calls`
      : `\n${classifier.name} ran free (local — no API cost)`
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('mine-classifier-eval failed:', e.message);
    process.exit(1);
  });
