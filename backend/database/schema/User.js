const { default: mongoose } = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramID: Number,
  token: { type: String, default: null },
  firstName: String,
  lastName: String,
  username: String,
  photo: {
    type: String,
    default: null,
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  uiLanguage: {
    type: String,
    enum: ['uk', 'en', 'it', 'ru'],
    default: 'uk',
  },
});

module.exports = mongoose.model('User', userSchema);
