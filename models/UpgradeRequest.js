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
  proof_image: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('UpgradeRequest', upgradeRequestSchema);
