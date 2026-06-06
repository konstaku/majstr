'use strict';

// Review-time dedup + policy filters used by the CLI review tool (and later
// the dashboard). Implements the practical chunk of #99 needed today:
//
//   1. Contact-keyed grouping inside the queue — phone (last 9 digits),
//      @handle / telegram, instagram, viber etc. — and a secondary "soft"
//      key on (name + profession + city) for the contactless cases.
//   2. Suppress candidates whose contact already maps to a live Master
//      (someone the queue is about to duplicate). This is the cross-DB check.
//   3. Cross-border transport policy filter — the user-stated exclusion of
//      Ukraine ↔ Italy / EU bus / parcel / courier services. LOCAL trasloco
//      / in-city furniture moves are explicitly kept (whitelist).
//
// Stateless — suppressed candidates stay in the DB with status='new'. After
// a representative is approved, the duplicates will naturally cascade into
// 'existing-master' suppression on the next queue load (no permanent decline
// needed; if the dedup is wrong, candidates resurface on the next session).

// Last 9 digits — robust to "+39 333 1234567", "0039 333 1234567", "333 1234567".
function phoneKey(value) {
  const d = String(value || '').replace(/\D/g, '');
  if (d.length < 8) return null;
  return d.slice(-9);
}

// Lowercased handle without leading @ or URL prefix. Strips trailing slashes.
function handleKey(value) {
  const s = String(value || '').toLowerCase().trim();
  if (!s) return null;
  const m = s.match(
    /(?:https?:\/\/)?(?:t\.me\/|wa\.me\/|instagram\.com\/|facebook\.com\/)?@?([a-z0-9_.]{4,})/
  );
  if (!m) return null;
  return m[1].replace(/\/+$/, '');
}

function classifyContact(type) {
  const t = String(type || '').toLowerCase();
  // Telegram / Instagram FIRST: "telegram" contains the substring "tel", so a
  // naive /tel/ phone test would mis-bucket Telegram handles as phones (then
  // phoneKey strips the @handle to null and the contact is lost). Order matters.
  if (/telegram|tg/.test(t)) return 'tg';
  if (/instagram|insta|ig/.test(t)) return 'ig';
  if (/phone|tel|whatsapp|viber/.test(t)) return 'phone';
  return 'other:' + t;
}

function contactsToKeys(contacts) {
  const keys = new Set();
  for (const c of contacts || []) {
    const cat = classifyContact(c.contactType);
    const k = cat === 'phone' ? phoneKey(c.value) : handleKey(c.value);
    if (k) keys.add(cat + ':' + k);
  }
  return keys;
}

// Candidate.extracted is the LLM's extraction; that's what we group on. The
// raw message text isn't reliable because the same master may be referenced
// under different phrasings — but their contact / handle is stable.
function dedupKeys(candidate) {
  return contactsToKeys((candidate && candidate.extracted && candidate.extracted.contacts) || []);
}

// Richness of a candidate's extraction — used to pick the representative when
// the same person appears across several messages. We want the card with the
// FULLEST contact set (most contacts, then longest total contact value), then
// the richest description, then the classifier score. Compared field-by-field.
function richness(candidate) {
  const e = (candidate && candidate.extracted) || {};
  const contacts = (e.contacts || []).filter((c) => c && c.value);
  const contactLen = contacts.reduce(
    (n, c) => n + String(c.value || '').length,
    0
  );
  return [
    contacts.length,
    contactLen,
    String(e.description || '').length,
    Number(candidate && candidate.score) || 0,
  ];
}

// Descending lexicographic compare of two richness tuples.
function compareRichness(a, b) {
  const ra = richness(a);
  const rb = richness(b);
  for (let i = 0; i < ra.length; i++) {
    if (rb[i] !== ra[i]) return rb[i] - ra[i];
  }
  return 0;
}

// Soft secondary key — used when there is no contact at all. A name without a
// profession/city is too noisy to dedup on; require all three.
function softKey(candidate) {
  const e = (candidate && candidate.extracted) || {};
  const n = String(e.name || '').toLowerCase().trim();
  const p = String(e.profession || '').toLowerCase().trim();
  const c = String(e.city || '').toLowerCase().trim();
  if (n && p && c) return 'soft:' + n + '|' + p + '|' + c;
  return null;
}

