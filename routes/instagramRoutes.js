const express = require('express');
const instagramController = require('../controllers/instagramController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// insta OAuth Routes
router.get('/instagram/redirect', instagramController.redirectToInstagram);
router.get('/instagram/callback', instagramController.handleInstagramCallback);
router.get('/instagram/accounts', authMiddleware, instagramController.getInstagramAccounts);
router.post('/instagram/post', authMiddleware, instagramController.publishInstagramPost);
module.exports = router;