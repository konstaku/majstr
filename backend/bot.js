// Thin entry point — the implementation lives in bot/. This file must keep
// existing at this path with this export shape: routes (claims.js, draft.js)
// and index.js resolve the bot singleton via require('../bot') / require('./bot').
require('dotenv').config();

const { bot } = require('./bot/instance');
const { runBot } = require('./bot/transport');

module.exports = { bot, runBot };
