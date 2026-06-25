'use strict';

// Telegram chatID -> endorsing Community.id. The mining accept flow stamps
// Master.communityIds from this, so a master mined from a community's own chat
// carries that community's "Рекомендовано спільнотою" badge. Keep in sync with
// the Community collection (seed via scripts/add-beauty-community.js).
const CHAT_COMMUNITY = {
  '1678212416': 'beauty-ukrainians', // УКРАЇНСЬКІ КРАСУНІ (@beautyforUkrainians) · Côte d'Azur
};

const communityForChat = (chatID) => CHAT_COMMUNITY[String(chatID)] || null;

module.exports = { CHAT_COMMUNITY, communityForChat };
