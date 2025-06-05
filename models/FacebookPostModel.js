const mongoose = require('mongoose');

const FacebookPostSchema = new mongoose.Schema({
  facebookAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'FacebookAccount', required: true },
  postedTo: { type: String, enum: ['page', 'feed'], required: true },
  pageId: { type: String, default: null },
  pageName: { type: String, default: null },
  imageUrl: { type: String, required: true },
  caption: { type: String, required: true },
  facebookPostId: { type: String },
  postedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('FacebookPost', FacebookPostSchema);