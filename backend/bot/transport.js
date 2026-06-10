const express = require('express');
const https = require('https');
const fs = require('fs');

const {
  bot,
  BOT_TOKEN,
  WEBHOOK_URL,
  CERTIFICATE,
  KEYFILE,
  TMA_BASE_URL,
  PUBLIC_WEB_URL,
  FRONTEND_URL,
  PORT_NUMBER,
} = require('./instance');
const { handleMessage, handleCallbackQuery } = require('./router');

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

module.exports = { runBot, handleWebhook };
