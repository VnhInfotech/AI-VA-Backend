const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    password: {
        type: String,
        required: false
    },
    name: {
        type: String,
        required: true
    },
    googleId: {
        type: String,
        sparse: true
    },
    profilePicture: {
        type: String,
    },
    linkedinId: { type: String, required: false, unique: true },
    accessToken: { type: String, required: false },
    createdAt: { type: Date, default: Date.now }
});

UserSchema.pre('save', async function(next) {
    try {
        if (!this.isModified('password')) {
            return next();
        }
        console.log('Hashing password for user:', this.email); // Debug log
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        console.log('Password hashed successfully'); // Debug log
        next();
    } catch (error) {
        console.error('Error in password hashing:', error); // Debug log
        next(error);
    }
});

module.exports = mongoose.model('User', UserSchema); 