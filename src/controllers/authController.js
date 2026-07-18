const User = require("../models/User");
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} = require("../utils/jwt");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/apiResponse");

//Helper: Set refresh token as a secure, httpOnly cookie
const setRefreshCookie = (res, token) => {
  res.cookie("refreshToken", token, {
    httpOnly: true, //JS cannot read this cookie (XSS Protection)
    sameSite: "strict", //CSRF Protection
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

//@desc Register a new user
//@route POST /api/v1/auth/register
exports.register = asyncHandler(async (req, res, next) => {
  const { name, email, password } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return next(new AppError("Email address is already in use", 409));
  }

  const user = await User.create({ name, email, password });

  const accessToken = signAccessToken(user._id, user.role);
  const refreshToken = signRefreshToken(user._id);

  setRefreshCookie(res, refreshToken);

  ApiResponse.created(
    res,
    {
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        availableBalance: user.availableBalance,
      },
    },
    "Registration successful",
  );
});

// @desc Login user
// @route POST /api/v1/auth/Login
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError("Please provide email and password", 400));
  }

  // select('+password') overrides the schema's select: false
  const user = await User.findOne({ email }).select("+password");

  if (!user || !(await user.comparePassword(password))) {
    return next(new AppError("Incorrect email or password", 401));
  }

  if (!user.isActive) {
    return next(new AppError("This account has been deactivated", 403));
  }

  const accessToken = signAccessToken(user._id, user.role);
  const refreshToken = signRefreshToken(user._id);

  setRefreshCookie(res, refreshToken);

  ApiResponse.success(
    res,
    {
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        availableBalance: user.availableBalance,
        frozenBalance: user.frozenBalance,
      },
    },
    "Login successful",
  );
});

// @desc Refresh access token using httpOnly cookie
// @route POST /api/v1/auth/refresh
exports.refreshToken = asyncHandler(async (req, res, next) => {
  const token = req.cookies.refreshToken;

  if (!token) {
    return next(new AppError("No refresh token provided. Please log in.", 401));
  }

  const decoded = verifyRefreshToken(token);
  const user = await User.findById(decoded.userId);

  if (!user || !user.isActive) {
    return next(new AppError("User no longer exists or is deactivated", 401));
  }

  const newAccessToken = signAccessToken(user._id, user.role);

  ApiResponse.success(res, { accessToken: newAccessToken }, "Token refreshed");
});

// @desc Logout user (clear cookie)
// @route POST /api/v1/auth/logout
exports.logout = (req, res) => {
  res.clearCookie("refreshToken");
  ApiResponse.success(res, null, "Logged out successfully");
};

// @desc Get current logged-in user profile
// @route GET /api/v1/auth/me
exports.getMe = asyncHandler(async (req, res) => {
  // req.user is automatically attached by the 'protect' middleware
  ApiResponse.success(res, req.user, "User profile retrieved successfully");
});
