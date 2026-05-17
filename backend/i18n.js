// Bot/owner-facing i18n. UI languages: uk (primary), en, it, ru.
// uk copy mirrors the original hardcoded strings; en/it/ru are first-pass
// drafts pending native review (tracked as a follow-up issue).

const UI_LANGS = ['uk', 'en', 'it', 'ru'];
const DEFAULT_LANG = 'uk';

// Telegram language_code (ISO-639-1, e.g. "uk", "it", "ru-RU") -> our set.
function mapTgLang(code) {
  if (!code) return null;
  const base = String(code).toLowerCase().split('-')[0];
  if (base === 'uk') return 'uk';
  if (base === 'it') return 'it';
  if (base === 'ru') return 'ru';
  if (base === 'en') return 'en';
  return null;
}

function normalizeLang(code) {
  return UI_LANGS.includes(code) ? code : DEFAULT_LANG;
}

const DICT = {
  uk: {
    'welcome.body':
      'Вітаємо у Majstr! 🛠\n\nЗнайдіть майстра або зареєструйте себе як фахівця.\n\n👇 Оберіть мову / Choose language / Scegli la lingua',
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
  },
  en: {
    'welcome.body':
      'Welcome to Majstr! 🛠\n\nFind a tradesperson or register yourself as one.\n\n👇 Choose language / Оберіть мову / Scegli la lingua',
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
  },
  it: {
    'welcome.body':
      'Benvenuto su Majstr! 🛠\n\nTrova un artigiano o registrati come professionista.\n\n👇 Scegli la lingua / Choose language / Оберіть мову',
    'btn.addMaster': '➕ Aggiungi la mia scheda',
    'btn.loginSite': '🌐 Apri il sito',
    'lang.switched': '✅ Lingua cambiata',
    'unknownCommand':
      'Comando sconosciuto. Disponibili:\n/start — inizia\n/available — disponibile ora\n/nextweek — dalla prossima settimana\n/busy — occupato\n/status — vedi stato\n/languages — lingue parlate',
    'avail.none': 'Nessuna scheda approvata trovata.',
    'avail.updated': 'Stato aggiornato: {label}',
    'avail.available': '🟢 Disponibile ora',
    'avail.next_week': '🟡 Dalla prossima settimana',
    'avail.busy': '🔴 Occupato',
    'status.line': '📋 Il tuo profilo:\nStato: {avail}\nLingue: {langs}\n\nComandi:\n/available /nextweek /busy /languages',
    'status.notset': 'non impostato',
    'langs.prompt': 'Scegli le lingue che parli (più di una possibile):',
    'langs.save': '💾 Salva',
    'langs.saved': 'Lingue salvate: {labels}',
    'owner.approved':
      '✅ La tua scheda è stata approvata e pubblicata!\n\nVisualizzala: {url}',
    'owner.declined':
      '❌ Purtroppo la tua scheda non è stata approvata. Puoi modificare i dati e inviarla di nuovo tramite il bot.',
  },
  ru: {
    'welcome.body':
      'Добро пожаловать в Majstr! 🛠\n\nНайдите мастера или зарегистрируйтесь как специалист.\n\n👇 Выберите язык / Choose language / Scegli la lingua',
    'btn.addMaster': '➕ Добавить карточку мастера',
    'btn.loginSite': '🌐 Открыть сайт',
    'lang.switched': '✅ Язык изменён',
    'unknownCommand':
      'Неизвестная команда. Доступно:\n/start — начать\n/available — доступен сейчас\n/nextweek — со следующей недели\n/busy — занят\n/status — статус\n/languages — языки общения',
    'avail.none': 'Одобренная карточка мастера не найдена.',
    'avail.updated': 'Статус обновлён: {label}',
    'avail.available': '🟢 Доступен сейчас',
    'avail.next_week': '🟡 Со следующей недели',
    'avail.busy': '🔴 Занят',
    'status.line': '📋 Ваш профиль:\nСтатус: {avail}\nЯзыки: {langs}\n\nКоманды:\n/available /nextweek /busy /languages',
    'status.notset': 'не указано',
    'langs.prompt': 'Выберите языки общения (можно несколько):',
    'langs.save': '💾 Сохранить',
    'langs.saved': 'Языки сохранены: {labels}',
    'owner.approved':
      '✅ Ваша карточка мастера одобрена и опубликована!\n\nПосмотреть: {url}',
    'owner.declined':
      '❌ К сожалению, ваша карточка не одобрена. Вы можете отредактировать данные и отправить её повторно через бота.',
  },
};

function t(lang, key, vars) {
  const l = normalizeLang(lang);
  let s = (DICT[l] && DICT[l][key]) || (DICT[DEFAULT_LANG] && DICT[DEFAULT_LANG][key]) || key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : `{${k}}`));
  return s;
}

// Language switch keyboard row. RU intentionally has NO flag (text label).
function langButtonsRow(activeLang) {
  const opts = [
    { code: 'uk', label: '🇺🇦' },
    { code: 'en', label: '🇬🇧' },
    { code: 'it', label: '🇮🇹' },
    { code: 'ru', label: 'RU' },
  ];
  return opts.map((o) => ({
    text: o.code === activeLang ? `· ${o.label} ·` : o.label,
    callback_data: `uilang:${o.code}`,
  }));
}

module.exports = { UI_LANGS, DEFAULT_LANG, mapTgLang, normalizeLang, t, langButtonsRow };
