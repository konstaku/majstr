'use strict';

// Pure parser for a Telegram Desktop JSON export (`result.json`).
//
// Pure on purpose: takes the already-parsed export object, returns normalized
// records + stats, touches no DB/FS/env. That keeps it deterministically
// unit-testable (M7) and keeps the hashing/persistence concern in the CLI.
//
// IMPORTANT: each normalized message carries `_fromId` (the raw Telegram
// author id). This is TRANSIENT and must NEVER be persisted — the CLI maps it
// to a salted hash and drops it before any DB write. See docs/data-policy.md.

// Telegram Desktop puts message text in two forms:
//   - `text`: a string OR an array mixing plain strings and {type,text} objects
//   - `text_entities`: always the normalized array form [{type,text}]
// We rebuild from `text_entities` (robust: keeps the visible text of links,
// mentions, bold, etc.) and fall back to `text`.
function reconstructText(msg) {
  if (Array.isArray(msg.text_entities) && msg.text_entities.length) {
    return msg.text_entities.map((e) => (e && e.text) || '').join('');
  }
  if (typeof msg.text === 'string') return msg.text;
  if (Array.isArray(msg.text)) {
    return msg.text
      .map((p) => (typeof p === 'string' ? p : (p && p.text) || ''))
      .join('');
  }
  return '';
}

function parseExport(exportObj) {
  if (!exportObj || !Array.isArray(exportObj.messages)) {
    throw new Error('Not a Telegram Desktop export: missing messages[]');
  }

  const chat = {
    id: String(exportObj.id),
    name: exportObj.name || null,
    type: exportObj.type || null,
  };

  const stats = { total: 0, parsed: 0, service: 0, empty: 0 };
  const messages = [];

  for (const m of exportObj.messages) {
    stats.total += 1;

    if (m.type === 'service') {
      stats.service += 1;
      continue;
    }

    const text = reconstructText(m).trim();
    if (!text) {
      // Media-only / sticker / empty — cannot be a recommendation.
      stats.empty += 1;
      continue;
    }

    const unix = Number(m.date_unixtime);
    messages.push({
      chatID: chat.id,
      messageID: m.id,
      date: Number.isFinite(unix) ? new Date(unix * 1000) : new Date(m.date),
      text,
      replyToID: m.reply_to_message_id != null ? m.reply_to_message_id : null,
      ingestSource: 'export',
      _fromId: m.from_id != null ? String(m.from_id) : null, // transient
    });
    stats.parsed += 1;
  }

  return { chat, messages, stats };
}

module.exports = { parseExport, reconstructText };
