const { default: mongoose } = require('mongoose');

const professionSchema = new mongoose.Schema({
  id: String,
  categoryID: String,
  name: {
    ua: String,
    en: String,
    ru: String,
  },
});

module.exports = mongoose.model('Profession', professionSchema);
