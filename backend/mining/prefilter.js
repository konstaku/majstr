'use strict';

// Pre-classification filters — trim obvious noise BEFORE the LLM stage. This is
// the volume lever for the slow local (Ollama) path: ~94% of units historically
// came back "unknown", so cheaply dropping the most certain noise saves hours.
//
// Applied to thread-ANSWER units only. Standalone announcements already cleared
// the heuristic announcement gate and pass through untouched.
//
// Conservative by design — recall is verified by scripts/mine-prefilter-eval.js
// (labeled fixtures) AND against real classified candidates. The "no-signal"
// rule deliberately KEEPS the "I'll DM you the contact" pattern (написала вам,
// можу дати контакт): the classifier's USEFUL bar explicitly rewards a responder
// who signals they have a master to share off-channel, so a reply can be a real
// lead while carrying almost no extractable text.
//
// Two rules:
//   pure-ack         — the answer is only acknowledgement / chatter / bump
//                      words or emoji; no contact, link, profession or cue.
//   no-thread-signal — no profession word anywhere (inquiry OR answer), and the
//                      answer has no contact, no link, and no lead cue.

const { analyze } = require('./classifier/adapters/heuristic');

// Acknowledgement / chatter / bump words — UA, RU, IT, EN. Lowercased; matched
// whole-word. A reply made up entirely of these has nothing to extract.
const ACK_WORDS = new Set([
  // Ukrainian
  'дякую', 'дяки', 'дякс', 'дякуючи', 'подяка', 'прошу', 'будь', 'ласка',
  'добре', 'гаразд', 'зрозуміло', 'ясно', 'так', 'ні', 'ага', 'угу',
  'актуально', 'неактуально', 'плюс', 'плюсую', 'плюсуюсь', 'підніму',
  'піднімаю', 'ап', 'вгору', 'дуже',
  // Russian
  'спасибо', 'спс', 'спасиб', 'спасибки', 'спасибочки', 'благодарю',
  'пожалуйста', 'хорошо', 'понятно', 'согласна', 'согласен', 'да', 'нет',
  'поддерживаю', 'тоже', 'вверх', 'поднимаю', 'очень',
  // Italian / English / generic
  'grazie', 'prego', 'certo', 'ok', 'okay', 'si', 'thanks', 'thank', 'ty',
  'yes', 'no', 'please', 'up', 'bump', 'plus',
]);

// Lead cues — substrings whose presence in a reply means it MAY carry a lead,
// even with no profession word or inline contact. Matched on lowercased text.
//   share-privately : responder will hand over a contact off-channel
//   recommends      : responder is recommending / pointing to someone
//   self-offer      : responder offers their own service / help
const LEAD_CUES = [
  // will share a contact privately
  'написал', 'напиш', 'пишу ', 'пишіть', 'пишите', 'в особист', 'в лічк',
  'в личк', 'в приват', 'в лс', 'в дірект', 'в директ', 'скину', 'скинул',
  'надішл', 'надсил', 'відправл', 'отправл', 'кину контакт', 'кину в',
  'дам контакт', 'дати контакт', 'дам номер', 'можу дати', 'дам вам', 'дам тобі',
  // recommends / points to someone
  'рекоменд', 'раджу', 'пораджу', 'звертайс', 'звернись', 'обращайс',
  'скористал', 'користувал', 'послуг',
  // offers their own service / help
  'можу допомог', 'допоможу', 'працю', 'роблю', 'виконую', 'надаю',
  'підвезу', 'завезу', 'заберу', 'доставлю', 'перевезу', 'можу зробити',
  'можу провести', 'звертайтесь',
];

const LINK_RE = /(https?:\/\/|t\.me\/|wa\.me\/|instagram\.com|facebook\.com|\bfb\.com)/i;
const WORD_RE = /[\p{L}]+/gu;

function words(text) {
  return String(text || '').toLowerCase().match(WORD_RE) || [];
}

// True when the text carries nothing beyond acknowledgement / chatter: either
// no words at all (emoji / punctuation only) or every word is an ack word.
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

  const hasContact = ans.contacts.length > 0;
  const hasLink = LINK_RE.test(String(answerText || ''));
  const hasProfession = !!ans.profId || !!inq.profId;
  const hasLeadCue = LEAD_CUES.some((c) => lower.includes(c));

  if (!hasContact && !hasLink && !ans.profId && isAck(answerText)) {
    return { keep: false, reason: 'pure-ack' };
  }
  if (!hasProfession && !hasContact && !hasLink && !hasLeadCue) {
    return { keep: false, reason: 'no-thread-signal' };
  }
  return { keep: true, reason: 'kept' };
}

module.exports = { keepAnswerUnit, isAck, ACK_WORDS, LEAD_CUES };
