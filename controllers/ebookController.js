const Ebook = require("../models/Ebook");
const fs = require("fs");
const path = require("path");

// @desc    Upload a new ebook
// @route   POST /api/ebooks
// @access  Admin only
exports.uploadEbook = async (req, res) => {
  const startTime = Date.now();
  console.log("\n========== EBOOK UPLOAD STARTED ==========");
  console.log(`[${new Date().toISOString()}] Upload initiated by admin: ${req.user?.email || 'Unknown'}`);

  try {
    const { title, description, accentColor, plan } = req.body;

    console.log("Request body:", {
      title,
      description: description?.substring(0, 50) + "...",
      accentColor,
      plan,
    });

    // Log file information
    if (req.file) {
      console.log("File details:", {
        originalName: req.file.originalname,
        filename: req.file.filename,
        mimetype: req.file.mimetype,
        size: `${(req.file.size / 1024 / 1024).toFixed(2)} MB`,
        path: req.file.path,
      });
    } else {
      console.error("ERROR: No file uploaded in request");
    }

    // Validate required fields
    if (!title || !description || !plan) {
      console.error("ERROR: Missing required fields", { title: !!title, description: !!description, plan: !!plan });

      // Delete uploaded file if validation fails
      if (req.file) {
        console.log("Cleaning up uploaded file due to validation error...");
        fs.unlinkSync(req.file.path);
      }

      return res.status(400).json({
        success: false,
        message: "Please provide title, description, and plan",
      });
    }

    // Validate plan
    if (!["knowic", "learnic", "masteric"].includes(plan)) {
      console.error("ERROR: Invalid plan value:", plan);

      if (req.file) {
        console.log("Cleaning up uploaded file due to invalid plan...");
        fs.unlinkSync(req.file.path);
      }

      return res.status(400).json({
        success: false,
        message: "Invalid plan. Must be knowic, learnic, or masteric",
      });
    }

    // Check if file was uploaded
    if (!req.file) {
      console.error("ERROR: No PDF file uploaded");
      return res.status(400).json({
        success: false,
        message: "Please upload a PDF file",
      });
    }

    console.log("Creating ebook document in database...");

    // Create ebook document
    const ebook = await Ebook.create({
      title,
      description,
      accentColor: accentColor || "#3B82F6",
      plan,
      pdfFile: req.file.filename,
    });

    const duration = Date.now() - startTime;
    console.log(`SUCCESS: Ebook created successfully (ID: ${ebook._id})`);
    console.log(`Upload duration: ${(duration / 1000).toFixed(2)} seconds`);
    console.log("========== EBOOK UPLOAD COMPLETED ==========\n");

    res.status(201).json({
      success: true,
      message: "Ebook uploaded successfully",
      data: ebook,
    });
  } catch (error) {
    const duration = Date.now() - startTime;

    // Delete uploaded file if database operation fails
    if (req.file && fs.existsSync(req.file.path)) {
      console.log("Cleaning up uploaded file due to error...");
      try {
        fs.unlinkSync(req.file.path);
        console.log("File cleanup successful");
      } catch (cleanupError) {
        console.error("ERROR: File cleanup failed:", cleanupError.message);
      }
    }

    console.error("========== EBOOK UPLOAD FAILED ==========");
    console.error("Error type:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    console.error(`Failed after: ${(duration / 1000).toFixed(2)} seconds`);
    console.error("==========================================\n");

    res.status(500).json({
      success: false,
      message: error.message || "Error uploading ebook",
      error: process.env.NODE_ENV === "development" ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
    });
  }
};

// @desc    Get all ebooks (grouped by plan for admin, hierarchical access for users)
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
      // Regular users get hierarchical access based on their plan
      if (!userPlan) {
        return res.status(200).json({
          success: true,
          data: [],
        });
      }

      // Define hierarchical access
      // Knowic: only knowic ebooks
      // Learnic: knowic + learnic ebooks
      // Masteric: knowic + learnic + masteric ebooks (all)
      let allowedPlans = [];
      if (userPlan === "knowic") {
        allowedPlans = ["knowic"];
      } else if (userPlan === "learnic") {
        allowedPlans = ["knowic", "learnic"];
      } else if (userPlan === "masteric") {
        allowedPlans = ["knowic", "learnic", "masteric"];
      }

      ebooks = await Ebook.find({ plan: { $in: allowedPlans } }).sort({ createdAt: -1 });

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
