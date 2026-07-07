'use strict';

// Public read model for a master's recommendation quotes — feeds the card
// modal's quote carousel (Phase 3). Returns only recommendations that carry
// text; count-only endorsements move Master.recommendationCount (already on the
// card record) but are not quoted here.

const mongoose = require('mongoose');
const Recommendation = require('../database/schema/Recommendation');

// Public display of a recommender: first name + initial ("Богдан Сергійович" →
// "Богдан С."; "Ірина П." stays "Ірина П."; single token unchanged). Per the
// data-policy amendment — never the full surname or @handle. '' → '' (the client
// falls back to "Анонімно").
function firstNameInitial(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0]}.`;
}

// t.me link to the source message, when the chat id is numeric. Supergroups are
// stored as -100XXXXXXXXXX; the public deep link drops the -100 prefix. Synthetic
// ids ("forward:…") have no link → null (the "view in chat" link is omitted).
function telegramMessageHref(chatID, messageID) {
  if (chatID == null || messageID == null) return null;
  const s = String(chatID);
  let internal = null;
  if (/^-100\d+$/.test(s)) internal = s.slice(4);
  else if (/^-\d+$/.test(s)) internal = s.slice(1);
  else if (/^\d+$/.test(s)) internal = s;
  else return null;
  return `https://t.me/c/${internal}/${messageID}`;
}

// GET /api/master/:id/recommendations  (public)
async function getMasterRecommendations(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: 'bad_id' });
  }
  const recs = await Recommendation.find({ masterID: id, text: { $ne: '' } })
    .sort({ createdAt: -1 })
    .limit(24)
    .lean();
  res.json({
    recommendations: recs.map((r) => ({
      author: firstNameInitial(r.authorName),
      text: r.text,
      href: telegramMessageHref(r.sourceChatID, r.sourceMessageID),
    })),
  });
}

module.exports = {
  getMasterRecommendations,
  // Exported for tests.
  _firstNameInitial: firstNameInitial,
  _telegramMessageHref: telegramMessageHref,
};
