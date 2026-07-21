const express = require("express");
const router = express.Router();

// 1. Import the protect middleware
const { protect } = require("../middleware/auth");

// 2. Import controllers
const auctionController = require("../controllers/auctionController");
const bidController = require("../controllers/bidController");
const upload = require("../middleware/upload");

// ==========================================
// PUBLIC ROUTES
// ==========================================
router.get("/", auctionController.getAuctions);
router.get("/:id", auctionController.getAuctionById);

// ==========================================
// PROTECTED ROUTES (protect MUST be here)
// ==========================================
router.post(
  "/",
  protect,
  upload.array("images", 5),
  auctionController.createAuction
);

router.patch("/:id", protect, auctionController.updateAuction);
router.delete("/:id", protect, auctionController.cancelAuction);
router.post("/:id/bid", protect, bidController.placeBid);

module.exports = router;