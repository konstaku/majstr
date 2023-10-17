const { app } = require('./index');

const TelegramBot = require('node-telegram-bot-api');
const TOKEN = '6670255598:AAHEvdTHxZZ58lIZymZm8lIe4I66imY9tH8';

const bot = new TelegramBot(TOKEN);

bot.setWebHook(`https://konstaku.com:${PORT_NUMBER}/webhook`);

app.post('/webhook', (req, res) => {
  if (req.body.callback_query) {
    console.log('callback query!');
    return;
  }

  const message = req.body.message;

  if (!message) return;

  if (message.text === '/start') {
    bot.sendMessage(message.chat.id, 'Confirm', {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: 'Confirm',
              url: 'https://konstaku.com/login?token=12345',
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
