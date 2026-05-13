require('dotenv').config();
const express = require('express');
const https = require('https');
const fs = require('fs');
const AWS = require('aws-sdk');
const TelegramBot = require('node-telegram-bot-api');
const jwt = require('jsonwebtoken');
const User = require('./database/schema/User');
const Master = require('./database/schema/Master');

const CERTIFICATE = process.env.CERTIFICATE;
const KEYFILE = process.env.KEYFILE;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const JWT_ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_TOKEN_SECRET;
const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const PORT_NUMBER = 8443;

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
  const chatId = message.chat.id;
  const text = message.text || '';

  switch (text) {
    case '/start':
      await handleStart(message);
      break;
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
    default:
      console.log('Unknown command:', text);
      bot.sendMessage(
        chatId,
        'Невідома команда. Доступні команди:\n' +
        '/start — увійти на сайт\n' +
        '/available — доступний зараз\n' +
        '/nextweek — з наступного тижня\n' +
        '/busy — зайнятий\n' +
        '/status — переглянути статус\n' +
        '/languages — мови спілкування'
      );
  }
}

async function handleStart(message) {
  console.log('Looking for a user with an ID of:', message.chat.id);

  const registeredUserID = await User.exists({
    telegramID: message.chat.id,
  });

  if (registeredUserID) {
    console.log('User already registered! ID:', registeredUserID);
    const registeredUser = await User.findById(registeredUserID);
    return sendLoginLink(message.chat.id, registeredUser.token);
  }

  console.log('Welcome new user!, ID:', registeredUserID);
  const token = createTokenForUser(message);
  const userPhoto = await fetchUserTelegramPhoto(message);
  await addUserToDatabase(message, userPhoto, token);
  sendLoginLink(message.chat.id, token);
}

async function setAvailability(chatId, availability) {
  const masters = await Master.find({ telegramID: chatId, approved: true });

  if (!masters.length) {
    return bot.sendMessage(chatId, 'Не знайдено жодної схваленої картки майстра.');
  }

  await Master.updateMany({ telegramID: chatId, approved: true }, { availability });
  bot.sendMessage(chatId, `Статус оновлено: ${AVAILABILITY_LABELS[availability]}`);
}

async function showStatus(chatId) {
  const masters = await Master.find({ telegramID: chatId, approved: true });

  if (!masters.length) {
    return bot.sendMessage(chatId, 'Не знайдено жодної схваленої картки майстра.');
  }

  const master = masters[0];
  const availLabel = master.availability
    ? AVAILABILITY_LABELS[master.availability]
    : 'не вказано';
  const langs =
    master.languages && master.languages.length
      ? master.languages
          .map((l) => SUPPORTED_LANGUAGES.find((s) => s.code === l)?.label ?? l)
          .join(', ')
      : 'не вказано';

  bot.sendMessage(
    chatId,
    `📋 Ваш профіль:\nСтатус: ${availLabel}\nМови: ${langs}\n\n` +
      'Команди:\n/available /nextweek /busy /languages'
  );
}

function buildLanguageKeyboard(currentLanguages) {
  const langs = currentLanguages || [];
  const buttons = SUPPORTED_LANGUAGES.map(({ code, label }) => ({
    text: langs.includes(code) ? `✅ ${label}` : label,
    callback_data: `lang:${code}`,
  }));

  const rows = [];
  for (let i = 0; i < buttons.length; i += 4) {
    rows.push(buttons.slice(i, i + 4));
  }
  rows.push([{ text: '💾 Зберегти', callback_data: 'lang:save' }]);
  return { inline_keyboard: rows };
}

async function showLanguageSelector(chatId) {
  const masters = await Master.find({ telegramID: chatId, approved: true });

  if (!masters.length) {
    return bot.sendMessage(chatId, 'Не знайдено жодної схваленої картки майстра.');
  }

  const currentLanguages = masters[0].languages || [];
  bot.sendMessage(chatId, 'Оберіть мови спілкування (можна декілька):', {
    reply_markup: buildLanguageKeyboard(currentLanguages),
  });
}

async function handleCallbackQuery(callbackQuery) {
  const { id: queryId, message, data } = callbackQuery;
  if (!data || !data.startsWith('lang:')) {
    console.log('Unknown callback data:', data);
    return bot.answerCallbackQuery(queryId, { text: 'Невідома дія' });
  }

  const chatId = message.chat.id;
  const langCode = data.slice(5);

  if (langCode === 'save') {
    const masters = await Master.find({ telegramID: chatId, approved: true });
    const langs = masters[0]?.languages || [];
    const langLabels =
      langs.map((l) => SUPPORTED_LANGUAGES.find((s) => s.code === l)?.label ?? l).join(', ') ||
      'жодної';
    await bot.answerCallbackQuery(queryId, { text: '✅ Збережено' });
    return bot.editMessageText(`Мови збережено: ${langLabels}`, {
      chat_id: chatId,
      message_id: message.message_id,
    });
  }

  const masters = await Master.find({ telegramID: chatId, approved: true });
  if (!masters.length) {
    return bot.answerCallbackQuery(queryId, { text: 'Профіль не знайдено' });
  }

  const currentLangs = masters[0].languages || [];
  const newLangs = currentLangs.includes(langCode)
    ? currentLangs.filter((l) => l !== langCode)
    : [...currentLangs, langCode];

  await Master.updateMany({ telegramID: chatId, approved: true }, { languages: newLangs });

  await bot.answerCallbackQuery(queryId, { text: '' });
  await bot.editMessageReplyMarkup(buildLanguageKeyboard(newLangs), {
    chat_id: chatId,
    message_id: message.message_id,
  });
}

function sendLoginLink(id, token) {
  const encodedToken = encodeURIComponent(JSON.stringify(token));

  bot.sendMessage(id, 'Увійти на majstr.com?', {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: 'Увійти',
            login_url: {
              url: `${FRONTEND_URL}/login?token=${encodedToken}&path=add`,
            },
          },
        ],
      ],
    },
  });
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

async function addUserToDatabase(message, photo, token) {
  // Add new user to database
  // NB: I am using mongo _id as a name for a photo, so database record is created prior to photo upload in s3
  const user = await User.create({
    telegramID: message.chat.id,
    firstName: message.chat.first_name || null,
    lastName: message.chat.last_name || null,
    username: message.chat.username || null,
    token: token,
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

