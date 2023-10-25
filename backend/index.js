require('dotenv').config();

const express = require('express');
const https = require('https');
const fs = require('fs');
const cors = require('cors');
const mongoose = require('mongoose');
const Master = require('./Master');

const PORT_NUMBER = 5000;
const CERTIFICATE = process.env.CERTIFICATE;
const KEYFILE = process.env.KEYFILE;
const httpsOptions = {
  key: fs.readFileSync(KEYFILE),
  cert: fs.readFileSync(CERTIFICATE),
};

const bot = require('./bot');

const MONGO_PASSWORD = process.env.MONGO_PASSWORD;
const uri = `mongodb+srv://0864380:${MONGO_PASSWORD}@piglets.vfyjg2w.mongodb.net/`;

async function main() {
  const app = express();
  app.use(express.json());
  app.use(cors());

  bot.runBot();
  await mongoose.connect(uri);
  console.log('Database connected');

  app.get('/', async (req, res) => {
    console.log('=== api request to HTTP server ===');
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
      console.log(`Server started on port ${PORT_NUMBER}`)
    )
    .on('error', (err) => {
      console.log('Error starting server:', err);
    });
}

main().catch(console.error);
