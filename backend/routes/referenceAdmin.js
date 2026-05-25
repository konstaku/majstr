'use strict';

// Admin-only reference-data create + lexicon rebuild — used by:
//   - the API (Express endpoints below, wired in index.js)
//   - the CLI review tool (scripts/mine-review.js)
//
// The business logic lives in the `*Doc` / `runLexiconRebuild` functions so
// both callers share validation, slugging, dedup and the in-flight mutex.
// The Express handlers are thin wrappers that map thrown errors → HTTP codes.
//
// Errors thrown by the core functions carry a `code` for the wrappers:
//   'validation'    -> HTTP 400
//   'duplicate'     -> HTTP 409 (with `existing` attached)
//   'in_progress'   -> HTTP 409 (rebuild only)
//   'build_failed'  -> HTTP 500 (rebuild only)

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const Profession = require('../database/schema/Profession');
const ProfCategory = require('../database/schema/ProfCategory');
const Location = require('../database/schema/Location');
const Country = require('../database/schema/Country');

const SUPPORTED_LANGS = ['ua', 'en', 'ru', 'it', 'pt', 'de', 'fr', 'tr', 'es'];

function refError(message, code, extra = {}) {
  return Object.assign(new Error(message), { code, ...extra });
}

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

// ---------------------------------------------------------------------------
// Core functions — plain async, throw on error, return the created Mongoose doc.

async function createProfCategoryDoc({ id: rawId, name: rawName } = {}) {
  const s = sanitizeName(rawName);
  if (s.error) throw refError(s.error, 'validation');
  const id = (rawId && slugify(rawId)) || slugify(s.name.en);
  if (!id) throw refError('could not derive id from name.en', 'validation');
  const dup = await findDuplicate(ProfCategory, s.name, id);
  if (dup) throw refError('duplicate', 'duplicate', { existing: dup });
  return ProfCategory.create({ id, name: s.name });
}

async function createProfessionDoc({ id: rawId, categoryID, name: rawName } = {}) {
  if (!categoryID || typeof categoryID !== 'string') {
    throw refError('categoryID required', 'validation');
  }
  const cat = await ProfCategory.findOne({ id: categoryID }).lean();
  if (!cat) throw refError('unknown categoryID', 'validation');
  const s = sanitizeName(rawName);
  if (s.error) throw refError(s.error, 'validation');
  if (!s.name.ua && !s.name.ru) {
    throw refError(
      'at least one of name.ua / name.ru is required (lexicon needs it)',
      'validation'
    );
  }
  const id = (rawId && slugify(rawId)) || slugify(s.name.en);
  if (!id) throw refError('could not derive id from name.en', 'validation');
  const dup = await findDuplicate(Profession, s.name, id);
  if (dup) throw refError('duplicate', 'duplicate', { existing: dup });
  return Profession.create({ id, categoryID, name: s.name });
}

async function createLocationDoc({ id: rawId, countryID, name: rawName } = {}) {
  if (!countryID || typeof countryID !== 'string') {
    throw refError('countryID required', 'validation');
  }
  const country = await Country.findOne({ id: countryID }).lean();
  if (!country) throw refError('unknown countryID', 'validation');
  const s = sanitizeName(rawName, { extraLangs: ['ua_alt', 'ru_alt'] });
  if (s.error) throw refError(s.error, 'validation');
  const id = (rawId && slugify(rawId)) || slugify(s.name.en);
  if (!id) throw refError('could not derive id from name.en', 'validation');
  const dup = await findDuplicate(Location, s.name, id);
  if (dup) throw refError('duplicate', 'duplicate', { existing: dup });
  return Location.create({ id, countryID, name: s.name });
}

// ---------------------------------------------------------------------------
// Lexicon rebuild — single-flight, env-scrubbed spawn of mine-build-lexicon.js.
// Shared mutex across every caller (API and CLI). Returns counts on success.

