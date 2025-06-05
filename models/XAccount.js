const mongoose = require('mongoose');

const XAccountSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  twitterId: { type: String, required: true }, 
  username: String,
  name: String,
  email: String, 
  profilePicture: String,
  accessToken: String,
  accessTokenSecret: String,
  tokenExpiry: Date, 
  isEnabled: { type: Boolean, default: true },
}, { timestamps: true });

XAccountSchema.index({ user: 1, twitterId: 1 }, { unique: true });

module.exports = mongoose.model('XAccount', XAccountSchema);
