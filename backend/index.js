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
const requireAdmin = require('./middleware/requireAdmin');
const requireUser = require('./middleware/requireUser');

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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

  // Mini App bootstrap + reference data (legacy /?q= aliases kept below)
  app.get('/api/me', requireUser, (req, res) => res.json(req.user));
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
        const masters = await Master.find(mastersQuery);
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

  try {
    const ogUrl = await createOGimageForMaster(master);
    master.OGimage = ogUrl.toString();
  } catch (err) {
    console.error(err);
    return res.status(500).send('Error creating open graph image');
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
    bot.sendMessage(
      TELEGRAM_ADMIN_CHAT_ID,
      `New master added, check it: https://majstr.xyz/admin\n${master.OGimage}`
    );
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

      await MasterAudit.create({
        masterID: master._id,
        actorUserID: req.user._id,
        actorTelegramID: req.user.telegramID,
        action: 'approve',
        from: previousStatus,
        to: 'approved',
      });

      if (telegramId) {
        await bot.sendMessage(
          telegramId,
          `✅ Картку майстра додано на сайт: https://majstr.xyz/?card=${masterID}\n\n` +
            'Управляйте своїм профілем через бот:\n' +
            '/available — доступний зараз\n' +
            '/nextweek — з наступного тижня\n' +
            '/busy — зайнятий\n' +
            '/status — переглянути статус\n' +
            '/languages — мови спілкування'
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
        await bot.sendMessage(
          telegramId,
          `На жаль, заявка не відповідає правилам сайту, або заповнена із помилками. Щоб зʼясувати подробиці, звʼяжіться із підтримкою за контактами, вказаними на сайті`
        );
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
