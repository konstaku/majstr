require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const User = require('../database/schema/User');
const i18n = require('../i18n');

const CERTIFICATE = process.env.CERTIFICATE;
const KEYFILE = process.env.KEYFILE;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const JWT_ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_TOKEN_SECRET;
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

const bot = new TelegramBot(BOT_TOKEN);

async function getUserLang(telegramID) {
  const u = await User.findOne({ telegramID }).select('uiLanguage').lean();
  return i18n.normalizeLang(u?.uiLanguage);
}

module.exports = {
  bot,
  getUserLang,
  CERTIFICATE,
  KEYFILE,
  BOT_TOKEN,
  JWT_ACCESS_TOKEN_SECRET,
  WEBHOOK_URL,
  FRONTEND_URL,
  TMA_BASE_URL,
  PUBLIC_WEB_URL,
  REVALIDATE_SECRET,
  TELEGRAM_ADMIN_CHAT_ID,
  PORT_NUMBER,
};
