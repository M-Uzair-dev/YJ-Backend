const UpgradeRequest = require('../models/UpgradeRequest');
const User = require('../models/User');

const PLAN_PRICING = {
  knowic: { price: 24, direct: 16, passive: 2 },
  learnic: { price: 59, direct: 40, passive: 4 },
  masteric: { price: 130, direct: 85, passive: 7 },
};

// Create upgrade request
exports.createUpgradeRequest = async (req, res) => {
  try {
    const { new_plan } = req.body;
    const userId = req.user.id;

    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user has a current plan
    if (!user.plan) {
      return res.status(400).json({ message: 'You must have an active plan before upgrading' });
    }

    // Check if user is trying to upgrade to same plan
    if (user.plan === new_plan) {
      return res.status(400).json({ message: 'You are already on this plan' });
    }

    // Check if user is trying to downgrade
    const planHierarchy = { knowic: 1, learnic: 2, masteric: 3 };
    if (planHierarchy[new_plan] <= planHierarchy[user.plan]) {
      return res.status(400).json({ message: 'You can only upgrade to a higher plan' });
    }

    // Check for existing pending upgrade request
    const existingRequest = await UpgradeRequest.findOne({
      user_id: userId,
      status: 'pending',
    });

    if (existingRequest) {
      return res.status(400).json({ message: 'You already have a pending upgrade request' });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ message: 'Payment proof image is required' });
    }

    const proof_image = req.file.path; // File path from multer

    // Create upgrade request
    const upgradeRequest = new UpgradeRequest({
      user_id: userId,
      previous_plan: user.plan,
      new_plan: new_plan,
      proof_image: proof_image,
      status: 'pending',
    });

    await upgradeRequest.save();

    res.status(201).json({
      message: 'Upgrade request submitted successfully',
      upgradeRequest,
    });
  } catch (error) {
    console.error('Create upgrade request error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get user's upgrade request
exports.getUserUpgradeRequest = async (req, res) => {
  try {
    const userId = req.user.id;

    const upgradeRequest = await UpgradeRequest.findOne({
      user_id: userId,
      status: 'pending',
    });

    res.status(200).json({ upgradeRequest });
  } catch (error) {
    console.error('Get user upgrade request error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all upgrade requests (admin)
exports.getAllUpgradeRequests = async (req, res) => {
  try {
    const { status } = req.query;

    const filter = {};
    if (status) {
      filter.status = status;
    }

    const upgradeRequests = await UpgradeRequest.find(filter)
      .populate('user_id', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({ upgradeRequests });
  } catch (error) {
    console.error('Get all upgrade requests error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Approve upgrade request (admin)
exports.approveUpgradeRequest = async (req, res) => {
  try {
    const { id } = req.params;

    const upgradeRequest = await UpgradeRequest.findById(id);
    if (!upgradeRequest) {
      return res.status(404).json({ message: 'Upgrade request not found' });
    }

    if (upgradeRequest.status !== 'pending') {
      return res.status(400).json({ message: 'This request has already been processed' });
    }

    // Update user's plan
    const user = await User.findById(upgradeRequest.user_id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.plan = upgradeRequest.new_plan;
    await user.save();

    // Update upgrade request status
    upgradeRequest.status = 'approved';
    await upgradeRequest.save();

    res.status(200).json({
      message: 'Upgrade request approved successfully',
      upgradeRequest,
    });
  } catch (error) {
    console.error('Approve upgrade request error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Reject upgrade request (admin)
exports.rejectUpgradeRequest = async (req, res) => {
  try {
    const { id } = req.params;

    const upgradeRequest = await UpgradeRequest.findById(id);
    if (!upgradeRequest) {
      return res.status(404).json({ message: 'Upgrade request not found' });
    }

    if (upgradeRequest.status !== 'pending') {
      return res.status(400).json({ message: 'This request has already been processed' });
    }

    upgradeRequest.status = 'rejected';
    await upgradeRequest.save();

    res.status(200).json({
      message: 'Upgrade request rejected successfully',
      upgradeRequest,
    });
  } catch (error) {
    console.error('Reject upgrade request error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
