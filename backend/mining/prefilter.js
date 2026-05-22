'use strict';

// Pre-classification filter — trims obvious noise BEFORE the LLM stage. The
// volume lever for the slow local (Ollama) path: ~94% of units historically
// came back "unknown", so cheaply dropping the most certain noise saves hours.
//
// Applied to thread-ANSWER units only. Standalone announcements already cleared
// the heuristic announcement gate and pass through untouched.
//
// Division of labour:
//   - This filter is a SAFE volume cut. It keeps anything that plausibly points
//     at a specialist and only drops threads with no specialist signal at all.
//   - The CLASSIFIER (with its system prompt) is the precision gate. In
//     particular it — not this filter — rejects the "I'll DM you the contact"
//     pattern ("написала вам", "можу дати контакт"): that needs full context,
//     so such replies may still reach the classifier and be rejected there.
//
// A thread answer is kept when it has any specialist signal:
//   - a profession word in the answer OR the inquiry (heuristic lexicon)
//   - a contact (phone / @handle) in the answer
//   - a link or a social-platform mention in the answer
//   - a self-offer — the responder offering their own service
// Otherwise it is dropped: `pure-ack` (only chatter/emoji) or `no-thread-signal`.
//
// Recall is verified by scripts/mine-prefilter-eval.js (labeled fixtures) and
// against real classified candidates.

const { analyze } = require('./classifier/adapters/heuristic');

// Acknowledgement / chatter / bump words — UA, RU, IT, EN. Lowercased.
const ACK_WORDS = new Set([
  'дякую', 'дяки', 'дякс', 'дякуючи', 'подяка', 'прошу', 'будь', 'ласка',
  'добре', 'гаразд', 'зрозуміло', 'ясно', 'так', 'ні', 'ага', 'угу',
  'актуально', 'неактуально', 'плюс', 'плюсую', 'плюсуюсь', 'підніму',
  'піднімаю', 'ап', 'вгору', 'дуже',
  'спасибо', 'спс', 'спасиб', 'спасибки', 'спасибочки', 'благодарю',
  'пожалуйста', 'хорошо', 'понятно', 'согласна', 'согласен', 'да', 'нет',
  'поддерживаю', 'тоже', 'вверх', 'поднимаю', 'очень',
  'grazie', 'prego', 'certo', 'ok', 'okay', 'si', 'thanks', 'thank', 'ty',
  'yes', 'no', 'please', 'up', 'bump', 'plus',
]);

// Self-offer cues — the responder offering THEIR OWN service / help. They are
// the specialist (named by their display name). Substring-matched on lowercased
// text. The heuristic's own OFFER_CUES (analyze().hasOffer) covers виконую /
// надаю / працюю / оказываю / предлагаю / обращайтесь etc.; these add the
// first-person verbs it misses.
const SELF_OFFER_CUES = [
  'роблю', 'робл', 'робив', 'робила', 'зробл', 'займаю', 'займаюс', 'занимаюс',
  'даю урок', 'даю консульт', 'викладаю', 'навчаю', 'делаю',
  'наберіть мене', 'наберите меня', 'можу допомог', 'можу зроб',
  'можу провест', 'можу підвез', 'підвезу', 'завезу', 'заберу', 'доставлю',
  'перевезу', 'підвозжу', 'я майстер', 'я фотограф',
];

// Social-platform mentions — a reply pointing at a public profile, even when
// the handle is not written as a @handle or full URL ("в instagram artcake_x").
const SOCIAL_WORDS = [
  'instagram', 'інстаграм', 'инстаграм', 'інста', 'инста', 'insta',
  'telegram', 'телеграм', 'телега', 'viber', 'вайбер', 'whatsapp', 'ватсап',
  'вотсап', 'facebook', 'фейсбук', 'тікток', 'тикток', 'tiktok',
];

const LINK_RE = /(https?:\/\/|t\.me\/|wa\.me\/|instagram\.com|facebook\.com|\bfb\.com)/i;
const WORD_RE = /[\p{L}]+/gu;

function words(text) {
  return String(text || '').toLowerCase().match(WORD_RE) || [];
}

// True when the text carries nothing beyond acknowledgement / chatter.
function isAck(text) {
  const w = words(text);
  if (!w.length) return true;
  return w.every((x) => ACK_WORDS.has(x));
}

// Decide whether a thread-answer unit is worth a classifier call.
//   inquiryText — the question that anchored the thread
//   answerText  — the bundled reply being assessed
// Returns { keep, reason } where reason ∈ {kept, pure-ack, no-thread-signal}.
function keepAnswerUnit(inquiryText, answerText) {
  const ans = analyze(answerText);
  const inq = analyze(inquiryText);
  const lower = String(answerText || '').toLowerCase();

  const hasProfession = !!ans.profId || !!inq.profId;
  const hasContact = ans.contacts.length > 0;
  const hasLink =
    LINK_RE.test(String(answerText || '')) ||
    SOCIAL_WORDS.some((s) => lower.includes(s));
  const hasSelfOffer = ans.hasOffer || SELF_OFFER_CUES.some((c) => lower.includes(c));

  if (hasProfession || hasContact || hasLink || hasSelfOffer) {
    return { keep: true, reason: 'kept' };
  }
  if (isAck(answerText)) return { keep: false, reason: 'pure-ack' };
  return { keep: false, reason: 'no-thread-signal' };
}

module.exports = { keepAnswerUnit, isAck, ACK_WORDS, SELF_OFFER_CUES };
