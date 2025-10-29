const mongoose = require('mongoose');

const discountSchema = new mongoose.Schema(
  {
    enabled: {
      type: Boolean,
      default: false,
    },
    knowicDiscount: {
      type: Number,
      default: 0,
      min: 0,
    },
    learnicDiscount: {
      type: Number,
      default: 0,
      min: 0,
    },
    mastericDiscount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure only one discount document exists (singleton pattern)
discountSchema.index({}, { unique: true });

module.exports = mongoose.model('Discount', discountSchema);
