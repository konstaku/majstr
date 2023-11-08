const { default: mongoose } = require('mongoose');

const masterSchema = new mongoose.Schema({
  name: String,
  professionID: String,
  countryID: {
    type: String,
    default: 'IT',
  },
  locationID: String,
  contacts: [
    {
      contactType: String,
      value: String,
    },
  ],
  about: String,
  photo: String,
  likes: { type: Number, default: 0 },
  tags: {
    ua: [String],
    en: [String],
  },
  approved: {
    type: Boolean,
    default: false,
  },
});

module.exports = mongoose.model('Master', masterSchema);
