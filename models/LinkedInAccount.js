const mongoose = require('mongoose');

const LinkedInAccountSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    linkedinId: { type: String, required: true },
    name: String,
    email: String,
    profilePicture: String,
    accessToken: String,
    isEnabled: { type: Boolean, default: true },
}, { timestamps: true });

LinkedInAccountSchema.index({ user: 1, linkedinId: 1 }, { unique: true });

module.exports = mongoose.model('LinkedInAccount', LinkedInAccountSchema);
