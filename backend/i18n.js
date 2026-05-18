// Bot/owner-facing i18n. UI languages: en, uk, ru, it, pt, de, fr, tr.
// uk/en/it/ru copy is a first-pass draft; pt/de/fr/tr are filled by the
// Content Creator / Brand Guardian agents (Phase 2) — missing keys resolve
// via the EN fallback in t().

const UI_LANGS = ['en', 'uk', 'ru', 'it', 'pt', 'de', 'fr', 'tr', 'es'];
const DEFAULT_LANG = 'uk';

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
  pt: {
    'welcome.body':
      'Bem-vindo à Majstr! 🛠\n\nEncontre um profissional ou registe-se como um.\n\n👇 Escolha o idioma / Choose language / Scegli la lingua',
    'btn.addMaster': '➕ Adicionar o meu cartão',
    'btn.loginSite': '🌐 Abrir o site',
    'lang.switched': '✅ Idioma alterado',
    'unknownCommand':
      'Comando desconhecido. Disponíveis:\n/start — começar\n/available — disponível agora\n/nextweek — a partir da próxima semana\n/busy — ocupado\n/status — ver estado\n/languages — línguas faladas',
    'avail.none': 'Nenhum cartão de profissional aprovado encontrado.',
    'avail.updated': 'Estado atualizado: {label}',
    'avail.available': '🟢 Disponível agora',
    'avail.next_week': '🟡 A partir da próxima semana',
    'avail.busy': '🔴 Ocupado',
    'status.line': '📋 O seu perfil:\nEstado: {avail}\nLínguas: {langs}\n\nComandos:\n/available /nextweek /busy /languages',
    'status.notset': 'não definido',
    'langs.prompt': 'Escolha as línguas que fala (pode escolher várias):',
    'langs.save': '💾 Guardar',
    'langs.saved': 'Línguas guardadas: {labels}',
    'owner.approved':
      '✅ O seu cartão foi aprovado e publicado!\n\nVer: {url}',
    'owner.declined':
      '❌ Infelizmente o seu cartão não foi aprovado. Pode editar os dados e enviá-lo de novo através do bot.',
  },
  de: {
    'welcome.body':
      'Willkommen bei Majstr! 🛠\n\nFinde eine Fachkraft oder registriere dich selbst als eine.\n\n👇 Sprache wählen / Choose language / Scegli la lingua',
    'btn.addMaster': '➕ Meine Profilkarte hinzufügen',
    'btn.loginSite': '🌐 Website öffnen',
    'lang.switched': '✅ Sprache geändert',
    'unknownCommand':
      'Unbekannter Befehl. Verfügbar:\n/start — starten\n/available — jetzt verfügbar\n/nextweek — ab nächster Woche\n/busy — ausgelastet\n/status — Status ansehen\n/languages — gesprochene Sprachen',
    'avail.none': 'Keine freigegebene Profilkarte gefunden.',
    'avail.updated': 'Status aktualisiert: {label}',
    'avail.available': '🟢 Jetzt verfügbar',
    'avail.next_week': '🟡 Ab nächster Woche',
    'avail.busy': '🔴 Ausgelastet',
    'status.line': '📋 Dein Profil:\nStatus: {avail}\nSprachen: {langs}\n\nBefehle:\n/available /nextweek /busy /languages',
    'status.notset': 'nicht festgelegt',
    'langs.prompt': 'Wähle die Sprachen, die du sprichst (mehrere möglich):',
    'langs.save': '💾 Speichern',
    'langs.saved': 'Sprachen gespeichert: {labels}',
    'owner.approved':
      '✅ Deine Profilkarte wurde freigegeben und veröffentlicht!\n\nAnsehen: {url}',
    'owner.declined':
      '❌ Leider wurde deine Profilkarte nicht freigegeben. Du kannst die Angaben bearbeiten und sie über den Bot erneut einreichen.',
  },
  fr: {
    'welcome.body':
      'Bienvenue sur Majstr ! 🛠\n\nTrouvez un artisan ou inscrivez-vous comme professionnel.\n\n👇 Choisissez la langue / Choose language / Scegli la lingua',
    'btn.addMaster': '➕ Ajouter ma fiche',
    'btn.loginSite': '🌐 Ouvrir le site',
    'lang.switched': '✅ Langue modifiée',
    'unknownCommand':
      'Commande inconnue. Disponibles :\n/start — démarrer\n/available — disponible maintenant\n/nextweek — à partir de la semaine prochaine\n/busy — occupé\n/status — voir le statut\n/languages — langues parlées',
    'avail.none': 'Aucune fiche professionnelle approuvée trouvée.',
    'avail.updated': 'Statut mis à jour : {label}',
    'avail.available': '🟢 Disponible maintenant',
    'avail.next_week': '🟡 À partir de la semaine prochaine',
    'avail.busy': '🔴 Occupé',
    'status.line': '📋 Votre profil :\nStatut : {avail}\nLangues : {langs}\n\nCommandes :\n/available /nextweek /busy /languages',
    'status.notset': 'non défini',
    'langs.prompt': 'Choisissez les langues que vous parlez (plusieurs possibles) :',
    'langs.save': '💾 Enregistrer',
    'langs.saved': 'Langues enregistrées : {labels}',
    'owner.approved':
      '✅ Votre fiche a été approuvée et publiée !\n\nLa voir : {url}',
    'owner.declined':
      "❌ Malheureusement, votre fiche n'a pas été approuvée. Vous pouvez modifier les informations et la renvoyer via le bot.",
  },
  tr: {
    'welcome.body':
      "Majstr'a hoş geldiniz! 🛠\n\nBir usta bulun ya da kendinizi usta olarak kaydedin.\n\n👇 Dil seçin / Choose language / Scegli la lingua",
    'btn.addMaster': '➕ Profil kartımı ekle',
    'btn.loginSite': '🌐 Siteyi aç',
    'lang.switched': '✅ Dil değiştirildi',
    'unknownCommand':
      'Bilinmeyen komut. Kullanılabilir:\n/start — başla\n/available — şu an müsait\n/nextweek — gelecek haftadan itibaren\n/busy — meşgul\n/status — durumu gör\n/languages — konuşulan diller',
    'avail.none': 'Onaylanmış profil kartı bulunamadı.',
    'avail.updated': 'Durum güncellendi: {label}',
    'avail.available': '🟢 Şu an müsait',
    'avail.next_week': '🟡 Gelecek haftadan itibaren',
    'avail.busy': '🔴 Meşgul',
    'status.line': '📋 Profiliniz:\nDurum: {avail}\nDiller: {langs}\n\nKomutlar:\n/available /nextweek /busy /languages',
    'status.notset': 'belirtilmemiş',
    'langs.prompt': 'Konuştuğunuz dilleri seçin (birden fazla seçilebilir):',
    'langs.save': '💾 Kaydet',
    'langs.saved': 'Diller kaydedildi: {labels}',
    'owner.approved':
      '✅ Profil kartınız onaylandı ve yayınlandı!\n\nGörüntüle: {url}',
    'owner.declined':
      '❌ Maalesef profil kartınız onaylanmadı. Bilgileri düzenleyip bot üzerinden tekrar gönderebilirsiniz.',
  },
  es: {
    'welcome.body':
      '¡Bienvenido a Majstr! 🛠\n\nEncuentra a un profesional o regístrate como uno.\n\n👇 Elige idioma / Choose language / Scegli la lingua',
    'btn.addMaster': '➕ Añadir mi ficha',
    'btn.loginSite': '🌐 Abrir el sitio',
    'lang.switched': '✅ Idioma cambiado',
    'unknownCommand':
      'Comando desconocido. Disponibles:\n/start — empezar\n/available — disponible ahora\n/nextweek — a partir de la próxima semana\n/busy — ocupado\n/status — ver estado\n/languages — idiomas que hablas',
    'avail.none': 'No se encontró ninguna ficha profesional aprobada.',
    'avail.updated': 'Estado actualizado: {label}',
    'avail.available': '🟢 Disponible ahora',
    'avail.next_week': '🟡 A partir de la próxima semana',
    'avail.busy': '🔴 Ocupado',
    'status.line': '📋 Tu perfil:\nEstado: {avail}\nIdiomas: {langs}\n\nComandos:\n/available /nextweek /busy /languages',
    'status.notset': 'sin definir',
    'langs.prompt': 'Elige los idiomas que hablas (puedes elegir varios):',
    'langs.save': '💾 Guardar',
    'langs.saved': 'Idiomas guardados: {labels}',
    'owner.approved':
      '✅ ¡Tu ficha ha sido aprobada y publicada!\n\nVerla: {url}',
    'owner.declined':
      '❌ Lamentablemente tu ficha no fue aprobada. Puedes editar los datos y volver a enviarla a través del bot.',
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

// Language switch keyboard, chunked into rows of 4. RU intentionally has
// NO flag (text label), per project decision.
const LANG_BUTTONS = [
  { code: 'en', label: '🇬🇧' },
  { code: 'uk', label: '🇺🇦' },
  { code: 'ru', label: 'RU' },
  { code: 'it', label: '🇮🇹' },
  { code: 'pt', label: '🇵🇹' },
  { code: 'de', label: '🇩🇪' },
  { code: 'fr', label: '🇫🇷' },
  { code: 'tr', label: '🇹🇷' },
  { code: 'es', label: '🇪🇸' },
];

function langButtonsRows(activeLang) {
  const btns = LANG_BUTTONS.map((o) => ({
    text: o.code === activeLang ? `· ${o.label} ·` : o.label,
    callback_data: `uilang:${o.code}`,
  }));
  const rows = [];
  for (let i = 0; i < btns.length; i += 4) rows.push(btns.slice(i, i + 4));
  return rows;
}

module.exports = {
  UI_LANGS,
  DEFAULT_LANG,
  mapTgLang,
  normalizeLang,
  t,
  langButtonsRows,
};
