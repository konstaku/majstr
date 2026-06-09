require('dotenv').config();

const express = require('express');
const fs = require('fs');
const http = require('http');
const https = require('https');

const Master = require('./database/schema/Master');
const MasterAudit = require('./database/schema/MasterAudit');
const User = require('./database/schema/User');
const Profession = require('./database/schema/Profession');
const ProfCategory = require('./database/schema/ProfCategory');
const Location = require('./database/schema/Location');
const Review = require('./database/schema/Review');

const requireAuth = require('./middleware/requireAuth');
const i18n = require('./i18n');
const { masterWebUrl } = require('./helpers/masterUrl');
const requireAdmin = require('./middleware/requireAdmin');
const requireUser = require('./middleware/requireUser');
const { getDraft, patchDraft, deleteDraft, submitDraft, getMine } = require('./routes/draft');
const { uploadDraftPhoto, uploadDraftPhotoFromTelegram } = require('./routes/photo');
const { patchDraftLimiter, submitDraftLimiter, photoUploadLimiter, claimsLimiter } = require('./middleware/draftRateLimiter');
const { submitClaim, getMyClaims, withdrawClaim } = require('./routes/claims');
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

const PORT_NUMBER = process.env.PORT || 5000;
const CERTIFICATE = process.env.CERTIFICATE_API;
const KEYFILE = process.env.KEYFILE_API;
const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const httpsOptions =
  CERTIFICATE && KEYFILE
    ? { key: fs.readFileSync(KEYFILE), cert: fs.readFileSync(CERTIFICATE) }
    : null;

const db = require('./database/db');
const { bot, runBot } = require('./bot');
const runOpenGraphMiddleware = require('./open-graph-middleware');
const createOGimageForMaster = require('./helpers/generateOpenGraph');
const Country = require('./database/schema/Country');

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : ['*'];

const corsMiddleware = (req, res, next) => {
  const origin = req.headers.origin;
  const allowed = ALLOWED_ORIGINS.includes('*') || (origin && ALLOWED_ORIGINS.includes(origin));
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Telegram-Init-Data');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
};

async function main() {
  const app = express();
  app.use(express.json());
  app.use(corsMiddleware);
  app.use('/img', express.static('data/img'));

  await db.runDB();
  await runBot();
  await runOpenGraphMiddleware();

  app.get('/', handleApiRequests);
  app.get('/auth', requireAuth, authenticateUser);
  app.post('/addmaster', requireUser, addMaster);
  app.post('/approve-master', requireAuth, requireAdmin, handleApproveMaster);
  app.post('/review', addReview);

  // Draft lifecycle (Mini App onboarding wizard)
  app.get('/api/masters/draft', requireUser, getDraft);
  app.patch('/api/masters/draft', requireUser, patchDraftLimiter, patchDraft);
  app.post('/api/masters/draft/submit', requireUser, submitDraftLimiter, submitDraft);
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
  app.delete('/api/masters/draft', requireUser, deleteDraft);
  app.get('/api/masters/mine', requireUser, getMine);

  // Claims
  app.post('/api/claims', requireUser, claimsLimiter, submitClaim);
  app.get('/api/claims/mine', requireUser, getMyClaims);
  app.delete('/api/claims/:id', requireUser, withdrawClaim);

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
  app.get('/api/reference/professions', async (req, res) =>
    res.json(await Profession.find())
  );
  app.get('/api/reference/prof-categories', async (req, res) =>
    res.json(await ProfCategory.find())
  );
  app.get('/api/reference/locations', async (req, res) =>
    res.json(
      await Location.find(
        req.query.country ? { countryID: req.query.country } : {}
      )
    )
  );
  app.get('/api/reference/countries', async (req, res) =>
    res.json(await Country.find())
  );

  // Admin-only create endpoints — let the M3 review dashboard add a new
  // profession / category / city inline when approving a candidate (#116).
  app.post('/api/reference/professions', requireUser, requireAdmin, createProfession);
  app.post('/api/reference/prof-categories', requireUser, requireAdmin, createProfCategory);
  app.post('/api/reference/locations', requireUser, requireAdmin, createLocation);
  // Explicit "Rebuild lexicon" — call after a batch of profession creates so
  // the mining heuristic picks up the new terms (#116 follow-up).
  app.post('/api/admin/lexicon/rebuild', requireUser, requireAdmin, rebuildLexicon);

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

  const server = httpsOptions
    ? https.createServer(httpsOptions, app)
    : http.createServer(app);

  server
    .listen(PORT_NUMBER, () =>
      console.log(`Backend server started on port ${PORT_NUMBER}`)
    )
    .on('error', (err) => {
      console.log('Error starting backend server:', err);
    });
}

