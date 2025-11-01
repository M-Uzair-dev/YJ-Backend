const express = require('express');
const router = express.Router();
const upgradeRequestController = require('../controllers/upgradeRequestController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../utils/upload');

// User routes
router.post(
  '/',
  protect,
  upgradeRequestController.createUpgradeRequest
);

router.get(
  '/my-request',
  protect,
  upgradeRequestController.getUserUpgradeRequest
);

// Get upgrade requests where user is the new referrer
router.get(
  '/referrer-requests',
  protect,
  upgradeRequestController.getReferrerUpgradeRequests
);

// Referrer approves with proof upload
router.post(
  '/referrer-approve/:id',
  protect,
  upload.single('proof_image'),
  upgradeRequestController.referrerApproveRequest
);

// Referrer rejects
router.post(
  '/referrer-reject/:id',
  protect,
  upgradeRequestController.referrerRejectRequest
);

// Admin routes
router.get(
  '/all',
  protect,
  authorize('admin'),
  upgradeRequestController.getAllUpgradeRequests
);

router.post(
  '/approve/:id',
  protect,
  authorize('admin'),
  upgradeRequestController.approveUpgradeRequest
);

router.post(
  '/reject/:id',
  protect,
  authorize('admin'),
  upgradeRequestController.rejectUpgradeRequest
);

module.exports = router;
