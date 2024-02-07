const { default: mongoose } = require('mongoose');

const profCategorySchema = new mongoose.Schema({
  id: String,
  name: {
    en: String,
    ua: String,
    ru: String,
  },
});

module.exports = mongoose.model('ProfCategory', profCategorySchema);
