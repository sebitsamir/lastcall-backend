const User = require('../models/User');
const Transaction = require('../models/Transaction');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/apiResponse');
const mongoose = require('mongoose');

// @desc Add funds to user account (Simulated for now)
// @route POST /api/v1/users/balance/add
// @access Private
exports.addFunds = asyncHandler(async (req, res, next) => {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
        return next(new AppError("Please provide a valid positive amount", 400));
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 1. Update user balance
        const user = await User.findByIdAndUpdate(
            req.user._id,
            { $inc: { availableBalance: amount } },
            { new: true, session }
        );

        // 2. Log the transaction
        await Transaction.create(
            [
                {
                    user: req.user._id,
                    type: "deposit",
                    amount: amount,
                    description: `Added funds to the account`,
                    status: "completed",
                },
            ],
            { session }
        );

        await session.commitTransaction();

        ApiResponse.success(
            res,
            {
                availableBalance: user.availableBalance,
                frozenBalance: user.frozenBalance,
            },
            "Funds added successfully"
        );
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
});

// @desc Get user's transaction history
// @route GET /api/v1/users/transactions
// @access Private
exports.getTransactionHistory = asyncHandler(async (req, res, next) => {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const totalTransactions = await Transaction.countDocuments({ user: req.user._id })
    const transactions = await Transaction.find({ user: req.user._id })
        .populate("auction", "title") // Shows the auction title if applicable
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    ApiResponse.success(res, {
        transactions,
        pagination: {
            currentPage: page,
            totalPages: Math.ceil(totalTransactions / limit),
            totalTransactions,
        },
    }, "Transaction history retrieved successfully");
});

// @desc Update user profile (name)
// @route PATCH /api/v1/users/me
// @access Private
exports.updateProfile = asyncHandler(async (req, res, next) => {
    const { name } = req.body;

    // Prevent updating email/password here (should be separate, more secure flows)
    const updateUser = await User.findByIdAndUpdate(
        req.user._id,
        { name },
        { new: true, runValidators: true }
    ).select("-password");

    ApiResponse.success(res, { user: updateUser }, "Profile updated successfully");
});

// Toggle an auction in the user's watchlist
exports.toggleWatchlist = asyncHandler(async (req, res, next) => {
    const userId = req.user._id;
    const { auctionId } = req.params;

    const user = await User.findById(userId);
    if (!user) return next(new AppError("User not found", 404));

    // SAFETY CHECK: Initialize watchlist as an empty array if it doesn't exist
    if (!user.watchlist) {
        user.watchlist = [];
    }

    // Convert ObjectId to string for reliable comparison
    const isWatching = user.watchlist.some(
        (id) => id.toString() === auctionId
    );

    if (isWatching) {
        // Remove from watchlist
        user.watchlist = user.watchlist.filter(
            (id) => id.toString() !== auctionId
        );
    } else {
        // Add to watchlist
        user.watchlist.push(auctionId);
    }

    // Save without running full validation to be faster
    await user.save({ validateBeforeSave: false });

    ApiResponse.success(
        res,
        { isWatching: !isWatching },
        isWatching ? "Removed from watchlist" : "Added to watchlist"
    );
});

// Get user's watchlist
exports.getWatchlist = asyncHandler(async (req, res, next) => {
    const user = await User.findById(req.user._id).populate({
        path: 'watchlist',
        match: { status: 'active' }
    });

    ApiResponse.success(res, user.watchlist, "Watchlist retrieved");
});