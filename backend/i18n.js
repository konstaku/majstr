// Bot/owner-facing i18n. The bot ships in two languages only: Ukrainian
// for uk users, English for everyone else (same rule as the Mini App).
// Legacy stored uiLanguage values (it, ru, …) normalize to English.

const UI_LANGS = ['en', 'uk'];
const DEFAULT_LANG = 'en';

// Telegram language_code (ISO-639-1, e.g. "uk", "it", "ru-RU") -> our set.
function mapTgLang(code) {
  if (!code) return null;
  const base = String(code).toLowerCase().split('-')[0];
  return UI_LANGS.includes(base) ? base : null;
}

function normalizeLang(code) {
  return UI_LANGS.includes(code) ? code : DEFAULT_LANG;
}

const DICT = {
  uk: {
    'welcome.body':
      'Вітаємо у Majstr! 🛠\n\nЗнайдіть майстра або зареєструйте себе як фахівця.\n\n👇 Оберіть мову / Choose language',
    'btn.addMaster': '➕ Додати картку майстра',
    'btn.loginSite': '🌐 Увійти на сайт',
    'lang.switched': '✅ Мову змінено',
    'unknownCommand':
      'Невідома команда. Доступні команди:\n/start — почати\n/available — доступний зараз\n/nextweek — з наступного тижня\n/busy — зайнятий\n/status — переглянути статус\n/languages — мови спілкування',
    'avail.none': 'Не знайдено жодної схваленої картки майстра.',
    'avail.updated': 'Статус оновлено: {label}',
    'avail.available': '🟢 Доступний зараз',
    'avail.next_week': '🟡 З наступного тижня',
    'avail.busy': '🔴 Зайнятий',
    'status.line': '📋 Ваш профіль:\nСтатус: {avail}\nМови: {langs}\n\nКоманди:\n/available /nextweek /busy /languages',
    'status.notset': 'не вказано',
    'langs.prompt': 'Оберіть мови спілкування (можна декілька):',
    'langs.save': '💾 Зберегти',
    'langs.saved': 'Мови збережено: {labels}',
    'owner.approved':
      '✅ Вашу картку майстра схвалено та опубліковано!\n\nПереглянути: {url}',
    'owner.declined':
      '❌ На жаль, вашу картку майстра не схвалено. Ви можете відредагувати дані та надіслати її повторно через бота.',
    'owner.verified':
      '🛡 Вашу картку верифіковано! Тепер вона має позначку VERIFIED і показується вище в результатах пошуку.\n\nПереглянути: {url}',
    'owner.verifyDeclined':
      '❌ Верифікацію картки відхилено. Перевірте дані картки та збережіть зміни ще раз — ми переглянемо її повторно.',
    'forward.savedRaw':
      '✅ Зберіг у чергу. Оброблю локальною моделлю і покажу картку, коли відкрию інструмент перегляду.',
    'forward.received':
      '✅ Додав до черги на модерацію:\n{summary}\n\nПереглянемо і опублікуємо картку майстра.',
    'forward.weak':
      '📥 Зберіг у чергу, але не вдалося впевнено розпізнати дані ({summary}). Передивлюся вручну.',
    'forward.duplicate': 'ℹ️ Це повідомлення вже є в черзі на модерацію.',
    'forward.alreadyListed': 'ℹ️ Цей майстер уже є в каталозі ({name}) — той самий контакт. Нову картку не створював.',
    'forward.empty':
      'Перешліть повідомлення з текстом (рекомендацію майстра), щоб я міг його опрацювати.',
    'forward.error': '⚠️ Не вдалося опрацювати пересилання. Спробуйте пізніше.',
    'forward.ratelimited': 'Забагато пересилань поспіль. Спробуйте трохи згодом.',
    'forward.nodata': 'дані не розпізнано',
  },
  en: {
    'welcome.body':
      'Welcome to Majstr! 🛠\n\nFind a tradesperson or register yourself as one.\n\n👇 Choose language / Оберіть мову',
    'btn.addMaster': '➕ Add my master card',
    'btn.loginSite': '🌐 Open the website',
    'lang.switched': '✅ Language changed',
    'unknownCommand':
      'Unknown command. Available:\n/start — start\n/available — available now\n/nextweek — from next week\n/busy — busy\n/status — view status\n/languages — spoken languages',
    'avail.none': 'No approved master card found.',
    'avail.updated': 'Status updated: {label}',
    'avail.available': '🟢 Available now',
    'avail.next_week': '🟡 From next week',
    'avail.busy': '🔴 Busy',
    'status.line': '📋 Your profile:\nStatus: {avail}\nLanguages: {langs}\n\nCommands:\n/available /nextweek /busy /languages',
    'status.notset': 'not set',
    'langs.prompt': 'Choose the languages you speak (multiple allowed):',
    'langs.save': '💾 Save',
    'langs.saved': 'Languages saved: {labels}',
    'owner.approved':
      '✅ Your master card has been approved and published!\n\nView it: {url}',
    'owner.declined':
      '❌ Unfortunately your master card was not approved. You can edit the details and resubmit it via the bot.',
    'owner.verified':
      '🛡 Your card is now verified! It carries the VERIFIED badge and ranks higher in search results.\n\nView it: {url}',
    'owner.verifyDeclined':
      '❌ Card verification was declined. Review your card details and save again — we will take another look.',
    'forward.savedRaw':
      '✅ Saved to the queue. I’ll run it through the local model and show the card when you open the review tool.',
    'forward.received':
      '✅ Added to the review queue:\n{summary}\n\nI’ll review it and publish the master card.',
    'forward.weak':
      '📥 Saved to the queue, but I couldn’t confidently parse the details ({summary}). I’ll review it manually.',
    'forward.duplicate': 'ℹ️ This message is already in the review queue.',
    'forward.alreadyListed': 'ℹ️ This master is already in the directory ({name}) — same contact. No new card created.',
    'forward.empty':
      'Forward a message that contains text (a master recommendation) so I can process it.',
    'forward.error': '⚠️ Couldn’t process the forward. Please try again later.',
    'forward.ratelimited': 'Too many forwards in a row. Please try again a bit later.',
    'forward.nodata': 'no details parsed',
  },
};

function t(lang, key, vars) {
  const l = normalizeLang(lang);
  let s =
    (DICT[l] && DICT[l][key]) ||
    (DICT.en && DICT.en[key]) ||
    (DICT[DEFAULT_LANG] && DICT[DEFAULT_LANG][key]) ||
    key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : `{${k}}`));
  return s;
}

// The bot offers exactly the two shipped UI languages.
const BOT_LANGS = [
  { code: 'uk', label: '🇺🇦' },
  { code: 'en', label: '🇬🇧' },
];

// Single language-switch row for the bot welcome / /languages keyboard.
function langKeyboardRows(activeLang) {
  return [
    BOT_LANGS.map((o) => ({
      text: o.code === activeLang ? `· ${o.label} ·` : o.label,
      callback_data: `uilang:${o.code}`,
    })),
  ];
}

module.exports = {
  UI_LANGS,
  DEFAULT_LANG,
  mapTgLang,
  normalizeLang,
  t,
  langKeyboardRows,
};
