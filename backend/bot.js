require('dotenv').config();
const express = require('express');
const https = require('https');
const fs = require('fs');
const AWS = require('aws-sdk');
const TelegramBot = require('node-telegram-bot-api');
const jwt = require('jsonwebtoken');
const User = require('./database/schema/User');
const Master = require('./database/schema/Master');
const MasterClaim = require('./database/schema/MasterClaim');
const MasterAudit = require('./database/schema/MasterAudit');
const i18n = require('./i18n');
const { masterWebUrl } = require('./helpers/masterUrl');
const { storeRawForward, EmptyForwardError } = require('./mining/forwardIntake');
const { forwardPhotoToS3 } = require('./helpers/telegramFileToS3');

// Pull a known UI language out of a /start or startapp payload, e.g.
// "add-it" -> "it", "onboard_en" -> "en", "ru" -> "ru". null if none.
function parseLangFromPayload(payload) {
  if (!payload) return null;
  for (const tok of String(payload).split(/[^a-zA-Z]+/)) {
    if (i18n.UI_LANGS.includes(tok.toLowerCase())) return tok.toLowerCase();
  }
  return null;
}

async function getUserLang(telegramID) {
  const u = await User.findOne({ telegramID }).select('uiLanguage').lean();
  return i18n.normalizeLang(u?.uiLanguage);
}

const CERTIFICATE = process.env.CERTIFICATE;
const KEYFILE = process.env.KEYFILE;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const JWT_ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_TOKEN_SECRET;
const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
// Mini App (onboarding wizard) host and public website host. Defaults are
// the prod values so behaviour is unchanged if unset; staging overrides
// both to its own domain to fully isolate the dev bot.
const TMA_BASE_URL = process.env.TMA_BASE_URL || 'https://app.majstr.xyz';
const PUBLIC_WEB_URL = process.env.PUBLIC_WEB_URL || 'https://majstr.xyz';
const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET || '';
const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const PORT_NUMBER = 8443;

// --- Forwarded-lead intake (forward chat messages -> review queue) ---
// Telegram delivers each forwarded message as its own update, so a Q+A pair
// arrives as a rapid burst. We buffer per chat and flush once the burst goes
// quiet, bundling the messages into a single Candidate.
const FORWARD_DEBOUNCE_MS = 4000;
// Spam guard for non-admin submitters: max bundles per rolling window.
const FORWARD_RATELIMIT_MAX = 12;
const FORWARD_RATELIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const _forwardBuffers = new Map(); // chatId -> { items:[], timer, from }
const _forwardRateLog = new Map(); // telegramID -> [timestamps]

const s3 = new AWS.S3({
  accessKeyId: AWS_ACCESS_KEY,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
});

const bot = new TelegramBot(BOT_TOKEN);

const SUPPORTED_LANGUAGES = [
  { code: 'uk', label: '🇺🇦 UA' },
  { code: 'it', label: '🇮🇹 IT' },
  { code: 'en', label: '🇬🇧 EN' },
  { code: 'pt', label: '🇵🇹 PT' },
  { code: 'de', label: '🇩🇪 DE' },
  { code: 'fr', label: '🇫🇷 FR' },
  { code: 'es', label: '🇪🇸 ES' },
  { code: 'pl', label: '🇵🇱 PL' },
];

const AVAILABILITY_LABELS = {
  available: '🟢 Доступний зараз',
  next_week: '🟡 З наступного тижня',
  busy: '🔴 Зайнятий',
};

