'use strict';

// Admin-only create endpoints for reference data (issue #116). Lets the M3
// review dashboard add a Profession / ProfCategory / Location on the fly when
// the candidate doesn't match an existing entry. Read endpoints stay on
// index.js — this file is the write side.
//
// All endpoints require an authenticated admin (requireUser + requireAdmin).
//
// After a Profession (or Category) is created, the mining heuristic only
// recognises it once `node scripts/mine-build-lexicon.js` regenerates
// backend/mining/data/profession-lexicon.json. We log a reminder rather than
// auto-spawning the rebuild — environments differ and a silent failure here
// would surprise an admin. The hand-maintained
// backend/mining/data/profession-aliases.json is the place to add detection
// signals (UA/RU/IT colloquial forms) for newly-created professions.

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const Profession = require('../database/schema/Profession');
const ProfCategory = require('../database/schema/ProfCategory');
const Location = require('../database/schema/Location');
const Country = require('../database/schema/Country');

const SUPPORTED_LANGS = ['ua', 'en', 'ru', 'it', 'pt', 'de', 'fr', 'tr', 'es'];

// Slug like "auto_electrician" — matches the existing id convention in the
// Profession / ProfCategory / Location collections.
function slugify(text, maxLen = 40) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip Latin diacritics
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, maxLen);
}

// Lift, validate and normalize a `name` payload. Returns either a sanitized
// object (only known lang keys, trimmed, non-empty) or an error string.
function sanitizeName(rawName, { extraLangs = [] } = {}) {
  if (!rawName || typeof rawName !== 'object') {
    return { error: 'name object required' };
  }
  const allowed = new Set([...SUPPORTED_LANGS, ...extraLangs]);
  const out = {};
  for (const [k, v] of Object.entries(rawName)) {
    if (!allowed.has(k)) continue;
    if (typeof v !== 'string') continue;
    const trimmed = v.trim();
    if (trimmed) out[k] = trimmed;
  }
  if (!out.en) return { error: 'name.en is required' };
  return { name: out };
}

// Case-insensitive duplicate check against every language we were given.
async function findDuplicate(Model, name, id) {
  const ors = [];
  if (id) ors.push({ id });
  for (const lang of Object.keys(name)) {
    const escaped = name[lang].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    ors.push({ [`name.${lang}`]: new RegExp('^' + escaped + '$', 'i') });
  }
  if (!ors.length) return null;
  return Model.findOne({ $or: ors }).lean();
}

async function createProfCategory(req, res) {
  const { id: rawId, name: rawName } = req.body || {};
  const s = sanitizeName(rawName);
  if (s.error) return res.status(400).json({ error: s.error });

  const id = (rawId && slugify(rawId)) || slugify(s.name.en);
  if (!id) return res.status(400).json({ error: 'could not derive id from name.en' });

  const dup = await findDuplicate(ProfCategory, s.name, id);
  if (dup) return res.status(409).json({ error: 'duplicate', existing: dup });

  const created = await ProfCategory.create({ id, name: s.name });
  console.log(`[refAdmin] ProfCategory created: ${id} by user ${req.user._id}`);
  res.status(201).json(created);
}

async function createProfession(req, res) {
  const { id: rawId, categoryID, name: rawName } = req.body || {};
  if (!categoryID || typeof categoryID !== 'string') {
    return res.status(400).json({ error: 'categoryID required' });
  }
  const cat = await ProfCategory.findOne({ id: categoryID }).lean();
  if (!cat) return res.status(400).json({ error: 'unknown categoryID' });

  const s = sanitizeName(rawName);
  if (s.error) return res.status(400).json({ error: s.error });
  if (!s.name.ua && !s.name.ru) {
    return res.status(400).json({
      error: 'at least one of name.ua / name.ru is required (lexicon needs it)',
    });
  }

  const id = (rawId && slugify(rawId)) || slugify(s.name.en);
  if (!id) return res.status(400).json({ error: 'could not derive id from name.en' });

  const dup = await findDuplicate(Profession, s.name, id);
  if (dup) return res.status(409).json({ error: 'duplicate', existing: dup });

  const created = await Profession.create({ id, categoryID, name: s.name });
  console.log(
    `[refAdmin] Profession created: ${id} (cat=${categoryID}) by user ${req.user._id}. ` +
      'Run `node scripts/mine-build-lexicon.js` to refresh the mining heuristic.'
  );
  res.status(201).json(created);
}

