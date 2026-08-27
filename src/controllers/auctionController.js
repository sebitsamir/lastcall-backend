const mongoose = require('mongoose');
const Auction = require('../models/Auction');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/apiResponse');
const Bid = require('../models/Bid');

// @desc    Create a new auction
// @route   POST /api/v1/auctions
// @access  Private
exports.createAuction = asyncHandler(async (req, res, next) => {
    // 1. The frontend already uploaded images to Cloudinary via /uploads.
    // We just need to verify the URLs arrived in the JSON body.
    const { images } = req.body;
    if (!images || !Array.isArray(images) || images.length === 0) {
        return next(new AppError("Please upload at least one image for the auction.", 400));
    }

    // 2. Build the auction document using the pre-uploaded URLs
    const auctionData = {
        title: req.body.title,
        description: req.body.description,
        category: req.body.category,
        images: images, // Direct assignment, no Cloudinary stream needed here!
        startingPrice: Number(req.body.startingPrice),
        startTime: req.body.startTime || undefined,
        endTime: req.body.endTime,
        seller: req.user._id,
        currentBid: Number(req.body.startingPrice), // Initialize current bid
        status: req.body.startTime && new Date(req.body.startTime) > new Date() ? 'upcoming' : 'active',
    };

    const auction = await Auction.create(auctionData);
    ApiResponse.created(res, { auction }, 'Auction created successfully');
});

// @desc    Get all auctions (with pagination & filtering)
// @route   GET /api/v1/auctions
// @access  Public
// src/controllers/auctionController.js

exports.getAuctions = asyncHandler(async (req, res, next) => {
    // 1. Pagination Setup
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    // 2. Build the Query (Secure & Conditional)
    const query = {};

    // Default to active auctions for the public feed unless a specific status is requested
    query.status = req.query.status || "active";

    // Category Filter
    if (req.query.category && req.query.category !== "all") {
        query.category = req.query.category;
    }

    // Text Search Filter (Case-insensitive regex for title or description)
    if (req.query.search) {
        query.$or = [
            { title: { $regex: req.query.search, $options: "i" } },
            { description: { $regex: req.query.search, $options: "i" } }
        ];
    }

    // Price Range Filter
    if (req.query.minPrice || req.query.maxPrice) {
        query.currentBid = {};
        if (req.query.minPrice) query.currentBid.$gte = Number(req.query.minPrice);
        if (req.query.maxPrice) query.currentBid.$lte = Number(req.query.maxPrice);
    }

    // 3. Dynamic Sorting
    let sortOptions = { createdAt: -1 }; // Default: Newest first
    if (req.query.sortBy === "endingSoon") {
        sortOptions = { endTime: 1 }; // Ascending: Closest end time first
    } else if (req.query.sortBy === "priceLow") {
        sortOptions = { currentBid: 1 };
    } else if (req.query.sortBy === "priceHigh") {
        sortOptions = { currentBid: -1 };
    }

    // 4. Execute Query with Pagination & Population
    const totalAuctions = await Auction.countDocuments(query);

    const auctions = await Auction.find(query)
        .populate("seller", "name email")
        .populate("currentHighestBidder", "name")
        .sort(sortOptions)
        .skip(skip)
        .limit(limit);

    // 5. Return Structured Response
    ApiResponse.success(res, {
        auctions,
        pagination: {
            currentPage: page,
            totalPages: Math.ceil(totalAuctions / limit),
            totalAuctions,
        },
    }, "Auctions retrieved successfully");
});

// @desc    Get single auction details + bid history
// @route   GET /api/v1/auctions/:id
// @access  Public
exports.getAuctionById = asyncHandler(async (req, res, next) => {
    const auction = await Auction.findById(req.params.id)
        .populate('seller', 'name email')
        .populate('currentHighestBidder', 'name');

    if (!auction) {
        return next(new AppError('Auction not found', 404));
    }

    // Bid history lives in its own collection — query it separately.
    // Works whether or not the Auction schema has a `bids` array.
    const bids = await Bid.find({ auction: auction._id })
        .populate('bidder', 'name')
        .sort({ createdAt: -1 })
        .limit(50);

    const payload = auction.toObject();
    payload.bids = bids; // frontend reads data.bids defensively

    ApiResponse.success(res, { auction: payload }, 'Auction retrieved successfully');
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

    await Transaction.create(
        [
            {
                user: auction.currentHighestBidder,
                type: "refund",
                amount: auction.currentBid,
                description: `Auction cancelled: ${auction.title}`,
                auction: auction._id,
            },
        ],
        { session }
    );

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


// @desc    Get all auctions created by the signed-in seller
// @route   GET /api/v1/auctions/mine
// @access  Private

exports.getMyAuctions = asyncHandler(async (req, res, next) => {
    const auctions = await Auction.find({ seller: req.user._id }).sort({
        createdAt: -1,
    });

    res.status(200).json({
        status: "success",
        data: { auctions },
    });
});