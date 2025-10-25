const express = require('express');
const router = express.Router();
const {
  getMe,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  loadMoreTransactions,
  loadMoreReferrals,
  loadMorePendingUsers,
  updateProfile,
  changePassword,
  getIncomeStats,
  getAdminDashboardStats,
  uploadProfileImage
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

// @route   GET /api/admin/dashboard-stats
router.get('/admin/dashboard-stats', protect, authorize('admin'), getAdminDashboardStats);

// @route   GET /api/users
router.get('/users', protect, authorize('admin'), getAllUsers);

// @route   GET /api/users/:id
router.get('/users/:id', protect, authorize('admin'), getUserById);

// @route   PUT /api/users/:id
router.put('/users/:id', protect, authorize('admin'), updateUser);

// @route   DELETE /api/users/:id
router.delete('/users/:id', protect, authorize('admin'), deleteUser);

// @route   GET /api/me
router.get('/me', protect, getMe);

// @route   GET /api/me/income-stats
router.get('/me/income-stats', protect, getIncomeStats);

// @route   PUT /api/me/profile
router.put('/me/profile', protect, updateProfile);

// @route   PUT /api/me/password
router.put('/me/password', protect, changePassword);

// @route   PUT /api/me/profile-image
router.put('/me/profile-image', protect, upload.single('profileImage'), uploadProfileImage);

// @route   GET /api/me/transactions/load-more
router.get('/me/transactions/load-more', protect, loadMoreTransactions);

// @route   GET /api/me/referrals/load-more
router.get('/me/referrals/load-more', protect, loadMoreReferrals);

// @route   GET /api/me/pending-users/load-more
router.get('/me/pending-users/load-more', protect, loadMorePendingUsers);

module.exports = router;
