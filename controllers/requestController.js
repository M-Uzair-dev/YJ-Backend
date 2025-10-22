const mongoose = require("mongoose");
const Request = require("../models/Request");
const User = require("../models/User");
const Transaction = require("../models/Transaction");

// Plan pricing structure
const PLAN_PRICING = {
  knowic: { price: 24, direct: 16, passive: 2 },
  learnic: { price: 59, direct: 40, passive: 4 },
  masteric: { price: 130, direct: 85, passive: 7 },
};

// Plan hierarchy rules
const PLAN_HIERARCHY = {
  knowic: ["knowic"],
  learnic: ["knowic", "learnic"],
  masteric: ["knowic", "learnic", "masteric"],
};

// @desc    Create a new request
// @route   POST /api/requests
// @access  Private
exports.createRequest = async (req, res) => {
  try {
    const { user_id, plan } = req.body;
    const sender_id = req.user._id;

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Proof image is required",
      });
    }

    const proof_image = req.file.path; // File path from multer

    // Validate user exists and is pending
    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "User is not in pending status",
      });
    }

    // Check if user has a referrer
    if (user.referral_of) {
      // User has a referrer - only that referrer can create request
      if (user.referral_of.toString() !== sender_id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Only the referrer can create a request for this user",
        });
      }

      // Validate sender's plan permits the selected plan
      const sender = await User.findById(sender_id);
      if (!sender.plan) {
        return res.status(400).json({
          success: false,
          message: "You must have an active plan to create requests",
        });
      }

      const allowedPlans = PLAN_HIERARCHY[sender.plan];
      if (!allowedPlans.includes(plan)) {
        return res.status(400).json({
          success: false,
          message: `Your plan (${sender.plan}) does not allow referring ${plan} users`,
        });
      }
    } else {
      // User has no referrer - only they can create their own request
      if (user_id.toString() !== sender_id.toString()) {
        return res.status(403).json({
          success: false,
          message:
            "This user has no referrer. Only they can create their own request",
        });
      }
    }

    // Check if pending request already exists for this user
    const existingRequest = await Request.findOne({
      user_id,
      status: "pending",
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: "A pending request already exists for this user",
      });
    }

    // Create request
    const request = await Request.create({
      user_id,
      sender_id,
      proof_image,
      plan,
    });

    const populatedRequest = await Request.findById(request._id)
      .populate("user_id", "name email")
      .populate("sender_id", "name email");

    res.status(201).json({
      success: true,
      message: "Request created successfully",
      request: populatedRequest,
    });
  } catch (error) {
    console.error("Create request error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Get all requests (with pagination and status filter)
// @route   GET /api/requests
// @access  Private (Admin)
exports.getAllRequests = async (req, res) => {
  try {
    // Get query parameters with defaults
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status || "pending"; // Default to pending only

    // Calculate skip value for pagination
    const skip = (page - 1) * limit;

    // Build query filter
    const filter = status === "all" ? {} : { status };

    // Get total count for pagination
    const total = await Request.countDocuments(filter);

    // Get paginated requests
    const requests = await Request.find(filter)
      .populate("user_id", "name email referral_code")
      .populate("sender_id", "name email referral_code")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Add expected payment amount to each request
    const requestsWithPayment = requests.map((request) => {
      const planPricing = PLAN_PRICING[request.plan];
      const isSelfApproval = request.user_id._id.toString() === request.sender_id._id.toString();
      const expectedPayment = isSelfApproval
        ? planPricing.price
        : planPricing.price - planPricing.direct;

      return {
        ...request.toObject(),
        expectedPayment,
        isSelfApproval,
      };
    });

    res.status(200).json({
      success: true,
      count: requestsWithPayment.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      requests: requestsWithPayment,
    });
  } catch (error) {
    console.error("Get all requests error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Approve a request
// @route   POST /api/requests/approve/:id
// @access  Private (Admin)
exports.approveRequest = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;

    // Find the request
    const request = await Request.findById(id).session(session);
    if (!request) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Request not found",
      });
    }

    if (request.status !== "pending") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Request has already been processed",
      });
    }

    // Update request status
    request.status = "approved";
    await request.save({ session });

    // Update user status and plan
    const user = await User.findById(request.user_id).session(session);
    user.status = "active";
    user.plan = request.plan;
    await user.save({ session });

    // Get plan pricing
    const pricing = PLAN_PRICING[request.plan];

    // Check if user has a referrer (sender is the referrer)
    if (
      user.referral_of &&
      user.referral_of.toString() !== request.user_id.toString()
    ) {
      // Give direct income to sender
      const sender = await User.findById(request.sender_id).session(session);
      sender.direct_income += pricing.direct;
      sender.balance += pricing.direct;
      await sender.save({ session });

      // Create direct transaction
      await Transaction.create(
        [
          {
            user_id: sender._id,
            type: "direct",
            amount: pricing.direct,
          },
        ],
        { session }
      );

      // Give passive income to sender's referrer (if exists)
      if (sender.referral_of) {
        const grandReferrer = await User.findById(sender.referral_of).session(
          session
        );
        if (grandReferrer) {
          grandReferrer.passive_income += pricing.passive;
          grandReferrer.balance += pricing.passive;
          await grandReferrer.save({ session });

          // Create passive transaction
          await Transaction.create(
            [
              {
                user_id: grandReferrer._id,
                type: "passive",
                amount: pricing.passive,
              },
            ],
            { session }
          );
        }
      }
    }

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    const updatedRequest = await Request.findById(id)
      .populate("user_id", "name email status plan")
      .populate("sender_id", "name email");

    res.status(200).json({
      success: true,
      message: "Request approved successfully",
      request: updatedRequest,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Approve request error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Reject a request
// @route   POST /api/requests/reject/:id
// @access  Private (Admin)
exports.rejectRequest = async (req, res) => {
  try {
    const { id } = req.params;

    // Find and delete the request
    const request = await Request.findById(id);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Request not found",
      });
    }

    if (request.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Only pending requests can be rejected",
      });
    }

    // Delete the request
    await Request.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Request rejected and deleted successfully",
    });
  } catch (error) {
    console.error("Reject request error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
