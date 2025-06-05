const mongoose = require('mongoose');

const InstagramPostSchema = new mongoose.Schema({
    instagramAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'InstagramAccount', required: true },
    imageUrl: { type: String, required: true },
    caption: { type: String, required: true },
    instagramPostId: { type: String, default: null },
    postedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('InstagramPost', InstagramPostSchema);
