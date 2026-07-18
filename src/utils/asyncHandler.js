//Wraps async route controllers so we never have to write try/catch
//just to pass errors to Express's next() function.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
