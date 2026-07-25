const Highlight = require('../models/Highlight');
const Story = require('../models/Story');
const fs = require('fs');
const path = require('path');

// Helper - delete a story's media file from disk (best-effort)
const deleteStoryFile = (filename) => {
  try {
    const filePath = path.join(__dirname, '..', 'stories', filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error('Story file cleanup failed:', error.message);
  }
};

// @desc    Get all highlights with their stories
// @route   GET /api/highlights
// @access  Public (landing page shows them without auth)
exports.getHighlights = async (req, res) => {
  try {
    const highlights = await Highlight.find().sort({ order: 1, createdAt: 1 });
    const stories = await Story.find().sort({ order: 1, createdAt: 1 });

    // Group stories under their highlight
    const data = highlights.map((highlight) => ({
      _id: highlight._id,
      name: highlight.name,
      order: highlight.order,
      createdAt: highlight.createdAt,
      stories: stories
        .filter((story) => story.highlight_id.toString() === highlight._id.toString())
        .map((story) => ({
          _id: story._id,
          media_url: `/stories/${story.media_file}`,
          media_type: story.media_type,
          order: story.order,
          createdAt: story.createdAt,
        })),
    }));

    res.status(200).json({
      success: true,
      highlights: data,
    });
  } catch (error) {
    console.error('Get highlights error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch highlights',
      error: error.message,
    });
  }
};

// @desc    Create a highlight
// @route   POST /api/highlights
// @access  Private (Admin)
exports.createHighlight = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Highlight name is required',
      });
    }

    const highlight = await Highlight.create({ name: name.trim() });

    res.status(201).json({
      success: true,
      message: 'Highlight created successfully',
      highlight,
    });
  } catch (error) {
    console.error('Create highlight error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create highlight',
    });
  }
};

// @desc    Update (rename) a highlight
// @route   PUT /api/highlights/:id
// @access  Private (Admin)
exports.updateHighlight = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Highlight name is required',
      });
    }

    const highlight = await Highlight.findByIdAndUpdate(
      req.params.id,
      { name: name.trim() },
      { new: true, runValidators: true }
    );

    if (!highlight) {
      return res.status(404).json({
        success: false,
        message: 'Highlight not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Highlight updated successfully',
      highlight,
    });
  } catch (error) {
    console.error('Update highlight error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update highlight',
    });
  }
};

// @desc    Delete a highlight and all of its stories
// @route   DELETE /api/highlights/:id
// @access  Private (Admin)
exports.deleteHighlight = async (req, res) => {
  try {
    const highlight = await Highlight.findById(req.params.id);

    if (!highlight) {
      return res.status(404).json({
        success: false,
        message: 'Highlight not found',
      });
    }

    // Delete all story files + documents belonging to this highlight
    const stories = await Story.find({ highlight_id: highlight._id });
    stories.forEach((story) => deleteStoryFile(story.media_file));
    await Story.deleteMany({ highlight_id: highlight._id });

    await Highlight.findByIdAndDelete(highlight._id);

    res.status(200).json({
      success: true,
      message: 'Highlight and its stories deleted successfully',
    });
  } catch (error) {
    console.error('Delete highlight error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete highlight',
    });
  }
};

// @desc    Upload a story into a highlight
// @route   POST /api/highlights/:id/stories
// @access  Private (Admin)
exports.uploadStory = async (req, res) => {
  try {
    const highlight = await Highlight.findById(req.params.id);

    if (!highlight) {
      if (req.file) deleteStoryFile(req.file.filename);
      return res.status(404).json({
        success: false,
        message: 'Highlight not found',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image or video file',
      });
    }

    const media_type = req.file.mimetype.startsWith('video/') ? 'video' : 'image';

    const story = await Story.create({
      highlight_id: highlight._id,
      media_file: req.file.filename,
      media_type,
    });

    res.status(201).json({
      success: true,
      message: 'Story uploaded successfully',
      story: {
        _id: story._id,
        media_url: `/stories/${story.media_file}`,
        media_type: story.media_type,
        createdAt: story.createdAt,
      },
    });
  } catch (error) {
    console.error('Upload story error:', error);
    if (req.file) deleteStoryFile(req.file.filename);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload story',
    });
  }
};

// @desc    Delete a story
// @route   DELETE /api/highlights/stories/:storyId
// @access  Private (Admin)
exports.deleteStory = async (req, res) => {
  try {
    const story = await Story.findById(req.params.storyId);

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Story not found',
      });
    }

    deleteStoryFile(story.media_file);
    await Story.findByIdAndDelete(story._id);

    res.status(200).json({
      success: true,
      message: 'Story deleted successfully',
    });
  } catch (error) {
    console.error('Delete story error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete story',
    });
  }
};

// @desc    Move a story to another highlight
// @route   PUT /api/highlights/stories/:storyId/move
// @access  Private (Admin)
exports.moveStory = async (req, res) => {
  try {
    const { highlight_id } = req.body;

    if (!highlight_id) {
      return res.status(400).json({
        success: false,
        message: 'Target highlight_id is required',
      });
    }

    const targetHighlight = await Highlight.findById(highlight_id);
    if (!targetHighlight) {
      return res.status(404).json({
        success: false,
        message: 'Target highlight not found',
      });
    }

    const story = await Story.findByIdAndUpdate(
      req.params.storyId,
      { highlight_id },
      { new: true }
    );

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Story not found',
      });
    }

    res.status(200).json({
      success: true,
      message: `Story moved to "${targetHighlight.name}" successfully`,
      story,
    });
  } catch (error) {
    console.error('Move story error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to move story',
    });
  }
};