async function createLocation(req, res) {
  const { id: rawId, countryID, name: rawName } = req.body || {};
  if (!countryID || typeof countryID !== 'string') {
    return res.status(400).json({ error: 'countryID required' });
  }
  const country = await Country.findOne({ id: countryID }).lean();
  if (!country) return res.status(400).json({ error: 'unknown countryID' });

  // Location supports ua_alt / ru_alt for alternate spellings.
  const s = sanitizeName(rawName, { extraLangs: ['ua_alt', 'ru_alt'] });
  if (s.error) return res.status(400).json({ error: s.error });

  const id = (rawId && slugify(rawId)) || slugify(s.name.en);
  if (!id) return res.status(400).json({ error: 'could not derive id from name.en' });

  const dup = await findDuplicate(Location, s.name, id);
  if (dup) return res.status(409).json({ error: 'duplicate', existing: dup });

  const created = await Location.create({ id, countryID, name: s.name });
  console.log(`[refAdmin] Location created: ${id} (country=${countryID}) by user ${req.user._id}`);
  res.status(201).json(created);
}

// ---------------------------------------------------------------------------
// Lexicon rebuild — explicit endpoint the M3 dashboard calls after a batch of
// profession creates. Spawns mine-build-lexicon.js, waits for it, returns the
// resulting counts. Single-flight: a second concurrent request returns 409.
//
// Why explicit (chosen over auto-spawn on every create):
//   - Lets the admin batch N creates and rebuild once.
//   - Makes success/failure visible in the dashboard, not just server logs.
//   - Avoids surprise rebuilds during dev sessions.

const LEXICON_PATH = path.join(__dirname, '..', 'mining', 'data', 'profession-lexicon.json');
const BUILD_SCRIPT = path.join(__dirname, '..', 'scripts', 'mine-build-lexicon.js');
const BUILD_CWD = path.join(__dirname, '..');
const BUILD_TIMEOUT_MS = 60_000;

let rebuildInFlight = null;

async function rebuildLexicon(req, res) {
  if (rebuildInFlight) {
    return res.status(409).json({
      error: 'rebuild_in_progress',
      startedAt: rebuildInFlight.startedAt,
    });
  }
  const startedAt = new Date();
  rebuildInFlight = { startedAt };
  const t0 = Date.now();

  // mine-build-lexicon.js needs the default DB (reference collections live
  // there, not in majstr_mining). Scrub the override so a dev API process
  // running against the mining DB doesn't blast the lexicon with an empty one.
  const env = { ...process.env };
  delete env.MONGO_DB_NAME;

  try {
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [BUILD_SCRIPT], {
        cwd: BUILD_CWD,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: BUILD_TIMEOUT_MS,
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (d) => (stdout += d.toString()));
      child.stderr.on('data', (d) => (stderr += d.toString()));
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) return resolve({ stdout, stderr });
        reject(new Error(`build-lexicon exited ${code}: ${(stderr || stdout).trim().slice(0, 400)}`));
      });
    });

    // Read the freshly-written artifact for counts the dashboard can show.
    const lex = JSON.parse(fs.readFileSync(LEXICON_PATH, 'utf8'));
    const ms = Date.now() - t0;
    console.log(
      `[refAdmin] lexicon rebuilt by user ${req.user._id}: ` +
        `${lex.professionCount} professions, ${lex.termCount} terms in ${ms}ms`
    );
    res.json({
      ok: true,
      professions: lex.professionCount,
      terms: lex.termCount,
      generatedAt: lex.generatedAt,
      ms,
    });
  } catch (err) {
    const ms = Date.now() - t0;
    console.error('[refAdmin] lexicon rebuild failed:', err.message);
    res.status(500).json({ ok: false, error: err.message, ms });
  } finally {
    rebuildInFlight = null;
  }
}

module.exports = {
  createProfession,
  createProfCategory,
  createLocation,
  rebuildLexicon,
  // Exported for tests / introspection.
  _slugify: slugify,
  _sanitizeName: sanitizeName,
};
