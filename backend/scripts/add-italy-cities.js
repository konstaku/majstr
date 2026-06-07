/**
 * Idempotent: adds Bergamo and Palermo to the Location collection.
 *
 * Both were missing from the initial city list — Bergamo has one of the
 * largest Ukrainian communities in Lombardy; Palermo is Sicily's capital
 * and the largest Sicilian city (Catania + Messina were already present).
 *
 * Run: `cd backend && node scripts/add-italy-cities.js`
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const mongoose = require('mongoose');

const Location = require('../database/schema/Location');

const NEW_CITIES = [
  {
    id: 'bergamo',
    countryID: 'IT',
    name: {
      en: 'Bergamo',
      it: 'Bergamo',
      ua: 'Бергамо',
      ua_alt: 'Бергамо',
      ru: 'Бергамо',
      ru_alt: 'Бергамо',
    },
  },
  {
    id: 'palermo',
    countryID: 'IT',
    name: {
      en: 'Palermo',
      it: 'Palermo',
      ua: 'Палермо',
      ua_alt: 'Палермо',
      ru: 'Палермо',
      ru_alt: 'Палермо',
    },
  },
];

async function main() {
  const uri = `mongodb+srv://0864380:${process.env.MONGO_PASSWORD}@piglets.vfyjg2w.mongodb.net/`;
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  for (const city of NEW_CITIES) {
    const existing = await Location.findOne({ id: city.id });
    if (existing) {
      console.log(`[skip] ${city.id} already exists`);
      continue;
    }
    const created = await Location.create(city);
    console.log(`[created] ${created.id} (_id ${created._id})`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
