const mongoose = require('mongoose');

// Discounts are stored as percentages (0-100). They are applied to the amount a
// buyer actually owes, so they can never push a payment below $0 - see
// utils/pricing.js for the math.
const discountSchema = new mongoose.Schema(
  {
    enabled: {
      type: Boolean,
      default: false,
    },
    knowicPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    learnicPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    mastericPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure only one discount document exists (singleton pattern)
discountSchema.index({}, { unique: true });

module.exports = mongoose.model('Discount', discountSchema);
