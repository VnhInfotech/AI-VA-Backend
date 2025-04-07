const mongoose = require('mongoose');

const GeneratedPostSchema = new mongoose.Schema({
    originalContent: { type: String, required: true },
    generatedContent: { type: String, required: true }
});

module.exports = mongoose.model('GeneratedPost', GeneratedPostSchema);
