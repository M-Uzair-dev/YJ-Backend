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
  const allowedTypes = /pdf/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = file.mimetype === 'application/pdf';

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'));
  }
};

// Configure multer
const ebookUpload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_EBOOK_SIZE) || 50 * 1024 * 1024, // 50MB default
  },
  fileFilter: fileFilter
});

module.exports = ebookUpload;
