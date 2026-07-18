const express = require("express");
const router = express.Router();
const auctionController = require("../controllers/auctionController");
const bidController = require("../controllers/bidController");
const { protect } = require("../middleware/auth");

// Public routes (Anyone can view auctions)
router.get("/", auctionController.getAllAuctions);
router.get("/:id", auctionController.getAuctionById);

// Protected routes (Must be logged in)
router.post("/", protect, auctionController.createAuction);
router.post("/:auctionId/bid", protect, bidController.placeBid); // The Masterpiece

module.exports = router;
