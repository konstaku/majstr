require('dotenv').config();

const express = require('express');
const fs = require('fs');
const https = require('https');
const cors = require('cors');

const Master = require('./database/schema/Master');
const User = require('./database/schema/User');
const Profession = require('./database/schema/Profession');
const ProfCategory = require('./database/schema/ProfCategory');
const Location = require('./database/schema/Location');

const PORT_NUMBER = 5000;
const CERTIFICATE = process.env.CERTIFICATE_API;
const KEYFILE = process.env.KEYFILE_API;
const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const httpsOptions = {
  key: fs.readFileSync(KEYFILE),
  cert: fs.readFileSync(CERTIFICATE),
};

const db = require('./database/db');
const { bot, runBot } = require('./bot');
const runOpenGraphMiddleware = require('./open-graph-middleware');
const createOGimageForMaster = require('./helpers/generateOpenGraph');
const Country = require('./database/schema/Country');

const corsMiddleware = (req, res, next) => {
  // CORS headers temporary set to allow all origins - will change on production
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
};

async function main() {
  const app = express();
  app.use(express.json());
  app.use(cors());
  app.use(corsMiddleware);
  app.use('/img', express.static('data/img'));

  await db.runDB();
  await runBot();
  await runOpenGraphMiddleware();

  app.get('/', handleApiRequests);
  app.get('/auth', authenticateUser);
  app.post('/addmaster', addMaster);
  app.post('/approve-master', handleApproveMaster);

  const httpsServer = https.createServer(httpsOptions, app);

  httpsServer
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
    throw new Error(validationError);
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
    `New master added, check it: ${master.OGimage}\nhttps://majstr.com/admin`
  );

  res.status(200).json({ success: true });
}

async function handleApproveMaster(req, res) {
  console.log('new request', req.body);

  const data = req.body;
  const { action, masterID, token } = data;
  const master = await Master.findById(masterID);
  const telegramId = master?.telegramID;

  const adminTokens = (await User.find({ isAdmin: true })).map(
    (user) => user?.token
  );

  if (adminTokens.includes(token)) {
    console.log('auth success');
  }

  if (master === null) {
    return res.status(404).end();
  }

  let success = false;

  switch (action) {
    case 'approve':
      try {
        await approveMaster(masterID);
        await bot.sendMessage(
          telegramId,
          `Картку майстра додано на сайт: https://majstr.com/?card=${masterID}`
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
