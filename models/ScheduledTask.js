const mongoose = require('mongoose');

const ScheduledTaskSchema = new mongoose.Schema({
    content: { type: String, required: true },
    scheduledTime: { type: Date, required: true },
    isSent: { type: Boolean, default: false },
    generatedPostId: { type: mongoose.Schema.Types.ObjectId, ref: 'GeneratedPost' } // 🔹 Added reference
});

module.exports = mongoose.model('ScheduledTask', ScheduledTaskSchema);
