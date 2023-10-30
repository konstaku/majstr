const { default: mongoose } = require('mongoose');

const userSchema = new mongoose.Schema({
  id: Number,
  token: String,
  firstName: String,
  lastName: String,
  username: String,
  isAdmin: {
    type: Boolean,
    default: false,
  },
});

module.exports = mongoose.model('User', userSchema);
