const express = require('express');
const PORT_NUMBER = 5050;
const fs = require('fs');
const jsdom = require('jsdom');
const Master = require('./database/schema/Master');

const Profession = require('./database/schema/Profession');
const Location = require('./database/schema/Location');

/* 

    This function is a middleware that does HTML rendering in case client comes from an 
external link to a master card. The forwarding to middleware is done in nginx settings,
for any traffic that has '?card=' in url search params.

    The middleware is fetching master's custom OG image from database, and sets it inside the 
OG tags. It will also update the page title for SEO purposes. It is done by DOM manipulation:
title node is replaced and new tags are appended to meta section

*/

async function runOpenGraphMiddleware() {
  // OG tags are now handled natively by the Next.js SSR layer (web/).
  // This middleware is kept for reference but no longer starts a server.
  console.log('[og-middleware] disabled — Next.js handles OG natively');
  return;

  app.get('/', async (req, res) => {
    if (!req.query.card) {
      return res.status(404).send('Card ID not found in URL');
    }

    const id = req.query.card;
    const master = await Master.findById(id);
    const professions = await Profession.find();
    const locations = await Location.find();

    if (!master) {
      // return res.status(404).send(`Master with id ${id} not found`);
      return res.redirect('/');
    }

    console.log('Incoming SSR request for card #', id);

    const profEntry = professions.find((p) => p.id === master.professionID);
    const locEntry  = locations.find((l) => l.id === master.locationID);
    const profName  = profEntry?.name?.ua || master.professionID || '';
    const locName   = locEntry?.name?.ua_alt || locEntry?.name?.ua || master.locationID || '';
    const newTitle  = [master.name, profName, locName].filter(Boolean).join(' · ');

    // Prefer the stored OGimage URL; fall back to the conventional S3 key.
    const ogImageUrl = master.OGimage ||
      `https://chupakabra-test.s3.eu-west-3.amazonaws.com/user-og/${id}.jpg`;

    const metaTags = `
  <meta property="og:title" content="${newTitle}" />
  <meta property="og:image" content="${ogImageUrl}">
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta itemProp="image" content="${ogImageUrl}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${newTitle}" />
  <meta name="twitter:image" content="${ogImageUrl}" />
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
}

module.exports = runOpenGraphMiddleware;
