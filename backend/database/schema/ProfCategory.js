const { default: mongoose } = require('mongoose');

const ProfCategorySchema = new mongoose.Schema({
  id: String,
  name: [
    {
      ua: String,
      en: String,
      ru: String,
    },
  ],
});

module.exports = mongoose.model('Location', ProfCategorySchema);
