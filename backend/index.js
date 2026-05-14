require('dotenv').config();

const express = require('express');
const fs = require('fs');
const http = require('http');
const https = require('https');

const Master = require('./database/schema/Master');
const User = require('./database/schema/User');
const Profession = require('./database/schema/Profession');
const ProfCategory = require('./database/schema/ProfCategory');
const Location = require('./database/schema/Location');
const Review = require('./database/schema/Review');

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
  app.get('/auth', authenticateUser);
  app.post('/addmaster', addMaster);
  app.post('/approve-master', handleApproveMaster);
  app.post('/review', addReview);

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
        let mastersQuery = { approved: true };
        if (req.query.country) {
          mastersQuery = { ...mastersQuery, countryID: req.query.country };
        }
        const masters = await Master.find(mastersQuery);
        console.log(`Fetching masters for location`, req.query.country);
        res.status(200).send(masters);
        break;
      case 'newmasters':
        const newMasters = await Master.find({ approved: false });
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

// This endpoint is checking if a user has token
// If yes, it returns user data from DB
async function authenticateUser(req, res) {
  const token = req.headers.authorization;
  if (!token) {
    console.log('Auth request without a token, returning 400');
    return res.status(400).send('No token');
  }

  console.log(`Login request with token ${token}`);
  console.log(`Looking up database entry...`);

  const user = await User.findOne({ token: token.toString() });
  if (!user) {
    console.log('User with this token not found');
    return res.status(404).send('User not found');
  }

  console.log('Login successful, sending user...');
  res.status(200).send(JSON.stringify(user));
}

// This is an endpoint for adding a new master.
// Every user who has logged in may add one master.
// All masters get "verified: false" by default which can later be set to true by an admin
async function addMaster(req, res) {
  console.log(`=== New data posted at ${new Date().toUTCString()}`);
  console.log(`Request data:`);
  for (const key in req.body) {
    console.log(`${key}: ${req.body[key]}`);
  }

  const master = new Master(req.body);

  // 1. Validate data
  const validationError = master.validateSync();
  if (validationError) {
    return res.status(400).send(validationError.message);
  }

  // 2. Find user in database with matching userId
  try {
    const user = await User.find({ telegramID: master.telegramID });
    if (!user) throw new Error('User not found in users db');
  } catch (err) {
    console.error(err);
    return res.status(404).send('Error finding user');
  }

  // 4. Generate OG image
  try {
    const ogUrl = await createOGimageForMaster(master);
    console.log('Open Graph image created successfully: ', ogUrl);
    master.OGimage = ogUrl.toString();
  } catch (err) {
    console.error(err);
    return res.status(500).send('Error creating open graph image');
  }

  // 5. Update database record
  try {
    await master.save();
    console.log('Master saved successfully!: ', master.OGimage);
  } catch (err) {
    console.error(err);
    return res.status(500).send('Error saving master data');
  }

  // 5.5 (optional) Add master profile to the their user record

  // 6. Send an update to a moderator telegram
  // sendModeratorUpdate(masterId)

  // bot.sendMessage(TELEGRAM_ADMIN_CHAT_ID, master.toString(), {
  //   reply_markup: {
  //     inline_keyboard: [
  //       [
  //         {
  //           text: '✅',
  //           callback_data: JSON.stringify({
  //             value: 'accept',
  //             masterId: master._id,
  //           }),
  //         },
  //       ],
  //       [
  //         {
  //           text: '❌',
  //           callback_data: JSON.stringify({
  //             value: 'decline',
  //             masterId: master._id,
  //           }),
  //         },
  //       ],
  //     ],
  //   },
  // });

  bot.sendMessage(
    TELEGRAM_ADMIN_CHAT_ID,
    `New master added, check it: https://majstr.xyz/admin\n${master.OGimage}`
  );

  res.status(200).json({ success: true });
}

async function handleApproveMaster(req, res) {
  console.log('new request', req.body);

  const data = req.body;
  const { action, masterID, token } = data;
  const master = await Master.findById(masterID);
  const telegramId = master?.telegramID;

  if (master === null) {
    return res.status(404).end();
  }

  const adminTokens = (await User.find({ isAdmin: true })).map(
    (user) => user?.token
  );

  if (!adminTokens.includes(token)) {
    console.log('auth failed — token not in admin list');
    return res.status(403).send('Unauthorized');
  }

  console.log('auth success');

  let success = false;

  switch (action) {
    case 'approve':
      try {
        await approveMaster(masterID);
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
        success = true;
      } catch (err) {
        throw new Error(err?.message);
      }
      break;

    case 'decline':
      try {
        await declineMaster(masterID);
        await bot.sendMessage(
          telegramId,
          `На жаль, заявка не відповідає правилам сайту, або заповнена із помилками. Щоб зʼясувати подробиці, звʼяжіться із підтримкою за контактами, вказаними на сайті`
        );
        success = true;
      } catch (err) {
        throw new Error(err?.message);
      }
      break;
    default:
      throw new Error('Cannot handle master approval!');
  }

  if (success) {
    return res.status(200).send('ok');
  }

  res.status(400).send('cannot handle request');
}

async function approveMaster(id) {
  const master = await Master.findById(id).catch(console.error);
  master.approved = true;
  await master.save().catch(console.error);
}

async function declineMaster(id) {
  const deleted = await Master.findByIdAndDelete(id).catch(console.error);
  if (!deleted) {
    throw new Error('Can not delete master');
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
  if (!master || !master.approved) {
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
