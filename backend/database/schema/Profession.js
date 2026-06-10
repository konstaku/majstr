const { default: mongoose } = require('mongoose');

const professionSchema = new mongoose.Schema({
  id: { type: String, index: true },
  categoryID: String,
  name: {
    ua: String,
    en: String,
    ru: String,
    it: String,
    pt: String,
    de: String,
    fr: String,
    tr: String,
    es: String,
  },
});

module.exports = mongoose.model('Profession', professionSchema);
