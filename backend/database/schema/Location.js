const { default: mongoose } = require('mongoose');

const locationSchema = new mongoose.Schema({
  id: String,
  countryID: String,
  name: {
    en: String,
    ua: String,
    ua_alt: String,
    ru: String,
    ru_alt: String,
  },
});

module.exports = mongoose.model('Location', locationSchema);
