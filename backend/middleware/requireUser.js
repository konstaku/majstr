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
  // No initData header. If this is a Mini App request that should have had
  // one, the wizard isn't running in a real Telegram webview (empty
  // window.Telegram.WebApp.initData) — log it so the 401 cause is visible.
  console.warn(
    `[auth] no x-telegram-init-data header -> JWT fallback ` +
      `(path=${req.path}, origin=${req.headers.origin || '-'}, ` +
      `hasAuth=${!!req.headers.authorization})`
  );
  return requireAuth(req, res, next);
};
