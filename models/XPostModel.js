const mongoose = require('mongoose');

const XPostSchema = new mongoose.Schema({
  xAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'XAccount', required: true },
  content: { type: String, required: true },
  mediaUrls: [{ type: String }],
  tweetId: { type: String, required: true },
  postedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('XPost', XPostSchema);
