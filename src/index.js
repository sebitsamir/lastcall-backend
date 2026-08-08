require("dotenv").config();
const http = require("http");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const app = require("./app");
const connectDB = require("./config/db");
const logger = require("./utils/logger");
const settlementJob = require("./jobs/settlementJob");

const PORT = process.env.PORT || 3000;

// 1. Create HTTP Server & Attach Socket.io
const server = http.createServer(app);
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5173",
  process.env.CLIENT_URL,
].filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const isAllowed =
        allowedOrigins.includes(origin) ||
        /^https:\/\/([a-z0-9-]+\.)?vercel\.app$/i.test(origin);
      if (isAllowed) return callback(null, true);
      return callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
  },
});

global.io = io;
app.set("io", io);

// 2. Socket.io Connection Logic
io.on("connection", (socket) => {
  logger.info(`Socket connected: ${socket.id}`);

  // Clients will join specific auction rooms to get live updates
  socket.on("joinAuction", (auctionId) => {
    socket.join(`lastcall:auction:${auctionId}`);
    logger.info(`Socket ${socket.id} joined auction room: ${auctionId}`);
  });

  socket.on("disconnect", () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

// 3. Database Connection & Server startup
connectDB().then(() => {
  const serverInstance = server.listen(PORT, () => {
    logger.info(`lastCall API running on port ${PORT}`);
  });

  // Start the settlement cron job
  settlementJob.start();
  logger.info("[Cron] Auction settlement job started");

  // 4. Graceful shutdown Handler
  process.on("unhandledRejection", (err) => {
    logger.error("UNHANDLED REJECTION! Shutting down...");
    serverInstance.close(() => process.exit(1));
  });
});