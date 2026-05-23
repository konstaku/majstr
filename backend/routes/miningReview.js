'use strict';

// Mining-review HTTP endpoints (M3 #93 + #94) — the API the admin dashboard
// (#95) will call. Mirrors the existing CLI tool `scripts/mine-review.js` and
// reuses the SAME publish-to-Master flow: Accept creates a live Master in the
// production DB (`source:'scraped'`, `status:'approved'`, `claimable:true`)
// with a MasterAudit entry, marks the Candidate `carded`, and writes a
// MiningFeedback record. Decline marks the Candidate and writes a
// MiningFeedback record with the decline reason.
//
// Candidates live in the isolated mining DB (`majstr_mining`); Masters and
// reference data live in the production / default DB. See `database/miningDb`.

const CandidateModel = require('../database/schema/Candidate');
const miningDb = require('../database/miningDb');
const Master = require('../database/schema/Master');
const MasterAudit = require('../database/schema/MasterAudit');
const Profession = require('../database/schema/Profession');
const Location = require('../database/schema/Location');

const DECLINE_REASONS = CandidateModel.DECLINE_REASONS; // shared enum
const STATUSES = CandidateModel.STATUS;
const KINDS = CandidateModel.KINDS;

// ---------------------------------------------------------------------------
// Reference-data cache — `suggestProfessionID` / `suggestLocationID` need to
// match Candidate.extracted strings against the Profession / Location tables.
// Refetched every 60s, which is more than fresh enough given the dashboard
// edit cadence and the fact that suggestions are advisory (the admin picks).

const REF_TTL_MS = 60_000;
let _refCache = null;

async function getRefs() {
  if (_refCache && Date.now() - _refCache.t < REF_TTL_MS) return _refCache.data;
  const [professions, locations] = await Promise.all([
    Profession.find().lean(),
    Location.find().lean(),
  ]);
  _refCache = { t: Date.now(), data: { professions, locations } };
  return _refCache.data;
}

function invalidateRefCache() {
  _refCache = null;
}

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

// Best-effort fuzzy match of extracted free text to a reference id. Returns ''
// when nothing matches; the dashboard surfaces this as "no suggestion".
function matchRef(text, refs, langs) {
  const t = norm(text);
  if (!t) return '';
  for (const r of refs) {
    for (const lang of langs) {
      const v = norm(r.name && r.name[lang]);
      if (v && (t.includes(v) || v.includes(t))) return r.id;
    }
  }
  return '';
}

// ---------------------------------------------------------------------------
// Candidate serializer — shape mirrors what mine-review.js already returns to
// its HTML UI, so the new React/whatever dashboard can adopt the same fields.

function serializeCandidate(c, refs) {
  return {
    id: String(c._id),
    chatID: c.chatID,
    kind: c.kind,
    score: c.score,
    status: c.status,
    declineReason: c.declineReason || null,
    sourceType: c.sourceType,
    anchorMessageID: c.anchorMessageID,
    messageIDs: c.messageIDs || [],
    inquiryMessageID: c.inquiryMessageID,
    inquiryText: c.inquiryText,
    responderName: c.responderName,
    text: c.text,
    tgLink: `https://t.me/c/${c.chatID}/${c.anchorMessageID}`,
    extracted: c.extracted || {},
    classifierName: c.classifierName,
    classifierVersion: c.classifierVersion,
    masterRef: c.masterRef ? String(c.masterRef) : null,
    suggestProfessionID: matchRef(
      c.extracted && c.extracted.profession,
      refs.professions,
      ['ua', 'ru', 'it', 'en']
    ),
    suggestLocationID: matchRef(c.extracted && c.extracted.city, refs.locations, [
      'en', 'it', 'ua', 'ua_alt', 'ru', 'ru_alt',
    ]),
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// GET /api/mining/candidates  — #93
// Query: status (default 'new'), kind, page (default 1), pageSize (default 20),
//        sort ('score' default | 'created').

async function listCandidates(req, res) {
  const status = req.query.status || 'new';
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: 'bad_status', allowed: STATUSES });
  }
  const kindFilter = req.query.kind;
  if (kindFilter && !KINDS.includes(kindFilter)) {
    return res.status(400).json({ error: 'bad_kind', allowed: KINDS });
  }
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
  const sortKey = req.query.sort === 'created' ? { createdAt: -1 } : { score: -1, createdAt: -1 };

  const query = { status };
  if (kindFilter) query.kind = kindFilter;

  const Candidate = miningDb.Candidate();
  const [items, total, queueDepth, refs] = await Promise.all([
    Candidate.find(query).sort(sortKey).skip((page - 1) * pageSize).limit(pageSize).lean(),
    Candidate.countDocuments(query),
    Candidate.countDocuments({ status: 'new' }),
    getRefs(),
  ]);

  res.json({
    page,
    pageSize,
    total,
    queueDepth, // always reflects the `new` queue, regardless of filters
    candidates: items.map((c) => serializeCandidate(c, refs)),
  });
}