main().catch(console.error);

// Handle various API data requests
async function handleApiRequests(req, res) {
  console.log(
    `=== API request to HTTP server at ${new Date().toUTCString()} ===`
  );

  // Whenever I need to fetch data, I am using URL params to define which data to send
  if (!req.query || !req.query.q) {
    return res.status(400).send('Missing query parameter');
  }

  if (req.query && req.query.q) {
    switch (req.query.q) {
      case 'masters':
        let mastersQuery = { status: 'approved' };
        if (req.query.country) {
          mastersQuery = { ...mastersQuery, countryID: req.query.country };
        }
        const masters = await Master.find(mastersQuery).sort({ _id: -1 });
        console.log(`Fetching masters for location`, req.query.country);
        res.status(200).send(masters);
        break;
      case 'newmasters':
        const newMasters = await Master.find({ status: 'pending' });
        console.log(`Fetching new masters...`);
        res.status(200).send(newMasters);
        break;
      case 'professions':
        const professions = await Profession.find();
        console.log(`Fetching professions...`);
        res.status(200).send(professions);
        break;
      case 'prof-categories':
        const profCategories = await ProfCategory.find();
        console.log(`Fetching professional categories...`);
        res.status(200).send(profCategories);
        break;
      case 'locations':
        const locationsQuery = req.query.country
          ? { countryID: req.query.country }
          : {};
        const locations = await Location.find(locationsQuery);
        console.log(`Fetching locations... country id:`, req.query.country);
        res.status(200).send(locations);
        break;
      case 'countries':
        const countries = await Country.find();
        console.log(`Fetching countries...`);
        res.status(200).send(countries);
        break;
      case 'reviews':
        if (!req.query.master) {
          res.status(400).send('Missing master ID');
          break;
        }
        const reviews = await Review.find({ masterID: req.query.master }).sort({ createdAt: -1 });
        res.status(200).send(reviews);
        break;
      default:
        console.log(`Unknown request, sending 404...`);
        console.log('request url:', req.url);
        res.status(404).send('No such file!');
    }
  }
}

// Returns the authenticated user. JWT verification + revocation check
// happens in the requireAuth middleware.
async function authenticateUser(req, res) {
  console.log(`Auth ok for user ${req.user.firstName} (${req.user.telegramID})`);
  res.status(200).json(req.user);
}

// Create a master card. Identity is taken from req.user (verified JWT),
// never from the request body. Body telegramID / ownerUserID / status fields
// are ignored to prevent spoofing.
async function addMaster(req, res) {
  console.log(`=== New master submission from ${req.user.telegramID}`);

  const {
    telegramID: _ignoredTelegramID,
    ownerUserID: _ignoredOwner,
    status: _ignoredStatus,
    approved: _ignoredApproved,
    submittedAt: _ignoredSubmittedAt,
    approvedAt: _ignoredApprovedAt,
    ...safeBody
  } = req.body || {};

  const master = new Master({
    ...safeBody,
    telegramID: req.user.telegramID,
    ownerUserID: req.user._id,
    status: 'pending',
    submittedAt: new Date(),
    source: 'self_submitted',
    claimable: false,
    claimedAt: new Date(),
  });

  const validationError = master.validateSync();
  if (validationError) {
    return res.status(400).send(validationError.message);
  }

  // OG image is best-effort — failure must not block master creation.
  try {
    const ogUrl = await createOGimageForMaster(master);
    master.OGimage = ogUrl.toString();
  } catch (err) {
    console.error('[OG] generation failed, continuing without image:', err.message);
  }

  try {
    await master.save();
  } catch (err) {
    console.error(err);
    return res.status(500).send('Error saving master data');
  }

  try {
    await MasterAudit.create({
      masterID: master._id,
      actorUserID: req.user._id,
      actorTelegramID: req.user.telegramID,
      action: 'submit',
      from: null,
      to: 'pending',
    });
  } catch (err) {
    console.error('Failed to write audit row:', err);
  }

  if (TELEGRAM_ADMIN_CHAT_ID) {
    const contactLines = (master.contacts || []).map(c => `  ${c.contactType}: ${c.value}`).join('\n');
    const adminText =
      `🆕 Нова картка майстра на модерації\n\n` +
      `👤 ${master.name || '—'}\n` +
      (contactLines ? `📞 Контакти:\n${contactLines}\n` : '') +
      (master.about ? `📝 ${master.about.slice(0, 200)}\n` : '');
    const approveKeyboard = {
      inline_keyboard: [[
        { text: '✅ Схвалити', callback_data: `master:approve:${master._id}` },
        { text: '❌ Відхилити', callback_data: `master:decline:${master._id}` },
      ]],
    };
    if (master.photo) {
      bot.sendPhoto(TELEGRAM_ADMIN_CHAT_ID, master.photo, {
        caption: adminText,
        reply_markup: approveKeyboard,
      }).catch(console.error);
    } else {
      bot.sendMessage(TELEGRAM_ADMIN_CHAT_ID, adminText, {
        reply_markup: approveKeyboard,
      }).catch(console.error);
    }
  }

  res.status(200).json({ success: true, masterID: master._id });
}

