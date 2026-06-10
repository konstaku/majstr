const { default: mongoose } = require('mongoose');

const userSchema = new mongoose.Schema({
  // Looked up on every authenticated request (requireAuth / requireMiniAppAuth).
  // Non-unique: historical duplicates and the TMA upsert race make a unique
  // index unsafe without a prior dedup pass.
  telegramID: { type: Number, index: true },
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
