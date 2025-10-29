const Discount = require('../models/Discount');

// @desc    Get discount settings
// @route   GET /api/discounts
// @access  Public (so users can see discounts in approve modal)
exports.getDiscounts = async (req, res) => {
  try {
    let discount = await Discount.findOne();

    // If no discount settings exist, create default
    if (!discount) {
      discount = await Discount.create({
        enabled: false,
        knowicDiscount: 0,
        learnicDiscount: 0,
        mastericDiscount: 0,
      });
    }

    res.status(200).json({
      success: true,
      discount,
    });
  } catch (error) {
    console.error('Get discounts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch discounts',
      error: error.message,
    });
  }
};

// @desc    Update discount settings
// @route   PUT /api/discounts
// @access  Private (Admin only)
exports.updateDiscounts = async (req, res) => {
  try {
    const { enabled, knowicDiscount, learnicDiscount, mastericDiscount } = req.body;

    // Validate discount amounts - cannot be negative
    if (knowicDiscount < 0 || learnicDiscount < 0 || mastericDiscount < 0) {
      return res.status(400).json({
        success: false,
        message: 'Discount amounts cannot be negative',
      });
    }

    // Validate maximum discount limits (passive income amount)
    // Knowic: max $7, Learnic: max $18, Masteric: max $44
    if (knowicDiscount > 7) {
      return res.status(400).json({
        success: false,
        message: 'Knowic discount cannot exceed $7 (passive income amount)',
      });
    }

    if (learnicDiscount > 18) {
      return res.status(400).json({
        success: false,
        message: 'Learnic discount cannot exceed $18 (passive income amount)',
      });
    }

    if (mastericDiscount > 44) {
      return res.status(400).json({
        success: false,
        message: 'Masteric discount cannot exceed $44 (passive income amount)',
      });
    }

    let discount = await Discount.findOne();

    if (!discount) {
      // Create new discount settings
      discount = await Discount.create({
        enabled,
        knowicDiscount,
        learnicDiscount,
        mastericDiscount,
      });
    } else {
      // Update existing discount settings
      discount.enabled = enabled !== undefined ? enabled : discount.enabled;
      discount.knowicDiscount = knowicDiscount !== undefined ? knowicDiscount : discount.knowicDiscount;
      discount.learnicDiscount = learnicDiscount !== undefined ? learnicDiscount : discount.learnicDiscount;
      discount.mastericDiscount = mastericDiscount !== undefined ? mastericDiscount : discount.mastericDiscount;

      await discount.save();
    }

    res.status(200).json({
      success: true,
      message: 'Discount settings updated successfully',
      discount,
    });
  } catch (error) {
    console.error('Update discounts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update discounts',
      error: error.message,
    });
  }
};
