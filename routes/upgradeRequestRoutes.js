const express = require('express');
const router = express.Router();
const upgradeRequestController = require('../controllers/upgradeRequestController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../utils/upload');

// User routes
router.post(
  '/',
  protect,
  upload.single('proof_image'),
  upgradeRequestController.createUpgradeRequest
);

router.get(
  '/my-request',
  protect,
  upgradeRequestController.getUserUpgradeRequest
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
