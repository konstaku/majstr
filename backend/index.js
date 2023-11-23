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
const CERTIFICATE = process.env.CERTIFICATE;
const KEYFILE = process.env.KEYFILE;
const httpsOptions = {
  key: fs.readFileSync(KEYFILE),
  cert: fs.readFileSync(CERTIFICATE),
};

const db = require('./database/db');
const bot = require('./bot');
const OGMW = require('./open-graph-middleware');

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
        res.status(404).send('No such file!');
    }
  });

  app.get('/auth', async (req, res) => {
    console.log(`=== Login request ===`);
    // Check for auth token in request headers
    const token = req.headers.authorization;
    // If token does not exist, send 400
    if (!token) return res.status(400).send('No token');

    // If token exists, find a user with a matching token
    console.log(`Login request with token ${token}`);
    const user = await User.findOne({ token: token.toString() });

    return user
      ? // If user exists, send user data
        res.status(200).send(JSON.stringify(user))
      : // Otherwise send an error
        res.status(404).send('User not found');
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

    // 1. Validate data

    // 2. Update database

    // 3. If user is not an admin, add master profile to the their user record

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
