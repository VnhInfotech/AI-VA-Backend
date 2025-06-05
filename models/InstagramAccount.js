const mongoose = require('mongoose');

const InstagramAccountSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  instagramId: { type: String, required: true },
  username: { type: String },
  accountType: { type: String },
  accessToken: { type: String },
  email: String,
  profilePicture: String,
  tokenExpiry: Date,
  isEnabled: { type: Boolean, default: true },
}, { timestamps: true });

InstagramAccountSchema.index({ user: 1, instagramId: 1 }, { unique: true });

module.exports = mongoose.model('InstagramAccount', InstagramAccountSchema);
