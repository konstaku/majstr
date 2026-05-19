'use strict';

// Heuristic pre-filter scorer — the cost lever and the >30% candidate gate.
// Zero API cost. Decides which RawMessages are worth deeper processing.
//
// Kinds:
//   inquiry        — someone ASKING for a specialist (the thread anchor; its
//                    replies are where the real master data lives)
//   announcement   — a specialist offering their own services
//   recommendation — naming/contacting a specific master (typical reply)
//   unknown        — noise
//
// `analyze()` is exported so the thread builder reuses the exact same signal
// extraction without recomputing. Weights live in CONFIG so the M3 feedback
// loop can tune without touching logic.

const lexicon = require('../../data/profession-lexicon.json');

const CONFIG = {
  version: '1.1.0',
  threshold: 0.3,
  weights: { profession: 0.45, requestIntent: 0.3, offerIntent: 0.3, contact: 0.2 },
  inquiryFloor: 0.35, // an inquiry must clear the gate even with no other signal
  shortLenChars: 15,
  shortPenalty: 0.4,
  linkOnlyPenalty: 0.3,
};

const REQUEST_CUES = [
  'шука', 'порад', 'підкаж', 'порекоменд', 'потріб', 'треба', 'хто може',
  'хто знає', 'хто робить', 'де знайти', 'кто може', 'кто знает', 'посоветуйте',
  'ищу', 'нужен', 'нужна', 'нужно', 'подскажите', 'кто делает', 'порекомендуйте',
  'cerco', 'qualcuno', 'consigli', 'mi serve', 'conoscete', 'avete',
];
const OFFER_CUES = [
  'послуг', 'пропоную', 'виконую', 'надаю', 'працюю', 'записатися', 'запис на',
  'мої контакт', 'телефонуйте', 'дзвоніть', 'звертайтеся', 'оказываю',
  'предлагаю', 'услуги', 'записаться', 'обращайтесь', 'мастер по', 'майстер з',
  'offro', 'disponibile', 'servizi', 'prezzi', 'contattatemi',
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

const STEMS = new Map();
const TERMS = new Map();
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

const anyCue = (t, cues) => cues.some((c) => t.includes(c));

function extractContacts(rawText) {
  const out = [];
  const phone = rawText.match(PHONE_RE);
  if (phone && phone[0].replace(/\D/g, '').length >= 8) {
    out.push({ contactType: 'phone', value: phone[0].trim() });
  }
  const handle = rawText.match(HANDLE_RE);
  if (handle) out.push({ contactType: 'telegram', value: handle[0] });
  return out;
}

// Single source of signal extraction — used by classify() AND the thread builder.
function analyze(rawText) {
  const raw = rawText ? String(rawText) : '';
  const text = norm(raw);
  const w = CONFIG.weights;

  const profId = matchProfession(text);
  const hasRequest = anyCue(text, REQUEST_CUES);
  const hasOffer = anyCue(text, OFFER_CUES);
  const contacts = extractContacts(raw);
  const hasContact = contacts.length > 0;
  const isInquiry = hasRequest && !(hasOffer && hasContact);

  let score = 0;
  if (profId) score += w.profession;
  if (hasRequest) score += w.requestIntent;
  if (hasOffer) score += w.offerIntent;
  if (hasContact) score += w.contact;
  if (raw.trim().length < CONFIG.shortLenChars) score *= CONFIG.shortPenalty;
  if (LINK_RE.test(raw) && !profId && !hasRequest && !hasOffer) {
    score *= CONFIG.linkOnlyPenalty;
  }
  if (isInquiry) score = Math.max(score, CONFIG.inquiryFloor);
  score = Math.max(0, Math.min(1, score));

  let kind = 'unknown';
  if (hasOffer && (hasContact || profId)) kind = 'announcement';
  else if (isInquiry) kind = 'inquiry';
  else if (profId && hasContact) kind = 'recommendation';

  return { kind, score, profId, hasRequest, hasOffer, contacts, isInquiry };
}

async function classify(message) {
  const a = analyze(message && message.text);
  const extracted = {};
  if (a.profId) extracted.profession = a.profId;
  if (a.contacts.length) extracted.contacts = a.contacts;
  return { kind: a.kind, score: a.score, extracted };
}

module.exports = { name: 'heuristic', version: CONFIG.version, CONFIG, classify, analyze };
