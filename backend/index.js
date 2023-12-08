require('dotenv').config();

const express = require('express');
const fs = require('fs');
const https = require('https');
const cors = require('cors');
const Master = require('./database/schema/Master');
const User = require('./database/schema/User');
const professions = require('./data/professions.json');
const locations = require('./data/locations.json');

const PORT_NUMBER = 5000;
const CERTIFICATE = process.env.CERTIFICATE_API;
const KEYFILE = process.env.KEYFILE_API;
const httpsOptions = {
  key: fs.readFileSync(KEYFILE),
  cert: fs.readFileSync(CERTIFICATE),
};

const db = require('./database/db');
const bot = require('./bot');
const OGMW = require('./open-graph-middleware');
const createOGimageForMaster = require('./helpers/generateOpenGraph');

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

  await db.runDB();
  await bot.runBot();
  await OGMW();

  // This is where all my data fetch requests go
  app.get('/', async (req, res) => {
    console.log(
      `=== API request to HTTP server at ${new Date().toUTCString()} ===`
    );

    // Whenever I need to fetch data, I am using URL params to define which data to send
    switch (req.query.q) {
      case 'masters':
        const masters = await Master.find({ approved: true });
        console.log(`Fetching masters...`);
        res.status(200).send(masters);
        break;
      case 'professions':
        console.log(`Fetching professions...`);
        res.status(200).send(professions);
        break;
      case 'locations':
        console.log(`Fetching locations...`);
        res.status(200).send(locations);
        break;
      default:
        console.log(`Unknown request, sending 404...`);
        console.log('request url:', req.url);
        res.status(404).send('No such file!');
    }
  });

  // This endpoint is checking if a user has token
  // If yes, it returns user data from DB
  app.get('/auth', async (req, res) => {
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
  });

  // This is an endpoint for adding a new master.
  // Every user who has logged in may add one master.
  // All masters get "verified: false" by default which can later be set to true by an admin
  app.post('/addmaster', async (req, res) => {
    console.log(`=== New data posted at ${new Date().toUTCString()}`);
    console.log(`Request data:`);
    for (const key in req.body) {
      console.log(`${key}: ${req.body[key]}`);
    }

    const master = new Master(req.body);

    // Automatically approve and add records made by admin
    if (req.body.telegramID === 5950535) {
      master.approved = true;
    }

    // 1. Validate data
    const validationError = master.validateSync();
    if (validationError) throw new Error(validationError);

    // 2. Find user in database with matching userId
    try {
      const user = await User.find({ telegramID: master.telegramID });
      if (!user) throw new Error('User not found in users db');
    } catch (err) {
      console.error(err);
      return res.status(404).send('Error finding user');
    }

    // 3. Create new master record, set approved to true.
    // Copy telegramId, photo (if there is photo and "usephoto" selected)
    let savedMaster;
    try {
      savedMaster = await Master.create(master);
    } catch (err) {
      console.error(err);
      return res.status(404).send('Error finding user');
    }
    console.log('Master entry created successfully!');

    // 4. Generate OG image
    let ogUrl;
    try {
      ogUrl = await createOGimageForMaster(savedMaster);
      console.log('Open Graph image created successfully: ', ogUrl);
      master.OGimage = ogUrl;
    } catch (err) {
      console.error(err);
      return res.status(500).send('Error creating open graph image');
    }

    // 5. Update database record
    try {
      await master.save();
      console.log('Master saved successfully!: ', ogUrl);
    } catch (err) {
      console.error(err);
      return res.status(500).send('Error saving master data');
    }

    // x. (optional) Add master profile to the their user record

    res.status(200).json({ success: true });
  });

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
