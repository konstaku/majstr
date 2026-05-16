const crypto = require('crypto');
const User = require('../database/schema/User');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BOT_TOKEN_PREV = process.env.TELEGRAM_BOT_TOKEN_PREV; // optional; set during rotation for ~24h overlap
const MAX_AGE_SECONDS = 24 * 60 * 60;

// Verifies Telegram Mini App initData per
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
// Returns { user, authDate, startParam } on success, null otherwise.
function verifyInitData(initData, token) {
  if (!token) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');

  const secret = crypto
    .createHmac('sha256', 'WebAppData')
    .update(token)
    .digest();
  const computed = crypto
    .createHmac('sha256', secret)
    .update(dataCheckString)
    .digest('hex');

  // Constant-time compare to avoid timing leaks on the hash.
  const a = Buffer.from(computed, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const authDate = Number(params.get('auth_date'));
  if (!authDate || Date.now() / 1000 - authDate > MAX_AGE_SECONDS) return null;

  const userRaw = params.get('user');
  if (!userRaw) return null;

  let user;
  try {
    user = JSON.parse(userRaw);
  } catch {
    return null;
  }
  if (!user || typeof user.id !== 'number') return null;

  return { user, authDate, startParam: params.get('start_param') || null };
}

module.exports = async function requireMiniAppAuth(req, res, next) {
  const raw = req.headers['x-telegram-init-data'];
  if (!raw) return res.status(401).json({ error: 'invalid_init_data' });

  // Try current token first, then previous token (rotation overlap window).
  const parsed = verifyInitData(raw, BOT_TOKEN) ||
    (BOT_TOKEN_PREV ? verifyInitData(raw, BOT_TOKEN_PREV) : null);
  if (!parsed) {
    return res.status(401).json({ error: 'invalid_init_data' });
  }

  const u = parsed.user;
  const user = await User.findOneAndUpdate(
    { telegramID: u.id },
    {
      $set: {
        firstName: u.first_name || null,
        lastName: u.last_name || null,
        username: u.username || null,
        ...(u.photo_url ? { photo: u.photo_url } : {}),
      },
      $setOnInsert: { telegramID: u.id, isAdmin: false },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  req.user = user;
  req.tgInit = parsed;
  next();
};

module.exports.verifyInitData = verifyInitData; // exported for testing
