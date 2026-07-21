require("dotenv").config();
const http = require("http");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const app = require("./app");
const connectDB = require("./config/db");
const logger = require("./utils/logger");
const { Socket } = require("dgram");
const settlementJob = require("./jobs/settlementJob");

const PORT = process.env.PORT || 3000;

// 1. Create HTTP Server & Attach Socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "https://localhost:5173",
    credentials: true,
  },
});

// Make 'io' accessible globally in controllers via req.app.get('io')
app.set("io", io);

// 2. Socket.io Connection Logic
io.on("connection", (socket) => {
  logger.info(`Socket connect: ${socket.id}`);

  // Clients will join specific auction rooms to get live updates
  socket.on("joinAuction", (auctionId) => {
    socket.join(`lastcall:auction:${auctionId}`);
    logger.info(`socket ${socket.id} joined auction ${auctionId}`);
  });

  socket.on("disconnect", () => {
    logger.info(`socket disconnected: ${socket.id}`);
  });
});

// 3. Database Connection & Server startup
connectDB().then(() => {
  const serverInstance = server.listen(PORT, () => {
    logger.info(`lastCall API running on port ${PORT}`);
  });

  settlementJob.start();
  logger.info("[Cron] Auction settlement job started");

  // 4. Graceful shutdown Handler
  process.on("unhandledRejection", (err) => {
    logger.error("UNHANDLED REJECTION! Shutting down...");
    serverInstance.close(() => process.exit(1));
  });
});
