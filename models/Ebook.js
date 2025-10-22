const mongoose = require("mongoose");

const ebookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Please provide a title for the ebook"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Please provide a description for the ebook"],
      trim: true,
    },
    accentColor: {
      type: String,
      required: [true, "Please provide an accent color"],
      default: "#3B82F6", // blue-500
    },
    plan: {
      type: String,
      required: [true, "Please specify the plan"],
      enum: ["knowic", "learnic", "masteric"],
    },
    pdfFile: {
      type: String,
      required: [true, "Please upload a PDF file"],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Ebook", ebookSchema);
