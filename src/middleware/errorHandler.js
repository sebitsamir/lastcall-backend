const AppError = require("../utils/AppError");

//The 4-parameter signature tells Express this is the global error handler
const globalErrorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";

  //1. Handle specific mongoose errors
  if (err.name === "CastError") {
    //e.g., Invalid MongoDB ID format
    message = `Resources Not found with id: ${err.value}`;
    statusCode = 400;
  }

  if (err.code === 11000) {
    //e.g., Duplicate email
    const field = Object.keys(err.keyValue || {})[0] || "field";
    message = `Duplicate ${field} value. Please use another value!`;
    statusCode = 400;
  }

  if (err.name === "ValidationError") {
    //Mongoose schema validation failed
    const errors = Object.values(err.errors).map((el) => el.message);
    message = `Invalid input data. ${errors.join(". ")}`;
    statusCode = 422;
  }

  // 2. Send Response
  // Operational Errors(AppErrors): send message to client
  // Programming/Unexpected Errors: send generic message
  res.status(statusCode).json({
    status: err.status || "error",
    message: err.isOperational ? message : "An unexpected error occurred.",
    // Only send stack trace in development
    ...(process.env.NODE_ENV === "development" && {
      stack: err.stack,
      errObj: err,
    }),
  });
};

module.exports = globalErrorHandler;
