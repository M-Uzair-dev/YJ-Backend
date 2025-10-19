const User = require("../models/User");
const Transaction = require("../models/Transaction");
const Request = require("../models/Request");

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

    // Get all transactions for this user
    const transactions = await Transaction.find({ user_id: user._id });

    // Calculate balance from transactions
    const calculatedBalance = transactions.reduce((sum, transaction) => {
      return sum + transaction.amount;
    }, 0);

    // Auto-correct balance if mismatched
    if (user.balance !== calculatedBalance) {
      user.balance = calculatedBalance;
      await user.save();
    }

    // Calculate income totals from transactions
    const directIncome = transactions
      .filter((t) => t.type === "direct")
      .reduce((sum, t) => sum + t.amount, 0);

    const passiveIncome = transactions
      .filter((t) => t.type === "passive")
      .reduce((sum, t) => sum + t.amount, 0);

    // Auto-correct income fields if mismatched
    if (
      user.direct_income !== directIncome ||
      user.passive_income !== passiveIncome
    ) {
      user.direct_income = directIncome;
      user.passive_income = passiveIncome;
      await user.save();
    }

    // Get all users who were referred by this user
    const referrals = await User.find({ referral_of: user._id }).select(
      "name plan createdAt"
    );

    // Group referrals by plan
    const knowic_referrals = referrals
      .filter((r) => r.plan === "knowic")
      .map((r) => ({
        name: r.name,
        joinDate: r.createdAt,
      }));

    const learnic_referrals = referrals
      .filter((r) => r.plan === "learnic")
      .map((r) => ({
        name: r.name,
        joinDate: r.createdAt,
      }));

    const masteric_referrals = referrals
      .filter((r) => r.plan === "masteric")
      .map((r) => ({
        name: r.name,
        joinDate: r.createdAt,
      }));

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

    let pending_users = await User.find({
      status: "pending",
      referral_of: user._id,
    }).select("name email createdAt");
    pending_users = pending_users.map((user) => ({
      name: user.name,
      email: user.email,
      joinDate: user.createdAt,
    }));

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
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    res.status(200).json({
      success: true,
      user: userData,
      referrals: {
        knowic_referrals,
        learnic_referrals,
        masteric_referrals,
        pending_users,
        total: referrals.length,
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
