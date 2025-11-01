const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

// Ensure ebooks directory exists
const ebooksDir = 'ebooks';
if (!fs.existsSync(ebooksDir)) {
  fs.mkdirSync(ebooksDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'ebooks/'); // Store in ebooks directory
  },
  filename: function (req, file, cb) {
    // Generate unique filename: timestamp-randomhex-originalname
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    // Sanitize basename
    const sanitizedBasename = basename.replace(/[^a-zA-Z0-9-_]/g, '_');
    cb(null, 'ebook-' + uniqueSuffix + '-' + sanitizedBasename + ext);
  }
});

// File filter - only accept PDFs
const fileFilter = (req, file, cb) => {
  console.log(`[Multer] Processing file: ${file.originalname} (${file.mimetype})`);

  const allowedTypes = /pdf/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = file.mimetype === 'application/pdf';

  if (mimetype && extname) {
    console.log(`[Multer] File validation passed: ${file.originalname}`);
    return cb(null, true);
  } else {
    console.error(`[Multer] File validation failed: ${file.originalname} (mimetype: ${file.mimetype})`);
    cb(new Error('Only PDF files are allowed'));
  }
};

// Configure multer with explicit limits
const ebookUpload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size (generous limit for production)
    files: 1, // Only one file at a time
  },
  fileFilter: fileFilter,
});

// Add error handling middleware
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error('[Multer Error]:', err.message);

    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum allowed size is 100MB.',
      });
    }

    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Only one file can be uploaded at a time.',
      });
    }

    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected file field. Please upload using the "pdfFile" field.',
      });
    }

    return res.status(400).json({
      success: false,
      message: err.message || 'File upload error',
    });
  }

  if (err) {
    console.error('[Upload Error]:', err.message);
    return res.status(400).json({
      success: false,
      message: err.message || 'File upload failed',
    });
  }

  next();
};

module.exports = ebookUpload;
module.exports.handleMulterError = handleMulterError;
