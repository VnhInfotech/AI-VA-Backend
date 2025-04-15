const auth = require('../middleware/authMiddleware.js');
const express = require('express');
const { register, login } = require('../controllers/authController');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);

// Google OAuth routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    const token = jwt.sign({ id: req.user.id }, process.env.JWT_SECRET);
    res.redirect(`http://localhost:3000/auth-success?token=${token}`);
  }
);

router.get('/test', async (req, res) => {
    try {
        // Try to count users
        const count = await User.countDocuments();
        res.json({ 
            status: 'Database working!',
            userCount: count 
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'Database error',
            error: error.message 
        });
    }
});

router.get('/linkedin/user', auth, async (req, res) => {
    try {
      const user = await User.findById(req.user.id).select('name email profileImage linkedinId');
      if (!user) return res.status(404).json({ msg: 'User not found' });
      res.json(user);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
});
  
module.exports = router; 