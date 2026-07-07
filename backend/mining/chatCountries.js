'use strict';

// Telegram chatID -> countryID for mined chats. The review tool (local-queue-
// server) uses this to publish a candidate to the right country: the city
// dropdown, the "languages spoken" flag and the accept payload's countryID all
// follow it. Anything not listed here (incl. forwarded leads with no chatID)
// falls back to DEFAULT_COUNTRY. Keep in sync with mining/chatRegions.js.
const CHAT_COUNTRY = {
  '1678212416': 'FR', // УКРАЇНСЬКІ КРАСУНІ — Côte d'Azur beauty services (Nice/Cannes)
};

const DEFAULT_COUNTRY = 'IT';

function countryForChat(chatID) {
  return CHAT_COUNTRY[String(chatID)] || DEFAULT_COUNTRY;
}

module.exports = { CHAT_COUNTRY, DEFAULT_COUNTRY, countryForChat };
