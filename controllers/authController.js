const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

exports.register = async (req, res) => {
    try {
        // Check MongoDB connection first
        if (mongoose.connection.readyState !== 1) {
            throw new Error('Database not connected');
        }

        const { name, email, password } = req.body;

        // Check if user already exists
        let user = await User.findOne({ email }).exec();
        if (user) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Create new user (password will be hashed by the pre-save middleware)
        user = new User({
            name: name || email.split('@')[0], // Use email prefix if name not provided
            email,
            password // Password will be hashed in the pre-save middleware
        });

        await user.save();

        // Create JWT token
        const token = jwt.sign(
            { userId: user._id, name: user.name, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(201).json({ 
            token,
            user: {
                id: user._id,
                email: user.email,
                name: user.name
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            message: error.message,
            connectionState: mongoose.connection.readyState 
        });
    }
};

exports.login = async (req, res) => {
    try {
        // Check MongoDB connection first
        if (mongoose.connection.readyState !== 1) {
            throw new Error('Database not connected');
        }

        const { email, password } = req.body;
        console.log('Login attempt for:', email); // Debug log

        // Check if user exists
        const user = await User.findOne({ email }).exec();
        if (!user) {
            console.log('User not found'); // Debug log
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        console.log('User found:', user.email); // Debug log
        console.log('Stored hashed password:', user.password); // Debug log
        
        // Check password using bcrypt compare
        const isMatch = await bcrypt.compare(password, user.password);
        console.log('Password match result:', isMatch); // Debug log

        if (!isMatch) {
            console.log('Password mismatch'); // Debug log
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Create JWT token
        const token = jwt.sign(
            { userId: user._id, name: user.name, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Send response with token and user data
        res.json({ 
            token,
            user: {
                id: user._id,
                email: user.email,
                name: user.name
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            message: error.message,
            connectionState: mongoose.connection.readyState 
        });
    }
}; 