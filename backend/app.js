const express = require('express');

const Profession = require('./database/schema/Profession');
const ProfCategory = require('./database/schema/ProfCategory');
const Location = require('./database/schema/Location');
const Country = require('./database/schema/Country');
const Community = require('./database/schema/Community');

const requireAuth = require('./middleware/requireAuth');
const requireAdmin = require('./middleware/requireAdmin');
const requireUser = require('./middleware/requireUser');
const asyncHandler = require('./middleware/asyncHandler');
const { getDraft, patchDraft, deleteDraft, submitDraft, getMine } = require('./routes/draft');
const { uploadDraftPhoto, uploadDraftPhotoFromTelegram } = require('./routes/photo');
const { patchDraftLimiter, submitDraftLimiter, photoUploadLimiter, claimsLimiter } = require('./middleware/draftRateLimiter');
const { submitClaim, getMyClaims, withdrawClaim } = require('./routes/claims');
const { registerReferral } = require('./routes/referral');
const { editOwnedMaster, setVisibility, deleteOwnedMaster } = require('./routes/ownedMaster');
const loadOwnedMaster = require('./middleware/loadOwnedMaster');
const {
  createProfession,
  createProfCategory,
  createLocation,
  rebuildLexicon,
} = require('./routes/referenceAdmin');
const {
  listCandidates,
  acceptCandidate,
  declineCandidate,
} = require('./routes/miningReview');
const { handleApiRequests, addReview } = require('./routes/public');
const { authenticateUser, addMaster, handleApproveMaster } = require('./routes/masterModeration');
const { refCache } = require('./helpers/referenceCache');
const { bot } = require('./bot');

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : ['*'];

// Every majstr.xyz host is first-party: the apex + any subdomain over https
// (majstr.xyz, www, app, and per-country fr/it/… as the multi-country rollout
// adds them). Matching the family in code means a new country subdomain needs
// no ALLOWED_ORIGINS edit. The explicit list still covers off-domain origins
// (localhost dev, *.vercel.app previews).
const MAJSTR_ORIGIN = /^https:\/\/([a-z0-9-]+\.)*majstr\.xyz$/;

// Pure factory (takes the allow-list) so the policy is unit-testable without
// re-loading the module under different env.
const buildOriginPolicy = allowedOrigins => origin =>
  allowedOrigins.includes('*') ||
  (!!origin && (allowedOrigins.includes(origin) || MAJSTR_ORIGIN.test(origin)));

const isAllowedOrigin = buildOriginPolicy(ALLOWED_ORIGINS);

const corsMiddleware = (req, res, next) => {
  const origin = req.headers.origin;
  const allowed = isAllowedOrigin(origin);
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Telegram-Init-Data');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
};

