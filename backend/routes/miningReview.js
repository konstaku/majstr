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
const createOGimageForMaster = require('../helpers/generateOpenGraph');
const Profession = require('../database/schema/Profession');
const Location = require('../database/schema/Location');
const {
  fetchAndUploadPhotoForMaster,
} = require('../helpers/telegramPhotoByHandle');
const {
  findDuplicateMasters,
  summarizeDuplicate,
} = require('../helpers/masterDuplicates');
const dedup = require('../mining/dedup');

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
  // Synthetic forward chat ids ("forward:123") can't form a real t.me link; only
  // numeric chat ids (auto-mined, or forwards from a known channel) get one.
  const numericChat = /^\d+$/.test(String(c.chatID));
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
    tgLink: numericChat ? `https://t.me/c/${c.chatID}/${c.anchorMessageID}` : null,
    // Forwarded-lead provenance (null/absent on auto-mined candidates).
    submittedBy: c.submittedBy || null,
    originChatTitle: c.originChatTitle || null,
    reviewPriority: typeof c.reviewPriority === 'number' ? c.reviewPriority : 0,
    images: (c.images || []).map((im) => ({
      url: im.url,
      ocrText: im.ocrText || null,
    })),
    processedAt: c.processedAt || null,
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
  // reviewPriority leads every ordering so deprioritized forwards (non-admin
  // submissions, priority < 0) sink below trusted/auto-mined candidates.
  // $ifNull defaults legacy docs (no field) to 0 so they sort in the normal
  // tier rather than below the deprioritized ones.
  const secondary =
    req.query.sort === 'created'
      ? { createdAt: -1 }
      : { score: -1, createdAt: -1 };
  const sortKey = { _prio: -1, ...secondary };

  const query = { status };
  if (kindFilter) query.kind = kindFilter;
  // Source filters for the review tool's dropdown: 'forwarded' (bot-sent) vs a
  // specific mined chat by chatID.
  if (req.query.sourceType) query.sourceType = req.query.sourceType;
  if (req.query.chatID) query.chatID = req.query.chatID;

  const Candidate = miningDb.Candidate();
  const [items, total, queueDepth, refs] = await Promise.all([
    Candidate.aggregate([
      { $match: query },
      { $addFields: { _prio: { $ifNull: ['$reviewPriority', 0] } } },
      { $sort: sortKey },
      { $skip: (page - 1) * pageSize },
      { $limit: pageSize },
      { $project: { _prio: 0 } },
    ]),
    Candidate.countDocuments(query),
    Candidate.countDocuments({ status: 'new' }),
    getRefs(),
  ]);

  // Annotate each candidate with live masters that already share a contact, so
  // the admin sees a duplicate before publishing. One extra query per page:
  // gather every candidate's contact keys, fetch matching masters once, index.
  const candKeys = items.map((c) =>
    [...dedup.contactsToKeys((c.extracted && c.extracted.contacts) || [])]
  );
  const allKeys = [...new Set(candKeys.flat())];
  let masterIdx = new Map();
  if (allKeys.length) {
    const liveMasters = await Master.find({
      contactKeys: { $in: allKeys },
      status: { $in: Master.ACTIVE_STATUSES },
    })
      .select('name professionID locationID contacts status source claimable')
      .lean();
    masterIdx = dedup.buildMasterIndex(liveMasters);
  }

  res.json({
    page,
    pageSize,
    total,
    queueDepth, // always reflects the `new` queue, regardless of filters
    candidates: items.map((c, i) => {
      const s = serializeCandidate(c, refs);
      const seen = new Set();
      const matches = [];
      for (const k of candKeys[i]) {
        const m = masterIdx.get(k);
        if (m && !seen.has(String(m._id))) {
          seen.add(String(m._id));
          matches.push(summarizeDuplicate(m));
        }
      }
      s.duplicateMasters = matches;
      return s;
    }),
  });
}

// ---------------------------------------------------------------------------
// POST /api/mining/candidates/:id/accept  — #94
// Body: { master: { name, professionID, locationID, contacts:[{contactType,value}],
//                   about?, countryID? (default 'IT') } }
// Publishes a live Master, marks the Candidate carded, writes MiningFeedback.

// Coerce a tags input ({ua:[], en:[]}) into clean string arrays. Returns null
// when there are no usable tags, so the caller can omit the field entirely.
function normalizeTags(t) {
  if (!t || typeof t !== 'object') return null;
  const clean = (arr) =>
    (Array.isArray(arr) ? arr : [])
      .map((s) => String(s || '').trim())
      .filter(Boolean);
  const ua = clean(t.ua);
  const en = clean(t.en);
  if (!ua.length && !en.length) return null;
  return { ua, en };
}

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

  // Duplicate guard: refuse to publish a master that shares a contact (phone /
  // @handle / link) with an existing live one, unless the admin forces it.
  if (!req.body.force) {
    const dups = await findDuplicateMasters(master.contacts);
    if (dups.length) {
      return res.status(409).json({
        error: 'duplicate_master',
        duplicates: dups.map(summarizeDuplicate),
      });
    }
  }

  const now = new Date();
  // Human-forwarded leads are community-sourced; auto-mined ones stay 'scraped'.
  const source = cand.sourceType === 'forwarded' ? 'community' : 'scraped';
  const tags = normalizeTags(
    master.tags || (cand.extracted && cand.extracted.tags)
  );
  // Spoken languages the reviewer ticked (e.g. ['ua','ru']).
  const languages = Array.isArray(master.languages)
    ? master.languages.map((l) => String(l).trim()).filter(Boolean)
    : [];
  const created = await Master.create({
    name: String(master.name).trim(),
    professionID: master.professionID,
    locationID: master.locationID,
    countryID: master.countryID || 'IT',
    contacts: master.contacts.map((c) => ({
      contactType: c.contactType,
      value: String(c.value).trim(),
    })),
    ...(languages.length ? { languages } : {}),
    about: (master.about || '').toString(),
    ...(tags ? { tags } : {}),
    source,
    status: 'approved', // the review IS the quality gate
    claimable: true,
    submittedAt: now,
    approvedAt: now,
    sourceMetadata: {
      chatID: cand.chatID,
      anchorMessageID: cand.anchorMessageID,
      candidateRef: String(cand._id),
      sourceType: cand.sourceType,
      classifierName: cand.classifierName,
      classifierVersion: cand.classifierVersion,
      submittedByTelegramID:
        cand.submittedBy && cand.submittedBy.telegramID != null
          ? cand.submittedBy.telegramID
          : undefined,
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

  // #117 — fire-and-forget Telegram profile photo fetch for scraped masters
  // with an @handle. The admin doesn't wait for it; if it succeeds the photo
  // appears on the card on the next render. Any failure is logged, not thrown.
  // The OG card is generated AFTER the photo settles (either way) so the
  // image includes the photo — published cards previously shipped with no
  // OGimage at all and fell back to the legacy Next.js OG layout.
  fetchAndUploadPhotoForMaster(created)
    .then((url) => {
      if (url) {
        created.photo = url;
        return Master.updateOne({ _id: created._id }, { $set: { photo: url } });
      }
    })
    .catch((e) => console.error('[scraped-photo] post-accept', e.message))
    .then(() => createOGimageForMaster(created))
    .then((ogUrl) =>
      Master.updateOne({ _id: created._id }, { $set: { OGimage: ogUrl.toString() } })
    )
    .catch((e) => console.error('[OG] post-accept generation failed:', e.message));

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
  _normalizeTags: normalizeTags,
};
