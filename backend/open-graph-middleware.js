const express = require('express');
const PORT_NUMBER = 5050;
const db = require('./database/db');
const Master = require('./database/schema/Master');

const professions = require('./data/professions.json');
const locations = require('./data/locations.json');

const OGMW = async () => {
  const app = express();
  await db.runDB();

  app.listen(PORT_NUMBER, () => {
    console.log(`Middleware server running on port ${PORT_NUMBER}`);
  });

  app.get('/', async (req, res) => {
    if (!req.query.card) return res.status(404).send('not found');

    const id = req.query.card;
    console.log('Generating OG for card #', id);
    const master = await Master.findById(id);

    if (!master) return res.status(404).send(`Master with id ${id} not found`);

    const html = `<!doctype html>
  <html lang="en">
  
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/img/icons/favicon.svg" />
    <link rel="apple-touch-icon" href="/img/icons/apple-app-icon.png">
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta property="og:image" content="https://chupakabra-test.s3.eu-west-3.amazonaws.com/user-og/${req.query.card}.jpg">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@300;400;600&display=swap" rel="stylesheet">
    <title>Majstr : Знаходь українських майстрів</title>
    <script type="module" crossorigin src="/assets/index-53b5aec3.js"></script>
    <link rel="stylesheet" href="/assets/index-0b5db0eb.css">
  </head>
  
  <body>
    <div id="root"></div>
    
  </body>
  
  </html>`;

    res.status(200).send(html);
  });
};

module.exports = OGMW;
