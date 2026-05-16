const jwt = require('jsonwebtoken');
const User = require('../database/schema/User');

const JWT_ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_TOKEN_SECRET;

function extractToken(rawHeader) {
  if (!rawHeader) return null;
  let token = String(rawHeader).trim();
  if (token.startsWith('Bearer ')) token = token.slice(7).trim();
  // Defensive: legacy clients sometimes pass a JSON-stringified token.
  if (token.startsWith('"') && token.endsWith('"')) {
    token = token.slice(1, -1);
  }
  return token || null;
}

module.exports = async function requireAuth(req, res, next) {
  const token = extractToken(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ error: 'no_token' });
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_ACCESS_TOKEN_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'invalid_token' });
  }

  // JWT signature is the primary trust anchor. The DB token is only a
  // revocation handle: enforced when the user has a stored token (web
  // bot-login users), skipped for users with no token (TMA-created).
  const user = await User.findOne({ telegramID: payload.userID });
  if (!user) {
    return res.status(401).json({ error: 'user_not_found' });
  }
  if (user.token && user.token !== token) {
    return res.status(401).json({ error: 'session_revoked' });
  }

  req.user = user;
  req.token = token;
  next();
};
