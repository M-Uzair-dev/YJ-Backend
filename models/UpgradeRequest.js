const mongoose = require('mongoose');

const upgradeRequestSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  previous_plan: {
    type: String,
    enum: ['knowic', 'learnic', 'masteric'],
    required: true,
  },
  new_plan: {
    type: String,
    enum: ['knowic', 'learnic', 'masteric'],
    required: true,
  },
  referral_code: {
    type: String,
    required: true,
  },
  new_referrer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  proof_image: {
    type: String,
    required: false,
  },
  status: {
    type: String,
    enum: ['created', 'user_approved', 'approved', 'rejected'],
    default: 'created',
  },
  discounted: {
    type: Boolean,
    default: false,
  },
  // Percentage applied at purchase time. Recorded alongside the resolved
  // dollar amount so historical requests stay readable if rates change later.
  discountPercent: {
    type: Number,
    default: 0,
  },
  discountAmount: {
    type: Number,
    default: 0,
  },
  originalPrice: {
    type: Number,
    default: 0,
  },
  finalPrice: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('UpgradeRequest', upgradeRequestSchema);
