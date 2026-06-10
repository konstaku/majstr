const AWS = require('aws-sdk');
const jwt = require('jsonwebtoken');

const User = require('../database/schema/User');
const i18n = require('../i18n');
const { S3_BUCKET } = require('../config/s3');
const {
  bot,
  BOT_TOKEN,
  JWT_ACCESS_TOKEN_SECRET,
  TMA_BASE_URL,
  FRONTEND_URL,
} = require('./instance');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

// Pull a known UI language out of a /start or startapp payload, e.g.
// "add-it" -> "it", "onboard_en" -> "en", "ru" -> "ru". null if none.
function parseLangFromPayload(payload) {
  if (!payload) return null;
  for (const tok of String(payload).split(/[^a-zA-Z]+/)) {
    if (i18n.UI_LANGS.includes(tok.toLowerCase())) return tok.toLowerCase();
  }
  return null;
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
    Bucket: S3_BUCKET,
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

module.exports = {
  parseLangFromPayload,
  handleStart,
  buildWelcomeKeyboard,
  sendLoginLink,
  createTokenForUser,
  fetchUserTelegramPhoto,
  handleUiLangCallback,
  addUserToDatabase,
};
