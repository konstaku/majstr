const mongoose = require('mongoose');

// Per-file DB lifecycle. Each test file connects with its own dbName so
// serial files never see each other's data.
async function connect(dbName) {
  await mongoose.connect(process.env.MONGO_TEST_URI, { dbName });
}

async function clearAll() {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

async function disconnect() {
  await mongoose.disconnect();
}

module.exports = { connect, clearAll, disconnect };
