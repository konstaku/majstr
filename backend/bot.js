require('dotenv').config();
const express = require('express');
const https = require('https');
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
const jwt = require('jsonwebtoken');

const CERTIFICATE = process.env.CERTIFICATE;
const KEYFILE = process.env.KEYFILE;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
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

  app.post('/webhook', (req, res) => {
    console.log('Webhook triggered!');
    const message = req.body.message;

    if (!message) return;

    if (message.text === '/start') {
      const token = jwt.sign({ userID: message.chat.id }, 'secretKey', {
        expiresIn: '100d',
      });

      console.log('=== Token generated ===\n', JSON.stringify(token));
      const encodedToken = encodeURIComponent(JSON.stringify(token));

      bot.sendMessage(message.chat.id, 'Confirm', {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'Confirm',
                // url: ?id=userID&token=18236182736 -> backend
                // -> db.users.save(id, token)
                url: `https://konstaku.com/login?token=${encodedToken}`,
              },
            ],
          ],
        },
      });
    }

    console.log('message recieved, request:', req.body.message);
    res.status(200).send('OK');
  });

  bot.on('webhook_error', console.log);
};
