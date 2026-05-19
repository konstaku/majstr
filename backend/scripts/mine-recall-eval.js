/**
 * Recall-check evaluator. Reads a label-sample.json built by mine-recall-sample
 * and reports how many useful messages the current pipeline is missing.
 *
 * Per chat:
 *   sample N from missed pool  ->  k labeled useful, n-k not
 *   point estimate of useful in missed pool = (k/N) * |missed|
 *   95% Clopper-Pearson upper bound on the missed-positive rate (binomial)
 *
 * Usage (from backend/):
 *   node scripts/mine-recall-eval.js [--labels ../chat-history/recall/label-sample.json]
 */
const fs = require('fs');
const path = require('path');

const arg = (n, d) => {
  const i = process.argv.indexOf(n);
  return i !== -1 ? process.argv[i + 1] : d;
};

// Clopper-Pearson 95% upper bound for binomial proportion (no deps).
// Beta-quantile via a small bisection on the incomplete-beta CDF.
function logGamma(z) {
  // Stirling-ish: lanczos approximation
  const g = 7;
  const p = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let x = p[0];
  for (let i = 1; i < g + 2; i++) x += p[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}
function logBeta(a, b) {
  return logGamma(a) + logGamma(b) - logGamma(a + b);
}
function incBeta(x, a, b) {
  // Continued fraction (Lentz). Adequate for our small inputs.
  const bt =
    x === 0 || x === 1
      ? 0
      : Math.exp(
          a * Math.log(x) + b * Math.log(1 - x) - logBeta(a, b)
        );
  if (x < (a + 1) / (a + b + 2)) {
    let c = 1, d = 1 - ((a + b) * x) / (a + 1);
    if (Math.abs(d) < 1e-30) d = 1e-30;
    d = 1 / d;
    let h = d;
    for (let m = 1; m < 200; m++) {
      const m2 = 2 * m;
      let aa = (m * (b - m) * x) / ((a - 1 + m2) * (a + m2));
      d = 1 + aa * d;
      if (Math.abs(d) < 1e-30) d = 1e-30;
      c = 1 + aa / c;
      if (Math.abs(c) < 1e-30) c = 1e-30;
      d = 1 / d;
      h *= d * c;
      aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + 1 + m2));
      d = 1 + aa * d;
      if (Math.abs(d) < 1e-30) d = 1e-30;
      c = 1 + aa / c;
      if (Math.abs(c) < 1e-30) c = 1e-30;
      d = 1 / d;
      h *= d * c;
    }
    return (bt * h) / a;
  }
  return 1 - incBeta(1 - x, b, a);
}
function cpUpper(k, n, alpha = 0.05) {
  if (k === n) return 1;
  let lo = 0, hi = 1;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (incBeta(mid, k + 1, n - k) < 1 - alpha) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function main() {
  const labelsPath = path.resolve(
    arg('--labels', '../chat-history/recall/label-sample.json')
  );
  const data = JSON.parse(fs.readFileSync(labelsPath, 'utf8'));
  const byChat = {};
  for (const u of data.units) {
    if (!byChat[u.chatLabel]) byChat[u.chatLabel] = { labels: [], chatID: u.chatID };
    if (u.useful === 0 || u.useful === 1) byChat[u.chatLabel].labels.push(u.useful);
  }

  const rows = [];
  for (const [chat, info] of Object.entries(byChat)) {
    const s = data.meta.stats[chat] || {};
    const N = info.labels.length;
    const k = info.labels.filter((x) => x === 1).length;
    const pHat = N ? k / N : 0;
    const upper = N ? cpUpper(k, N) : 1;
    const estMissedUseful = Math.round(pHat * (s.missed || 0));
    const upperMissedUseful = Math.round(upper * (s.missed || 0));
    rows.push({
      chat,
      missedPool: s.missed,
      sampled: N,
      useful: k,
      pointRate: (pHat * 100).toFixed(1) + '%',
      upper95: (upper * 100).toFixed(1) + '%',
      estMissedUsefulCorpus: `${estMissedUseful} (≤ ${upperMissedUseful})`,
    });
  }
  console.table(rows);
  console.log(
    '\nInterpretation: "pointRate" is the labeled fraction of missed messages that look useful. ' +
      '"upper95" is the 95% upper bound on that rate given how few we labeled. ' +
      'estMissedUsefulCorpus scales it to the whole missed pool.'
  );
}
main();
