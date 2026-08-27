// src/controllers/bidController.js
const mongoose = require("mongoose");
const Auction = require("../models/Auction");
const Bid = require("../models/Bid");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/apiResponse");
const logger = require("../utils/logger");

/**
 * @desc    Place a bid on an auction
 * @route   POST /api/v1/auctions/:auctionId/bid
 */
exports.placeBid = asyncHandler(async (req, res, next) => {
  const { auctionId } = req.params;
  const { amount } = req.body;
  const bidderId = req.user._id;

  // 1. Validate bid amount
  if (!amount || typeof amount !== "number" || amount <= 0) {
    return next(new AppError("Invalid bid amount", 400));
  }

  // 2. Fetch auction with lock (for transaction safety)
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const auction = await Auction.findById(auctionId).session(session);
    if (!auction) {
      await session.abortTransaction();
      return next(new AppError("Auction not found", 404));
    }

    // 3. Check auction state
    if (auction.status !== "active") {
      await session.abortTransaction();
      return next(new AppError("Auction is not active", 400));
    }

    if (auction.endTime && new Date(auction.endTime) < new Date()) {
      await session.abortTransaction();
      return next(new AppError("Auction has ended", 400));
    }

    // 4. Validate bid is higher than current
    const minimumBid = (auction.currentBid || auction.startingPrice || 0) + 1;
    if (amount < minimumBid) {
      await session.abortTransaction();
      return next(
        new AppError(
          `Bid must be at least $${minimumBid}. Current bid is $${auction.currentBid || auction.startingPrice}`,
          400
        )
      );
    }

    // 5. Capture previous state for outbid notification
    const previousHighestBidder = auction.currentHighestBidder;
    const previousBid = auction.currentBid || auction.startingPrice || 0;

    // 6. Check if bidder is the seller
    if (auction.seller.toString() === bidderId.toString()) {
      await session.abortTransaction();
      return next(new AppError("Sellers cannot bid on their own auctions", 400));
    }

    // 7. Fetch bidder
    const bidder = await User.findById(bidderId).session(session);
    if (!bidder) {
      await session.abortTransaction();
      return next(new AppError("Bidder not found", 404));
    }

    // 8. Check available balance
    if (bidder.availableBalance < amount) {
      await session.abortTransaction();
      return next(
        new AppError(
          `Insufficient balance. You have $${bidder.availableBalance.toFixed(2)} available`,
          400
        )
      );
    }

    // 9. Freeze funds for this bid
    await User.findByIdAndUpdate(
      bidderId,
      {
        $inc: {
          availableBalance: -amount,
          frozenBalance: amount,
        },
      },
      { session }
    );

    // 10. Refund previous highest bidder (if any)
    if (previousHighestBidder && previousBid > 0) {
      await User.findByIdAndUpdate(
        previousHighestBidder,
        {
          $inc: {
            availableBalance: previousBid,
            frozenBalance: -previousBid,
          },
        },
        { session }
      );
    }

    // 11. Update auction with optimistic concurrency check
    const updatedAuction = await Auction.findOneAndUpdate(
      {
        _id: auctionId,
        status: "active",
        currentBid: previousBid, // ← ensures no concurrent bid won the race
      },
      {
        $set: {
          currentBid: amount,
          currentHighestBidder: bidderId,
        },
      },
      {
        new: true,
        session,
      }
    );

    if (!updatedAuction) {
      // Another bid won the race — abort everything
      await session.abortTransaction();
      return next(
        new AppError("Another bid was placed. Please try again.", 409)
      );
    }

    // 12. Create bid record
    await Bid.create(
      [
        {
          auction: auctionId,
          bidder: bidderId,
          amount,
        },
      ],
      { session }
    );

    // 13. Commit transaction
    await session.commitTransaction();

    // 14. Emit real-time events (after commit)
    if (global.io) {
      // Notify auction room of new bid
      global.io.to(`lastcall:auction:${auctionId}`).emit("newBid", {
        auctionId,
        currentBid: amount,
        bidderName: bidder.name,
        bidCount: await Bid.countDocuments({ auction: auctionId }),
      });

      // Notify previous highest bidder they've been outbid
      if (previousHighestBidder && previousHighestBidder.toString() !== bidderId.toString()) {
        global.io.to(`lastcall:user:${previousHighestBidder}`).emit("outbid", {
          auctionId,
          auctionTitle: auction.title,
          previousBid,
          currentBid: amount,
          releasedAmount: previousBid,
        });
      }
    }

    // 15. Return success
    ApiResponse.success(
      res,
      {
        auction: updatedAuction,
        message: `Bid of $${amount} placed successfully`,
      },
      "Bid placed successfully"
    );
  } catch (error) {
    await session.abortTransaction();
    logger.error("Bid placement failed:", error);
    next(error);
  } finally {
    session.endSession();
  }
});