const express = require("express");
const router = express.Router();

// 1. Import the  middlewares
const { protect } = require("../middleware/auth");
const validate = require("../middleware/validate");

// 2. Import  the Validators
const auctionValidator = require("../validators/auctionValidator");
const bidValidator = require("../validators/bidValidator");

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

router.post("/", protect, validate(auctionValidator.create), auctionController.createAuction);
router.patch("/:id", protect, validate(auctionValidator.update), auctionController.updateAuction);
router.post("/:id/cancel", protect, validate(auctionValidator.cancel), auctionController.cancelAuction);
router.post("/:id/bid", protect, validate(bidValidator.place), bidController.placeBid);

module.exports = router;


