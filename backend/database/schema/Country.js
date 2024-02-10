const { default: mongoose } = require('mongoose');

const countrySchema = new mongoose.Schema({
  id: String,
  name: {
    en: String,
    ua: String,
    ua_alt: String,
    ru: String,
    ru_alt: String,
  },
  flag: String,
});

module.exports = mongoose.model('Country', countrySchema);
