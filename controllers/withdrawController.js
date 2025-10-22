const Withdraw = require('../models/Withdraw');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');

// @desc    Create a new withdrawal request
// @route   POST /api/withdraw
// @access  Private (User)
exports.createWithdrawal = async (req, res) => {
  try {
    const { bankName, bankAccountNumber, amount } = req.body;
    const userId = req.user._id;

    // Input validation
    if (!bankName || !bankAccountNumber || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Please provide bank name, account number, and amount',
      });
    }

    // Validate amount is a number and >= 30
    if (isNaN(amount) || amount < 30) {
      return res.status(400).json({
        success: false,
        message: 'Withdrawal amount must be at least $30',
      });
    }

    // Get user's current passive income
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if user has sufficient passive income
    if (user.passive_income < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient passive income balance',
      });
    }

    // Check if user already has a pending withdrawal
    const existingPendingWithdrawal = await Withdraw.findOne({
      user_id: userId,
      status: 'pending',
    });

    if (existingPendingWithdrawal) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending withdrawal request. Please wait for it to be processed.',
      });
    }

    // Create new withdrawal request
    const withdrawal = await Withdraw.create({
      user_id: userId,
      bankName,
      bankAccountNumber,
      amount,
      status: 'pending',
    });

    res.status(201).json({
      success: true,
      message: 'Withdrawal request created successfully',
      withdraw: withdrawal,
    });
  } catch (error) {
    console.error('Create withdrawal error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get all withdrawals for logged-in user
// @route   GET /api/withdraw
// @access  Private (User)
exports.getUserWithdrawals = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get all withdrawals for the user, sorted by most recent first
    const withdrawals = await Withdraw.find({ user_id: userId }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      withdrawals,
    });
  } catch (error) {
    console.error('Get user withdrawals error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get all pending withdrawals (Admin only)
// @route   GET /api/admin/withdraws/pending
// @access  Private (Admin)
exports.getPendingWithdrawals = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get total count of pending withdrawals
    const total = await Withdraw.countDocuments({ status: 'pending' });

    // Get pending withdrawals with pagination, oldest first
    const withdrawals = await Withdraw.find({ status: 'pending' })
      .populate('user_id', 'name email')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: 1 }); // Oldest first

    res.status(200).json({
      success: true,
      count: withdrawals.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      withdrawals,
    });
  } catch (error) {
    console.error('Get pending withdrawals error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Approve a withdrawal
// @route   POST /api/admin/withdraws/:id/approve
// @access  Private (Admin)
exports.approveWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;

    // Find the withdrawal
    const withdrawal = await Withdraw.findById(id).session(session);
    if (!withdrawal) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Withdrawal not found',
      });
    }

    // Check if already processed
    if (withdrawal.status !== 'pending') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Withdrawal has already been processed',
      });
    }

    // Get the user
    const user = await User.findById(withdrawal.user_id).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if user has sufficient passive income
    if (user.passive_income < withdrawal.amount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'User has insufficient passive income',
      });
    }

    // Update withdrawal status
    withdrawal.status = 'approved';
    await withdrawal.save({ session });

    // Deduct amount from user's passive income
    user.passive_income -= withdrawal.amount;
    await user.save({ session });

    // Create transaction record
    await Transaction.create(
      [
        {
          user_id: user._id,
          type: 'withdrawal',
          amount: withdrawal.amount,
        },
      ],
      { session }
    );

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: 'Withdrawal approved successfully',
      withdrawal,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Approve withdrawal error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Reject a withdrawal
// @route   POST /api/admin/withdraws/:id/reject
// @access  Private (Admin)
exports.rejectWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the withdrawal
    const withdrawal = await Withdraw.findById(id);
    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal not found',
      });
    }

    // Check if already processed
    if (withdrawal.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Withdrawal has already been processed',
      });
    }

    // Update withdrawal status
    withdrawal.status = 'rejected';
    await withdrawal.save();

    res.status(200).json({
      success: true,
      message: 'Withdrawal rejected successfully',
      withdrawal,
    });
  } catch (error) {
    console.error('Reject withdrawal error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
