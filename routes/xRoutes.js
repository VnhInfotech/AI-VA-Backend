const express = require('express');
const xController = require('../controllers/xController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/x/redirect', xController.redirectToX);
router.get('/x/callback', xController.handleXCallback);
router.post('/x/post', authMiddleware, xController.postImageTweetV1);
router.get('/x/accounts', authMiddleware, xController.getXAccounts);
router.patch('/x/delete/:accountId', authMiddleware, xController.disconnectXAccount);
module.exports = router;
