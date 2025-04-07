const express = require('express');
const { scheduleTask, getScheduledTasks, generatePostContent } = require('../controllers/schedulerController');

const router = express.Router();

router.post('/schedule', scheduleTask);
router.get('/tasks', getScheduledTasks);
router.post('/generatePost', generatePostContent);

module.exports = router; 