// Backend mirror of the frontend localizedName resolver. Used where the
// server renders reference-entity names (OG card image, bot messages).

const APP_LANGS = ['en', 'uk', 'ru', 'it', 'pt', 'de', 'fr', 'tr'];

function readKey(name, key) {
  const direct = name[key];
  if (typeof direct === 'string' && direct.trim()) return direct;
  if (key === 'uk' && typeof name.ua === 'string' && name.ua.trim()) return name.ua;
  if (key === 'ua' && typeof name.uk === 'string' && name.uk.trim()) return name.uk;
  return '';
}

// requested → en → uk → any non-empty → fallbackId. Never returns blank
// when any name exists, so missing translations degrade gracefully.
function localizedName(name, lang, fallbackId) {
  if (!name || typeof name !== 'object') return fallbackId || '';
  const chain = [lang, 'en', 'uk', 'ru', 'it', 'pt', 'de', 'fr', 'tr'];
  for (const l of chain) {
    const v = readKey(name, l);
    if (v) return v;
  }
  for (const k of Object.keys(name)) {
    if (typeof name[k] === 'string' && name[k].trim()) return name[k];
  }
  return fallbackId || '';
}

module.exports = { APP_LANGS, localizedName };
