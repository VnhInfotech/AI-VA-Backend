const mongoose = require('mongoose');

const LinkedInPostSchema = new mongoose.Schema({
  linkedinAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'LinkedInAccount', required: true },
  originalContent: { type: String, required: true },
  generatedContent: { type: String, required: true },
  postedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('LinkedInPost', LinkedInPostSchema);
