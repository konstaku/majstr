const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../database/schema/User');

// Mirrors bot.js createTokenForUser: payload carries userID = telegramID.
function makeJwt(telegramID, extra = {}) {
  return jwt.sign({ userID: telegramID, ...extra }, process.env.JWT_ACCESS_TOKEN_SECRET);
}

// Creates a User row whose stored token passes requireAuth's revocation
// check (token: null skips it — the TMA-created user shape).
async function makeUser({ telegramID = 1000001, isAdmin = false, ...rest } = {}) {
  const user = await User.create({
    telegramID,
    firstName: 'Test',
    username: 'testuser',
    token: null,
    isAdmin,
    ...rest,
  });
  return { user, jwt: makeJwt(telegramID), authHeader: `Bearer ${makeJwt(telegramID)}` };
}

// Builds a synthetic Telegram Mini App initData string signed with the same
// HMAC scheme requireMiniAppAuth verifies (sha256('WebAppData', botToken) →
// HMAC of the sorted data-check-string).
function makeInitData(tgUser, { botToken = process.env.TELEGRAM_BOT_TOKEN, authDate, tamper = false } = {}) {
  const params = new URLSearchParams();
  params.set('user', JSON.stringify(tgUser));
  params.set('auth_date', String(authDate ?? Math.floor(Date.now() / 1000)));
  params.set('query_id', 'AAE-test');

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  let hash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  if (tamper) hash = hash.replace(/^./, hash[0] === '0' ? '1' : '0');

  params.set('hash', hash);
  return params.toString();
}

module.exports = { makeJwt, makeUser, makeInitData };
