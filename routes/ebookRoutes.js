const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const ebookUpload = require("../utils/ebookUpload");
const { handleMulterError } = require("../utils/ebookUpload");
const {
  uploadEbook,
  getEbooks,
  deleteEbook,
} = require("../controllers/ebookController");

// Upload ebook - Admin only (with multer error handling)
router.post(
  "/",
  protect,
  authorize("admin"),
  (req, res, next) => {
    console.log(`[Route] POST /api/ebooks - Upload initiated by: ${req.user?.email}`);
    ebookUpload.single("pdfFile")(req, res, (err) => {
      if (err) {
        return handleMulterError(err, req, res, next);
      }
      next();
    });
  },
  uploadEbook
);

// Get ebooks - All authenticated users (filtered by role/plan in controller)
router.get("/", protect, getEbooks);

// Delete ebook - Admin only
router.delete("/:id", protect, authorize("admin"), deleteEbook);

module.exports = router;
