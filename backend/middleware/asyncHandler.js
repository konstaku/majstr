// Wraps an async route handler so rejected promises reach the terminal
// error middleware instead of leaving the request hanging (Express 4 does
// not catch async errors on its own).
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
