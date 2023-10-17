const express = require('express');
const https = require('https');
const fs = require('fs');
const cors = require('cors');
const masters = require('./data/masters.json');

const PORT_NUMBER = 5000;
const CERTIFICATE = '/etc/letsencrypt/live/api.konstaku.com/fullchain.pem';
const KEYFILE = '/etc/letsencrypt/live/api.konstaku.com/privkey.pem';
const httpsOptions = {
  key: fs.readFileSync(KEYFILE),
  cert: fs.readFileSync(CERTIFICATE),
};

const app = express();

function main() {
  app.use(express.json());
  app.use(cors());

  app.get('/', (req, res) => {
    console.log('=== api request to HTTP server ===');

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

main();
