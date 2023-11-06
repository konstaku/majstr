require('dotenv').config();
const express = require('express');
const https = require('https');
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
const jwt = require('jsonwebtoken');
const User = require('./database/schema/User');

const CERTIFICATE = process.env.CERTIFICATE;
const KEYFILE = process.env.KEYFILE;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const JWT_ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_TOKEN_SECRET;
const PORT_NUMBER = 8443;

const httpsOptions = {
  key: fs.readFileSync(KEYFILE),
  cert: fs.readFileSync(CERTIFICATE),
};

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

    if (registeredUserID) {
      console.log('User already registered! ID:', registeredUserID);
    } else {
      console.log('Welcome new user!, ID:', registeredUserID);

      const token = jwt.sign(
        {
          userID: message.chat.id,
          firstName: message.chat.first_name,
          username: message.chat.username,
        },
        JWT_ACCESS_TOKEN_SECRET
      );

      console.log('=== Token generated ===\n', JSON.stringify(token));

      await User.create({
        telegramID: message.chat.id,
        firstName: message.chat.first_name || null,
        lastName: message.chat.last_name || null,
        username: message.chat.username || null,
        token: token,
      });

      console.log(
        `User ${message.chat.first_name} ${message.chat.last_name} successfully added to database`
      );

      const encodedToken = encodeURIComponent(JSON.stringify(token));

      bot.sendMessage(message.chat.id, 'Confirm', {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'Confirm',
                // url: ?id=userID&token=18236182736 -> backend
                // -> db.users.save(id, token)
                url: `https://majstr.com/login?token=${encodedToken}`,
              },
            ],
          ],
        },
      });
    }

    // console.log('message recieved, request:', req.body.message);
    res.status(200).send('OK');
  });

  bot.on('webhook_error', console.error);
};
