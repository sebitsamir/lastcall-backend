const mongoose = require("mongoose");
const Auction = require("../models/Auction");
const Bid = require("../models/Bid");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/apiResponse");

// @desc Place a bid (The Escrow Transaction)
// @route POST /api/v1/auctions/:auctionId/bid
exports.placeBid = asyncHandler(async (req, res, next) => {
  const { auctionId } = req.params; // Ensure your route is defined as /:auctionId
  const { amount } = req.body;
  const userId = req.user._id;

  if (typeof amount !== "number" || amount <= 0) {
    throw new AppError("Bid amount must be a positive number", 400);
  }

  // 1. Start a MongoDB session & Transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 2. Fetch data within the transaction session
    const auction = await Auction.findById(auctionId).session(session);
    if (!auction) throw new AppError("Auction not found", 404);

    const now = new Date();
    if (auction.status !== "active" || now > auction.endTime) {
      throw new AppError("This auction is no longer active", 400);
    }

    if (amount <= auction.currentBid) {
      throw new AppError(
        `Bid must be strictly higher than current bid ($${auction.currentBid})`,
        409,
      );
    }

    const user = await User.findById(userId).session(session);
    if (!user) throw new AppError("User not found", 404);

    // FIX 2: Use 'availableBalance' consistently
    if (user.availableBalance < amount) {
      throw new AppError(
        `Insufficient funds. Available: $${user.availableBalance}`,
        422,
      );
    }

    // 3. Unfreeze the previous highest bidder's funds (Escrow Release)
    if (auction.currentHighestBidder) {
      await User.findByIdAndUpdate(
        auction.currentHighestBidder,
        {
          $inc: {
            availableBalance: auction.currentBid, // Give money back
            frozenBalance: -auction.currentBid, // Remove from Escrow
          },
        },
        { session, new: true },
      );
    }

    // 4. Freeze the new Bidder's funds (Escrow lock)
    await User.findByIdAndUpdate(
      userId,
      {
        $inc: {
          availableBalance: -amount, // Deduct from available
          frozenBalance: amount, // Lock in Escrow
        },
      },
      { session },
    );

    // 5. Create the Bid Record
    const [bid] = await Bid.create(
      [
        {
          auction: auctionId,
          bidder: userId,
          amount,
        },
      ],
      { session },
    );

    // 6. Update Auction State
    auction.currentBid = amount;
    auction.currentHighestBidder = userId;
    await auction.save({ session });

    // 7. Commit the Transaction (All or Nothing)
    await session.commitTransaction();

    // 8. Real-time Broadcast (AFTER commit so we don't broadcast failed bids)
    const io = req.app.get("io");
    if (io) {
      io.to(`lastcall:auction:${auctionId}`).emit("newBid", {
        bidAmount: amount,
        bidderName: user.name,
        timestamp: new Date(),
      });
    }

    ApiResponse.created(res, { bid }, "Bid placed successfully");
  } catch (error) {
    // 9. Rollback on any error
    await session.abortTransaction();
    next(error); // Pass to globalErrorHandler (asyncHandler already catches, but next is safer)
  } finally {
    // 10. Always end the session to prevent connection leaks
    session.endSession();
  }
});
