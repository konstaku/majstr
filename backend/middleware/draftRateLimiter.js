const rateLimit = require('express-rate-limit');

// Keyed by user._id so Telegram CDN IPs don't poison the bucket for all users.
// requireUser must run before these limiters so req.user is populated.
function keyByUser(req) {
  return req.user._id.toString();
}

const patchDraftLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: keyByUser,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests', detail: 'max 60 draft saves per minute' },
});

const submitDraftLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: keyByUser,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests', detail: 'max 5 submissions per minute' },
});

const photoUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: keyByUser,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests', detail: 'max 10 photo uploads per hour' },
});

// Exported for claims endpoints when they're wired in (Spike 4)
const claimsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyGenerator: keyByUser,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests', detail: 'max 3 claim submissions per hour' },
});

module.exports = { patchDraftLimiter, submitDraftLimiter, photoUploadLimiter, claimsLimiter };
