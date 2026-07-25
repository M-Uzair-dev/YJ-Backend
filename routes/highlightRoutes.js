const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const storyUpload = require('../utils/storyUpload');
const { handleMulterError } = require('../utils/storyUpload');
const {
  getHighlights,
  createHighlight,
  updateHighlight,
  deleteHighlight,
  uploadStory,
  deleteStory,
  moveStory,
} = require('../controllers/highlightController');

// Public - anyone can view highlights (landing page)
router.get('/', getHighlights);

// Admin - highlight CRUD
router.post('/', protect, authorize('admin'), createHighlight);
router.put('/:id', protect, authorize('admin'), updateHighlight);
router.delete('/:id', protect, authorize('admin'), deleteHighlight);

// Admin - story management
// No conflict with /:id above - those only match a single path segment
router.post(
  '/:id/stories',
  protect,
  authorize('admin'),
  (req, res, next) => {
    storyUpload.single('media')(req, res, (err) => {
      if (err) {
        return handleMulterError(err, req, res, next);
      }
      next();
    });
  },
  uploadStory
);
router.delete('/stories/:storyId', protect, authorize('admin'), deleteStory);
router.put('/stories/:storyId/move', protect, authorize('admin'), moveStory);

module.exports = router;
