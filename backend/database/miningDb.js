'use strict';

// Helper for talking to the isolated mining DB (default: `majstr_mining`) from
// the main API process. Candidate and MiningFeedback live there, NOT in the
// production / default DB the API otherwise uses. Mirrors the pattern that
// scripts/mine-review.js already uses (`mongoose.connection.useDb(...)`).
//
// Models are lazily bound on first call so import order does not matter and a
// hot reload during dev does not blow up if runDB() has not finished yet.

const mongoose = require('mongoose');
const CandidateSchema = require('./schema/Candidate').schema;
const MiningFeedbackSchema = require('./schema/MiningFeedback').schema;

const MINING_DB_NAME = process.env.MINING_DB_NAME || 'majstr_mining';

let _conn = null;
let _Candidate = null;
let _MiningFeedback = null;

function getConn() {
  if (_conn) return _conn;
  if (mongoose.connection.readyState !== 1) {
    throw new Error(
      'miningDb: default mongoose connection is not ready — call runDB() first'
    );
  }
  _conn = mongoose.connection.useDb(MINING_DB_NAME);
  return _conn;
}

module.exports = {
  Candidate() {
    if (!_Candidate) _Candidate = getConn().model('Candidate', CandidateSchema);
    return _Candidate;
  },
  MiningFeedback() {
    if (!_MiningFeedback) {
      _MiningFeedback = getConn().model('MiningFeedback', MiningFeedbackSchema);
    }
    return _MiningFeedback;
  },
  dbName: MINING_DB_NAME,
};
