const express = require('express');
const router = express.Router();
const { getDiscounts, updateDiscounts } = require('../controllers/discountController');
const { protect, authorize } = require('../middleware/auth');

// Public route - anyone can view discounts
router.get('/discounts', getDiscounts);

// Admin only - update discounts
router.put('/discounts', protect, authorize('admin'), updateDiscounts);

module.exports = router;
