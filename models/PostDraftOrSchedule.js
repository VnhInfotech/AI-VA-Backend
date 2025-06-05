const mongoose = require('mongoose');

const PostDraftOrSchedule = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    platform: { type: String, required: false }, // "LinkedIn"
    imageUrl: { type: String, required: true },
    content: { type: String, required: true },
    scheduledTime: { type: Date }, // optional for drafts
    isSent: { type: Boolean, default: false },
    isDraft: { type: Boolean, default: false },
    generatedPostId: { type: mongoose.Schema.Types.ObjectId, ref: 'GeneratedPost' },
    linkedinAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'LinkedInAccount' },
      facebookPageId: { type: String },
  facebookPostId: { type: String },
    status: { type: String, default: "pending" },
});

module.exports = mongoose.model('PostDraftOrSchedule', PostDraftOrSchedule);
