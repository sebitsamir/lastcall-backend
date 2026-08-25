// src/routes/wallet.js
const express = require("express");
const walletController = require("../controllers/walletController");
const { protect } = require("../middleware/auth");

const router = express.Router();

// All wallet routes require authentication
router.use(protect);

router.get("/", walletController.getBalance);
router.post("/deposit", walletController.deposit);
router.get("/transactions", walletController.getTransactions);

module.exports = router;