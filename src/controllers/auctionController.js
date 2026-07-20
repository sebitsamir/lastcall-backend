const mongoose = require('mongoose');
const Auction = require('../models/Auction');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/apiResponse');
const cloudinary = require('../config/cloudinary');

// @desc    Create a new auction
// @route   POST /api/v1/auctions
// @access  Private
exports.createAuction = asyncHandler(async (req, res, next) => {

    // Ensure images were uploaded
    if (!req.files || req.files.length === 0) {
    return next(new AppError('Please upload at least one image for the auction.', 400));
    }

    // Upload images to Cloudinary
    const uploadPromises = req.files.map((file) =>
        new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                { folder: 'lastcall_auctions' },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result.secure_url);
                }
            );
            stream.end(file.buffer);
        })
    );

    const imageUrls = await Promise.all(uploadPromises);

    // Create auction
    const auctionData = {
        ...req.body,
        images: imageUrls,
        seller: req.user._id, // From your auth middleware
        currentBid: req.body.startingPrice, // Initialize current bid to starting price
        };

    const auction = await Auction.create(auctionData);
    ApiResponse.created(res, { auction }, 'Auction created successfully');
});

// @desc    Get all auctions (with pagination & filtering)
// @route   GET /api/v1/auctions
// @access  Public
exports.getAuctions = asyncHandler(async (req, res, next) => {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    // Build query
    const query = {};
    if (req.query.category) query.category = req.query.category;
    if (req.query.status) query.status = req.query.status;
    if (req.query.seller) query.seller = req.query.seller;

    const totalAuctions = await Auction.countDocuments(query);
    const auctions = await Auction.find(query)
        .populate('seller', 'name email')
        .populate('currentHighestBidder', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    ApiResponse.success(res, {
        auctions,
        pagination: {
            currentPage: page,
            totalPages: Math.ceil(totalAuctions / limit),
            totalAuctions,
        },
    }, 'Auctions retrieved successfully');
});

// @desc    Get single auction details
// @route   GET /api/v1/auctions/:id
// @access  Public
exports.getAuctionById = asyncHandler(async (req, res, next) => {
    const auction = await Auction.findById(req.params.id)
        .populate('seller', 'name email')
        .populate('currentHighestBidder', 'name');

    if (!auction) {
        return next(new AppError('Auction not found', 404));
    }

    ApiResponse.success(res, { auction }, 'Auction retrieved successfully');
});

// @desc    Update auction (Only if upcoming and no bids)
// @route   PATCH /api/v1/auctions/:id
// @access  Private (Seller only)
exports.updateAuction = asyncHandler(async (req, res, next) => {
    const auction = await Auction.findById(req.params.id);

    if (!auction) return next(new AppError('Auction not found', 404));

    // Authorization: Only the seller can update
    if (auction.seller.toString() !== req.user._id.toString()) {
        return next(new AppError('You are not authorized to update this auction', 403));
    }

    // Business Logic: Cannot update if auction has started or has bids
    if (auction.status !== 'upcoming') {
        return next(new AppError('Cannot update an auction that has already started or ended', 400));
    }
    
    const updatedAuction = await Auction.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
    });

    ApiResponse.success(res, { auction: updatedAuction }, 'Auction updated successfully');
});

// @desc    Cancel auction & refund highest bidder (if any)
// @route   DELETE /api/v1/auctions/:id
// @access  Private (Seller only)
exports.cancelAuction = asyncHandler(async (req, res, next) => {
    const auction = await Auction.findById(req.params.id);
    if (!auction) return next(new AppError('Auction not found', 404));

    if (auction.seller.toString() !== req.user._id.toString()) {
        return next(new AppError('You are not authorized to cancel this auction', 403));
    }
    
    if (auction.status === 'completed' || auction.status === 'cancelled') {
        return next(new AppError('Auction is already completed or cancelled', 400));
    }

    // Start transaction to safely refund the highest bidder
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
    // If there is a highest bidder, unfreeze their funds
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
    }

    // Mark auction as cancelled
    auction.status = 'cancelled';
    await auction.save({ session });

    await session.commitTransaction();
    
    ApiResponse.success(res, { auction }, 'Auction cancelled and funds refunded successfully');
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
});