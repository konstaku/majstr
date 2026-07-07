'use strict';

/**
 * Local LLM review server — runs on YOUR machine (where Ollama lives), not the
 * server. The bot only stores RAW forwarded text/screenshots in Mongo; this tool
 * is where the LLM actually runs:
 *
 *   1. You open http://127.0.0.1:4300 in your browser.
 *   2. It pulls RAW items from the DB. You click "Process" (one) or "Process all"
 *      — it runs your local Ollama on the TEXT and turns them into editable cards.
 *      Forwarded screenshots are shown on the card so you read/type the contact.
 *   3. Approve → publishes a live master.  Decline → removed from the queue.
 *
 * You can also paste a chat snippet directly — it's stored + processed on the spot.
 *
 * Usage (from backend/):
 *   ollama serve                                   # text model running
 *   node scripts/local-queue-server.js             # http://127.0.0.1:4300
 *   node scripts/local-queue-server.js --port 5300
 *
 * Env: OLLAMA_MODEL (text, default qwen2.5:14b). Needs backend/.env for Mongo + S3
 * (S3 only to display forwarded screenshots).
 */

require('dotenv').config();
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const { runDB } = require('../database/db');

const Profession = require('../database/schema/Profession');
const ProfCategory = require('../database/schema/ProfCategory');
const Location = require('../database/schema/Location');
const Country = require('../database/schema/Country');

const {
  listCandidates,
  acceptCandidate,
  declineCandidate,
  attachRecommendationToMaster,
  listRecommendationBuckets,
} = require('../routes/miningReview');
const {
  createProfession,
  createLocation,
  createProfCategory,
  rebuildLexicon,
} = require('../routes/referenceAdmin');
const { storeRawForward, processCandidate } = require('../mining/forwardIntake');
const { classifyChat } = require('../mining/classifyChatJob');
const { getClassifier } = require('../mining/classifier');
const miningDb = require('../database/miningDb');
const CHAT_REGION = require('../mining/chatRegions');
const { CHAT_COUNTRY, DEFAULT_COUNTRY } = require('../mining/chatCountries');
const DECLINE_REASONS = require('../database/schema/Candidate').DECLINE_REASONS;

function arg(flag, def) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const PORT = parseInt(arg('--port', process.env.REVIEW_PORT || '4300'), 10);
const HOST = '127.0.0.1'; // localhost only — never exposed
const ADMIN_TG = Number(process.env.TELEGRAM_ADMIN_CHAT_ID) || 0;

function stubAdmin(req, _res, next) {
  req.user = { telegramID: ADMIN_TG || undefined, isAdmin: true };
  next();
}

