'use strict';

// Forwarded-lead intake, split into two phases because the bot (server, no
// Ollama) and the LLM (the reviewer's home machine) live in different places:
//
//   storeRawForward()  — runs in the BOT. Saves the forwarded text + screenshots
//                        to Mongo as a status:'raw' Candidate. NO LLM. Cheap.
//   processCandidate() — runs on the REVIEWER'S MACHINE (local-queue-server.js).
//                        Runs the local Ollama extractor on the text, fills
//                        extraction + score, flips 'raw' -> 'new'. Screenshots are
//                        shown in the review UI for manual reading (no OCR).
//
// Both use the same Candidate model + miningDb connection as the auto-miner, so
// accept/decline/dedup downstream are unchanged.

const miningDb = require('../database/miningDb');
const forwardExtract = require('./forwardExtract');
const {
  findDuplicateMasters,
  summarizeDuplicate,
} = require('../helpers/masterDuplicates');

class EmptyForwardError extends Error {
  constructor() {
    super('forwarded bundle has no text or images');
    this.code = 'EMPTY_FORWARD';
  }
}

// Combine forwarded message texts (in arrival order) into one block.
function combineTexts(texts) {
  return (texts || [])
    .map((t) => String(t || '').trim())
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

// Stable identity for the unique (chatID, anchorMessageID) index so a re-forward
// of the same source post is idempotent.
function deriveAnchor(origin, receivedMessageIDs, submitter) {
  const ids = (receivedMessageIDs || []).filter((n) => Number.isFinite(n));
  const fallbackAnchor = ids.length ? Math.min(...ids) : Date.now();
  if (origin && origin.chatID) {
    return {
      chatID: String(origin.chatID),
      anchorMessageID: Number.isFinite(origin.messageID)
        ? origin.messageID
        : fallbackAnchor,
    };
  }
  return {
    chatID: `forward:${submitter && submitter.telegramID != null ? submitter.telegramID : 'anon'}`,
    anchorMessageID: fallbackAnchor,
  };
}

// One-line human summary for the bot / UI.
function summarize(extracted) {
  const parts = [];
  if (extracted.name) parts.push(extracted.name);
  if (extracted.profession) parts.push(extracted.profession);
  if (extracted.city) parts.push(extracted.city);
  const contact = (extracted.contacts || [])[0];
  if (contact && contact.value) parts.push(contact.value);
  return parts.join(' · ');
}

// ---------------------------------------------------------------------------
// Phase 1 — BOT: store the raw forward (no LLM).
//
// @param {string[]} input.texts
// @param {number[]} [input.receivedMessageIDs]
// @param {Object}  [input.origin]     { chatID, chatTitle, messageID }
// @param {Object}  input.submitter    { telegramID, name, isAdmin }
// @param {Array}   [input.images]     [{ url, fileId }]
// @returns {Promise<{candidate, duplicate:boolean}>}
async function storeRawForward(input) {
  const { texts, receivedMessageIDs, origin, submitter = {}, images = [] } = input || {};
  const text = combineTexts(texts);
  if (!text && !(images && images.length)) throw new EmptyForwardError();

  const originChatTitle = (origin && origin.chatTitle) || null;
  const { chatID, anchorMessageID } = deriveAnchor(origin, receivedMessageIDs, submitter);
  const Candidate = miningDb.Candidate();

  // Idempotent re-forward.
  const existing = await Candidate.findOne({ chatID, anchorMessageID }).lean();
  if (existing) return { candidate: existing, duplicate: true };

  const doc = {
    chatID,
    sourceType: 'forwarded',
    anchorMessageID,
    messageIDs: (receivedMessageIDs || []).filter((n) => Number.isFinite(n)),
    text,
    images: (images || [])
      .filter((im) => im && im.url)
      .map((im) => ({ url: im.url, fileId: im.fileId || null, ocrText: null })),
    kind: 'unknown',
    score: 0,
    extracted: {},
    status: 'raw', // not processed yet — the reviewer's machine runs the LLM
    classifierName: '',
    classifierVersion: '',
    submittedBy: {
      telegramID: submitter.telegramID != null ? submitter.telegramID : null,
      name: submitter.name || null,
      isAdmin: !!submitter.isAdmin,
    },
    originChatTitle,
    reviewPriority: submitter.isAdmin ? 0 : -1,
  };

  try {
    const candidate = await Candidate.create(doc);
    return { candidate, duplicate: false };
  } catch (e) {
    if (e && e.code === 11000) {
      const raced = await Candidate.findOne({ chatID, anchorMessageID }).lean();
      if (raced) return { candidate: raced, duplicate: true };
    }
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Phase 2 — REVIEWER'S MACHINE: run the LLM on a raw candidate's text.
//
// Loads the candidate, runs the local Ollama extractor on its TEXT, fills
// extraction/score/kind, and flips status 'raw' -> 'new'. Screenshots are NOT
// OCR'd — they're shown in the review UI so the reviewer reads/types the contact
// by hand (no vision model required). Image-only forwards still become reviewable
// cards (empty fields + the picture). Idempotent-ish: re-processing re-extracts.
//
// @param {string} candidateId
// @returns {Promise<{candidate, duplicateMaster:object|null, summary, isUseful}>}
async function processCandidate(candidateId) {
  const Candidate = miningDb.Candidate();
  const cand = await Candidate.findById(candidateId);
  if (!cand) throw new Error('candidate_not_found');

  const text = String(cand.text || '').trim();

  // Image-only forward: nothing to extract from. Mark it reviewable so the card
  // (with the screenshot) shows up; the reviewer fills the fields manually.
  let result;
  if (!text) {
    result = {
      score: 0,
      isUseful: false,
      extracted: { name: null, profession: null, city: null, contacts: [], description: null, tags: { ua: [], en: [] } },
      classifierName: forwardExtract.name,
      classifierVersion: forwardExtract.version,
    };
  } else {
    result = await forwardExtract.extract({
      text,
      originChatTitle: cand.originChatTitle || null,
    });
  }

  cand.extracted = result.extracted;
  cand.score = result.score;
  cand.kind = 'recommendation';
  cand.classifierName = result.classifierName;
  cand.classifierVersion = result.classifierVersion;
  cand.status = 'new';
  cand.processedAt = new Date();
  await cand.save();

  // Annotate (don't block) with any live master already holding this contact.
  let duplicateMaster = null;
  const dups = await findDuplicateMasters(result.extracted.contacts);
  if (dups.length) duplicateMaster = summarizeDuplicate(dups[0]);

  return {
    candidate: cand.toObject(),
    duplicateMaster,
    summary: summarize(result.extracted),
    isUseful: result.isUseful,
  };
}

module.exports = {
  storeRawForward,
  processCandidate,
  EmptyForwardError,
  // Exposed for tests.
  _combineTexts: combineTexts,
  _deriveAnchor: deriveAnchor,
  _summarize: summarize,
};
