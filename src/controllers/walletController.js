// src/controllers/walletController.js
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");

/**
 * @desc    Get user wallet balance
 * @route   GET /api/v1/users/wallet
 */
exports.getBalance = asyncHandler(async (req, res, next) => {
    const user = await User.findById(req.user._id).select("availableBalance frozenBalance");
    if (!user) return next(new AppError("User not found", 404));

    res.status(200).json({
        status: "success",
        data: {
            available: user.availableBalance || 0,
            frozen: user.frozenBalance || 0,
            total: (user.availableBalance || 0) + (user.frozenBalance || 0),
        },
    });
});

/**
 * @desc    Deposit funds into available balance
 * @route   POST /api/v1/users/wallet/deposit
 */
exports.deposit = asyncHandler(async (req, res, next) => {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
        return next(new AppError("Please provide a valid deposit amount greater than 0", 400));
    }

    const user = await User.findById(req.user._id);
    if (!user) return next(new AppError("User not found", 404));

    // 1. Update balance
    user.availableBalance = (user.availableBalance || 0) + Number(amount);
    await user.save({ validateBeforeSave: false });

    // 2. Record the ledger entry
    await Transaction.create({
        user: user._id,
        type: "deposit",
        amount: Number(amount),
        description: "Funds added to wallet",
    });

    res.status(200).json({
        status: "success",
        data: {
            available: user.availableBalance,
            frozen: user.frozenBalance || 0,
        },
    });
});

/**
 * @desc    Get paginated transaction history
 * @route   GET /api/v1/users/wallet/transactions
 */
exports.getTransactions = asyncHandler(async (req, res, next) => {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const total = await Transaction.countDocuments({ user: req.user._id });

    const transactions = await Transaction.find({ user: req.user._id })
        .sort({ createdAt: -1 }) // Newest first
        .skip(skip)
        .limit(limit);

    res.status(200).json({
        status: "success",
        data: {
            transactions,
            pagination: {
                page,
                pages: Math.ceil(total / limit) || 1,
                total,
            },
        },
    });
});