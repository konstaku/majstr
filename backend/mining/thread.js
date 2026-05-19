'use strict';

// Reconstruct conversation threads from flat RawMessages.
//
// The valuable pattern in these chats is: someone ASKS for a specialist, and
// the answer lives in the REPLIES — often split across several short messages
// by one responder, only one of which is a formal reply:
//
//   X: please advise a good dentist?
//   Y: <phone>                 (not a formal reply)
//   Y: (reply→X) Maxim         (the formal reply)
//   Y: has his own studio downtown
//
// So per inquiry we group answers by responder (fromHash — we never store the
// raw author id, but the salted hash still lets us cluster same-author), and
// per responder we bundle their formal reply PLUS their adjacent messages
// within a small id/time window. Contact/name/description are assembled from
// the whole bundle, not a single message.

const { analyze } = require('./classifier/adapters/heuristic');

const DEFAULTS = { idWindow: 6, minutesWindow: 15 };

function assembleExtracted(texts) {
  const joined = texts.join('\n');
  const a = analyze(joined);
  const out = {};
  if (a.profId) out.profession = a.profId;
  if (a.contacts.length) out.contacts = a.contacts;
  // Name guess: a very short standalone line that is not a contact/url.
  const nameLine = texts
    .map((t) => t.trim())
    .find(
      (t) =>
        t.length >= 2 &&
        t.length <= 30 &&
        !/\d{6,}|@|https?:|t\.me/i.test(t) &&
        /^[\p{Lu}\p{L}][\p{L} '’.-]+$/u.test(t)
    );
  if (nameLine) out.name = nameLine;
  // Description: the longest line with no contact noise.
  const desc = texts
    .map((t) => t.trim())
    .filter((t) => t.length > 25 && !/\d{6,}|https?:|t\.me/i.test(t))
    .sort((x, y) => y.length - x.length)[0];
  if (desc) out.description = desc;
  return out;
}

function buildThreads(messages, opts = {}) {
  const { idWindow, minutesWindow } = { ...DEFAULTS, ...opts };
  const winMs = minutesWindow * 60000;
  const msgs = [...messages].sort((a, b) => a.messageID - b.messageID);
  const byId = new Map(msgs.map((m) => [m.messageID, m]));

  const repliesByParent = new Map();
  for (const m of msgs) {
    if (m.replyToID != null && byId.has(m.replyToID)) {
      if (!repliesByParent.has(m.replyToID)) repliesByParent.set(m.replyToID, []);
      repliesByParent.get(m.replyToID).push(m);
    }
  }

  const usedInThread = new Set();
  const threads = [];

  for (const m of msgs) {
    const sig = analyze(m.text);
    if (!sig.isInquiry) continue;
    const directReplies = repliesByParent.get(m.messageID) || [];
    if (!directReplies.length) continue; // only inquiries that got answered

    // Group answers by responder.
    const byResponder = new Map();
    for (const r of directReplies) {
      if (!byResponder.has(r.fromHash)) byResponder.set(r.fromHash, []);
      byResponder.get(r.fromHash).push(r);
    }

    const answers = [];
    for (const [responderHash, anchorReplies] of byResponder) {
      const bundle = new Map();
      for (const ar of anchorReplies) {
        bundle.set(ar.messageID, ar);
        const t = +new Date(ar.date);
        for (const z of msgs) {
          if (z.fromHash !== responderHash || z.messageID === ar.messageID) continue;
          // Skip messages that are formal replies to a DIFFERENT message.
          if (z.replyToID != null && z.replyToID !== m.messageID) continue;
          if (
            Math.abs(z.messageID - ar.messageID) <= idWindow &&
            Math.abs(+new Date(z.date) - t) <= winMs
          ) {
            bundle.set(z.messageID, z);
          }
        }
      }
      const items = [...bundle.values()].sort((a, b) => a.messageID - b.messageID);
      items.forEach((it) => usedInThread.add(it.messageID));
      answers.push({
        responderHash,
        messageIDs: items.map((i) => i.messageID),
        messages: items.map((i) => ({ messageID: i.messageID, text: i.text })),
        extracted: assembleExtracted(items.map((i) => i.text)),
      });
    }

    threads.push({
      inquiryID: m.messageID,
      inquiry: { messageID: m.messageID, text: m.text, lang: m.lang },
      profession: sig.profId || null,
      answers,
    });
  }

  // Standalone announcements (a specialist advertising) not already in a thread.
  const announcements = [];
  for (const m of msgs) {
    if (usedInThread.has(m.messageID)) continue;
    const sig = analyze(m.text);
    if (sig.kind === 'announcement' || (sig.kind === 'recommendation' && sig.contacts.length)) {
      announcements.push({
        messageID: m.messageID,
        text: m.text,
        lang: m.lang,
        kind: sig.kind,
        extracted: {
          ...(sig.profId ? { profession: sig.profId } : {}),
          ...(sig.contacts.length ? { contacts: sig.contacts } : {}),
        },
      });
    }
  }

  return { threads, announcements };
}

module.exports = { buildThreads, assembleExtracted, DEFAULTS };
