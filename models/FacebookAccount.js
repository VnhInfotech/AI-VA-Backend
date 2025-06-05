const mongoose = require('mongoose');

const FacebookAccountSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    facebookId: { type: String, required: true }, 
    name: String,
    email: String,
    profilePicture: String,
    accessToken: String,
    tokenExpiry: Date,
    isEnabled: { type: Boolean, default: true },
}, { timestamps: true });

FacebookAccountSchema.index({ user: 1, facebookId: 1 }, { unique: true });

module.exports = mongoose.model('FacebookAccount', FacebookAccountSchema);
