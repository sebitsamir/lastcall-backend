const jwt = require("jsonwebtoken");

//Short-lived access token (15 mins) - sent in Authorization header
exports.signAccessToken = (userId, role) => {
  return jwt.sign({ userId, role }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: "15m",
  });
};

// Long-lived refresh token (7 days) - sent in httpOnly cookie
exports.signRefreshToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "7d",
  });
};

exports.verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
};

exports.verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};
