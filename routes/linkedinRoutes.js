const express = require('express');
const linkedinController = require('../controllers/linkedinController');

const router = express.Router();

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.session.userId) { // Check if user is logged in
        return next();
    }
    return res.status(401).json({ message: 'User not authenticated' });
};

// Route to redirect to LinkedIn for authentication
router.get('/auth/linkedin', isAuthenticated, linkedinController.redirectToLinkedIn); // Ensure user is authenticated

// Route to handle LinkedIn callback
router.get('/auth/linkedin/callback', linkedinController.handleLinkedInCallback);

// Route to post to LinkedIn
router.post('/auth/linkedin/post', isAuthenticated, linkedinController.postToLinkedIn);

module.exports = router; 