const LEXICON_PATH = path.join(__dirname, '..', 'mining', 'data', 'profession-lexicon.json');
const BUILD_SCRIPT = path.join(__dirname, '..', 'scripts', 'mine-build-lexicon.js');
const BUILD_CWD = path.join(__dirname, '..');
const BUILD_TIMEOUT_MS = 60_000;

let rebuildInFlight = null;

async function runLexiconRebuild() {
  if (rebuildInFlight) {
    throw refError('rebuild_in_progress', 'in_progress', {
      startedAt: rebuildInFlight.startedAt,
    });
  }
  const startedAt = new Date();
  rebuildInFlight = { startedAt };
  const t0 = Date.now();
  const env = { ...process.env };
  delete env.MONGO_DB_NAME; // build script needs the default reference DB

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
        reject(
          refError(
            `build-lexicon exited ${code}: ${(stderr || stdout).trim().slice(0, 400)}`,
            'build_failed'
          )
        );
      });
    });

    const lex = JSON.parse(fs.readFileSync(LEXICON_PATH, 'utf8'));
    return {
      professions: lex.professionCount,
      terms: lex.termCount,
      generatedAt: lex.generatedAt,
      ms: Date.now() - t0,
    };
  } finally {
    rebuildInFlight = null;
  }
}

// ---------------------------------------------------------------------------
// Express handlers — thin wrappers that map thrown errors to HTTP codes.

function actor(req) {
  return (req.user && req.user._id) || '<unknown>';
}

function handleRefError(res, err) {
  if (err.code === 'validation') return res.status(400).json({ error: err.message });
  if (err.code === 'duplicate')
    return res.status(409).json({ error: 'duplicate', existing: err.existing });
  if (err.code === 'in_progress')
    return res.status(409).json({ error: 'rebuild_in_progress', startedAt: err.startedAt });
  if (err.code === 'build_failed') return res.status(500).json({ ok: false, error: err.message });
  return res.status(500).json({ error: err.message });
}

async function createProfCategory(req, res) {
  try {
    const created = await createProfCategoryDoc(req.body || {});
    console.log(`[refAdmin] ProfCategory created: ${created.id} by user ${actor(req)}`);
    res.status(201).json(created);
  } catch (err) {
    handleRefError(res, err);
  }
}

async function createProfession(req, res) {
  try {
    const created = await createProfessionDoc(req.body || {});
    console.log(
      `[refAdmin] Profession created: ${created.id} (cat=${created.categoryID}) by user ${actor(req)}. ` +
        'Run `node scripts/mine-build-lexicon.js` (or POST /api/admin/lexicon/rebuild) to refresh the mining heuristic.'
    );
    res.status(201).json(created);
  } catch (err) {
    handleRefError(res, err);
  }
}

async function createLocation(req, res) {
  try {
    const created = await createLocationDoc(req.body || {});
    console.log(
      `[refAdmin] Location created: ${created.id} (country=${created.countryID}) by user ${actor(req)}`
    );
    res.status(201).json(created);
  } catch (err) {
    handleRefError(res, err);
  }
}

async function rebuildLexicon(req, res) {
  const t0 = Date.now();
  try {
    const r = await runLexiconRebuild();
    console.log(
      `[refAdmin] lexicon rebuilt by user ${actor(req)}: ` +
        `${r.professions} professions, ${r.terms} terms in ${r.ms}ms`
    );
    res.json({ ok: true, ...r });
  } catch (err) {
    if (err.code === 'in_progress') return handleRefError(res, err);
    console.error('[refAdmin] lexicon rebuild failed:', err.message);
    res.status(500).json({ ok: false, error: err.message, ms: Date.now() - t0 });
  }
}

module.exports = {
  // Express handlers (mounted in index.js)
  createProfession,
  createProfCategory,
  createLocation,
  rebuildLexicon,
  // Reusable core functions (used by scripts/mine-review.js)
  createProfessionDoc,
  createProfCategoryDoc,
  createLocationDoc,
  runLexiconRebuild,
  // Exported for tests / introspection
  _slugify: slugify,
  _sanitizeName: sanitizeName,
};
