const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const draftsController = require('../controllers/draftsController')

const router = express.Router();

// drafts route : get and save drafts
router.get('/', authMiddleware, draftsController.getDrafts);
router.post('/', authMiddleware, draftsController.saveDraft);
router.put('/:id/mark-posted', authMiddleware, draftsController.markDraftAsPosted);

module.exports = router; 