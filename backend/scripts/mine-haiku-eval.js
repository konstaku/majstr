/**
 * Evaluate Haiku against the three human-labeled fixtures and produce the
 * precision/recall numbers that decide M2 (issue #90).
 *
 * For each unit, Haiku is called with:
 *   - 'answer'       : inquiry text as context + the bundled reply
 *   - 'announcement' : the message text
 *   - 'random'       : the message text, with parent (if any) as context
 *
 * Haiku "predicts positive" iff kind != 'unknown'. We compare against the
 * human 1/0 label and report precision / recall / F1 per fixture and overall,
 * plus running cost. Hard budget guard lives in the adapter; this script just
 * surfaces the running tally.
 *
 * Usage (from backend/):
 *   node scripts/mine-haiku-eval.js              # full run (all 3 fixtures)
 *   node scripts/mine-haiku-eval.js --limit 10   # dry-run, 10 units per fixture
 *   node scripts/mine-haiku-eval.js --only veneto
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const haiku = require('../mining/classifier/adapters/haiku');

const arg = (n, d) => {
  const i = process.argv.indexOf(n);
  return i !== -1 ? process.argv[i + 1] : d;
};

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
    return { inquiry: u.inquiryText, text };
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
  let startCost = haiku.getCumulativeCost();
  let i = 0;
  for (const u of slice) {
    const y = unitLabel(u);
    let r = null;
    // Local retry on top of the SDK's own — a stubborn blip still gets a shot.
    for (let attempt = 0; attempt < 3 && !r; attempt++) {
      try {
        r = await haiku.classify(unitInput(u));
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
        `\r  ${i}/${slice.length}  ok=${rows.length} failed=${failed.length}  cost: $${(haiku.getCumulativeCost() - startCost).toFixed(3)}`
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
      `Δcost $${(haiku.getCumulativeCost() - startCost).toFixed(3)}`
  );
  return { name: fx.name, rows, failed, metrics: m };
}

async function main() {
  const limit = arg('--limit') ? parseInt(arg('--limit'), 10) : null;
  const only = arg('--only', null);
  const targets = only ? FIXTURES.filter((f) => f.name.toLowerCase() === only.toLowerCase()) : FIXTURES;
  if (!targets.length) throw new Error('no fixtures matched --only ' + only);

  haiku.resetCost();
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
    `\nTotal: $${haiku.getCumulativeCost().toFixed(3)} across ${haiku.getCumulativeCalls()} Haiku calls`
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('mine-haiku-eval failed:', e.message);
    process.exit(1);
  });
