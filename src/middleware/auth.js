const { verifyAccessToken } = require("../utils/jwt");
const AppError = require("../utils/AppError");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");

// @desc Protect routes - verify JWT
exports.protect = asyncHandler(async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next(
      new AppError("You are not logged in. Please log in to get access.", 401),
    );
  }

  const decoded = verifyAccessToken(token);
  const currentUser = await User.findById(decoded.userId);

  if (!currentUser) {
    return next(
      new AppError("The user belonging to this token no longer exists.", 401),
    );
  }

  if (!currentUser.isActive) {
    return next(new AppError("This account has been deactivated.", 403));
  }

  // Grant access
  req.user = currentUser;
  next();
});

// @desc Restrict routes to specific roles
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError("You do not have permission to perform this action", 403),
      );
    }
    next();
  };
};
