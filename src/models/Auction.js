const mongoose = require("mongoose");

const auctionSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, "Title is required"],
            trim: true,
            maxlength: [100, "Title cannot exceed 100 characters"],
        },
        description: {
            type: String,
            required: [true, "Description is required"],
            maxlength: [5000, "Description cannot exceed 5000 characters"],
        },

        category: {
            type: String,
            required: [true, 'An auction must have a category'],
            enum: ['Art', 'Electronics', 'Watches', 'Collectibles', 'Fashion', 'Sports']
        },
        images: {
            type: [String],
            validate: {
                validator: function (arr) {
                    return arr.length >= 1 && arr.length <= 10;
                },
                message: "Auction must have between 1 and 10 images",
            },
        },

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
            required: [true, "End time is required"],
            validate: {
                validator: function (value) {
                    return value > this.startTime || value > new Date();
                },
                message: "End time must be after start time or now",
            },
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
// Index for fetching a specific user's auctions quickly
auctionSchema.index({ seller: 1 });

const Auction = mongoose.model("Auction", auctionSchema);
module.exports = Auction;