// Admin action on a pending master. Auth (requireAuth) and admin role
// (requireAdmin) are enforced by middleware — body no longer carries a token.
async function handleApproveMaster(req, res) {
  const { action, masterID, reason } = req.body || {};

  const master = await Master.findById(masterID);
  if (!master) {
    return res.status(404).send('Master not found');
  }

  const previousStatus = master.status;
  const telegramId = master.telegramID;

  try {
    if (action === 'approve') {
      master.status = 'approved';
      master.approvedAt = new Date();
      master.rejectionReason = undefined;
      await master.save();
      // pre-save hook has run → master.approved is now true.
      // Regenerate OG so the image matches the new design and shows the verified stamp.
      createOGimageForMaster(master)
        .then(ogUrl => Master.updateOne({ _id: master._id }, { $set: { OGimage: ogUrl.toString() } }))
        .catch(err => console.error('[OG] regeneration on approval failed:', err.message));

      await MasterAudit.create({
        masterID: master._id,
        actorUserID: req.user._id,
        actorTelegramID: req.user.telegramID,
        action: 'approve',
        from: previousStatus,
        to: 'approved',
      });

      if (telegramId) {
        const ownerUser = await User.findOne({ telegramID: telegramId }).select('uiLanguage').lean();
        const oLang = i18n.normalizeLang(ownerUser?.uiLanguage);
        await bot.sendMessage(
          telegramId,
          i18n.t(oLang, 'owner.approved', {
            url: masterWebUrl(master, oLang, `https://majstr.xyz`),
          })
        );
      }

      return res.status(200).json({ success: true });
    }

    if (action === 'decline') {
      master.status = 'rejected';
      master.rejectedAt = new Date();
      if (reason) master.rejectionReason = reason;
      await master.save();

      await MasterAudit.create({
        masterID: master._id,
        actorUserID: req.user._id,
        actorTelegramID: req.user.telegramID,
        action: 'reject',
        from: previousStatus,
        to: 'rejected',
        reason: reason || undefined,
      });

      if (telegramId) {
        const ownerUser = await User.findOne({ telegramID: telegramId }).select('uiLanguage').lean();
        const oLang = i18n.normalizeLang(ownerUser?.uiLanguage);
        await bot.sendMessage(telegramId, i18n.t(oLang, 'owner.declined'));
      }

      return res.status(200).json({ success: true });
    }

    return res.status(400).send('Unknown action');
  } catch (err) {
    console.error('Admin action failed:', err);
    return res.status(500).send('Action failed');
  }
}

async function addReview(req, res) {
  const { masterID, authorName, rating, comment } = req.body;

  if (!masterID || !authorName || !rating) {
    return res.status(400).json({ error: 'masterID, authorName, and rating are required' });
  }
  const ratingNum = Number(rating);
  if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json({ error: 'rating must be a number between 1 and 5' });
  }

  const master = await Master.findById(masterID);
  if (!master || master.status !== 'approved') {
    return res.status(404).json({ error: 'Master not found' });
  }

  const review = new Review({ masterID, authorName, rating: ratingNum, comment: comment || '' });
  await review.save();

  // Recalculate aggregate rating on the master record
  const allReviews = await Review.find({ masterID });
  const avg = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
  master.rating = Math.round(avg * 10) / 10;
  master.reviewCount = allReviews.length;
  await master.save();

  console.log(`Review added for master ${masterID}: ${ratingNum}/5 by ${authorName}`);
  res.status(201).json({ success: true, review });
}
