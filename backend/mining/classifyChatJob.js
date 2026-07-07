'use strict';

// Progress-tracked classification of one imported chat — the interactive
// counterpart to scripts/mine-classify.js. Given a chat's RawMessages it builds
// classifiable units (mining/buildUnits) and runs the classifier over them one by
// one, upserting Candidates (+ sibling candidates for multi-master messages) and
// reporting progress after EACH unit so a UI can render a live progress bar.
//
// Classifier- and model-agnostic: the caller passes the classifier and the
// mining-DB-bound RawMessage / Candidate models (miningDb.RawMessage() etc.), so
// the same runner works from the review server or a script. No cache / MiningRun
// here — this is the interactive path; the upsert on (chatID, anchorMessageID,
// subIndex) keeps re-runs idempotent.

const { unitsFromChat } = require('./buildUnits');
const { spawnAdditionalCandidates } = require('./spawnAdditional');

async function classifyWithRetry(classifier, input) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await classifier.classify(input);
    } catch (e) {
      if (attempt === 2) throw e;
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }
}

// opts: { RawMessage, Candidate, classifier, chatID, region, onProgress, shouldStop }
//   onProgress({ done, total, created, useful, failed, kind, name }) — after each unit.
//   shouldStop() — optional; return true to cancel gracefully.
async function classifyChat(opts) {
  const { RawMessage, Candidate, classifier, chatID, onProgress, shouldStop } = opts;
  const region = opts.region || String(chatID);

  const all = await RawMessage.find({ chatID: String(chatID) })
    .select('messageID replyToID fromHash fromName date text lang')
    .lean();
  const { units } = unitsFromChat(all);
  const total = units.length;

  let done = 0;
  let created = 0;
  let useful = 0;
  let failed = 0;
  const emit = (extra) =>
    onProgress && onProgress({ done, total, created, useful, failed, ...extra });

  emit({ phase: 'start' });

  for (const u of units) {
    if (shouldStop && shouldStop()) break;

    let cls;
    try {
      cls = await classifyWithRetry(classifier, u.classifyInput);
    } catch (e) {
      failed++;
      done++;
      emit({ error: e.message });
      continue;
    }

    // Only the two real candidate kinds are carded (the heuristic adapter can
    // also emit 'inquiry', which is not a Candidate kind — skip it).
    let graph = null;
    if (cls.kind === 'recommendation' || cls.kind === 'announcement') {
      useful++;
      const extracted = { ...(cls.extracted || {}) };
      if (!extracted.city) extracted.city = region;
      const shared = {
        chatID: String(chatID),
        sourceType: u.sourceType,
        anchorMessageID: u.anchorMessageID,
        messageIDs: u.messageIDs,
        inquiryMessageID: u.inquiryMessageID,
        inquiryText: u.inquiryText,
        responderName: u.responderName,
        text: u.text,
        score: cls.score,
        classifierName: classifier.name,
        classifierVersion: classifier.version,
      };
      await Candidate.updateOne(
        { chatID: String(chatID), anchorMessageID: u.anchorMessageID, subIndex: 0 },
        { $set: { ...shared, kind: cls.kind, extracted }, $setOnInsert: { status: 'new' } },
        { upsert: true }
      );
      created++;
      // Case 5 — extra masters named in the same message → sibling candidates.
      created += await spawnAdditionalCandidates(Candidate, shared, cls.additional, region);

      // Live-graph node/edge: the master (by name / contact) and, for a
      // recommendation, the person recommending them.
      const contactKey =
        (extracted.contacts && extracted.contacts[0] && extracted.contacts[0].value) || '';
      graph = {
        masterKey: String(extracted.name || contactKey || '#' + u.anchorMessageID).toLowerCase().trim(),
        masterName: extracted.name || contactKey || u.responderName || '?',
        recommender: cls.kind === 'recommendation' ? u.responderName || null : null,
      };
    }

    done++;
    emit({ kind: cls.kind, name: (cls.extracted && cls.extracted.name) || null, graph });
  }

  return { total, done, created, useful, failed, stopped: !!(shouldStop && shouldStop()) };
}

module.exports = { classifyChat };
