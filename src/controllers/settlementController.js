const mongoose = require('mongoose');
const Auction = require('../models/Auction');
const User = require('../models/User');
const Bid = require('../models/Bid');
const Transaction = require('../models/Transaction');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/apiResponse');

// @desc Manually settle an auction (for testing or admin use)
// @route POST /api/v1/auctions/:auctionId/settle
// @access Private(Seller or Admin)
exports.settleAuction = asyncHandler(async (req, res, next) => {
    const { auctionId } = req.params;

    const auction = await Auction.findById(auctionId);

    if (!auction) {
        return next(new AppError("Auction not found", 404));
    }

    // Authorization: Only Seller or admin can manually settle
    if (
        auction.seller.toString() !== req.user._id.toString() &&
        req.user.role !== "admin"
    ) {
        return next(new AppError("You are not authorized to settle this auction", 403));
    }

    if (auction.status === "completed" || auction.status === "cancelled") {
        return next(new AppError("Auction is already completed or cancelled", 400));
    }

    // Perform the settlement
    const result = await processAuctionSettlement(auction);

    ApiResponse.success(res, result, "Auction settled successfully");
});

// @desc Process auction settlement (Called by cron job or manually)
// This the core logic that handles fund transfers
const processAuctionSettlement = async (auction) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Case 1: Auction has a winner (the highest bidder exists)
        if (auction.currentHighestBidder && auction.currentBid > 0) {
            // 1. Transfer funds from winner's frozen balance to seller's available balance
            await User.findByIdAndUpdate(
                auction.currentHighestBidder,
                {
                    $inc: {
                        frozenBalance: -auction.currentBid, // Unfreeze winner's money
                    },
                },
                { session }
            );

            await User.findByIdAndUpdate(
                auction.seller,
                {
                    $inc: {
                        availableBalance: auction.currentBid, // Pay the seller
                    },
                },
                { session }
            );

            // 2. Log transaction for both parties
            await Transaction.create(
                [
                    {
                        user: auction.currentHighestBidder,
                        type: "auction_won",
                        amount: auction.currentBid,
                        description: `Received payment for auction: ${auction.title}`,
                        auction: auction._id,
                        status: "completed",
                    },
                ],
                { session }
            );

            // 3. Mark auction as completed
            auction.status = "completed";
            await auction.save({ session });

            await session.commitTransaction();

            return {
                auctionId: auction._id,
                status: "completed",
                winner: auction.currentHighestBidder,
                winningBid: auction.currentBid,
                seller: auction.seller,
            };
        }

        // Case 2: No bids, just mark completed
        auction.status = "completed";
        await auction.save({ session });

        await session.commitTransaction();
        return {
            auctionId: auction._id,
            status: "completed",
            message: "Auction ended with no bids",
        };
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

// @desc Check and settle all ended auctions (called by cron job)
exports. checkAndSettleEndedAuctions = async() => {
    const now = new Date();

    // Find all active auctions that have passed their endTime
    const endedAuctions = await Auction.find({
        status: "active",
        endTime: { $lte: now },
    });

    if (endedAuctions.length === 0) {
        console.log("[Settlement] No auctions to settle at", now.toISOString());
        return { settled: 0 };
    }

    console.log(`[Settlement] Found ${endedAuctions.length} auction(s) to settle`);

    const results = [];

    for (const auction of endedAuctions) {
        try {
            const result = await processAuctionSettlement(auction);
            results.push(result);
            console.log(`[Settlement] Successfully settled auction ${auction._id}`);
        } catch (error) {
            console.log(`[Settlement] Failed to settle auction ${auction._id}:`, error.message);
            results.push({
                auctionId: auction._id,
                status: "failed",
                error: error.message,
            });
        }
    }

    return { settled: results.length, results };
};

module.exports = {
    settleAuction: exports.settleAuction,
    checkAndSettleEndedAuctions: exports.checkAndSettleEndedAuctions,
};