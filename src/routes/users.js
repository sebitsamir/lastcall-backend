const express = require('express');
const router = express.Router();

const userController = require('../controllers/userController');
const { protect } = require('../middleware/auth');

// All routers here require authentication
router.use(protect);

router.patch("/me", userController.updateProfile);
router.post("/balance/add", userController.addFunds);
router.get("/transactions", userController.getTransactionHistory);

module.exports = router;