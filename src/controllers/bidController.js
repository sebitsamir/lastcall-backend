const mongoose = require("mongoose");
const Bid = require("../models/Bid");
const Auction = require("../models/Auction");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/apiResponse");

exports.placeBid = asyncHandler(async (req, res, next) => {
  // 1. SAFETY CHECK: Ensure protect middleware actually ran
  if (!req.user || !req.user._id) {
    return next(new AppError("Authentication failed. Please log in to bid.", 401));
  }

  const auctionId = req.params.id; // Matches the /:id/bid route
  const { amount } = req.body;
  const bidderId = req.user._id;

  // 2. Find the auction
  const auction = await Auction.findById(auctionId);
  if (!auction) {
    return next(new AppError("Auction not found", 404));
  }

  // 3. Validate auction status
  if (auction.status !== "active") {
    return next(new AppError("This auction is not currently active", 400));
  }

  // 4. Prevent seller from bidding on their own auction
  if (auction.seller.toString() === bidderId.toString()) {
    return next(new AppError("You cannot bid on your own auction", 403));
  }

  // 5. Validate bid amount
  if (amount <= auction.currentBid) {
    return next(new AppError(`Bid must be higher than the current bid of ${auction.currentBid}`, 409));
  }

  // 6. Check bidder's balance
  const bidder = await User.findById(bidderId);
  if (bidder.availableBalance < amount) {
    return next(new AppError("Insufficient available balance to place this bid", 422));
  }

  // 7. Execute Transaction (Escrow Logic)
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // A. If there was a previous highest bidder, unfreeze their money
    if (auction.currentHighestBidder && auction.currentBid > 0) {
      await User.findByIdAndUpdate(
        auction.currentHighestBidder,
        {
          $inc: {
            availableBalance: auction.currentBid,
            frozenBalance: -auction.currentBid,
          },
        },
        { session }
      );

      await Transaction.create(
        [
          {
            user: auction.currentHighestBidder,
            type: "bid_released",
            amount: auction.currentBid,
            description: `Outbid on auction: ${auction.title}`,
            auction: auction._id,
            status: "completed",
          },
        ],
        { session }
      );
    }

    // B. Freeze the new bidder's money
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

    await Transaction.create(
      [
        {
          user: bidderId,
          type: "bid_frozen",
          amount: amount,
          description: `Bid placed on auction: ${auction.title}`,
          auction: auction._id,
          status: "completed",
        },
      ],
      { session }
    );

    // C. Update the auction with the new bid
    auction.currentBid = amount;
    auction.currentHighestBidder = bidderId;
    await auction.save({ session });

    // D. Create the Bid record
    await Bid.create(
      [
        {
          auction: auctionId,
          bidder: bidderId,
          amount: amount,
        },
      ],
      { session }
    );

    await session.commitTransaction();

    // E. Emit WebSocket event (if io is available)
    const io = req.app.get("io");
    if (io) {
      io.to(`lastcall:auction:${auctionId}`).emit("newBid", {
        auctionId,
        amount,
        bidderName: bidder.name,
      });
    }

    ApiResponse.success(
      res,
      {
        auction: {
          id: auction._id,
          currentBid: auction.currentBid,
          currentHighestBidder: auction.currentHighestBidder,
        },
      },
      "Bid placed successfully"
    );
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
});