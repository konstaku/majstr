require('dotenv').config();

const express = require('express');
const fs = require('fs');
const https = require('https');
const cors = require('cors');
const Master = require('./database/schema/Master');

const PORT_NUMBER = 5000;
const CERTIFICATE = process.env.CERTIFICATE;
const KEYFILE = process.env.KEYFILE;
const httpsOptions = {
  key: fs.readFileSync(KEYFILE),
  cert: fs.readFileSync(CERTIFICATE),
};

const db = require('./database/db');
const bot = require('./bot');

async function main() {
  const app = express();
  app.use(express.json());
  app.use(cors());

  await db.runDB();
  await bot.runBot();

  app.get('/', async (req, res) => {
    console.log(`=== API request to HTTP server at ${new Date()} ===`);
    const masters = await Master.find();

    switch (req.query.q) {
      case 'masters':
        res.status(200).send(masters);
        break;
      default:
        res.status(404).send('No such file!');
    }
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
