/**
 * Generate the profession lexicon used by the heuristic pre-filter from the
 * canonical Profession collection (default DB). Committed as a static artifact
 * so the heuristic stays pure/fast/offline — re-run when professions change.
 *
 * Usage (from backend/):
 *   node scripts/mine-build-lexicon.js
 * Writes: backend/mining/data/profession-lexicon.json
 *
 * Env: MONGO_* as database/db.js. Reads the DEFAULT db (prod reference data) —
 * do NOT set MONGO_DB_NAME=majstr_mining here (that DB has no reference data).
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { runDB } = require('../database/db');
const Profession = require('../database/schema/Profession');

const STOP = new Set([
  'майстер', 'мастер', 'послуги', 'услуги', 'спеціаліст', 'специалист',
  'di', 'da', 'per', 'the', 'of', 'and', 'специалист',
]);

// Lowercase; Latin diacritics folded; Cyrillic kept as-is.
function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  await runDB();
  const profs = await Profession.find().lean();
  if (!profs.length) throw new Error('No professions found in default DB');

  const terms = []; // { term, stem, profId, lang }
  for (const p of profs) {
    const langs = p.name || {};
    for (const lang of ['ua', 'ru', 'it', 'en']) {
      const raw = norm(langs[lang]);
      if (!raw) continue;
      const phrase = raw;
      // Index the full phrase plus each distinctive (non-stopword, len>=4) token.
      const tokens = phrase.split(' ').filter((t) => t.length >= 4 && !STOP.has(t));
      const candidates = new Set([phrase, ...tokens]);
      for (const t of candidates) {
        // Stem: drop up to the last 2 chars for inflected forms (len>=6).
        const stem = t.length >= 6 ? t.slice(0, -2) : t;
        terms.push({ term: t, stem, profId: p.id, lang });
      }
    }
  }

  const out = {
    generatedAt: new Date().toISOString(),
    professionCount: profs.length,
    termCount: terms.length,
    terms,
  };
  const dir = path.join(__dirname, '..', 'mining', 'data');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'profession-lexicon.json');
  fs.writeFileSync(file, JSON.stringify(out, null, 0));
  console.log(
    `Wrote ${file}: ${profs.length} professions -> ${terms.length} terms`
  );
  await mongoose.disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('build-lexicon failed:', e.message);
    process.exit(1);
  });
