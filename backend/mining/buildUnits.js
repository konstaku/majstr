'use strict';

// Flatten a chat's RawMessages into classifiable candidate units.
//
// Thread answers run through the pre-filter (mining/prefilter.js) — pure-ack and
// no-thread-signal replies are dropped so they never reach the classifier.
// Announcements already cleared the heuristic announcement gate and pass through.
//
// Shared by scripts/mine-classify.js (batch CLI) and mining/classifyChatJob.js
// (the review server's progress-tracked run) so both build identical units.

const { buildThreads } = require('./thread');
const { keepAnswerUnit } = require('./prefilter');

function unitsFromChat(all) {
  const { threads, announcements } = buildThreads(all);
  const units = [];
  const dropped = { pureAck: 0, noLead: 0 };
  for (const t of threads) {
    for (const a of t.answers) {
      const ids = a.messageIDs.slice().sort((x, y) => x - y);
      const text = a.messages.map((m) => m.text).join('\n');
      const verdict = keepAnswerUnit(t.inquiry.text, text);
      if (!verdict.keep) {
        if (verdict.reason === 'pure-ack') dropped.pureAck++;
        else dropped.noLead++;
        continue;
      }
      units.push({
        sourceType: 'thread_answer',
        anchorMessageID: ids[0],
        messageIDs: ids,
        inquiryMessageID: t.inquiryID,
        inquiryText: t.inquiry.text,
        responderName: a.responderName,
        text,
        classifyInput: { inquiry: t.inquiry.text, responderName: a.responderName, text },
      });
    }
  }
  for (const an of announcements) {
    units.push({
      sourceType: 'announcement',
      anchorMessageID: an.messageID,
      messageIDs: [an.messageID],
      inquiryMessageID: null,
      inquiryText: null,
      responderName: null,
      text: an.text,
      classifyInput: { text: an.text },
    });
  }
  return { units, dropped };
}

module.exports = { unitsFromChat };
