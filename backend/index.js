require('dotenv').config();

const fs = require('fs');
const http = require('http');
const https = require('https');

const db = require('./database/db');
const { runBot } = require('./bot');
const buildApp = require('./app');

const PORT_NUMBER = process.env.PORT || 5000;
const CERTIFICATE = process.env.CERTIFICATE_API;
const KEYFILE = process.env.KEYFILE_API;
const httpsOptions =
  CERTIFICATE && KEYFILE
    ? { key: fs.readFileSync(KEYFILE), cert: fs.readFileSync(CERTIFICATE) }
    : null;

async function main() {
  await db.runDB();
  await runBot();

  const app = buildApp();

  const server = httpsOptions
    ? https.createServer(httpsOptions, app)
    : http.createServer(app);

  server
    .listen(PORT_NUMBER, () =>
      console.log(`Backend server started on port ${PORT_NUMBER}`)
    )
    .on('error', (err) => {
      console.log('Error starting backend server:', err);
    });
}

main().catch(console.error);
