// A custom error class that allows us to attach HTTP status codes
// and mark errors as "operational" (expected) vs "programming" (bug).
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true; //Marks errors we created

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
