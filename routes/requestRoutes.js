const express = require('express');
const router = express.Router();
const {
  createRequest,
  getAllRequests,
  approveRequest,
  rejectRequest,
} = require('../controllers/requestController');
const { protect, authorize } = require('../middleware/auth');
const { createRequestValidation, validate } = require('../middleware/validators');
const upload = require('../utils/upload');

// @route   POST /api/requests
router.post('/', protect, upload.single('proof_image'), createRequestValidation, validate, createRequest);

// @route   GET /api/requests
router.get('/', protect, authorize('admin'), getAllRequests);

// @route   POST /api/requests/approve/:id
router.post('/approve/:id', protect, authorize('admin'), approveRequest);

// @route   POST /api/requests/reject/:id
router.post('/reject/:id', protect, authorize('admin'), rejectRequest);

module.exports = router;
