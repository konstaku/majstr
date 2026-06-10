const { default: mongoose } = require('mongoose');

const locationSchema = new mongoose.Schema({
  id: { type: String, index: true },
  countryID: { type: String, index: true },
  name: {
    en: String,
    ua: String,
    ua_alt: String,
    ru: String,
    ru_alt: String,
    it: String,
    pt: String,
    de: String,
    fr: String,
    tr: String,
    es: String,
  },
});

module.exports = mongoose.model('Location', locationSchema);
