'use strict';

// Heuristic pre-filter scorer — the cost lever and the >30% candidate gate.
// Zero API cost. Decides which RawMessages are worth sending to the paid LLM.
//
// Signals: profession-lexicon hit (UA/RU/IT/EN, stem-aware), request-intent,
// offer-intent, contact presence. Weights live in CONFIG so the M3 feedback
// loop can tune them without touching logic. Cheap extraction (contacts +
// profession) is done here; name/city are left to the LLM.

const lexicon = require('../../data/profession-lexicon.json');

const CONFIG = {
  version: '1.0.0',
  threshold: 0.3, // the >30% gate (overridable per call / by tuning)
  weights: {
    profession: 0.45,
    requestIntent: 0.3,
    offerIntent: 0.3,
    contact: 0.2,
  },
  shortLenChars: 15, // below this, score is dampened
  shortPenalty: 0.4,
  linkOnlyPenalty: 0.3,
};

// uk / ru / it request ("looking for a master") and offer ("I provide…") cues.
const REQUEST_CUES = [
  'шука', 'порад', 'підкаж', 'порекоменд', 'потріб', 'треба', 'хто може',
  'хто знає', 'хто робить', 'де знайти', 'кто може', 'посоветуйте', 'ищу',
  'нужен', 'нужна', 'нужно', 'подскажите', 'кто делает', 'cerco',
  'qualcuno', 'consigli', 'mi serve', 'conoscete', 'avete',
];
const OFFER_CUES = [
  'послуг', 'пропоную', 'виконую', 'надаю', 'працюю', 'записатися',
  'запис на', 'мої контакт', 'телефонуйте', 'дзвоніть', 'звертайтеся',
  'оказываю', 'предлагаю', 'услуги', 'записаться', 'обращайтесь', 'мастер по',
  'майстер з', 'offro', 'disponibile', 'servizi', 'prezzi', 'contattatemi',
];

const PHONE_RE = /(?:\+?\d[\d\s().\-]{7,}\d)/;
const HANDLE_RE = /@[A-Za-z][A-Za-z0-9_]{3,}/;
const LINK_RE = /(https?:\/\/|t\.me\/|wa\.me\/|viber|instagram\.com)/i;

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Build stem/term maps once.
const STEMS = new Map(); // stem(>=5) -> profId
const TERMS = new Map(); // exact term -> profId
for (const t of lexicon.terms) {
  TERMS.set(t.term, t.profId);
  if (t.stem && t.stem.length >= 5) STEMS.set(t.stem, t.profId);
}

function matchProfession(normText) {
  const tokens = normText.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  for (const tok of tokens) {
    if (TERMS.has(tok)) return TERMS.get(tok);
    for (let l = 5; l < tok.length; l++) {
      const pid = STEMS.get(tok.slice(0, l));
      if (pid) return pid;
    }
  }
  return null;
}

function anyCue(normText, cues) {
  return cues.some((c) => normText.includes(c));
}

function extractContacts(rawText) {
  const out = [];
  const phone = rawText.match(PHONE_RE);
  if (phone && (phone[0].replace(/\D/g, '').length >= 8)) {
    out.push({ contactType: 'phone', value: phone[0].trim() });
  }
  const handle = rawText.match(HANDLE_RE);
  if (handle) out.push({ contactType: 'telegram', value: handle[0] });
  return out;
}

async function classify(message, opts = {}) {
  const raw = message && message.text ? String(message.text) : '';
  const text = norm(raw);
  const w = CONFIG.weights;

  const profId = matchProfession(text);
  const hasRequest = anyCue(text, REQUEST_CUES);
  const hasOffer = anyCue(text, OFFER_CUES);
  const contacts = extractContacts(raw);
  const hasContact = contacts.length > 0;

  let score = 0;
  if (profId) score += w.profession;
  if (hasRequest) score += w.requestIntent;
  if (hasOffer) score += w.offerIntent;
  if (hasContact) score += w.contact;

  if (raw.trim().length < CONFIG.shortLenChars) score *= CONFIG.shortPenalty;
  // Pure link/forward with no profession or intent = almost certainly noise.
  if (LINK_RE.test(raw) && !profId && !hasRequest && !hasOffer) {
    score *= CONFIG.linkOnlyPenalty;
  }
  score = Math.max(0, Math.min(1, score));

  let kind = 'unknown';
  if (hasOffer && (hasContact || profId)) kind = 'announcement';
  else if (hasRequest && profId) kind = 'recommendation';
  else if (profId && hasContact) kind = 'announcement';

  const extracted = {};
  if (profId) extracted.profession = profId;
  if (contacts.length) extracted.contacts = contacts;

  return { kind, score, extracted };
}

module.exports = {
  name: 'heuristic',
  version: CONFIG.version,
  CONFIG,
  classify,
};
