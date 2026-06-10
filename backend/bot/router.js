const i18n = require('../i18n');
const { bot, getUserLang } = require('./instance');
const { isForwarded, bufferForward } = require('./forwardLeads');
const { handleStart, handleUiLangCallback } = require('./startFlow');
const {
  setAvailability,
  showStatus,
  showLanguageSelector,
  handleLangCallback,
} = require('./masterStatus');
const { handleMasterCallback } = require('./moderationCallbacks');
const { handleClaimCallback } = require('./claimCallbacks');

async function handleMessage(message) {
  // Mini App data submissions are not user text commands — ignore silently.
  if (message.web_app_data) return;

  // Forwarded message(s) are leads to mine, not commands. Route before the
  // command switch so a forwarded "/start" can't be misread as a command.
  if (isForwarded(message)) {
    bufferForward(message);
    return;
  }

  const chatId = message.chat.id;
  const text = message.text || '';

  // /start may carry a payload after a space — handle before the switch.
  if (text === '/start' || text.startsWith('/start ')) {
    const payload = text.startsWith('/start ') ? text.slice(7).trim() : null;
    await handleStart(message, payload);
    return;
  }

  switch (text) {
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
    default: {
      // Only reply to messages that look like commands (/foo). Ignore plain
      // text, stickers, media, service messages, and empty strings from TMA.
      if (!text.startsWith('/')) break;
      console.log('Unknown command:', text);
      const lang = await getUserLang(chatId);
      bot.sendMessage(chatId, i18n.t(lang, 'unknownCommand'));
    }
  }
}

async function handleCallbackQuery(callbackQuery) {
  const { id: queryId, message, data, from } = callbackQuery;
  if (!data) {
    return bot.answerCallbackQuery(queryId, { text: 'Невідома дія' });
  }
  if (data.startsWith('claim:')) {
    return handleClaimCallback(queryId, message, data, from);
  }
  if (data.startsWith('master:')) {
    return handleMasterCallback(queryId, message, data, from);
  }
  if (data.startsWith('uilang:')) {
    return handleUiLangCallback(queryId, message, data, from);
  }
  if (!data.startsWith('lang:')) {
    console.log('Unknown callback data:', data);
    return bot.answerCallbackQuery(queryId, { text: 'Невідома дія' });
  }

  return handleLangCallback(queryId, message, data);
}

module.exports = { handleMessage, handleCallbackQuery };