async function runBot() {
  // One-glance environment fingerprint. Bot id (digits before ':') is the
  // bot's public id, not a secret. Makes prod/staging misconfig obvious.
  console.log(
    `[boot] bot id=${BOT_TOKEN ? String(BOT_TOKEN).split(':')[0] : 'none'} ` +
      `TMA_BASE_URL=${TMA_BASE_URL} PUBLIC_WEB_URL=${PUBLIC_WEB_URL} ` +
      `FRONTEND_URL=${FRONTEND_URL}`
  );
  if (!BOT_TOKEN) {
    console.log('TELEGRAM_BOT_TOKEN not set — bot disabled');
    return;
  }
  if (WEBHOOK_URL) {
    const app = express();
    app.use(express.json());
    const httpsOptions = {
      key: fs.readFileSync(KEYFILE),
      cert: fs.readFileSync(CERTIFICATE),
    };
    const httpsServer = https.createServer(httpsOptions, app);
    await bot.setWebHook(`${WEBHOOK_URL}:${PORT_NUMBER}/webhook`);
    bot.on('webhook_error', console.error);
    app.post('/webhook', async (req, res) => await handleWebhook(req, res, bot));
    httpsServer
      .listen(PORT_NUMBER, () =>
        console.log(`Telegram bot started on port ${PORT_NUMBER}`)
      )
      .on('error', (err) => {
        console.log('Error starting telegram bot server:', err);
      });
  } else {
    await bot.deleteWebHook();
    bot.startPolling();
    bot.on('polling_error', (err) => {
      console.error('[polling_error]', err.message);
      // 409 means another instance is still running. Exit so the process
      // manager can restart us after the old process is gone.
      if (err.message && err.message.includes('409 Conflict')) {
        console.error('Polling conflict — another instance running. Exiting.');
        process.exit(1);
      }
    });
    bot.on('message', handleMessage);
    bot.on('callback_query', handleCallbackQuery);
    console.log('Telegram bot started in polling mode');
  }
}

module.exports = {
  bot,
  runBot,
};

async function handleWebhook(req, res, bot) {
  console.log('Webhook triggered!');
  console.log('request body:', req.body);

  if (req.body.callback_query) {
    await handleCallbackQuery(req.body.callback_query);
    return res.status(200).send('OK');
  }

  const message = req.body.message;

  if (!message) {
    console.log('Webhook activated, but no message detected');
    return res.status(200).send('OK');
  }

  await handleMessage(message);
  res.status(200).send('OK');
}

async function handleMessage(message) {
  // Mini App data submissions are not user text commands — ignore silently.
  if (message.web_app_data) return;

  // Forwarded message(s) are leads to mine, not commands. Route before the
  // command switch so a forwarded "/start" can't be misread as a command.
  if (isForwarded(message)) {
    bufferForward(message);
    return;
  }

  const chatId = message.chat.id;
  const text = message.text || '';

  // /start may carry a payload after a space — handle before the switch.
  if (text === '/start' || text.startsWith('/start ')) {
    const payload = text.startsWith('/start ') ? text.slice(7).trim() : null;
    await handleStart(message, payload);
    return;
  }

  switch (text) {
    case '/available':
      await setAvailability(chatId, 'available');
      break;
    case '/nextweek':
      await setAvailability(chatId, 'next_week');
      break;
    case '/busy':
      await setAvailability(chatId, 'busy');
      break;
    case '/status':
      await showStatus(chatId);
      break;
    case '/languages':
      await showLanguageSelector(chatId);
      break;
    default: {
      // Only reply to messages that look like commands (/foo). Ignore plain
      // text, stickers, media, service messages, and empty strings from TMA.
      if (!text.startsWith('/')) break;
      console.log('Unknown command:', text);
      const lang = await getUserLang(chatId);
      bot.sendMessage(chatId, i18n.t(lang, 'unknownCommand'));
    }
  }
}

// ---------------------------------------------------------------------------
// Forwarded-lead intake
// ---------------------------------------------------------------------------

