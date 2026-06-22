// --- Forwarded-lead intake (forward chat messages -> review queue) ---
// Telegram delivers each forwarded message as its own update, so a Q+A pair
// arrives as a rapid burst. We buffer per chat and flush once the burst goes
// quiet, bundling the messages into a single Candidate.

const User = require('../database/schema/User');
const i18n = require('../i18n');
// Required as module objects (not destructured) so the test suite can stub
// the network/DB calls with vi.spyOn.
const forwardIntake = require('../mining/forwardIntake');
const telegramFileToS3 = require('../helpers/telegramFileToS3');
const { EmptyForwardError } = require('../mining/forwardIntake');
const { bot, getUserLang, TELEGRAM_ADMIN_CHAT_ID } = require('./instance');

const FORWARD_DEBOUNCE_MS = 9000;
// Spam guard for non-admin submitters: max bundles per rolling window.
const FORWARD_RATELIMIT_MAX = 12;
const FORWARD_RATELIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
// Hard cap per buffered bundle: a pathological burst flushes early instead of
// growing the in-memory buffer without bound.
const FORWARD_BUFFER_MAX_ITEMS = 30;
const _forwardBuffers = new Map(); // chatId -> { items:[], timer, from }
const _forwardRateLog = new Map(); // telegramID -> [timestamps]

// The rate log only ever grew: one entry per submitter, kept forever. Sweep
// expired windows hourly so the map doesn't leak across months of uptime.
const _rateLogSweep = setInterval(() => {
  const now = Date.now();
  for (const [id, timestamps] of _forwardRateLog) {
    const live = timestamps.filter((t) => now - t < FORWARD_RATELIMIT_WINDOW_MS);
    if (live.length) _forwardRateLog.set(id, live);
    else _forwardRateLog.delete(id);
  }
}, 60 * 60 * 1000);
_rateLogSweep.unref();

// forward_date is set on EVERY forward regardless of the origin's privacy
// settings, so it is the reliable detector; the rest cover older/newer Bot API
// field shapes.
function isForwarded(message) {
  return !!(
    message.forward_date ||
    message.forward_origin ||
    message.forward_from ||
    message.forward_from_chat ||
    message.forward_sender_name ||
    // A shared/forwarded contact card (a third party's number) is a lead — but
    // NOT the sender sharing their OWN phone (the onboarding "share contact"
    // step, where contact.user_id === the sender). That self-share must be
    // ignored, not queued as a mined lead.
    (message.contact &&
      !(message.from && message.contact.user_id === message.from.id))
  );
}

// Best-effort origin: chat id + title (the city hint) and the source message
// id. Present for channels / public supergroups; absent for private groups and
// users who hide their account, in which case the admin sets the city in review.
function readForwardOrigin(message) {
  const o = message.forward_origin;
  if (o && o.chat) {
    return { chatID: o.chat.id, chatTitle: o.chat.title || null, messageID: o.message_id || null };
  }
  if (message.forward_from_chat) {
    return {
      chatID: message.forward_from_chat.id,
      chatTitle: message.forward_from_chat.title || null,
      messageID: message.forward_from_message_id || null,
    };
  }
  return { chatID: null, chatTitle: null, messageID: null };
}

// Buffer a forwarded message and (re)arm the debounce so a Q+A burst lands as
// one bundle. Flush runs after the burst goes quiet — or immediately when the
// bundle hits FORWARD_BUFFER_MAX_ITEMS.
function bufferForward(message) {
  const chatId = message.chat.id;
  let text = message.text || message.caption || '';
  // A forwarded Telegram contact card (often the "answer" with the master's
  // number) has no text — pull the name + phone out of message.contact so the
  // extractor still sees it.
  if (!text && message.contact) {
    const ct = message.contact;
    text =
      [[ct.first_name, ct.last_name].filter(Boolean).join(' '), ct.phone_number]
        .filter(Boolean)
        .join(' — ')
        .trim();
  }
  const origin = readForwardOrigin(message);

  // Largest photo size, or an image sent as a document. Stored as file_id; the
  // bytes are downloaded to S3 at flush time.
  const photo =
    Array.isArray(message.photo) && message.photo.length
      ? message.photo[message.photo.length - 1]
      : null;
  const photoFileId = photo
    ? photo.file_id
    : message.document && /^image\//.test(message.document.mime_type || '')
      ? message.document.file_id
      : null;

  let entry = _forwardBuffers.get(chatId);
  if (!entry) {
    entry = { items: [], timer: null, from: message.from || null };
    _forwardBuffers.set(chatId, entry);
  }
  entry.items.push({ text, messageID: message.message_id, origin, photoFileId });
  if (entry.timer) clearTimeout(entry.timer);

  if (entry.items.length >= FORWARD_BUFFER_MAX_ITEMS) {
    _forwardBuffers.delete(chatId);
    flushForwardBundle(chatId, entry).catch((err) =>
      console.error('[forward] flush failed:', err)
    );
    return;
  }

  entry.timer = setTimeout(() => {
    _forwardBuffers.delete(chatId);
    flushForwardBundle(chatId, entry).catch((err) =>
      console.error('[forward] flush failed:', err)
    );
  }, FORWARD_DEBOUNCE_MS);
}

