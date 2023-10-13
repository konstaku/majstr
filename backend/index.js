const express = require('express');
const https = require('https');
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
const { kMaxLength } = require('buffer');

const TOKEN = '6670255598:AAHEvdTHxZZ58lIZymZm8lIe4I66imY9tH8';
const PORT_NUMBER = 8443;
const CERTIFICATE = '/etc/letsencrypt/live/konstaku.com/fullchain.pem';
const KEYFILE = '/etc/letsencrypt/live/konstaku.com/privkey.pem';

const app = express();

const httpsOptions = {
  key: fs.readFileSync(KEYFILE),
  cert: fs.readFileSync(CERTIFICATE),
};

const httpsServer = https.createServer(httpsOptions, app);

function main() {
  const bot = new TelegramBot(TOKEN);

  app.use(express.json());
  bot.setWebHook(`https://konstaku.com:${PORT_NUMBER}/webhook`);

  app.post('/webhook', (req, res) => {
    console.log('Webhook triggered!');
    const message = req.body.message;

    if (message.text === '/start') {
      bot.sendMessage(message.chat.id, 'AAA!');
    }

    console.log('message recieved!', message);
    res.status(200).send('OK');
  });

  httpsServer.listen(PORT_NUMBER, () =>
    console.log(`Server started on port ${PORT_NUMBER}`)
  );
}

main();
