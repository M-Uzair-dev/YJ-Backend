const express = require('express');
const router = express.Router();
const {
  createWithdrawal,
  getUserWithdrawals,
  getPendingWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
} = require('../controllers/withdrawController');
const { protect, authorize } = require('../middleware/auth');

// User routes
// @route   POST /api/withdraw
router.post('/withdraw', protect, createWithdrawal);

// @route   GET /api/withdraw
router.get('/withdraw', protect, getUserWithdrawals);

// Admin routes
// @route   GET /api/admin/withdraws/pending
router.get('/admin/withdraws/pending', protect, authorize('admin'), getPendingWithdrawals);

// @route   POST /api/admin/withdraws/:id/approve
router.post('/admin/withdraws/:id/approve', protect, authorize('admin'), approveWithdrawal);

// @route   POST /api/admin/withdraws/:id/reject
router.post('/admin/withdraws/:id/reject', protect, authorize('admin'), rejectWithdrawal);

module.exports = router;
