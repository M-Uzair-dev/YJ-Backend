const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const ebookUpload = require("../utils/ebookUpload");
const {
  uploadEbook,
  getEbooks,
  deleteEbook,
} = require("../controllers/ebookController");

// Upload ebook - Admin only
router.post(
  "/",
  protect,
  authorize("admin"),
  ebookUpload.single("pdfFile"),
  uploadEbook
);

// Get ebooks - All authenticated users (filtered by role/plan in controller)
router.get("/", protect, getEbooks);

// Delete ebook - Admin only
router.delete("/:id", protect, authorize("admin"), deleteEbook);

module.exports = router;
