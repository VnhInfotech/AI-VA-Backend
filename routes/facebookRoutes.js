const express = require('express');
const facebookController = require('../controllers/facebookController');
const authMiddleware = require('../middleware/authMiddleware');
const FacebookAccount = require('../models/FacebookAccount');
const User = require('../models/User');

const router = express.Router();

// Facebook OAuth Routes
router.get('/facebook/redirect', facebookController.redirectToFacebook);
router.get('/facebook/callback', facebookController.handleFacebookCallback);
router.patch('/facebook/delete/:accountId', authMiddleware, facebookController.disconnectFacebookAccount);
router.get('/facebook/accounts', authMiddleware, facebookController.getFacebookAccounts);
router.post('/facebook/post', authMiddleware, facebookController.postToFacebook);
router.post('/facebook/log-feed-post', authMiddleware, facebookController.logFeedPost);
router.get("/facebook/pages/:accountId", authMiddleware, facebookController.getUserPages);
router.post("/facebook/schedule", authMiddleware, facebookController.scheduleFacebookPagePost);
router.get('/facebook/webhook', facebookController.getWebhookCall);
router.post('/facebook/webhook', facebookController.handleWebhookEvent);

// get user profile
router.get('/facebook/user', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('name email profilePicture');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

module.exports = router;