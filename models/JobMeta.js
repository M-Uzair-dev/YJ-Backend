const mongoose = require('mongoose');

const jobMetaSchema = new mongoose.Schema(
  {
    job: {
      type: String,
      required: true,
      unique: true,
    },
    lastProcessedAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('JobMeta', jobMetaSchema);
