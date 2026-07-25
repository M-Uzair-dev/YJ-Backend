const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

// Ensure stories directory exists
const storiesDir = 'stories';
if (!fs.existsSync(storiesDir)) {
  fs.mkdirSync(storiesDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'stories/');
  },
  filename: function (req, file, cb) {
    // Generate unique filename: story-timestamp-randomhex.ext
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, 'story-' + uniqueSuffix + ext);
  },
});

// File filter - accept images and videos only
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg'];

const fileFilter = (req, file, cb) => {
  if (IMAGE_TYPES.includes(file.mimetype) || VIDEO_TYPES.includes(file.mimetype)) {
    return cb(null, true);
  }
  cb(
    new Error(
      'Only images (JPG, PNG, WEBP, GIF) and videos (MP4, WEBM, MOV, OGG) are allowed'
    )
  );
};

// Configure multer
const storyUpload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max per story
    files: 1,
  },
  fileFilter: fileFilter,
});

// Multer error handling middleware
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum allowed size is 50MB.',
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message || 'File upload error',
    });
  }

  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || 'File upload failed',
    });
  }

  next();
};

module.exports = storyUpload;
module.exports.handleMulterError = handleMulterError;
module.exports.VIDEO_TYPES = VIDEO_TYPES;
