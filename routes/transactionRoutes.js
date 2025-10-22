const express = require('express');
const router = express.Router();
const { getAllTransactions } = require('../controllers/transactionController');
const { protect, authorize } = require('../middleware/auth');

// @route   GET /api/transactions
router.get('/', protect, authorize('admin'), getAllTransactions);

module.exports = router;
