const express = require('express');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss');
const hpp = require('hpp');
const cors = require('cors');
const ratelimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const compression = require('compression');

// Wrap xss in a custom Express middleware
const xssSanitizer = (req, res, next) => {
    // Loop through the request body and sanitize any string values
    if (req.body) {
        for (const key in req.body) {
            if (typeof req.body[key] === 'string') {
                req.body[key] = xss(req.body[key]);
            }
        }
    }
    next(); // Pass control to the next middleware
};


const AppError = require('./utils/AppError');
const globalErrorHandler = require('./middleware/errorHandler');

const app = express();

//Security Hardening
//Sets HTTP headers
app.use(helmet());

//CORS: Allow the frontend to talk to this API
app.use(cors({
    origin: process.env.CLIENT_URL || 'https://localhost:5173',
    credentials: true //Allow httpOnly cookies to be sent
}));

//Rate Limiting: Prevent Brute Force and DoS Attacks
const globalLimiter = ratelimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, //Limit each IP to 100 requests per window
    message: { status: 'fail', message: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api', globalLimiter);

//Stricter limit specifically for Auth endpoints
const authLimiter = ratelimit({
    windowMs: 15 * 60 * 1000,
    max: 10, //10 login/register attempts per 15 minutes
    message: { error: 'Too many login attempts. Try again in 15 mins.' },
});
//This will be applied directly to the auth routes later

// 2. Data Parsing & Sanitization
//Body Parser with size limit (Prevents DoS via massive JSON payloads)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

//Data Sanitization against NoSQL Injection
app.use(mongoSanitize());

//Data Sanitization against XSS
app.use(xssSanitizer); 

//Prevents HTTP Parameter Pollution
app.use(hpp({
    whitelist: ['sort', 'fields', 'page', 'category']
}));

// 3. Performance
//Compresses all responses (Gzip/Brotli) -saves upto 80% bandwidth
app.use(compression());

// 4. Routes & Health Checks
// Health Check (Mounted BEFORE rate limiter so monitoring tools aren't blocked)
const healthRouter = require('./routes/health');
app.use('/health', healthRouter);


//TO: Mount API here in next step
//app.use('/api/v1', routes);

// 5. Error Handling
// Catch unhandled routes (404)
// app.use() without a path automatically catches everything that reaches it
app.use((req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

//Global Error Handler (Must be the last middleware)
app.use(globalErrorHandler);

module.exports = app;