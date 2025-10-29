const mongoose = require('mongoose');

const weeklyStatSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    total: {
      type: Number,
      default: 0,
    },
    date: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index on userId and date
weeklyStatSchema.index({ userId: 1, date: 1 }, { unique: true });

// Index on date for efficient querying of most recent stats
weeklyStatSchema.index({ date: -1 });

module.exports = mongoose.model('WeeklyStat', weeklyStatSchema);