// forward_date is set on EVERY forward regardless of the origin's privacy
// settings, so it is the reliable detector; the rest cover older/newer Bot API
// field shapes.
function isForwarded(message) {
  return !!(
    message.forward_date ||
    message.forward_origin ||
    message.forward_from ||
    message.forward_from_chat ||
    message.forward_sender_name
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
// one bundle. Flush runs after the burst goes quiet.
function bufferForward(message) {
  const chatId = message.chat.id;
  const text = message.text || message.caption || '';
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
  const isAdmin =
    !!(user && user.isAdmin) ||
    (TELEGRAM_ADMIN_CHAT_ID && String(chatId) === String(TELEGRAM_ADMIN_CHAT_ID));

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
  // URL would be gone by the time the reviewer's machine OCRs them.
  const images = [];
  for (const it of entry.items) {
    if (it.photoFileId) {
      const up = await forwardPhotoToS3(it.photoFileId, 'fwd' + chatId);
      if (up) images.push(up);
    }
  }

  try {
    // Store RAW only — no LLM here. The bot runs on a server with no Ollama;
    // extraction happens later on the reviewer's machine (npm run review).
    const { duplicate } = await storeRawForward({
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

async function handleStart(message, payload) {
  console.log('Looking for a user with an ID of:', message.chat.id);

  const explicitLang = parseLangFromPayload(payload);
  const tgLang = i18n.mapTgLang(message.from?.language_code);

  const registeredUser = await User.findOne({ telegramID: message.chat.id });

  if (registeredUser) {
    console.log('User already registered! ID:', registeredUser._id);
    // A language from a localized website link wins; otherwise keep the
    // user's existing (possibly manually chosen) preference.
    const lang = i18n.normalizeLang(
      explicitLang || registeredUser.uiLanguage || tgLang
    );
    if (lang !== registeredUser.uiLanguage) {
      registeredUser.uiLanguage = lang;
      await registeredUser.save().catch(() => {});
    }
    return sendLoginLink(message.chat.id, registeredUser.token, lang);
  }

  console.log('Welcome new user!, ID:', message.chat.id);
  const lang = i18n.normalizeLang(explicitLang || tgLang);
  const token = createTokenForUser(message);
  const userPhoto = await fetchUserTelegramPhoto(message);
  await addUserToDatabase(message, userPhoto, token, lang);
  sendLoginLink(message.chat.id, token, lang);
}

async function setAvailability(chatId, availability) {
  const lang = await getUserLang(chatId);
  const masters = await Master.find({ telegramID: chatId, status: 'approved' });

  if (!masters.length) {
    return bot.sendMessage(chatId, i18n.t(lang, 'avail.none'));
  }

  await Master.updateMany({ telegramID: chatId, status: 'approved' }, { availability });
  bot.sendMessage(
    chatId,
    i18n.t(lang, 'avail.updated', { label: i18n.t(lang, `avail.${availability}`) })
  );
}

async function showStatus(chatId) {
  const lang = await getUserLang(chatId);
  const masters = await Master.find({ telegramID: chatId, status: 'approved' });

  if (!masters.length) {
    return bot.sendMessage(chatId, i18n.t(lang, 'avail.none'));
  }

  const master = masters[0];
  const availLabel = master.availability
    ? i18n.t(lang, `avail.${master.availability}`)
    : i18n.t(lang, 'status.notset');
  const langs =
    master.languages && master.languages.length
      ? master.languages
          .map((l) => SUPPORTED_LANGUAGES.find((s) => s.code === l)?.label ?? l)
          .join(', ')
      : i18n.t(lang, 'status.notset');

  bot.sendMessage(
    chatId,
    i18n.t(lang, 'status.line', { avail: availLabel, langs })
  );
}

function buildLanguageKeyboard(currentLanguages, uiLang) {
  const langs = currentLanguages || [];
  const buttons = SUPPORTED_LANGUAGES.map(({ code, label }) => ({
    text: langs.includes(code) ? `✅ ${label}` : label,
    callback_data: `lang:${code}`,
  }));

  const rows = [];
  for (let i = 0; i < buttons.length; i += 4) {
    rows.push(buttons.slice(i, i + 4));
  }
  rows.push([{ text: i18n.t(uiLang, 'langs.save'), callback_data: 'lang:save' }]);
  return { inline_keyboard: rows };
}

async function showLanguageSelector(chatId) {
  const uiLang = await getUserLang(chatId);
  const masters = await Master.find({ telegramID: chatId, status: 'approved' });

  if (!masters.length) {
    return bot.sendMessage(chatId, i18n.t(uiLang, 'avail.none'));
  }

  const currentLanguages = masters[0].languages || [];
  bot.sendMessage(chatId, i18n.t(uiLang, 'langs.prompt'), {
    reply_markup: buildLanguageKeyboard(currentLanguages, uiLang),
  });
}

async function handleCallbackQuery(callbackQuery) {
  const { id: queryId, message, data, from } = callbackQuery;
  if (!data) {
    return bot.answerCallbackQuery(queryId, { text: 'Невідома дія' });
  }
  if (data.startsWith('claim:')) {
    return handleClaimCallback(queryId, message, data, from);
  }
  if (data.startsWith('master:')) {
    return handleMasterCallback(queryId, message, data, from);
  }
  if (data.startsWith('uilang:')) {
    return handleUiLangCallback(queryId, message, data, from);
  }
  if (!data.startsWith('lang:')) {
    console.log('Unknown callback data:', data);
    return bot.answerCallbackQuery(queryId, { text: 'Невідома дія' });
  }

  const chatId = message.chat.id;
  const uiLang = await getUserLang(chatId);
  const langCode = data.slice(5);

  if (langCode === 'save') {
    const masters = await Master.find({ telegramID: chatId, status: 'approved' });
    const langs = masters[0]?.languages || [];
    const langLabels =
      langs.map((l) => SUPPORTED_LANGUAGES.find((s) => s.code === l)?.label ?? l).join(', ') ||
      '—';
    await bot.answerCallbackQuery(queryId, { text: i18n.t(uiLang, 'lang.switched') });
    return bot.editMessageText(i18n.t(uiLang, 'langs.saved', { labels: langLabels }), {
      chat_id: chatId,
      message_id: message.message_id,
    });
  }

  const masters = await Master.find({ telegramID: chatId, status: 'approved' });
  if (!masters.length) {
    return bot.answerCallbackQuery(queryId, { text: i18n.t(uiLang, 'avail.none') });
  }

  const currentLangs = masters[0].languages || [];
  const newLangs = currentLangs.includes(langCode)
    ? currentLangs.filter((l) => l !== langCode)
    : [...currentLangs, langCode];

  await Master.updateMany({ telegramID: chatId, status: 'approved' }, { languages: newLangs });

  await bot.answerCallbackQuery(queryId, { text: '' });
  await bot.editMessageReplyMarkup(buildLanguageKeyboard(newLangs, uiLang), {
    chat_id: chatId,
    message_id: message.message_id,
  });
}

// Welcome keyboard. "Add master" is the primary CTA — first and alone on
// its own full-width row so it's the biggest/most prominent control. Then
// the uk/en/ru language switch, then the website link.
function buildWelcomeKeyboard(lang, token) {
  const encodedToken = encodeURIComponent(JSON.stringify(token));
  return {
    inline_keyboard: [
      [
        {
          text: i18n.t(lang, 'btn.addMaster'),
          web_app: { url: `${TMA_BASE_URL}/onboard?lng=${lang}` },
        },
      ],
      ...i18n.langKeyboardRows(lang),
      [
        {
          text: i18n.t(lang, 'btn.loginSite'),
          url: `${FRONTEND_URL}/login?token=${encodedToken}&path=add&lng=${lang}`,
        },
      ],
    ],
  };
}

function sendLoginLink(id, token, lang) {
  const L = i18n.normalizeLang(lang);
  bot.sendMessage(id, i18n.t(L, 'welcome.body'), {
    reply_markup: buildWelcomeKeyboard(L, token),
  }).catch((err) => console.error('[sendLoginLink] failed:', err.message));
}

function createTokenForUser(message) {
  const token = jwt.sign(
    {
      userID: message.chat.id,
      firstName: message.chat.first_name,
      username: message.chat.username,
    },
    JWT_ACCESS_TOKEN_SECRET
  );

  console.log('=== Token generated ===\n', JSON.stringify(token));
  return token;
}

async function fetchUserTelegramPhoto(message) {
  const fetchPhotoIdUrl = `https://api.telegram.org/bot${BOT_TOKEN}/getUserProfilePhotos`;
  const fetchPhotoPathUrl = `https://api.telegram.org/bot${BOT_TOKEN}/getFile`;

  // The options needed by telegram API to process a fetch photo ID request
  const fetchPhotoIdOptions = {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'User-Agent':
        'Telegram Bot SDK - (https://github.com/irazasyed/telegram-bot-sdk)',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      user_id: message.chat.id,
      limit: 1,
    }),
  };

  // Get user profile photo file ID from telegram api
  console.log(`Fetching photos for user ${message.chat.id}`);
  const photoID = await fetch(fetchPhotoIdUrl, fetchPhotoIdOptions)
    .then((response) => response.json())
    .then((data) => {
      if (data.result.total_count === 0) {
        return null;
      }
      return data.result.photos[0][1].file_id;
    })
    .catch(console.error);
  console.log('Photo ID obtained:', photoID);

  // If there is no photo ID, return null
  if (photoID === null) {
    return null;
  }

  // Now when we have a photo ID, we can create the options to process a photo path request
  const fetchPhotoPathOptions = {
    ...fetchPhotoIdOptions,
    body: JSON.stringify({
      file_id: photoID,
    }),
  };

  // Get user telegram photo path
  const photoPath = await fetch(fetchPhotoPathUrl, fetchPhotoPathOptions)
    .then((response) => response.json())
    .then((data) => data.result.file_path)
    .catch(console.error);
  console.log('Photo path obtained:', photoPath);

  // Now we can construct the final photo URL and download the user photo
  const telegramPhotoUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${photoPath}`;
  return fetch(telegramPhotoUrl)
    .then((response) => response.blob())
    .then((blob) => blob.arrayBuffer())
    .then(Buffer.from)
    .catch(console.error);
}

async function handleUiLangCallback(queryId, message, data, from) {
  const code = i18n.normalizeLang(data.slice('uilang:'.length));
  const chat_id = message.chat.id;
  const message_id = message.message_id;

  const user = await User.findOneAndUpdate(
    { telegramID: from.id },
    { $set: { uiLanguage: code } },
    { new: true }
  );

  await bot.answerCallbackQuery(queryId, { text: i18n.t(code, 'lang.switched') });

  await bot.editMessageText(i18n.t(code, 'welcome.body'), {
    chat_id,
    message_id,
    reply_markup: buildWelcomeKeyboard(code, user && user.token),
  }).catch((err) => console.error('[uilang] edit failed:', err.message));
}

async function handleMasterCallback(queryId, message, data, from) {
  // data format: master:approve:<masterID> or master:decline:<masterID>
  const [, action, masterId] = data.split(':');
  if (!masterId || !['approve', 'decline'].includes(action)) {
    return bot.answerCallbackQuery(queryId, { text: 'Невідома дія' });
  }

  const master = await Master.findById(masterId);
  if (!master) {
    return bot.answerCallbackQuery(queryId, { text: 'Картку не знайдено' });
  }
  if (master.status !== 'pending') {
    await bot.answerCallbackQuery(queryId, { text: `Вже ${master.status}` });
    return bot.editMessageText(`${message.text}\n\nℹ️ Вже оброблено (${master.status}).`, {
      chat_id: message.chat.id,
      message_id: message.message_id,
    }).catch(() => {});
  }

  const adminUser = await User.findOne({ telegramID: from.id });

  if (action === 'approve') {
    master.status = 'approved';
    master.approvedAt = new Date();
    await master.save();

    await MasterAudit.create({
      masterID: master._id,
      actorUserID: adminUser?._id,
      actorTelegramID: from.id,
      action: 'approve',
      from: 'pending',
      to: 'approved',
      reason: 'approved by admin',
    }).catch(err => console.error('Failed to write approve audit row:', err));

    await bot.answerCallbackQuery(queryId, { text: '✅ Схвалено' });
    await bot.editMessageText(
      `${message.text}\n\n✅ Схвалено — ${from.first_name}`,
      { chat_id: message.chat.id, message_id: message.message_id }
    ).catch(() => {});

    // Flush the Next.js ISR cache so the new master page is live immediately.
    // Awaited so the cache is warm before the notification URL is sent.
    if (REVALIDATE_SECRET) {
      await fetch(`${PUBLIC_WEB_URL}/api/revalidate?secret=${REVALIDATE_SECRET}`, { method: 'POST' })
        .catch(err => console.error('[revalidate] failed:', err.message));
    }

    if (master.telegramID) {
      const oLang = await getUserLang(master.telegramID);
      bot.sendMessage(
        master.telegramID,
        i18n.t(oLang, 'owner.approved', {
          url: masterWebUrl(master, oLang, PUBLIC_WEB_URL),
        })
      ).catch(() => {});
    }
  } else {
    master.status = 'rejected';
    master.rejectedAt = new Date();
    await master.save();

    await MasterAudit.create({
      masterID: master._id,
      actorUserID: adminUser?._id,
      actorTelegramID: from.id,
      action: 'reject',
      from: 'pending',
      to: 'rejected',
      reason: 'declined by admin',
    }).catch(err => console.error('Failed to write reject audit row:', err));

    await bot.answerCallbackQuery(queryId, { text: '❌ Відхилено' });
    await bot.editMessageText(
      `${message.text}\n\n❌ Відхилено — ${from.first_name}`,
      { chat_id: message.chat.id, message_id: message.message_id }
    ).catch(() => {});

    if (master.telegramID) {
      const oLang = await getUserLang(master.telegramID);
      bot.sendMessage(
        master.telegramID,
        i18n.t(oLang, 'owner.declined')
      ).catch(() => {});
    }
  }
}

async function handleClaimCallback(queryId, message, data, from) {
  // data format: claim:approve:<claimID> or claim:decline:<claimID>
  const [, action, claimId] = data.split(':');
  if (!claimId || !['approve', 'decline'].includes(action)) {
    return bot.answerCallbackQuery(queryId, { text: 'Невідома дія' });
  }

  const claim = await MasterClaim.findById(claimId);
  if (!claim) {
    return bot.answerCallbackQuery(queryId, { text: 'Claim not found' });
  }
  if (claim.status !== 'pending') {
    await bot.answerCallbackQuery(queryId, { text: `Already ${claim.status}` });
    return bot.editMessageText(`Already ${claim.status}.`, {
      chat_id: message.chat.id,
      message_id: message.message_id,
    });
  }

  const adminUser = await User.findOne({ telegramID: from.id });

  if (action === 'approve') {
    const master = await Master.findById(claim.masterID);
    const previousOwnerID = master?.ownerUserID || null;

    await Master.findByIdAndUpdate(claim.masterID, {
      ownerUserID: claim.claimantUserID,
      telegramID: claim.claimantTelegramID,
      claimable: false,
      claimedAt: new Date(),
    });

    claim.status = 'approved';
    claim.reviewedBy = adminUser?._id;
    claim.reviewedAt = new Date();
    await claim.save();

    await MasterAudit.create({
      masterID: claim.masterID,
      actorUserID: adminUser?._id,
      actorTelegramID: from.id,
      action: 'edit',
      diff: { ownerUserID: [previousOwnerID, claim.claimantUserID] },
      reason: 'claim approved by admin',
    }).catch(err => console.error('Failed to write claim audit row:', err));

    await bot.answerCallbackQuery(queryId, { text: '✅ Approved' });
    await bot.editMessageText(
      `${message.text}\n\n✅ Approved by ${from.first_name}`,
      { chat_id: message.chat.id, message_id: message.message_id }
    );

    // Notify claimant
    bot.sendMessage(
      claim.claimantTelegramID,
      `✅ Your claim was approved! You are now the owner of the card:\n${PUBLIC_WEB_URL}/?card=${claim.masterID}`
    ).catch(() => {});

  } else {
    claim.status = 'rejected';
    claim.reviewedBy = adminUser?._id;
    claim.reviewedAt = new Date();
    await claim.save();

    await MasterAudit.create({
      masterID: claim.masterID,
      actorUserID: adminUser?._id,
      actorTelegramID: from.id,
      action: 'reject',
      reason: 'claim declined by admin',
    }).catch(err => console.error('Failed to write claim audit row:', err));

    await bot.answerCallbackQuery(queryId, { text: '❌ Declined' });
    await bot.editMessageText(
      `${message.text}\n\n❌ Declined by ${from.first_name}`,
      { chat_id: message.chat.id, message_id: message.message_id }
    );

    // Notify claimant
    bot.sendMessage(
      claim.claimantTelegramID,
      `❌ Your ownership claim could not be verified. Contact support for more info.`
    ).catch(() => {});
  }
}

async function addUserToDatabase(message, photo, token, lang) {
  // Add new user to database
  // NB: I am using mongo _id as a name for a photo, so database record is created prior to photo upload in s3
  const user = await User.create({
    telegramID: message.chat.id,
    firstName: message.chat.first_name || null,
    lastName: message.chat.last_name || null,
    username: message.chat.username || null,
    token: token,
    uiLanguage: i18n.normalizeLang(lang),
  }).catch(console.error);

  // Create parameters to upload photo
  const s3uploadParams = {
    Bucket: 'chupakabra-test',
    Key: `userpics/${user._id}.jpg`,
    Body: photo,
  };

  // If there is no photo, skip s3 upload
  if (photo === null) {
    user.photo = null;
    await user.save();
  } else {
    // Save photo to S3
    s3.upload(s3uploadParams, async (err, data) => {
      if (err) return console.error(err);
      // Update user record in the database
      user.photo = data.Location;
      await user.save();
    });
  }

  // If we are here, that means that everything is completed successfully
  console.log(
    `User ${message.chat.first_name} ${message.chat.last_name} successfully added to database`
  );
}

