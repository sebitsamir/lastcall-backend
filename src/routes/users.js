const express = require('express');
const router = express.Router();

const userController = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const { getWatchlist, toggleWatchlist } = require("../controllers/userController");

// All routers here require authentication
router.use(protect);

router.patch("/me", userController.updateProfile);
router.post("/balance/add", userController.addFunds);
router.get("/transactions", userController.getTransactionHistory);
router.post("/watchlist/:auctionId", protect, toggleWatchlist);
router.get("/watchlist", protect, getWatchlist);
router.get("/bids", protect, userController.getMyBids);

module.exports = router;