const express = require("express");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss");
const hpp = require("hpp");
const cors = require("cors");
const ratelimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const compression = require("compression");

// Wrap xss in a custom Express middleware
const xssSanitizer = (req, res, next) => {
  // Helper function to recursively sanitize nested objects
  const sanitizeObject = (obj) => {
    for (const key in obj) {
      if (typeof obj[key] === "string") {
        obj[key] = xss(obj[key]);
      } else if (typeof obj[key] === "object" && obj[key] !== null) {
        sanitizeObject(obj[key]); // Recurse into nested objects/arrays
      }
    }
  };

  if (req.body) sanitizeObject(req.body);
  if (req.query) sanitizeObject(req.query);
  if (req.params) sanitizeObject(req.params);

  next();
};

const AppError = require("./utils/AppError");
const globalErrorHandler = require("./middleware/errorHandler");

const app = express();

// Required on Render/Heroku so rate-limit and secure cookies see the real client IP/proto
app.set("trust proxy", 1);

//Security Hardening
//Sets HTTP headers
app.use(helmet());

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5173",
  process.env.CLIENT_URL,
].filter(Boolean);

// CORS: Allow the frontend to talk to this API (incl. Vercel preview URLs)
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const isAllowed =
        allowedOrigins.includes(origin) ||
        /^https:\/\/([a-z0-9-]+\.)?vercel\.app$/i.test(origin);
      if (isAllowed) return callback(null, true);
      return callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true, // CRITICAL: Allows HttpOnly cookies to be sent
  })
);

//Rate Limiting: Prevent Brute Force and DoS Attacks
const globalLimiter = ratelimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, //Limit each IP to 100 requests per window
  message: {
    status: "fail",
    message: "Too many requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", globalLimiter);

//Stricter limit specifically for Auth endpoints
const authLimiter = ratelimit({
  windowMs: 15 * 60 * 1000,
  max: 10, //10 login/register attempts per 15 minutes
  message: { error: "Too many login attempts. Try again in 15 mins." },
});
//This will be applied directly to the auth routes later

// 2. Data Parsing & Sanitization
//Body Parser with size limit (Prevents DoS via massive JSON payloads)
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());

//Data Sanitization against NoSQL Injection
app.use(mongoSanitize());

//Data Sanitization against XSS
app.use(xssSanitizer);

//Prevents HTTP Parameter Pollution
app.use(
  hpp({
    whitelist: ["sort", "fields", "page", "category"],
  }),
);

// 3. Performance
//Compresses all responses (Gzip/Brotli) -saves upto 80% bandwidth
app.use(compression());

// 4. Routes & Health Checks
// Health Check (Mounted BEFORE rate limiter so monitoring tools aren't blocked)
const healthRouter = require("./routes/health");
app.use("/health", healthRouter);

// Mount Api routes
const authRoutes = require("./routes/auth");
app.use("/api/v1/auth", authRoutes);

const auctionRoutes = require("./routes/auctions");
app.use("/api/v1/auctions", auctionRoutes);

const userRoutes = require("./routes/users");
app.use("/api/v1/users", userRoutes);

// 5. Error Handling
// Catch unhandled routes (404)
// app.use() without a path automatically catches everything that reaches it
app.use((req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

//Global Error Handler (Must be the last middleware)
app.use(globalErrorHandler);

module.exports = app;
