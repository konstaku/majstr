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

  app.post('/webhook', async (req, res) => {
    console.log('Webhook triggered!');
    const message = req.body.message;

    if (!message) return;
    if (message.text !== '/start') {
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

    if (registeredUserID) {
      console.log('User already registered! ID:', registeredUserID);
      const registeredUser = await User.findById(registeredUserID);
      token = registeredUser.token;
    } else {
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

      // Fetch user photo from Telegram API
      const fetchPhotoIdUrl = `https://api.telegram.org/bot${BOT_TOKEN}/getUserProfilePhotos`;
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

      console.log(`Fetching photos for user ${message.chat.id}`);

      // Get user prophile photo file ID from telegram api
      const photoID = await fetch(fetchPhotoIdUrl, fetchPhotoIdOptions)
        .then((response) => response.json())
        .then((data) => data.result.photos[0][1].file_id)
        .catch(console.error);
      console.log('Photo ID obtained:', photoID);

      // Get user telegram photo path
      const fetchPhotoPathUrl = `https://api.telegram.org/bot${BOT_TOKEN}/getFile`;
      const fetchPhotoPathOptions = {
        ...fetchPhotoIdOptions,
        body: JSON.stringify({
          file_id: photoID,
        }),
      };
      const photoPath = await fetch(fetchPhotoPathUrl, fetchPhotoPathOptions)
        .then((response) => response.json())
        .then((data) => data.result.file_path)
        .catch(console.error);
      console.log('Photo path obtained:', photoPath);

      // Download the user photo
      const telegramPhotoUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${photoPath}`;
      const photo = await fetch(telegramPhotoUrl)
        .then((response) => response.blob())
        .then((blob) => blob.arrayBuffer())
        .then(Buffer.from)
        .catch(console.error);

      // Add new user to database
      const user = await User.create({
        telegramID: message.chat.id,
        firstName: message.chat.first_name || null,
        lastName: message.chat.last_name || null,
        username: message.chat.username || null,
        token: token,
      });

      // Save photo to S3
      const s3uploadParams = {
        Bucket: 'chupakabra-test',
        Key: `userpics/${user._id}.jpg`,
        Body: photo,
      };
      s3.upload(s3uploadParams, async (err, data) => {
        if (err) return console.error(err);
        // Update user record in the database
        user.photo = data.Location;
        await user.save();
      });

      console.log(
        `User ${message.chat.first_name} ${message.chat.last_name} successfully added to database`
      );
    }

    const encodedToken = encodeURIComponent(JSON.stringify(token));

    bot.sendMessage(message.chat.id, 'Confirm', {
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
  });

  bot.on('webhook_error', console.error);
};