// Sliding-window rate check. Admins are exempt (passed isAdmin=true).
function allowForward(telegramID, isAdmin) {
  if (isAdmin) return true;
  const now = Date.now();
  const log = (_forwardRateLog.get(telegramID) || []).filter(
    (t) => now - t < FORWARD_RATELIMIT_WINDOW_MS
  );
  if (log.length >= FORWARD_RATELIMIT_MAX) {
    _forwardRateLog.set(telegramID, log);
    return false;
  }
  log.push(now);
  _forwardRateLog.set(telegramID, log);
  return true;
}

async function flushForwardBundle(chatId, entry) {
  const lang = await getUserLang(chatId);

  const user = await User.findOne({ telegramID: chatId })
    .select('isAdmin')
    .lean()
    .catch(() => null);
  const isAdmin = Boolean(
    (user && user.isAdmin) ||
      (TELEGRAM_ADMIN_CHAT_ID && String(chatId) === String(TELEGRAM_ADMIN_CHAT_ID))
  );

  if (!allowForward(chatId, isAdmin)) {
    return void bot.sendMessage(chatId, i18n.t(lang, 'forward.ratelimited'));
  }

  const from = entry.from || {};
  const submitterName =
    [from.first_name, from.last_name].filter(Boolean).join(' ') ||
    from.username ||
    null;

  // The first item carrying an origin chat wins as the city hint / anchor.
  const origin =
    entry.items.map((i) => i.origin).find((o) => o && (o.chatID || o.chatTitle)) ||
    entry.items[0].origin;

  // Persist any forwarded screenshots to S3 now — the temporary Telegram file
  // URL would be gone by the time the reviewer's machine OCRs them. Uploads
  // run in parallel; forwardPhotoToS3 never throws (resolves null on failure),
  // and allSettled preserves input order.
  const results = await Promise.allSettled(
    entry.items
      .filter((it) => it.photoFileId)
      .map((it) => telegramFileToS3.forwardPhotoToS3(it.photoFileId, 'fwd' + chatId))
  );
  const images = results
    .filter((r) => r.status === 'fulfilled' && r.value)
    .map((r) => r.value);

  try {
    // Store RAW only — no LLM here. The bot runs on a server with no Ollama;
    // extraction happens later on the reviewer's machine (npm run review).
    const { duplicate } = await forwardIntake.storeRawForward({
      texts: entry.items.map((i) => i.text),
      receivedMessageIDs: entry.items.map((i) => i.messageID),
      origin,
      submitter: { telegramID: chatId, name: submitterName, isAdmin },
      images,
    });

    if (duplicate) {
      return void bot.sendMessage(chatId, i18n.t(lang, 'forward.duplicate'));
    }

    await bot.sendMessage(
      chatId,
      i18n.t(lang, 'forward.savedRaw', {
        count: entry.items.length,
        images: images.length,
      })
    );

    notifyAdminOfForward(submitterName, isAdmin, images.length).catch((e) =>
      console.error('[forward] admin notify failed:', e.message)
    );
  } catch (err) {
    if (err instanceof EmptyForwardError) {
      return void bot.sendMessage(chatId, i18n.t(lang, 'forward.empty'));
    }
    console.error('[forward] intake error:', err);
    bot.sendMessage(chatId, i18n.t(lang, 'forward.error'));
  }
}

// Ping the admin chat so forwarded leads get processed/reviewed. Skipped when
// the admin is the one who forwarded (no self-ping) or when no admin chat is set.
async function notifyAdminOfForward(submitterName, submitterIsAdmin, imageCount) {
  if (!TELEGRAM_ADMIN_CHAT_ID || submitterIsAdmin) return;
  const lines = [
    '🆕 Lead forwarded for review',
    `From: ${submitterName || 'unknown'}`,
    imageCount ? `Screenshots: ${imageCount}` : '',
    'Open the local review tool to process it (npm run review).',
  ].filter(Boolean);
  await bot.sendMessage(TELEGRAM_ADMIN_CHAT_ID, lines.join('\n'));
}

module.exports = {
  isForwarded,
  readForwardOrigin,
  bufferForward,
  allowForward,
  flushForwardBundle,
  notifyAdminOfForward,
  // Exposed for tests
  FORWARD_DEBOUNCE_MS,
  FORWARD_RATELIMIT_MAX,
  FORWARD_RATELIMIT_WINDOW_MS,
  FORWARD_BUFFER_MAX_ITEMS,
  _forwardBuffers,
  _forwardRateLog,
};
