const { default: mongoose } = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramID: Number,
  token: String,
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
});

module.exports = mongoose.model('User', userSchema);
