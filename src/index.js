// src/index.js
const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const connectDB = require("./config/database");
const logger = require("./utils/logger");
const jwt = require("jsonwebtoken");
const User = require("./models/User");

const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.CLIENT_URL
        : ["http://localhost:3000", "http://localhost:3001"],
    credentials: true,
  },
});

// Make io accessible to controllers
global.io = io;

// Socket authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      // Allow unauthenticated connections (for public auction updates)
      socket.user = null;
      return next();
    }

    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return next(new Error("User not found"));
    }

    // Attach user to socket
    socket.user = user;
    next();
  } catch (error) {
    logger.warn("Socket authentication failed:", error.message);
    next(new Error("Authentication failed"));
  }
});

// Socket connection handler
io.on("connection", (socket) => {
  logger.info(`Socket connected: ${socket.id}`);

  // Join user's private room (for outbid notifications)
  if (socket.user) {
    const userId = socket.user._id.toString();
    socket.join(`lastcall:user:${userId}`);
    logger.info(`User ${userId} joined private room`);
  }

  // Join auction room (public)
  socket.on("joinAuction", async (auctionId) => {
    if (!auctionId) return;

    socket.join(`lastcall:auction:${auctionId}`);
    logger.info(`Socket ${socket.id} joined auction ${auctionId}`);
  });

  // Leave auction room
  socket.on("leaveAuction", (auctionId) => {
    if (!auctionId) return;

    socket.leave(`lastcall:auction:${auctionId}`);
    logger.info(`Socket ${socket.id} left auction ${auctionId}`);
  });

  socket.on("disconnect", () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

// Start server
connectDB().then(() => {
  server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`Socket.IO ready`);
  });
});