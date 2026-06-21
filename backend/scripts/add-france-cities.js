/**
 * Idempotent: seeds France as a country + the launch cities on the Côte d'Azur
 * (plus Marseille and Montpellier) into the Country / Location collections.
 *
 * Launch region: Provence-Alpes-Côte d'Azur, plus Montpellier (Occitanie).
 * Region is NOT stored on Location (the SEO layer maps it via CITY_REGION); only
 * the multilingual city names live here.
 *
 * NOTE: the `ua_alt` / `ru_alt` (prepositional) forms below are a first draft and
 * need a native-speaker pass before launch — they render in public SEO copy
 * ("майстри у Ніцці"). Saint-Tropez / Montpellier are indeclinable (alt == nom).
 *
 * Run: `cd backend && node scripts/add-france-cities.js`
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const mongoose = require('mongoose');

const Country = require('../database/schema/Country');
const Location = require('../database/schema/Location');

const FRANCE = {
  id: 'FR',
  flag: '🇫🇷',
  name: {
    en: 'France',
    ua: 'Франція',
    ru: 'Франция',
    it: 'Francia',
    pt: 'França',
    de: 'Frankreich',
    fr: 'France',
    tr: 'Fransa',
    es: 'Francia',
  },
};

const NEW_CITIES = [
  { id: 'nice', name: { en: 'Nice', fr: 'Nice', ua: 'Ніцца', ua_alt: 'Ніцці', ru: 'Ницца', ru_alt: 'Ницце' } },
  { id: 'marseille', name: { en: 'Marseille', fr: 'Marseille', ua: 'Марсель', ua_alt: 'Марселі', ru: 'Марсель', ru_alt: 'Марселе' } },
  { id: 'cannes', name: { en: 'Cannes', fr: 'Cannes', ua: 'Канни', ua_alt: 'Каннах', ru: 'Канны', ru_alt: 'Каннах' } },
  { id: 'saint-tropez', name: { en: 'Saint-Tropez', fr: 'Saint-Tropez', ua: 'Сен-Тропе', ua_alt: 'Сен-Тропе', ru: 'Сен-Тропе', ru_alt: 'Сен-Тропе' } },
  { id: 'menton', name: { en: 'Menton', fr: 'Menton', ua: 'Ментон', ua_alt: 'Ментоні', ru: 'Ментон', ru_alt: 'Ментоне' } },
  { id: 'frejus', name: { en: 'Fréjus', fr: 'Fréjus', ua: 'Фрежюс', ua_alt: 'Фрежюсі', ru: 'Фрежюс', ru_alt: 'Фрежюсе' } },
  { id: 'toulon', name: { en: 'Toulon', fr: 'Toulon', ua: 'Тулон', ua_alt: 'Тулоні', ru: 'Тулон', ru_alt: 'Тулоне' } },
  { id: 'montpellier', name: { en: 'Montpellier', fr: 'Montpellier', ua: 'Монпельє', ua_alt: 'Монпельє', ru: 'Монпелье', ru_alt: 'Монпелье' } },
];

async function main() {
  const uri = `mongodb+srv://0864380:${process.env.MONGO_PASSWORD}@piglets.vfyjg2w.mongodb.net/`;
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const existingCountry = await Country.findOne({ id: FRANCE.id });
  if (existingCountry) {
    console.log(`[skip] country ${FRANCE.id} already exists`);
  } else {
    const created = await Country.create(FRANCE);
    console.log(`[created] country ${created.id} (_id ${created._id})`);
  }

  for (const city of NEW_CITIES) {
    const existing = await Location.findOne({ id: city.id });
    if (existing) {
      console.log(`[skip] ${city.id} already exists`);
      continue;
    }
    const created = await Location.create({ ...city, countryID: FRANCE.id });
    console.log(`[created] ${created.id} (_id ${created._id})`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
