const Discount = require('../models/Discount');

const PERCENT_FIELDS = ['knowicPercent', 'learnicPercent', 'mastericPercent'];

// Dollar-amount fields from the pre-percentage discount system. They are no
// longer part of the schema, so they are stripped once per process to keep the
// settings document from carrying stale values that no longer mean anything.
const LEGACY_FIELDS = ['knowicDiscount', 'learnicDiscount', 'mastericDiscount'];
let legacyCleanupDone = false;

const stripLegacyFields = async () => {
  if (legacyCleanupDone) return;
  legacyCleanupDone = true;
  try {
    await Discount.collection.updateMany(
      { $or: LEGACY_FIELDS.map((field) => ({ [field]: { $exists: true } })) },
      { $unset: LEGACY_FIELDS.reduce((acc, field) => ({ ...acc, [field]: '' }), {}) }
    );
  } catch (error) {
    // Cleanup is best-effort - stale fields are ignored by the schema anyway
    console.error('Legacy discount field cleanup failed:', error.message);
  }
};

// @desc    Get discount settings
// @route   GET /api/discounts
// @access  Public (so users can see discounts in approve modal)
exports.getDiscounts = async (req, res) => {
  try {
    await stripLegacyFields();

    let discount = await Discount.findOne();

    // If no discount settings exist, create default
    if (!discount) {
      discount = await Discount.create({
        enabled: false,
        knowicPercent: 0,
        learnicPercent: 0,
        mastericPercent: 0,
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
    const { enabled } = req.body;

    // Validate every supplied percentage is a number between 0 and 100.
    // 100% is allowed and simply means the buyer pays nothing.
    for (const field of PERCENT_FIELDS) {
      const value = req.body[field];
      if (value === undefined) continue;

      const percent = Number(value);
      if (!Number.isFinite(percent)) {
        return res.status(400).json({
          success: false,
          message: `${field} must be a number`,
        });
      }
      if (percent < 0 || percent > 100) {
        return res.status(400).json({
          success: false,
          message: 'Discount percentages must be between 0 and 100',
        });
      }
    }

    let discount = await Discount.findOne();

    if (!discount) {
      discount = new Discount();
    }

    if (enabled !== undefined) {
      discount.enabled = enabled;
    }
    for (const field of PERCENT_FIELDS) {
      if (req.body[field] !== undefined) {
        discount[field] = Number(req.body[field]);
      }
    }

    await discount.save();

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
