const mongoose = require("mongoose");

const auctionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
      enum: ["art", "electronics", "watches", "collectibles", "fashion"],
    },
    images: [{ type: String }], //Will hold S3 URLs later
    startingPrice: {
      type: Number,
      required: true,
      min: [0, "Price cannot be negative"],
    },
    currentBid: {
      type: Number,
      default: 0,
    },
    currentHighestBidder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["upcoming", "active", "completed", "cancelled"],
      default: "upcoming",
    },
  },
  { timestamps: true },
);

// Compound index for efficiently querying active auctions ending soon
auctionSchema.index({ status: 1, endTime: 1 });

const Auction = mongoose.model("Auction", auctionSchema);
module.exports = Auction;
