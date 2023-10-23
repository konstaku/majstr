const { default: mongoose } = require('mongoose');

const masterSchema = new mongoose.Schema({
  name: String,
  professionID: String,
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
});

module.exports = mongoose.model('Master', masterSchema);
