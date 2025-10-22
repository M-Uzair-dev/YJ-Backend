const Ebook = require("../models/Ebook");
const fs = require("fs");
const path = require("path");

// @desc    Upload a new ebook
// @route   POST /api/ebooks
// @access  Admin only
exports.uploadEbook = async (req, res) => {
  try {
    const { title, description, accentColor, plan } = req.body;

    // Validate required fields
    if (!title || !description || !plan) {
      // Delete uploaded file if validation fails
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        success: false,
        message: "Please provide title, description, and plan",
      });
    }

    // Validate plan
    if (!["knowic", "learnic", "masteric"].includes(plan)) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        success: false,
        message: "Invalid plan. Must be knowic, learnic, or masteric",
      });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a PDF file",
      });
    }

    // Create ebook document
    const ebook = await Ebook.create({
      title,
      description,
      accentColor: accentColor || "#3B82F6",
      plan,
      pdfFile: req.file.filename,
    });

    res.status(201).json({
      success: true,
      message: "Ebook uploaded successfully",
      data: ebook,
    });
  } catch (error) {
    // Delete uploaded file if database operation fails
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.error("Upload ebook error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error uploading ebook",
    });
  }
};

// @desc    Get all ebooks (grouped by plan for admin, filtered by user's plan for users)
// @route   GET /api/ebooks
// @access  Private
exports.getEbooks = async (req, res) => {
  try {
    const userRole = req.user.role;
    const userPlan = req.user.plan;

    let ebooks;

    if (userRole === "admin") {
      // Admin gets all ebooks grouped by plan
      const knowicEbooks = await Ebook.find({ plan: "knowic" }).sort({ createdAt: -1 });
      const learnicEbooks = await Ebook.find({ plan: "learnic" }).sort({ createdAt: -1 });
      const mastericEbooks = await Ebook.find({ plan: "masteric" }).sort({ createdAt: -1 });

      return res.status(200).json({
        success: true,
        data: {
          knowic: knowicEbooks,
          learnic: learnicEbooks,
          masteric: mastericEbooks,
        },
      });
    } else {
      // Regular users get only their plan's ebooks
      if (!userPlan) {
        return res.status(200).json({
          success: true,
          data: [],
        });
      }

      ebooks = await Ebook.find({ plan: userPlan }).sort({ createdAt: -1 });

      return res.status(200).json({
        success: true,
        data: ebooks,
      });
    }
  } catch (error) {
    console.error("Get ebooks error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error fetching ebooks",
    });
  }
};

// @desc    Delete an ebook
// @route   DELETE /api/ebooks/:id
// @access  Admin only
exports.deleteEbook = async (req, res) => {
  try {
    const ebook = await Ebook.findById(req.params.id);

    if (!ebook) {
      return res.status(404).json({
        success: false,
        message: "Ebook not found",
      });
    }

    // Delete the PDF file from filesystem
    const filePath = path.join(__dirname, "..", "ebooks", ebook.pdfFile);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from database
    await Ebook.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Ebook deleted successfully",
    });
  } catch (error) {
    console.error("Delete ebook error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error deleting ebook",
    });
  }
};
