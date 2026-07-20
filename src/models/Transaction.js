const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true, // Fast lookups for user history
        },
        type: {
            type: String, 
            enum: ["deposit", "withdrawal", "bid_frozen", "bid_released", "auction_won", "auction_refund"],
            required: true,
        },
        amount: {
            type: Number,
            required: true,
        },
        description: {
            type: String,
            required: true,
        },
        auction: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Auction",
        default: null, // Optional: link to auction if applicable
        },
        status: {
            type: String,
            enum: ["pending", "completed", "failed"],
            default: "completed",
        },
    },
    { timestamps: true }
);

// Index for sorting history by date (newest first)
transactionSchema.index({ user: 1, createdAt: -1 });

const Transaction = mongoose.model("Transaction", transactionSchema);
module.exports = Transaction;