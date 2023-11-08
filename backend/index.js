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

  app.get('/', async (req, res) => {
    console.log(
      `=== API request to HTTP server at ${new Date().toUTCString()} ===`
    );

    switch (req.query.q) {
      case 'masters':
        const masters = await Master.find({ approved: true });
        res.status(200).send(masters);
        break;
      case 'professions':
        res.status(200).send(professions);
        break;
      case 'locations':
        res.status(200).send(locations);
        break;
      default:
        res.status(404).send('No such file!');
    }
  });

  app.get('/auth', async (req, res) => {
    console.log(`=== Login request ===`);
    const token = req.headers.authorization;
    if (!token) return res.status(400).send('No token');

    console.log(`Login request with token ${token}`);
    const user = await User.findOne({ token: token.toString() });

    return user
      ? res.status(200).send(JSON.stringify(user))
      : res.status(404).send('User not found');
  });

  app.post('/addmaster', async (req, res) => {
    console.log(`=== New data posted at ${new Date().toUTCString()}`);
    console.log(`Request data:`);
    for (const key in req.body) {
      console.log(`${key}: ${req.body[key]}`);
    }

    // Validate data

    // Update database

    // if user is not an admin, add master profile to the their user record

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
