const mongoose = require('mongoose');

const highlightSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Highlight name is required'],
      trim: true,
      maxlength: [50, 'Highlight name cannot exceed 50 characters'],
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Highlight', highlightSchema);
