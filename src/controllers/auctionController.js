const Auction = require("../models/Auction");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/apiResponse");

// @desc    Create a new auction
// @route   POST /api/v1/auctions
exports.createAuction = asyncHandler(async (req, res) => {
  // The seller is the currently logged-in user
  const auctionData = { ...req.body, seller: req.user._id };
  const auction = await Auction.create(auctionData);

  ApiResponse.created(res, auction, "Auction created successfully");
});

// @desc    Get all active auctions (with filtering & pagination)
// @route   GET /api/v1/auctions
exports.getAllAuctions = asyncHandler(async (req, res) => {
  const { category, status = "active", page = 1, limit = 10 } = req.query;
  const filter = {};
  if (category) filter.category = category;
  if (status) filter.status = status;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [auctions, total] = await Promise.all([
    Auction.find(filter)
      .sort({ endTime: 1 }) // Sort by ending soonest
      .skip(skip)
      .limit(parseInt(limit))
      .populate("seller", "name email"),
    Auction.countDocuments(filter),
  ]);

  ApiResponse.paginated(
    res,
    auctions,
    {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
    },
    "Auctions retrieved successfully",
  );
});

// @desc    Get single auction details
// @route   GET /api/v1/auctions/:id
exports.getAuctionById = asyncHandler(async (req, res, next) => {
  const auction = await Auction.findById(req.params.id)
    .populate("seller", "name email")
    .populate("currentHighestBidder", "name");

  if (!auction) return next(new AppError("Auction not found", 404));

  ApiResponse.success(res, auction, "Auction retrieved successfully");
});
