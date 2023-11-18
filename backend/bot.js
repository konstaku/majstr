require('dotenv').config();
const express = require('express');
const https = require('https');
const fs = require('fs');
const AWS = require('aws-sdk');
const TelegramBot = require('node-telegram-bot-api');
const jwt = require('jsonwebtoken');
const User = require('./database/schema/User');

const CERTIFICATE = process.env.CERTIFICATE;
const KEYFILE = process.env.KEYFILE;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const JWT_ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_TOKEN_SECRET;
const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const PORT_NUMBER = 8443;

const httpsOptions = {
  key: fs.readFileSync(KEYFILE),
  cert: fs.readFileSync(CERTIFICATE),
};

const s3 = new AWS.S3({
  accessKeyId: AWS_ACCESS_KEY,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
});

module.exports.runBot = async function () {
  const app = express();
  app.use(express.json());
  const bot = new TelegramBot(BOT_TOKEN);
  const httpsServer = https.createServer(httpsOptions, app);

  await bot.setWebHook(`https://konstaku.com:${PORT_NUMBER}/webhook`);

  httpsServer
    .listen(PORT_NUMBER, () =>
      console.log(`Telegram bot started on port ${PORT_NUMBER}`)
    )
    .on('error', (err) => {
      console.log('Error starting telegram bot server:', err);
    });

  app.post('/webhook', async (req, res) => await handleWebhook(req, res, bot));

  bot.on('webhook_error', console.error);
};

async function handleWebhook(req, res, bot) {
  console.log('Webhook triggered!');
  const message = req.body.message;

  // If webhook activated, but there is no message, do nothing
  if (!message) {
    console.log('Webhook activated, but no message detected');
    return;
  }

  // If the message is unknown command, return
  if (message.text !== '/start') {
    console.log('Webhook activated, but command unknown:', message.text);

    return bot.sendMessage(
      message.chat.id,
      'Unknown command, use /start to sign in.'
    );
  }

  console.log('Looking for a user with an ID of:', message.chat.id);

  const registeredUserID = await User.exists({
    telegramID: message.chat.id,
  });

  let token;

  // If user found, just send the link
  if (registeredUserID) {
    console.log('User already registered! ID:', registeredUserID);
    const registeredUser = await User.findById(registeredUserID);
    return sendLoginLink(res, bot, message.chat.id, registeredUser.token);
  }

  console.log('Welcome new user!, ID:', registeredUserID);

  // Create a new JWT token
  token = jwt.sign(
    {
      userID: message.chat.id,
      firstName: message.chat.first_name,
      username: message.chat.username,
    },
    JWT_ACCESS_TOKEN_SECRET
  );
  console.log('=== Token generated ===\n', JSON.stringify(token));

  // Fetch user photo from Telegram API:
  //
  // The URLs for fetching photo ID and path
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
    .then((data) => data.result.photos[0][1].file_id)
    .catch(console.error);
  console.log('Photo ID obtained:', photoID);

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
  const photo = await fetch(telegramPhotoUrl)
    .then((response) => response.blob())
    .then((blob) => blob.arrayBuffer())
    .then(Buffer.from)
    .catch(console.error);

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

  // Save photo to S3
  s3.upload(s3uploadParams, async (err, data) => {
    if (err) return console.error(err);
    // Update user record in the database
    user.photo = data.Location;
    await user.save();
  });

  // If we are here, that means that everything is completed successfully
  console.log(
    `User ${message.chat.first_name} ${message.chat.last_name} successfully added to database`
  );

  // Sending a link with a token in URl params and directing to a login page which is handled by a frontend
  sendLoginLink(res, bot, message.chat.id, token);
}

function sendLoginLink(res, bot, id, token) {
  const encodedToken = encodeURIComponent(JSON.stringify(token));

  bot.sendMessage(id, 'Confirm', {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: 'Confirm',
            url: `https://majstr.com/login?token=${encodedToken}`,
          },
        ],
      ],
    },
  });

  res.status(200).send('OK');
}
