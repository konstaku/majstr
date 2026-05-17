require('dotenv').config();

const mongoose = require('mongoose');

// Connection is env-driven so staging can be isolated from prod.
// Priority:
//   1. MONGO_URI            — full connection string (any cluster)
//   2. MONGO_PASSWORD       — legacy: builds the original cluster URI
// MONGO_DB_NAME (optional) selects a separate database on the SAME cluster
// — the simplest way to isolate staging data with no new infra. Prod
// leaves it unset and keeps using the default database as before.
const MONGO_URI = process.env.MONGO_URI;
const MONGO_PASSWORD = process.env.MONGO_PASSWORD;
const MONGO_DB_NAME = process.env.MONGO_DB_NAME;

const uri =
  MONGO_URI ||
  `mongodb+srv://0864380:${MONGO_PASSWORD}@piglets.vfyjg2w.mongodb.net/`;

module.exports.runDB = async function () {
  await mongoose.connect(uri, MONGO_DB_NAME ? { dbName: MONGO_DB_NAME } : {});
  console.log(
    `Database connected${MONGO_DB_NAME ? ` (db: ${MONGO_DB_NAME})` : ''}`
  );
};
