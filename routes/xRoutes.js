const express = require('express');
const xController = require('../controllers/xController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/x/redirect', xController.redirectToX);
router.get('/x/callback', xController.handleXCallback);
router.post('/x/post', authMiddleware, xController.postXImageTweet);
router.get('/x/accounts', authMiddleware, xController.getXAccounts);

module.exports = router;
