const crypto = require('crypto');
const User = require('../database/schema/User');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BOT_TOKEN_PREV = process.env.TELEGRAM_BOT_TOKEN_PREV; // optional; set during rotation for ~24h overlap
const MAX_AGE_SECONDS = 24 * 60 * 60;

// The numeric bot id is the part before ':' in the token. It is NOT secret
// (it's the bot's public user id) and is safe to log — lets us confirm
// which bot a backend is verifying against (prod vs dev mismatch).
function botId(token) {
  return token ? String(token).split(':')[0] : 'none';
}

// Verifies Telegram Mini App initData per
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
// Returns { ok:true, user, authDate, startParam } or { ok:false, reason }.
function verifyInitData(initData, token) {
  if (!token) return { ok: false, reason: 'no_server_token' };

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return { ok: false, reason: 'no_hash_in_initdata' };
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

  const a = Buffer.from(computed, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: 'hash_mismatch' };
  }

  const authDate = Number(params.get('auth_date'));
  const age = Math.round(Date.now() / 1000 - authDate);
  if (!authDate) return { ok: false, reason: 'no_auth_date' };
  if (age > MAX_AGE_SECONDS) return { ok: false, reason: `stale_auth_date(${age}s)` };

  const userRaw = params.get('user');
  if (!userRaw) return { ok: false, reason: 'no_user' };

  let user;
  try {
    user = JSON.parse(userRaw);
  } catch {
    return { ok: false, reason: 'user_not_json' };
  }
  if (!user || typeof user.id !== 'number') {
    return { ok: false, reason: 'user_missing_id' };
  }

  return { ok: true, user, authDate, startParam: params.get('start_param') || null };
}

module.exports = async function requireMiniAppAuth(req, res, next) {
  const raw = req.headers['x-telegram-init-data'];
  if (!raw) {
    console.warn(
      `[miniapp-auth] reject: no x-telegram-init-data header ` +
        `(server bot id=${botId(BOT_TOKEN)}, origin=${req.headers.origin || '-'})`
    );
    return res.status(401).json({ error: 'invalid_init_data', reason: 'no_header' });
  }

  const primary = verifyInitData(raw, BOT_TOKEN);
  const parsed =
    primary.ok
      ? primary
      : BOT_TOKEN_PREV
      ? verifyInitData(raw, BOT_TOKEN_PREV)
      : primary;

  if (!parsed.ok) {
    console.warn(
      `[miniapp-auth] reject: ${parsed.reason} ` +
        `(server bot id=${botId(BOT_TOKEN)}, initData len=${raw.length})`
    );
    return res
      .status(401)
      .json({ error: 'invalid_init_data', reason: parsed.reason });
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