function buildMasterIndex(masters) {
  const idx = new Map();
  for (const m of masters || []) {
    for (const c of m.contacts || []) {
      const cat = classifyContact(c.contactType);
      const k = cat === 'phone' ? phoneKey(c.value) : handleKey(c.value);
      if (k) idx.set(cat + ':' + k, m);
    }
  }
  return idx;
}

// Cross-border (Ukraine ↔ Italy / EU) transport pattern detector. The user
// flagged these as scam-prone and not local — auto-suppress from the queue.
// LOCAL_MOVE_RE whitelists trasloco / in-city moves so they stay through.

const LOCAL_MOVE_RE =
  /(trasloco|переїзд\s+квартир|переезд\s+квартир|по\s+місту|по\s+городу|перевез\w*\s+(меб|речі|вещ|діван|шафу))/i;

const BORDER_PLACE_RE =
  /(україн\w*|львів\w*|київ\w*|харків\w*|одес\w*|дніпр\w*|ужгород|чернівц\w*|ів[ао]н[оа][\s\-]*франків|тернопіл|вінниц|рівн[еа]|польщ\w*|polska|poland|чех|румун)/i;

const TRANSPORT_VERB_RE =
  /(посилк|пакунк|передач|автобус|маршрут|перевез|перевіз|пересил|відправ\w*|забер[уе]|привез|доставк|рейс|шопер)/i;

function isCrossBorderTransport(text) {
  const t = String(text || '').toLowerCase();
  if (!t) return false;
  if (LOCAL_MOVE_RE.test(t)) return false; // local moves are explicitly OK
  // A border place (or "Україна" in any direction phrase) PLUS a transport
  // verb is the cross-border signal. Either signal alone is not enough.
  return BORDER_PLACE_RE.test(t) && TRANSPORT_VERB_RE.test(t);
}

// ---------------------------------------------------------------------------
// applyDedup — the main entry point. Given the raw queue + live Masters,
// returns: { reps[], suppressed: Map<candidateId, reason> }.
//
// The representative of each dedup group is the RICHEST candidate — the one
// with the fullest contact set (then description, then score), so the admin
// reviews the most complete card. Suppression reasons:
//   'existing-master'         — a live Master has this contact already
//   'cross-border-transport'  — policy filter
//   'duplicate-of:<cid>'      — another candidate in the queue is the rep

function applyDedup(candidates, masterIndex) {
  const reps = [];
  const suppressed = new Map(); // candidateId -> { reason, ... }
  const keyToRepId = new Map(); // dedup key -> repId already kept

  // Process richest-first so first-claim-wins keeps the fullest card as rep.
  const ordered = [...candidates].sort(compareRichness);
  for (const c of ordered) {
    const cid = String(c._id);

    // 1. live-Master collision
    let matched = null;
    for (const k of dedupKeys(c)) {
      const m = masterIndex.get(k);
      if (m) {
        matched = m;
        break;
      }
    }
    if (matched) {
      suppressed.set(cid, {
        reason: 'existing-master',
        masterID: String(matched._id),
        masterName: matched.name,
      });
      continue;
    }

    // 2. cross-border transport policy
    if (
      isCrossBorderTransport(c.text || '') ||
      isCrossBorderTransport(c.inquiryText || '')
    ) {
      suppressed.set(cid, { reason: 'cross-border-transport' });
      continue;
    }

    // 3. within-queue dedup — first claim wins (the input is score-sorted)
    const keys = [...dedupKeys(c)];
    const sk = softKey(c);
    if (sk) keys.push(sk);

    let existingRep = null;
    for (const k of keys) {
      if (keyToRepId.has(k)) {
        existingRep = keyToRepId.get(k);
        break;
      }
    }
    if (existingRep) {
      suppressed.set(cid, { reason: 'duplicate-of', candidateID: existingRep });
      continue;
    }

    // New representative — keep it and claim every key it brings.
    reps.push(c);
    for (const k of keys) keyToRepId.set(k, cid);
  }

  return { reps, suppressed };
}

module.exports = {
  phoneKey,
  handleKey,
  classifyContact,
  contactsToKeys,
  dedupKeys,
  richness,
  compareRichness,
  softKey,
  buildMasterIndex,
  isCrossBorderTransport,
  applyDedup,
};
