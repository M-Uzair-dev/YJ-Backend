const Transaction = require("../models/Transaction");
const User = require("../models/User");

// @desc    Get all transactions with pagination and search
// @route   GET /api/transactions
// @access  Private (Admin only)
exports.getAllTransactions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    let query = {};

    // If search term provided, find matching users first
    if (search) {
      const matchingUsers = await User.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');

      const userIds = matchingUsers.map(user => user._id);
      query = { user_id: { $in: userIds } };
    }

    // Get total count
    const total = await Transaction.countDocuments(query);

    // Get transactions with pagination and populate user details
    const transactions = await Transaction.find(query)
      .populate("user_id", "name email")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }); // Most recent first

    // Format transactions for frontend
    const formattedTransactions = transactions.map((transaction) => ({
      _id: transaction._id,
      type: transaction.type,
      amount: transaction.amount,
      userName: transaction.user_id?.name || "Unknown User",
      userEmail: transaction.user_id?.email || "N/A",
      createdAt: transaction.createdAt,
    }));

    res.status(200).json({
      success: true,
      count: formattedTransactions.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      transactions: formattedTransactions,
    });
  } catch (error) {
    console.error("Get all transactions error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
