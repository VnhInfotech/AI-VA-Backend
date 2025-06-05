const express = require('express');
const linkedinController = require('../controllers/linkedinController');
const authMiddleware = require('../middleware/authMiddleware');
const LinkedInAccount = require('../models/LinkedInAccount');

const router = express.Router();

router.get('/linkedin/redirect', linkedinController.redirectToLinkedIn);
router.get('/linkedin/callback', linkedinController.handleLinkedInCallback);
router.post('/linkedin/post', authMiddleware, linkedinController.postToLinkedIn);
router.post('/linkedin/schedule', authMiddleware, linkedinController.scheduleLinkedInPost);

router.get('/linkedin/accounts', authMiddleware, linkedinController.getLinkedInAccounts);
router.patch('/linkedin/delete/:accountId', authMiddleware, linkedinController.disconnectLinkedInAccount);

// User profile (optional)
router.get('/linkedin/user', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('name email profilePicture');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
});

router.get('/test', (req, res) => {
    res.send('LinkedIn Route Works');
});

router.get('/accounts', authMiddleware, async (req, res) => {
    try {
      const userId = req.user.id;
      const accounts = await LinkedInAccount.find({ user: userId });
      res.json({ accounts });
    } catch (error) {
      console.error("Error fetching LinkedIn accounts:", error);
      res.status(500).json({ message: "Server Error" });
    }
  });
module.exports = router;
