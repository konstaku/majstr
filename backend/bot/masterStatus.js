const Master = require('../database/schema/Master');
const i18n = require('../i18n');
const { bot, getUserLang } = require('./instance');

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

async function setAvailability(chatId, availability) {
  const lang = await getUserLang(chatId);
  const masters = await Master.find({ telegramID: chatId, status: 'approved' });

  if (!masters.length) {
    return bot.sendMessage(chatId, i18n.t(lang, 'avail.none'));
  }

  await Master.updateMany({ telegramID: chatId, status: 'approved' }, { availability });
  bot.sendMessage(
    chatId,
    i18n.t(lang, 'avail.updated', { label: i18n.t(lang, `avail.${availability}`) })
  );
}

async function showStatus(chatId) {
  const lang = await getUserLang(chatId);
  const masters = await Master.find({ telegramID: chatId, status: 'approved' });

  if (!masters.length) {
    return bot.sendMessage(chatId, i18n.t(lang, 'avail.none'));
  }

  const master = masters[0];
  const availLabel = master.availability
    ? i18n.t(lang, `avail.${master.availability}`)
    : i18n.t(lang, 'status.notset');
  const langs =
    master.languages && master.languages.length
      ? master.languages
          .map((l) => SUPPORTED_LANGUAGES.find((s) => s.code === l)?.label ?? l)
          .join(', ')
      : i18n.t(lang, 'status.notset');

  bot.sendMessage(
    chatId,
    i18n.t(lang, 'status.line', { avail: availLabel, langs })
  );
}

function buildLanguageKeyboard(currentLanguages, uiLang) {
  const langs = currentLanguages || [];
  const buttons = SUPPORTED_LANGUAGES.map(({ code, label }) => ({
    text: langs.includes(code) ? `✅ ${label}` : label,
    callback_data: `lang:${code}`,
  }));

  const rows = [];
  for (let i = 0; i < buttons.length; i += 4) {
    rows.push(buttons.slice(i, i + 4));
  }
  rows.push([{ text: i18n.t(uiLang, 'langs.save'), callback_data: 'lang:save' }]);
  return { inline_keyboard: rows };
}

async function showLanguageSelector(chatId) {
  const uiLang = await getUserLang(chatId);
  const masters = await Master.find({ telegramID: chatId, status: 'approved' });

  if (!masters.length) {
    return bot.sendMessage(chatId, i18n.t(uiLang, 'avail.none'));
  }

  const currentLanguages = masters[0].languages || [];
  bot.sendMessage(chatId, i18n.t(uiLang, 'langs.prompt'), {
    reply_markup: buildLanguageKeyboard(currentLanguages, uiLang),
  });
}

// Body of the `lang:` callback branch — toggles a spoken language on the
// master card or saves the selection. Moved verbatim from handleCallbackQuery.
async function handleLangCallback(queryId, message, data) {
  const chatId = message.chat.id;
  const uiLang = await getUserLang(chatId);
  const langCode = data.slice(5);

  if (langCode === 'save') {
    const masters = await Master.find({ telegramID: chatId, status: 'approved' });
    const langs = masters[0]?.languages || [];
    const langLabels =
      langs.map((l) => SUPPORTED_LANGUAGES.find((s) => s.code === l)?.label ?? l).join(', ') ||
      '—';
    await bot.answerCallbackQuery(queryId, { text: i18n.t(uiLang, 'lang.switched') });
    return bot.editMessageText(i18n.t(uiLang, 'langs.saved', { labels: langLabels }), {
      chat_id: chatId,
      message_id: message.message_id,
    });
  }

  const masters = await Master.find({ telegramID: chatId, status: 'approved' });
  if (!masters.length) {
    return bot.answerCallbackQuery(queryId, { text: i18n.t(uiLang, 'avail.none') });
  }

  const currentLangs = masters[0].languages || [];
  const newLangs = currentLangs.includes(langCode)
    ? currentLangs.filter((l) => l !== langCode)
    : [...currentLangs, langCode];

  await Master.updateMany({ telegramID: chatId, status: 'approved' }, { languages: newLangs });

  await bot.answerCallbackQuery(queryId, { text: '' });
  await bot.editMessageReplyMarkup(buildLanguageKeyboard(newLangs, uiLang), {
    chat_id: chatId,
    message_id: message.message_id,
  });
}

module.exports = {
  SUPPORTED_LANGUAGES,
  setAvailability,
  showStatus,
  buildLanguageKeyboard,
  showLanguageSelector,
  handleLangCallback,
};
