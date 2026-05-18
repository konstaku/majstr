const { default: mongoose } = require('mongoose');

const profCategorySchema = new mongoose.Schema({
  id: String,
  name: {
    en: String,
    ua: String,
    ru: String,
    it: String,
    pt: String,
    de: String,
    fr: String,
    tr: String,
  },
});

module.exports = mongoose.model('ProfCategory', profCategorySchema);
