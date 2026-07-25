const mongoose = require('mongoose');

const storySchema = new mongoose.Schema(
  {
    highlight_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Highlight',
      required: [true, 'Story must belong to a highlight'],
    },
    media_file: {
      type: String,
      required: [true, 'Story media file is required'],
    },
    media_type: {
      type: String,
      enum: ['image', 'video'],
      required: true,
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

module.exports = mongoose.model('Story', storySchema);