// ---------------------------------------------------------------------------
// POST /api/mining/candidates/:id/accept  — #94
// Body: { master: { name, professionID, locationID, contacts:[{contactType,value}],
//                   about?, countryID? (default 'IT') } }
// Publishes a live Master, marks the Candidate carded, writes MiningFeedback.

function validateMasterPayload(m) {
  if (!m || typeof m !== 'object') return 'master object required';
  if (!m.name || !String(m.name).trim()) return 'master.name required';
  if (!m.professionID) return 'master.professionID required';
  if (!m.locationID) return 'master.locationID required';
  if (!Array.isArray(m.contacts) || m.contacts.length === 0) {
    return 'master.contacts must contain at least one entry';
  }
  for (const c of m.contacts) {
    if (!c || !c.contactType || !c.value || !String(c.value).trim()) {
      return 'each contact needs contactType and non-empty value';
    }
  }
  return null;
}

async function acceptCandidate(req, res) {
  const { id } = req.params;
  const { master } = req.body || {};
  const err = validateMasterPayload(master);
  if (err) return res.status(400).json({ error: err });

  const Candidate = miningDb.Candidate();
  const cand = await Candidate.findById(id);
  if (!cand) return res.status(404).json({ error: 'candidate_not_found' });
  if (cand.status === 'carded') {
    return res.status(409).json({ error: 'already_carded', masterRef: cand.masterRef });
  }

  const now = new Date();
  const created = await Master.create({
    name: String(master.name).trim(),
    professionID: master.professionID,
    locationID: master.locationID,
    countryID: master.countryID || 'IT',
    contacts: master.contacts.map((c) => ({
      contactType: c.contactType,
      value: String(c.value).trim(),
    })),
    about: (master.about || '').toString(),
    source: 'scraped',
    status: 'approved', // the review IS the quality gate
    claimable: true,
    submittedAt: now,
    approvedAt: now,
    sourceMetadata: {
      chatID: cand.chatID,
      anchorMessageID: cand.anchorMessageID,
      candidateRef: String(cand._id),
      classifierName: cand.classifierName,
      classifierVersion: cand.classifierVersion,
      scrapedAt: now,
    },
  });

  await MasterAudit.create({
    masterID: created._id,
    actorTelegramID: req.user && req.user.telegramID ? Number(req.user.telegramID) : undefined,
    action: 'approve',
    from: null,
    to: 'approved',
    reason: 'mining-review',
  });

  cand.status = 'carded';
  cand.masterRef = created._id;
  await cand.save();

  const MiningFeedback = miningDb.MiningFeedback();
  // Diff what the admin saved vs what the classifier extracted — the labeled
  // pairs that feed the M3 feedback loop / prompt tuning (#96).
  const extracted = cand.extracted || {};
  const correctedFields = {};
  if (extracted.name !== master.name) correctedFields.name = { from: extracted.name, to: master.name };
  if (extracted.profession !== master.professionID) {
    correctedFields.profession = { from: extracted.profession, to: master.professionID };
  }
  if (extracted.city !== master.locationID) {
    correctedFields.city = { from: extracted.city, to: master.locationID };
  }
  await MiningFeedback.create({
    candidateRef: cand._id,
    action: 'card',
    correctedFields: Object.keys(correctedFields).length ? correctedFields : undefined,
    classifierName: cand.classifierName,
    classifierVersion: cand.classifierVersion,
    adminTelegramID: req.user && req.user.telegramID ? Number(req.user.telegramID) : undefined,
  });

  res.json({ ok: true, masterID: String(created._id), candidateID: String(cand._id) });
}

// ---------------------------------------------------------------------------
// POST /api/mining/candidates/:id/decline  — #94
// Body: { reasonCode: <one of DECLINE_REASONS>, note?: string }

async function declineCandidate(req, res) {
  const { id } = req.params;
  const { reasonCode, note } = req.body || {};
  if (!reasonCode || !DECLINE_REASONS.includes(reasonCode)) {
    return res.status(400).json({ error: 'bad_reasonCode', allowed: DECLINE_REASONS });
  }

  const Candidate = miningDb.Candidate();
  const cand = await Candidate.findById(id);
  if (!cand) return res.status(404).json({ error: 'candidate_not_found' });
  if (cand.status === 'carded') {
    return res.status(409).json({ error: 'already_carded' });
  }

  cand.status = 'declined';
  cand.declineReason = reasonCode;
  await cand.save();

  const MiningFeedback = miningDb.MiningFeedback();
  await MiningFeedback.create({
    candidateRef: cand._id,
    action: 'decline',
    reasonCode,
    correctedFields: note ? { note } : undefined,
    classifierName: cand.classifierName,
    classifierVersion: cand.classifierVersion,
    adminTelegramID: req.user && req.user.telegramID ? Number(req.user.telegramID) : undefined,
  });

  res.json({ ok: true, candidateID: String(cand._id), status: 'declined', reasonCode });
}

module.exports = {
  listCandidates,
  acceptCandidate,
  declineCandidate,
  invalidateRefCache,
  // Exported for tests / introspection.
  _matchRef: matchRef,
  _validateMasterPayload: validateMasterPayload,
};