// Builds the Express app without side effects: no DB connection, no bot
// startup, no listening socket. index.js (and the test suite) own those.
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(corsMiddleware);
  app.use('/img', express.static('data/img'));

  app.get('/', asyncHandler(handleApiRequests));
  app.get('/auth', requireAuth, authenticateUser);
  app.post('/addmaster', requireUser, asyncHandler(addMaster));
  app.post('/approve-master', requireAuth, requireAdmin, asyncHandler(handleApproveMaster));
  app.post('/review', asyncHandler(addReview));

  // Draft lifecycle (Mini App onboarding wizard)
  app.get('/api/masters/draft', requireUser, asyncHandler(getDraft));
  app.patch('/api/masters/draft', requireUser, patchDraftLimiter, asyncHandler(patchDraft));
  app.post('/api/masters/draft/submit', requireUser, submitDraftLimiter, asyncHandler(submitDraft));
  app.post('/api/masters/draft/photo', requireUser, photoUploadLimiter, uploadDraftPhoto);
  app.post('/api/masters/draft/photo/from-telegram', requireUser, photoUploadLimiter, uploadDraftPhotoFromTelegram);
  app.get('/api/masters/draft/photo/telegram-check', requireUser, async (req, res) => {
    try {
      const result = await bot.getUserProfilePhotos(req.user.telegramID, { limit: 1 });
      return res.json({ available: result.total_count > 0 });
    } catch (err) {
      console.error('[telegram-check] getUserProfilePhotos failed:', err.message);
      return res.status(502).json({ error: 'telegram_check_failed' });
    }
  });
  app.delete('/api/masters/draft', requireUser, asyncHandler(deleteDraft));
  app.get('/api/masters/mine', requireUser, asyncHandler(getMine));

  // Community share-link referral: the wizard posts the ?via= token so a
  // later submit can attach the community badge (phase-2 endorsement flow).
  app.post('/api/referral', requireUser, asyncHandler(registerReferral));

  // Owner card management (claim flow). Registered AFTER the literal
  // /draft and /mine paths so :id can never shadow them.
  app.patch('/api/masters/:id/visibility', requireUser, asyncHandler(loadOwnedMaster), asyncHandler(setVisibility));
  app.patch('/api/masters/:id', requireUser, asyncHandler(loadOwnedMaster), asyncHandler(editOwnedMaster));
  app.delete('/api/masters/:id', requireUser, asyncHandler(loadOwnedMaster), asyncHandler(deleteOwnedMaster));

  // Claims. asyncHandler matters here: an uncaught throw (e.g. a unique-index
  // violation) used to hang the request, and the edge then answered without
  // CORS headers — the TMA saw it as a network error.
  app.post('/api/claims', requireUser, claimsLimiter, asyncHandler(submitClaim));
  app.get('/api/claims/mine', requireUser, asyncHandler(getMyClaims));
  app.delete('/api/claims/:id', requireUser, asyncHandler(withdrawClaim));

  // Mini App bootstrap + reference data (legacy /?q= aliases kept below)
  app.get('/api/me', requireUser, (req, res) => res.json(req.user));

  // Legal content — served from static JSON, no auth required.
  app.get('/api/legal/:doc', (req, res) => {
    const allowed = ['privacy-policy'];
    if (!allowed.includes(req.params.doc)) return res.status(404).json({ error: 'not_found' });
    try {
      const content = require(`./data/legal/${req.params.doc}.json`);
      res.json(content);
    } catch {
      res.status(404).json({ error: 'not_found' });
    }
  });
  // Reference data is low-churn — served through a 60s TTL cache that the
  // admin create endpoints below invalidate on success.
  app.get('/api/reference/professions', asyncHandler(async (req, res) =>
    res.json(await refCache.get('professions', () => Profession.find()))
  ));
  app.get('/api/reference/prof-categories', asyncHandler(async (req, res) =>
    res.json(await refCache.get('prof-categories', () => ProfCategory.find()))
  ));
  app.get('/api/reference/locations', asyncHandler(async (req, res) =>
    res.json(
      await refCache.get(`locations:${req.query.country || ''}`, () =>
        Location.find(req.query.country ? { countryID: req.query.country } : {})
      )
    )
  ));
  app.get('/api/reference/countries', asyncHandler(async (req, res) =>
    res.json(await refCache.get('countries', () => Country.find()))
  ));
  app.get('/api/reference/communities', asyncHandler(async (req, res) =>
    res.json(await refCache.get('communities', () => Community.find({ active: true })))
  ));

  const clearRefCacheOnSuccess = (req, res, next) => {
    res.on('finish', () => {
      if (res.statusCode < 400) refCache.clear();
    });
    next();
  };

  // Admin-only create endpoints — let the M3 review dashboard add a new
  // profession / category / city inline when approving a candidate (#116).
  app.post('/api/reference/professions', requireUser, requireAdmin, clearRefCacheOnSuccess, createProfession);
  app.post('/api/reference/prof-categories', requireUser, requireAdmin, clearRefCacheOnSuccess, createProfCategory);
  app.post('/api/reference/locations', requireUser, requireAdmin, clearRefCacheOnSuccess, createLocation);
  // Explicit "Rebuild lexicon" — call after a batch of profession creates so
  // the mining heuristic picks up the new terms (#116 follow-up).
  app.post('/api/admin/lexicon/rebuild', requireUser, requireAdmin, clearRefCacheOnSuccess, rebuildLexicon);

  // Mining review queue (#93 / #94) — admin dashboard backend.
  app.get('/api/mining/candidates', requireUser, requireAdmin, listCandidates);
  app.post(
    '/api/mining/candidates/:id/accept',
    requireUser,
    requireAdmin,
    acceptCandidate
  );
  app.post(
    '/api/mining/candidates/:id/decline',
    requireUser,
    requireAdmin,
    declineCandidate
  );

  // Terminal error handler — async handlers wrapped in asyncHandler land here
  // instead of leaving the request hanging on an unhandled rejection.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error('Unhandled route error:', err);
    if (res.headersSent) return next(err);
    res.status(500).json({ error: 'internal_error' });
  });

  return app;
}

module.exports = buildApp;
// Exposed for unit tests (CORS origin policy).
module.exports.buildOriginPolicy = buildOriginPolicy;
