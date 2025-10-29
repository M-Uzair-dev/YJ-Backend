const User = require("../models/User");
const Transaction = require("../models/Transaction");
const Request = require("../models/Request");
const Ebook = require("../models/Ebook");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

// Plan pricing structure (same as in requestController)
const PLAN_PRICING = {
  knowic: { price: 24, direct: 16, passive: 2 },
  learnic: { price: 59, direct: 40, passive: 4 },
  masteric: { price: 130, direct: 85, passive: 7 },
};

// @desc    Get all users with pagination and search
// @route   GET /api/users
// @access  Private (Admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";
    const status = req.query.status || ""; // Add status filter

    // Build query
    const query = { role: { $ne: "admin" } };

    // Add status filter if provided
    if (status) {
      query.status = status;
    }

    // Add search filter if search term provided
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { referral_code: { $regex: search, $options: "i" } },
      ];
    }

    // Get total count
    const total = await User.countDocuments(query);

    // Get users with pagination
    const users = await User.find(query)
      .select("name email balance plan status")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    // For each user, get total referrals count
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const referralCount = await User.countDocuments({
          referral_of: user._id,
        });

        return {
          _id: user._id,
          name: user.name,
          email: user.email,
          plan: user.plan,
          status: user.status,
          totalReferrals: referralCount,
          totalIncome: user.balance,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: usersWithStats.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      users: usersWithStats,
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private (Admin only)
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Get user by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private (Admin only)
exports.updateUser = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { name, email, password, banned, plan } = req.body;

    const user = await User.findById(req.params.id).session(session);

    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const oldPlan = user.plan;

    // Update fields if provided
    if (name) user.name = name;
    if (email) user.email = email;
    if (password) user.password = password; // Will be hashed by pre-save hook
    if (banned !== undefined) user.banned = banned;
    if (plan !== undefined) user.plan = plan || null; // Allow setting to null/empty

    await user.save({ session });

    // If plan was changed, update the corresponding approved request
    if (plan !== undefined && oldPlan !== plan) {
      // Find the approved request for this user
      const approvedRequest = await Request.findOne({
        user_id: user._id,
        status: 'approved'
      }).session(session);

      if (approvedRequest) {
        // Update the request's plan to match the new plan
        approvedRequest.plan = plan || oldPlan;
        await approvedRequest.save({ session });
        console.log(`Updated request ${approvedRequest._id} plan from ${oldPlan} to ${plan}`);
      }
    }

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        balance: user.balance,
        direct_income: user.direct_income,
        passive_income: user.passive_income,
        referral_code: user.referral_code,
        referral_of: user.referral_of,
        status: user.status,
        plan: user.plan,
        banned: user.banned,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private (Admin only)
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Don't allow deleting admin users
    if (user.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Cannot delete admin users",
      });
    }

    // Start a Mongoose session for transaction
    const session = await User.startSession();
    session.startTransaction();

    try {
      // 1. Set referral_of to null for all users referred by this user
      await User.updateMany(
        { referral_of: user._id },
        { $set: { referral_of: null } },
        { session }
      );

      // 2. Delete all requests related to this user
      await Request.deleteMany({ user_id: user._id }, { session });

      // 3. Delete all transactions related to this user
      await Transaction.deleteMany({ user_id: user._id }, { session });

      // 4. Delete the user
      await User.findByIdAndDelete(req.params.id, { session });

      // Commit the transaction
      await session.commitTransaction();
      session.endSession();

      res.status(200).json({
        success: true,
        message: "User deleted successfully",
      });
    } catch (transactionError) {
      // Abort transaction on error
      await session.abortTransaction();
      session.endSession();
      throw transactionError;
    }
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Get current user data with referrals grouped by plan
// @route   GET /api/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    // Get user data
    const user = await User.findById(req.user._id).populate(
      "referral_of",
      "name email"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Get all transactions for this user (for balance calculation)
    const allTransactions = await Transaction.find({ user_id: user._id });

    // Calculate balance from transactions
    const calculatedBalance = allTransactions.reduce((sum, transaction) => {
      if (transaction.type === "withdrawal") {
        return sum - transaction.amount;
      }
      return sum + transaction.amount;
    }, 0);

    // Auto-correct balance if mismatched
    if (user.balance !== calculatedBalance) {
      user.balance = calculatedBalance;
      await user.save();
    }

    // Calculate income totals from transactions
    const directIncome = allTransactions
      .filter((t) => t.type === "direct")
      .reduce((sum, t) => sum + t.amount, 0);

    const passiveIncome = allTransactions
      .filter((t) => t.type === "passive" || t.type === "withdrawal")
      .reduce(
        (sum, t) => (t.type === "withdrawal" ? sum - t.amount : sum + t.amount),
        0
      );

    // Auto-correct income fields if mismatched
    if (
      user.direct_income !== directIncome ||
      user.passive_income !== passiveIncome
    ) {
      user.direct_income = directIncome;
      user.passive_income = passiveIncome;
      await user.save();
    }

    // Get latest 5 transactions for display
    const transactions = await Transaction.find({ user_id: user._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("type amount createdAt");

    // Format transactions
    const formattedTransactions = transactions.map((t) => ({
      _id: t._id,
      type: t.type,
      amount: t.amount,
      createdAt: t.createdAt,
    }));

    // Get total transaction count
    const totalTransactions = await Transaction.countDocuments({
      user_id: user._id,
    });

    // Get all users who were referred by this user
    const allReferrals = await User.find({ referral_of: user._id }).select(
      "name plan createdAt"
    );

    // Get latest 5 referrals by plan type
    const knowic_referrals = await User.find({
      referral_of: user._id,
      plan: "knowic",
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("name createdAt")
      .then((refs) =>
        refs.map((r) => ({
          _id: r._id,
          name: r.name,
          joinDate: r.createdAt,
        }))
      );

    const learnic_referrals = await User.find({
      referral_of: user._id,
      plan: "learnic",
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("name createdAt")
      .then((refs) =>
        refs.map((r) => ({
          _id: r._id,
          name: r.name,
          joinDate: r.createdAt,
        }))
      );

    const masteric_referrals = await User.find({
      referral_of: user._id,
      plan: "masteric",
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("name createdAt")
      .then((refs) =>
        refs.map((r) => ({
          _id: r._id,
          name: r.name,
          joinDate: r.createdAt,
        }))
      );

    // Get counts for each plan type
    const knowicCount = await User.countDocuments({
      referral_of: user._id,
      plan: "knowic",
    });
    const learnicCount = await User.countDocuments({
      referral_of: user._id,
      plan: "learnic",
    });
    const mastericCount = await User.countDocuments({
      referral_of: user._id,
      plan: "masteric",
    });

    // Check if user is pending and has no referrer
    // If they have a pending request, modify referral_of to prevent showing self-approve modal again
    let modifiedReferralOf = user.referral_of;

    if (user.status === "pending" && !user.referral_of) {
      // Check if user has a pending request
      const pendingRequest = await Request.findOne({
        user_id: user._id,
        status: "pending",
      });

      if (pendingRequest) {
        // Set referral_of to a truthy value to indicate request is already submitted
        modifiedReferralOf = "pending_request";
      }
    }

    // Get latest 5 pending users with their request status
    let pending_users = await User.find({
      status: "pending",
      referral_of: user._id,
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("name email createdAt");

    // Check if each pending user has a pending request
    const pending_users_with_requests = await Promise.all(
      pending_users.map(async (pendingUser) => {
        const pendingRequest = await Request.findOne({
          user_id: pendingUser._id,
          status: "pending",
        });

        return {
          _id: pendingUser._id,
          name: pendingUser.name,
          email: pendingUser.email,
          joinDate: pendingUser.createdAt,
          request: !!pendingRequest, // true if request exists, false otherwise
        };
      })
    );

    pending_users = pending_users_with_requests;

    // Get total pending users count
    const pendingUsersCount = await User.countDocuments({
      status: "pending",
      referral_of: user._id,
    });
    // Prepare user data (excluding password)
    const userData = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      balance: user.balance,
      direct_income: user.direct_income,
      passive_income: user.passive_income,
      referral_code: user.referral_code,
      referral_of: modifiedReferralOf,
      status: user.status,
      plan: user.plan,
      banned: user.banned,
      profileImage: user.profileImage,
      country: user.country,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    res.status(200).json({
      success: true,
      user: userData,
      transactions: formattedTransactions,
      transactionsCount: totalTransactions,
      referrals: {
        knowic_referrals,
        knowicCount,
        learnic_referrals,
        learnicCount,
        masteric_referrals,
        mastericCount,
        pending_users,
        pendingUsersCount,
        total: allReferrals.length,
      },
    });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Load more transactions for current user
// @route   GET /api/me/transactions/load-more
// @access  Private
exports.loadMoreTransactions = async (req, res) => {
  try {
    const skip = parseInt(req.query.skip) || 0;
    const limit = 5;

    const transactions = await Transaction.find({ user_id: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("type amount createdAt");

    const formattedTransactions = transactions.map((t) => ({
      _id: t._id,
      type: t.type,
      amount: t.amount,
      createdAt: t.createdAt,
    }));

    res.status(200).json({
      success: true,
      transactions: formattedTransactions,
    });
  } catch (error) {
    console.error("Load more transactions error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Load more referrals by plan type for current user
// @route   GET /api/me/referrals/load-more
// @access  Private
exports.loadMoreReferrals = async (req, res) => {
  try {
    const skip = parseInt(req.query.skip) || 0;
    const plan = req.query.plan; // knowic, learnic, or masteric
    const limit = 5;

    if (!plan || !["knowic", "learnic", "masteric"].includes(plan)) {
      return res.status(400).json({
        success: false,
        message: "Invalid or missing plan parameter",
      });
    }

    const referrals = await User.find({
      referral_of: req.user._id,
      plan: plan,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("name createdAt");

    const formattedReferrals = referrals.map((r) => ({
      _id: r._id,
      name: r.name,
      joinDate: r.createdAt,
    }));

    res.status(200).json({
      success: true,
      referrals: formattedReferrals,
    });
  } catch (error) {
    console.error("Load more referrals error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Load more pending users for current user
// @route   GET /api/me/pending-users/load-more
// @access  Private
exports.loadMorePendingUsers = async (req, res) => {
  try {
    const skip = parseInt(req.query.skip) || 0;
    const limit = 5;

    const pending_users = await User.find({
      status: "pending",
      referral_of: req.user._id,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("name email createdAt");

    // Check if each pending user has a pending request
    const pending_users_with_requests = await Promise.all(
      pending_users.map(async (pendingUser) => {
        const pendingRequest = await Request.findOne({
          user_id: pendingUser._id,
          status: "pending",
        });

        return {
          _id: pendingUser._id,
          name: pendingUser.name,
          email: pendingUser.email,
          joinDate: pendingUser.createdAt,
          request: !!pendingRequest,
        };
      })
    );

    res.status(200).json({
      success: true,
      pendingUsers: pending_users_with_requests,
    });
  } catch (error) {
    console.error("Load more pending users error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Update own profile (name only)
// @route   PUT /api/me/profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Name is required",
      });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.name = name.trim();
    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        balance: user.balance,
        direct_income: user.direct_income,
        passive_income: user.passive_income,
        referral_code: user.referral_code,
        referral_of: user.referral_of,
        status: user.status,
        plan: user.plan,
        banned: user.banned,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Change password
// @route   PUT /api/me/password
// @access  Private
exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Please provide both old and new passwords",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters",
      });
    }

    const user = await User.findById(req.user.id).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if old password matches
    const isMatch = await user.comparePassword(oldPassword);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Get income stats filtered by time period
// @route   GET /api/me/income-stats?period=all-time|this-month|this-week|today
// @access  Private
exports.getIncomeStats = async (req, res) => {
  try {
    const { period = "all-time" } = req.query;

    // Calculate date range based on period
    let startDate;
    const now = new Date();

    switch (period) {
      case "today":
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case "this-week":
        // Start of week (Sunday)
        const dayOfWeek = now.getDay();
        startDate = new Date(now);
        startDate.setDate(now.getDate() - dayOfWeek);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "this-month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "all-time":
      default:
        startDate = null; // No filter, get all transactions
        break;
    }

    // Build query
    const query = { user_id: req.user._id };
    if (startDate) {
      query.createdAt = { $gte: startDate };
    }

    // Get filtered transactions
    const transactions = await Transaction.find(query);

    // Calculate balance from filtered transactions
    const balance = transactions.reduce((sum, transaction) => {
      if (transaction.type === "withdrawal") {
        return sum - transaction.amount;
      }
      return sum + transaction.amount;
    }, 0);

    // Calculate direct income
    const directIncome = transactions
      .filter((t) => t.type === "direct")
      .reduce((sum, t) => sum + t.amount, 0);

    // Calculate passive income
    const passiveIncome = transactions
      .filter((t) => t.type === "passive" || t.type === "withdrawal")
      .reduce(
        (sum, t) => (t.type === "withdrawal" ? sum - t.amount : sum + t.amount),
        0
      );

    res.status(200).json({
      success: true,
      period,
      stats: {
        balance,
        direct_income: directIncome,
        passive_income: passiveIncome,
      },
    });
  } catch (error) {
    console.error("Get income stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Get admin dashboard statistics
// @route   GET /api/admin/dashboard-stats
// @access  Private (Admin only)
exports.getAdminDashboardStats = async (req, res) => {
  try {
    // 1. Get all approved requests
    const approvedRequests = await Request.find({ status: "approved" });

    // 2. Calculate total revenue (admin profit)
    let totalRevenue = 0;
    approvedRequests.forEach((request) => {
      const pricing = PLAN_PRICING[request.plan];
      if (!pricing) return;

      // If self-approval: revenue = price
      // If referred: revenue = price - direct
      if (request.user_id.toString() === request.sender_id.toString()) {
        totalRevenue += pricing.price;
      } else {
        totalRevenue += pricing.price - pricing.direct;
      }
    });

    // 3. Count total users (excluding admins)
    const totalUsers = await User.countDocuments({ role: { $ne: "admin" } });

    // 4. Count total ebooks
    const totalEbooks = await Ebook.countDocuments();

    // 5. Calculate plan distribution (percentage)
    const knowicRequests = approvedRequests.filter(
      (r) => r.plan === "knowic"
    ).length;
    const learnicRequests = approvedRequests.filter(
      (r) => r.plan === "learnic"
    ).length;
    const mastericRequests = approvedRequests.filter(
      (r) => r.plan === "masteric"
    ).length;
    const totalRequests = approvedRequests.length;

    const planDistribution = {
      knowic:
        totalRequests > 0
          ? Math.round((knowicRequests / totalRequests) * 100)
          : 0,
      learnic:
        totalRequests > 0
          ? Math.round((learnicRequests / totalRequests) * 100)
          : 0,
      masteric:
        totalRequests > 0
          ? Math.round((mastericRequests / totalRequests) * 100)
          : 0,
    };

    // 6. Generate revenue over time (frequency distribution)
    // Group approved requests by date and calculate revenue
    const revenueOverTime = {};
    approvedRequests.forEach((request) => {
      const date = new Date(request.createdAt);
      const dateKey = date.toISOString().split("T")[0]; // YYYY-MM-DD

      const pricing = PLAN_PRICING[request.plan];
      if (!pricing) return;

      let revenue = 0;
      if (request.user_id.toString() === request.sender_id.toString()) {
        revenue = pricing.price;
      } else {
        revenue = pricing.price - pricing.direct;
      }

      if (revenueOverTime[dateKey]) {
        revenueOverTime[dateKey] += revenue;
      } else {
        revenueOverTime[dateKey] = revenue;
      }
    });

    // Convert to array and sort by date
    const revenueData = Object.keys(revenueOverTime)
      .sort()
      .map((date) => ({
        date,
        revenue: revenueOverTime[date],
      }));

    // 7. Generate users over time (frequency distribution)
    const allUsers = await User.find({ role: { $ne: "admin" } })
      .select("createdAt")
      .sort({ createdAt: 1 });

    const usersOverTime = {};
    allUsers.forEach((user) => {
      const date = new Date(user.createdAt);
      const dateKey = date.toISOString().split("T")[0]; // YYYY-MM-DD

      if (usersOverTime[dateKey]) {
        usersOverTime[dateKey]++;
      } else {
        usersOverTime[dateKey] = 1;
      }
    });

    // Convert to cumulative count
    const usersData = [];
    let cumulativeUsers = 0;
    Object.keys(usersOverTime)
      .sort()
      .forEach((date) => {
        cumulativeUsers += usersOverTime[date];
        usersData.push({
          date,
          users: cumulativeUsers,
        });
      });

    res.status(200).json({
      success: true,
      stats: {
        totalRevenue,
        totalUsers,
        totalEbooks,
      },
      charts: {
        planDistribution,
        revenueOverTime: revenueData,
        usersOverTime: usersData,
      },
    });
  } catch (error) {
    console.error("Get admin dashboard stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Upload profile image
// @route   PUT /api/me/profile-image
// @access  Private
exports.uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload an image file",
      });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Delete old profile image if it exists
    if (user.profileImage) {
      const oldImagePath = path.join(__dirname, "..", user.profileImage);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }

    // Set new profile image path (relative to backend directory)
    user.profileImage = `/uploads/profiles/${req.file.filename}`;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile image uploaded successfully",
      profileImage: user.profileImage,
    });
  } catch (error) {
    console.error("Upload profile image error:", error);

    // Delete uploaded file if there was an error
    if (req.file) {
      const uploadedFilePath = path.join(
        __dirname,
        "../uploads/profiles",
        req.file.filename
      );
      if (fs.existsSync(uploadedFilePath)) {
        fs.unlinkSync(uploadedFilePath);
      }
    }

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
