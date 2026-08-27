// src/controllers/settlementController.js
const mongoose = require("mongoose");
const Auction = require("../models/Auction");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");

/**
 * @desc    Settle completed auctions (release winner funds, pay seller)
 * @route   POST /api/v1/settlement/process
 * @access  Private (Admin/System only)
 */
exports.processSettlement = asyncHandler(async (req, res, next) => {
    const now = new Date();

    // Find auctions that have ended and are still active
    const auctions = await Auction.find({
        status: "active",
        endTime: { $lte: now },
    });

    if (auctions.length === 0) {
        return res.status(200).json({
            status: "success",
            message: "No auctions to settle",
            data: { settled: 0 },
        });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    let settledCount = 0;

    try {
        for (const auction of auctions) {
            // Atomic state transition: only settle if still active
            const transitioned = await Auction.findOneAndUpdate(
                {
                    _id: auction._id,
                    status: "active", // ← prevents double-settlement
                },
                { $set: { status: "completed" } },
                { new: true, session }
            );

            if (!transitioned) {
                // Another process already settled this auction
                continue;
            }

            // If there's a winner, release their frozen funds and pay seller
            if (auction.currentHighestBidder && auction.currentBid > 0) {
                // Release winner's frozen funds
                await User.findByIdAndUpdate(
                    auction.currentHighestBidder,
                    {
                        $inc: {
                            frozenBalance: -auction.currentBid,
                        },
                    },
                    { session }
                );

                // Pay seller
                await User.findByIdAndUpdate(
                    auction.seller,
                    {
                        $inc: {
                            availableBalance: auction.currentBid,
                        },
                    },
                    { session }
                );

                // Record transaction for winner
                await Transaction.create(
                    [
                        {
                            user: auction.currentHighestBidder,
                            type: "purchase",
                            amount: auction.currentBid,
                            description: `Won auction: ${auction.title}`,
                            auction: auction._id,
                        },
                    ],
                    { session }
                );

                // Record transaction for seller
                await Transaction.create(
                    [
                        {
                            user: auction.seller,
                            type: "sale",
                            amount: auction.currentBid,
                            description: `Sold: ${auction.title}`,
                            auction: auction._id,
                        },
                    ],
                    { session }
                );

                logger.info(
                    `Settled auction ${auction._id}: $${auction.currentBid} transferred to seller ${auction.seller}`
                );
            }

            settledCount++;
        }

        await session.commitTransaction();

        res.status(200).json({
            status: "success",
            message: `Settled ${settledCount} auction(s)`,
            data: { settled: settledCount },
        });
    } catch (error) {
        await session.abortTransaction();
        logger.error("Settlement failed:", error);
        next(error);
    } finally {
        session.endSession();
    }
});

