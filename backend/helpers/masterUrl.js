// Mirror of web/lib/data.ts slugify + masterSlug. Must stay in sync.
const TRANSLIT = {
  а:'a',б:'b',в:'v',г:'h',ґ:'g',д:'d',е:'e',є:'ie',ё:'e',ж:'zh',з:'z',
  и:'y',і:'i',ї:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',
  с:'s',т:'t',у:'u',ф:'f',х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'shch',
  ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya',
};

function slugify(input) {
  const latin = (input || '').toLowerCase().split('').map(c => (c in TRANSLIT ? TRANSLIT[c] : c)).join('');
  return latin.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function masterSlug(master) {
  const name = slugify(master.name) || 'master';
  return `${name}-${master.professionID}-${master.locationID}-${master._id.toString().slice(-6)}`;
}

// Next.js site only supports uk + ru. Everything else falls back to uk.
function masterWebUrl(master, uiLang, siteUrl) {
  const lang = uiLang === 'ru' ? 'ru' : 'uk';
  return `${siteUrl}/${lang}/m/${masterSlug(master)}`;
}

// Per-country host for a card. The public catalogue is country-scoped (each host
// owns its dataset), so a France card only renders on fr.majstr.xyz — linking to
// the Italy apex just bounces to its homepage. Mirrors
// scripts/set-community-invite.js:siteForCountry.
function siteForCountry(countryID, base) {
  if (countryID === 'FR') return base.replace('://', '://fr.');
  return base;
}

// Canonical card URL on the card's OWN country host. Prefer this over
// masterWebUrl for any link handed to a user — it resolves regardless of country.
function masterCardUrl(master, uiLang, base) {
  return masterWebUrl(master, uiLang, siteForCountry(master.countryID, base));
}

module.exports = { slugify, masterSlug, masterWebUrl, siteForCountry, masterCardUrl };
