const express = require('express');
const PORT_NUMBER = 5050;
const fs = require('fs');
const jsdom = require('jsdom');
const Master = require('./database/schema/Master');
const professions = require('./data/professions.json');
const locations = require('./data/locations.json');

/* 

    This function is a middleware that does HTML rendering in case client comes from an 
external link to a master card. The forwarding to middleware is done in nginx settings,
for any traffic that has '?card=' in url search params.

    The middleware is fetching master's custom OG image from database, and sets it inside the 
OG tags. It will also update the page title for SEO purposes. It is done by DOM manipulation:
title node is replaced and new tags are appended to meta section

*/

const OGMW = async () => {
  const app = express();

  app.listen(PORT_NUMBER, () => {
    console.log(`Middleware server running on port ${PORT_NUMBER}`);
  });

  app.get('/', async (req, res) => {
    if (!req.query.card) {
      return res.status(404).send('Card ID not found in URL');
    }

    const id = req.query.card;
    const master = await Master.findById(id);

    if (!master) {
      return res.status(404).send(`Master with id ${id} not found`);
    }

    // Generate a custom page title for a master
    console.log('Incoming SSR request for card #', id);
    const newTitle = `${master.name}: ${
      professions.find((p) => p.id === master.professionID).name.ua
    } в ${locations.find((l) => l.id === master.locationID).city.ua_alt}`;

    // Meta tags for update
    const metaTags = `
  <meta property="og:image" content="https://chupakabra-test.s3.eu-west-3.amazonaws.com/user-og/${req.query.card}.jpg">
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="627" />
  <meta itemProp="image" content="https://chupakabra-test.s3.eu-west-3.amazonaws.com/user-og/${req.query.card}.jpg" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="https://chupakabra-test.s3.eu-west-3.amazonaws.com/user-og/${req.query.card}.jpg" />
  <meta content="noarchive, max-image-preview:large" name="robots" />`;

    // Get latest index HTML file from frontend directory
    let indexHtml = fs.readFileSync('./../frontend/index.html', 'utf8');

    // Parse HTML to DOM
    const dom = new jsdom.JSDOM(indexHtml);
    const doc = dom.window.document;

    // Select head and title nodes
    const head = doc.querySelector('head');
    const title = doc.querySelector('title');

    // Update head, change title
    head.insertAdjacentHTML('beforeend', metaTags);
    title.textContent = newTitle;

    // Serialize back to html string
    indexHtml = doc.documentElement.outerHTML;

    // Send an updated file
    res.status(200).send(indexHtml);
  });
};

module.exports = OGMW;
