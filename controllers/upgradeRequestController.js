const UpgradeRequest = require('../models/UpgradeRequest');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

const PLAN_PRICING = {
  knowic: { price: 24, direct: 16, passive: 2 },
  learnic: { price: 59, direct: 40, passive: 4 },
  masteric: { price: 130, direct: 85, passive: 7 },
};

// Create upgrade request
exports.createUpgradeRequest = async (req, res) => {
  try {
    const { new_plan, referral_code } = req.body;
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

    // Validate referral code
    if (!referral_code) {
      return res.status(400).json({ message: 'Referral code is required' });
    }

    const referrer = await User.findOne({ referral_code });
    if (!referrer) {
      return res.status(400).json({ message: 'Invalid referral code' });
    }

    // Check if referrer has a plan
    if (!referrer.plan) {
      return res.status(400).json({ message: 'The user of this referral code does not have an active plan yet' });
    }

    // Check if referrer's plan can refer the new plan
    const PLAN_HIERARCHY = {
      knowic: ['knowic'],
      learnic: ['knowic', 'learnic'],
      masteric: ['knowic', 'learnic', 'masteric']
    };

    const allowedPlans = PLAN_HIERARCHY[referrer.plan];
    if (!allowedPlans.includes(new_plan)) {
      // Determine what plan referrer needs
      const requiredPlan = new_plan; // They need at least the target plan
      return res.status(400).json({
        message: `The user of this referral code has ${referrer.plan} plan, they need to upgrade to ${requiredPlan} plan to be the referrer of your upgraded status.`
      });
    }

    // Check for existing pending upgrade request
    const existingRequest = await UpgradeRequest.findOne({
      user_id: userId,
      status: { $in: ['created', 'user_approved'] },
    });

    if (existingRequest) {
      return res.status(400).json({ message: 'You already have a pending upgrade request' });
    }

    // Create upgrade request
    const upgradeRequest = new UpgradeRequest({
      user_id: userId,
      previous_plan: user.plan,
      new_plan: new_plan,
      referral_code: referral_code,
      new_referrer_id: referrer._id,
      status: 'created',
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
      status: { $in: ['created', 'user_approved'] },
    });

    res.status(200).json({ upgradeRequest });
  } catch (error) {
    console.error('Get user upgrade request error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get upgrade requests where user is the new referrer
exports.getReferrerUpgradeRequests = async (req, res) => {
  try {
    const userId = req.user.id;

    const upgradeRequests = await UpgradeRequest.find({
      new_referrer_id: userId,
      status: { $in: ['created', 'user_approved'] },
    })
      .populate('user_id', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({ upgradeRequests });
  } catch (error) {
    console.error('Get referrer upgrade requests error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Referrer approves upgrade request (with proof upload)
exports.referrerApproveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { discounted, discountAmount, originalPrice, finalPrice } = req.body;

    const upgradeRequest = await UpgradeRequest.findById(id);
    if (!upgradeRequest) {
      return res.status(404).json({ message: 'Upgrade request not found' });
    }

    // Check if user is the new referrer
    if (upgradeRequest.new_referrer_id.toString() !== userId) {
      return res.status(403).json({ message: 'You are not authorized to approve this request' });
    }

    // Check if request is in created status
    if (upgradeRequest.status !== 'created') {
      return res.status(400).json({ message: 'This request has already been processed' });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ message: 'Payment proof image is required' });
    }

    const proof_image = req.file.path;

    // Update request
    upgradeRequest.proof_image = proof_image;
    upgradeRequest.status = 'user_approved';

    // Add discount fields if this is a discounted upgrade
    if (discounted === 'true' || discounted === true) {
      upgradeRequest.discounted = true;
      upgradeRequest.discountAmount = parseFloat(discountAmount) || 0;
      upgradeRequest.originalPrice = parseFloat(originalPrice) || 0;
      upgradeRequest.finalPrice = parseFloat(finalPrice) || 0;
    }

    await upgradeRequest.save();

    res.status(200).json({
      message: 'Upgrade request approved successfully. Waiting for admin approval.',
      upgradeRequest,
    });
  } catch (error) {
    console.error('Referrer approve request error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Referrer rejects upgrade request
exports.referrerRejectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const upgradeRequest = await UpgradeRequest.findById(id);
    if (!upgradeRequest) {
      return res.status(404).json({ message: 'Upgrade request not found' });
    }

    // Check if user is the new referrer
    if (upgradeRequest.new_referrer_id.toString() !== userId) {
      return res.status(403).json({ message: 'You are not authorized to reject this request' });
    }

    // Check if request is in created status
    if (upgradeRequest.status !== 'created') {
      return res.status(400).json({ message: 'This request has already been processed' });
    }

    // Delete the request entirely
    await UpgradeRequest.findByIdAndDelete(id);

    res.status(200).json({
      message: 'Upgrade request rejected and deleted successfully',
    });
  } catch (error) {
    console.error('Referrer reject request error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all upgrade requests (admin) - only user_approved status
exports.getAllUpgradeRequests = async (req, res) => {
  try {
    const upgradeRequests = await UpgradeRequest.find({
      status: 'user_approved',
    })
      .populate('user_id', 'name email')
      .populate('new_referrer_id', 'name email')
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

    if (upgradeRequest.status !== 'user_approved') {
      return res.status(400).json({ message: 'This request has already been processed or not yet approved by referrer' });
    }

    // Get user
    const user = await User.findById(upgradeRequest.user_id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get new referrer
    const newReferrer = await User.findById(upgradeRequest.new_referrer_id);
    if (!newReferrer) {
      return res.status(404).json({ message: 'New referrer not found' });
    }

    // Get plan pricing
    const pricing = PLAN_PRICING[upgradeRequest.new_plan];

    // Update user's plan and referral_of
    user.plan = upgradeRequest.new_plan;
    user.referral_of = upgradeRequest.new_referrer_id;
    await user.save();

    // Give direct commission to new referrer
    newReferrer.direct_income += pricing.direct;
    newReferrer.balance += pricing.direct;
    await newReferrer.save();

    // Create direct transaction
    await Transaction.create({
      user_id: newReferrer._id,
      type: 'direct',
      amount: pricing.direct,
    });

    // Give passive commission to new referrer's referrer (if exists AND upgrade is not discounted)
    if (newReferrer.referral_of) {
      const grandReferrer = await User.findById(newReferrer.referral_of);
      // Only give passive income if the upgrade is NOT discounted
      const isUpgradeDiscounted = upgradeRequest.discounted === true;

      if (grandReferrer && !isUpgradeDiscounted) {
        grandReferrer.passive_income += pricing.passive;
        grandReferrer.balance += pricing.passive;
        await grandReferrer.save();

        // Create passive transaction
        await Transaction.create({
          user_id: grandReferrer._id,
          type: 'passive',
          amount: pricing.passive,
        });
      }
    }

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

// Reject upgrade request (admin) - delete entirely
exports.rejectUpgradeRequest = async (req, res) => {
  try {
    const { id } = req.params;

    const upgradeRequest = await UpgradeRequest.findById(id);
    if (!upgradeRequest) {
      return res.status(404).json({ message: 'Upgrade request not found' });
    }

    if (upgradeRequest.status !== 'user_approved') {
      return res.status(400).json({ message: 'This request has already been processed or not yet approved by referrer' });
    }

    // Delete the request entirely
    await UpgradeRequest.findByIdAndDelete(id);

    res.status(200).json({
      message: 'Upgrade request rejected and deleted successfully',
    });
  } catch (error) {
    console.error('Reject upgrade request error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
