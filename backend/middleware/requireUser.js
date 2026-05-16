const requireMiniAppAuth = require('./requireMiniAppAuth');
const requireAuth = require('./requireAuth');

// Unified auth entry point. Telegram Mini App requests carry an
// X-Telegram-Init-Data header and are verified via initData HMAC;
// everything else falls back to JWT bearer auth. If both are present,
// initData wins. Downstream handlers only ever read req.user.
module.exports = function requireUser(req, res, next) {
  if (req.headers['x-telegram-init-data']) {
    return requireMiniAppAuth(req, res, next);
  }
  return requireAuth(req, res, next);
};
