const express = require('express');
const router = express.Router();
const { getMe } = require('../controllers/userController');
const { protect } = require('../middleware/auth');

// @route   GET /api/me
router.get('/me', protect, getMe);

module.exports = router;
