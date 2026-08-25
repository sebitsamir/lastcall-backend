const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { protect } = require("../middleware/auth");
const validate = require("../middleware/validate");
const authValidator = require("../validators/authValidator");
const authController = require("../controllers/authController");


// Strict rate limiter specifically for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: {
    status: "fail",
    message: "Too many login attempts. Please try again in 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/register", authLimiter, validate(authValidator.register), authController.register);
router.post("/login", authLimiter, validate(authValidator.login), authController.login);
router.post("/refresh", authController.refreshToken);
router.post("/logout", authController.logout);

router.get("/me", protect, authController.getMe);

module.exports = router;
