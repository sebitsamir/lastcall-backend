const mongoose = require("mongoose");

const bidSchema = new mongoose.Schema(
  {
    auction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Auction", // Mongoose resolves this string automatically
      required: true,
    },
    bidder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true },
);

// Index to quickly fetch bid history for a specific auction
bidSchema.index({ auction: 1, createdAt: -1 });

const Bid = mongoose.model("Bid", bidSchema);

module.exports = Bid;