async function main() {
  await runDB();
  const app = express();
  app.use(express.json());
  app.use(stubAdmin);

  // Review queue + actions (reuse prod handlers verbatim).
  app.get('/api/mining/candidates', listCandidates);
  app.post('/api/mining/candidates/:id/accept', acceptCandidate);
  app.post('/api/mining/candidates/:id/decline', declineCandidate);
  // Master-centric recommendation review (Phase 2).
  app.get('/api/mining/recommendation-buckets', listRecommendationBuckets);
  app.post('/api/mining/candidates/:id/attach', attachRecommendationToMaster);

  // Reference data for the accept-form dropdowns.
  app.get('/api/reference/professions', async (_req, res) => res.json(await Profession.find()));
  app.get('/api/reference/prof-categories', async (_req, res) => res.json(await ProfCategory.find()));
  app.get('/api/reference/locations', async (_req, res) => res.json(await Location.find()));
  app.get('/api/reference/countries', async (_req, res) => res.json(await Country.find()));
  app.post('/api/reference/professions', createProfession);
  app.post('/api/reference/locations', createLocation);
  app.post('/api/reference/prof-categories', createProfCategory);
  app.post('/api/admin/lexicon/rebuild', rebuildLexicon);

  // Source dropdown: distinct origins in the reviewable queue (raw+new).
  // 'forwarded' = bot-sent leads; otherwise one entry per mined chat (by chatID).
  app.get('/api/local/sources', async (_req, res) => {
    try {
      const Candidate = miningDb.Candidate();
      const rows = await Candidate.aggregate([
        { $match: { status: { $in: ['raw', 'new'] } } },
        { $group: { _id: { sourceType: '$sourceType', chatID: '$chatID' }, count: { $sum: 1 } } },
      ]);
      let forwarded = 0;
      const chats = new Map(); // chatID -> count
      for (const r of rows) {
        if (r._id.sourceType === 'forwarded') forwarded += r.count;
        else chats.set(r._id.chatID, (chats.get(r._id.chatID) || 0) + r.count);
      }
      const sources = [];
      if (forwarded) sources.push({ key: 'forwarded', label: '📨 Forwarded (bot)', count: forwarded });
      for (const [chatID, count] of [...chats.entries()].sort((a, b) => b[1] - a[1])) {
        sources.push({ key: 'chat:' + chatID, label: CHAT_REGION[chatID] || ('chat ' + chatID), count });
      }
      res.json({ sources });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Run the local LLM on a raw candidate's text -> status 'new'.
  app.post('/api/local/process/:id', async (req, res) => {
    try {
      const r = await processCandidate(req.params.id);
      res.json({ ok: true, ...r });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Paste -> store raw -> process immediately (you're at the machine with Ollama).
  app.post('/api/local/extract', async (req, res) => {
    const text = String((req.body && req.body.text) || '').trim();
    const chatTitle = (req.body && req.body.chatTitle) || null;
    if (!text) return res.status(400).json({ error: 'text required' });
    try {
      const { candidate, duplicate } = await storeRawForward({
        texts: [text],
        receivedMessageIDs: [],
        origin: { chatID: null, chatTitle, messageID: null },
        submitter: { telegramID: ADMIN_TG || null, name: 'local', isAdmin: true },
      });
      if (duplicate) return res.json({ ok: true, duplicate: true });
      const result = await processCandidate(String(candidate._id));
      res.json({
        ok: true,
        duplicate: false,
        duplicateMaster: result.duplicateMaster || null,
        summary: result.summary,
        candidateID: String(candidate._id),
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Sender lookup for the review card. We never stored the @username or numeric
  // id (docs/data-policy.md) — but Telegram exports carry @handles in message
  // TEXT, and the stored salted `fromHash` lets us cluster one author's messages.
  // So we return the display name + the @handles that author wrote across the
  // chat (strong hint for their own handle; could also be a referral — verify).
  let _RawMining = null;
  const rawMiningModel = () => {
    if (_RawMining) return _RawMining;
    const conn = mongoose.connection.useDb(miningDb.dbName);
    _RawMining =
      conn.models.RawMessage ||
      conn.model('RawMessage', require('../database/schema/RawMessage').schema);
    return _RawMining;
  };
  // Telegram usernames: 5–32 chars, start with a letter, [A-Za-z0-9_]. Pull both
  // bare @mentions and t.me/<handle> links; drop reserved/non-profile paths.
  const RESERVED = new Set(['c', 'joinchat', 'addstickers', 'share', 'proxy', 'iv', 'addemoji']);
  function handlesFromText(text) {
    const out = [];
    const t = String(text || '');
    const re = /(?:@|t\.me\/)([A-Za-z][A-Za-z0-9_]{3,31})\b/g;
    let m;
    while ((m = re.exec(t))) {
      const h = m[1];
      if (!RESERVED.has(h.toLowerCase())) out.push(h);
    }
    return out;
  }
  app.get('/api/local/sender/:id', async (req, res) => {
    try {
      const cand = await miningDb.Candidate().findById(req.params.id).lean();
      if (!cand) return res.status(404).json({ error: 'candidate_not_found' });
      let name = cand.responderName || (cand.submittedBy && cand.submittedBy.name) || null;
      const counts = new Map();
      const bump = (h) => counts.set(h, (counts.get(h) || 0) + 1);
      handlesFromText(cand.text).forEach(bump);

      // Cluster the author's own messages via fromHash → gather the handles they
      // used elsewhere too (the "quick search" for the poster's username).
      let authoredMessages = 0;
      if (cand.chatID && cand.anchorMessageID != null) {
        const Raw = rawMiningModel();
        const anchor = await Raw.findOne({
          chatID: String(cand.chatID),
          messageID: cand.anchorMessageID,
        })
          .select('fromName fromHash')
          .lean();
        if (anchor) {
          if (!name) name = anchor.fromName || null;
          if (anchor.fromHash) {
            const mine = await Raw.find({ chatID: String(cand.chatID), fromHash: anchor.fromHash })
              .select('text')
              .limit(500)
              .lean();
            authoredMessages = mine.length;
            for (const msg of mine) handlesFromText(msg.text).forEach(bump);
          }
        }
      }
      const handles = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([handle, count]) => ({ handle, count }));
      res.json({ name, handles, authoredMessages });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Bulk decline by handle: decline the current candidate AND every other queued
  // (raw/new) candidate that features the same master handle — clears a repeat
  // poster in one action. Mirrors declineCandidate (status + MiningFeedback).
  const normHandle = (h) => {
    if (!h) return '';
    let s = String(h).trim().replace(/^https?:\/\//i, '').replace(/^t\.me\//i, '').replace(/^@/, '');
    s = s.split(/[\/?\s]/)[0].toLowerCase();
    return /^[a-z0-9_]{3,32}$/.test(s) ? s : '';
  };
  const featuresHandle = (cand, norm) => {
    const re = new RegExp('(?:@|t\\.me/)' + norm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
    if (re.test(cand.text || '')) return true;
    const contacts = (cand.extracted && cand.extracted.contacts) || [];
    return contacts.some((x) => normHandle(x.value) === norm);
  };
  app.post('/api/local/decline-by-handle', async (req, res) => {
    try {
      const { handle, reasonCode, currentId, note } = req.body || {};
      if (!reasonCode || !DECLINE_REASONS.includes(reasonCode)) {
        return res.status(400).json({ error: 'bad_reasonCode', allowed: DECLINE_REASONS });
      }
      const norm = normHandle(handle);
      if (!norm) return res.status(400).json({ error: 'bad_handle' });

      const Candidate = miningDb.Candidate();
      const MiningFeedback = miningDb.MiningFeedback();
      const queue = await Candidate.find({ status: { $in: ['raw', 'new'] } })
        .select('text extracted classifierName classifierVersion')
        .lean();

      const ids = new Set();
      if (currentId) ids.add(String(currentId)); // the card you are on, always
      for (const c of queue) if (featuresHandle(c, norm)) ids.add(String(c._id));

      let declined = 0;
      for (const cid of ids) {
        const cand = await Candidate.findById(cid);
        if (!cand || cand.status === 'carded' || cand.status === 'declined') continue;
        cand.status = 'declined';
        cand.declineReason = reasonCode;
        await cand.save();
        await MiningFeedback.create({
          candidateRef: cand._id,
          action: 'decline',
          reasonCode,
          correctedFields: { note: note || ('bulk decline · @' + norm) },
          classifierName: cand.classifierName,
          classifierVersion: cand.classifierVersion,
          adminTelegramID: ADMIN_TG || undefined,
        });
        declined++;
      }
      res.json({ ok: true, handle: norm, declined });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- Mine a chat with a live progress bar (imported chat -> candidates) ---
  // One job at a time, tracked in memory. The classifier defaults to Ollama (this
  // IS the Ollama machine); override with CLASSIFIER=heuristic|haiku.
  let mineJob = null;
  const publicJob = () =>
    mineJob && {
      running: mineJob.running,
      chatID: mineJob.chatID,
      region: mineJob.region,
      classifier: mineJob.classifier,
      done: mineJob.done,
      total: mineJob.total,
      created: mineJob.created,
      useful: mineJob.useful,
      failed: mineJob.failed,
      lastName: mineJob.lastName,
      error: mineJob.error,
      startedAt: mineJob.startedAt,
      finishedAt: mineJob.finishedAt,
      graph: mineJob.graph
        ? {
            masters: Object.values(mineJob.graph.masters).slice(0, 200),
            edges: mineJob.graph.edges.slice(0, 600),
          }
        : { masters: [], edges: [] },
    };

  // Imported chats available to classify (from mining RawMessage), with message
  // and pending-candidate counts + a human region label.
  app.get('/api/local/mine/chats', async (_req, res) => {
    try {
      const [msgRows, candRows] = await Promise.all([
        miningDb.RawMessage().aggregate([{ $group: { _id: '$chatID', messages: { $sum: 1 } } }]),
        miningDb.Candidate().aggregate([
          { $match: { status: 'new' } },
          { $group: { _id: '$chatID', candidates: { $sum: 1 } } },
        ]),
      ]);
      const cand = new Map(candRows.map((r) => [String(r._id), r.candidates]));
      const chats = msgRows
        .map((r) => ({
          chatID: String(r._id),
          label: CHAT_REGION[String(r._id)] || String(r._id),
          messages: r.messages,
          candidates: cand.get(String(r._id)) || 0,
        }))
        .sort((a, b) => b.messages - a.messages);
      res.json({ chats });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/local/mine/start', async (req, res) => {
    const chatID = String((req.body && req.body.chatID) || '').trim();
    if (!chatID) return res.status(400).json({ error: 'chatID required' });
    if (mineJob && mineJob.running) {
      return res.status(409).json({ error: 'already_running', job: publicJob() });
    }
    let classifier;
    try {
      classifier = getClassifier(process.env.CLASSIFIER || 'ollama');
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    const region = CHAT_REGION[chatID] || chatID;
    mineJob = {
      running: true, chatID, region,
      classifier: classifier.name + ' ' + classifier.version,
      done: 0, total: 0, created: 0, useful: 0, failed: 0,
      lastName: null, error: null, stop: false,
      startedAt: Date.now(), finishedAt: null,
      graph: { masters: {}, edges: [], eseen: {} },
    };
    // Fire-and-forget: the UI polls /api/local/mine/progress for the bar.
    classifyChat({
      RawMessage: miningDb.RawMessage(),
      Candidate: miningDb.Candidate(),
      classifier, chatID, region,
      onProgress: (p) => {
        mineJob.done = p.done; mineJob.total = p.total;
        mineJob.created = p.created; mineJob.useful = p.useful; mineJob.failed = p.failed;
        if (p.name) mineJob.lastName = p.name;
        if (p.error) mineJob.error = p.error;
        // Accumulate the live graph: masters (recs = distinct recommenders) + edges.
        if (p.graph) {
          const g = mineJob.graph;
          const k = p.graph.masterKey;
          if (!g.masters[k]) g.masters[k] = { key: k, name: p.graph.masterName, recs: 0 };
          if (p.graph.recommender) {
            const ek = p.graph.recommender + '|' + k;
            if (!g.eseen[ek]) {
              g.eseen[ek] = 1;
              g.masters[k].recs++;
              if (g.edges.length < 600) g.edges.push({ r: p.graph.recommender, m: k });
            }
          }
        }
      },
      shouldStop: () => mineJob && mineJob.stop,
    })
      .then((r) => { mineJob.running = false; mineJob.finishedAt = Date.now(); mineJob.summary = r; })
      .catch((e) => { mineJob.running = false; mineJob.finishedAt = Date.now(); mineJob.error = e.message; });
    res.json({ ok: true, job: publicJob() });
  });

  app.post('/api/local/mine/stop', (_req, res) => {
    if (mineJob) mineJob.stop = true;
    res.json({ ok: true, job: publicJob() });
  });

  app.get('/api/local/mine/progress', (_req, res) => res.json({ job: publicJob() }));

  // Small config for the dashboard (country per chat → accept payload countryID).
  app.get('/api/local/config', (_req, res) =>
    res.json({ chatCountry: CHAT_COUNTRY, defaultCountry: DEFAULT_COUNTRY })
  );

  // Optional trust-graph view — the master-recommendation network. Synthetic
  // data for now (a preview of the shape); wire to the live Recommendation
  // collection once there is enough of it. Opens in its own tab from the header.
  app.get('/graph', (_req, res) => res.sendFile(path.join(__dirname, 'rec-graph.html')));

  app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'review-dashboard.html')));
  app.get('/dashboard.js', (_req, res) =>
    res.type('application/javascript').sendFile(path.join(__dirname, 'review-dashboard.js'))
  );

  app.listen(PORT, HOST, () => {
    console.log(`\n  Local review queue → http://${HOST}:${PORT}\n`);
    console.log(`  Text model: ${process.env.OLLAMA_MODEL || 'qwen2.5:14b'}`);
    console.log(`  Screenshots are shown on each card for manual reading (no OCR).`);
    console.log(`  Mongo connected. Open the URL, then Process raw items.\n`);
  });
}

// ---------------------------------------------------------------------------

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
