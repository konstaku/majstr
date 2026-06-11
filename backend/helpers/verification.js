// Verification request: pings the admin chat with a Verify ✅ / Decline ❌
// keyboard for a master card. Fired whenever ownership is established (claim
// auto-approve, admin claim approval) and after every owner edit — the
// VERIFIED badge is only ever granted through the verify: callbacks
// (bot/verifyCallbacks.js), and an edit always revokes it until re-approved.
//
// Best-effort by design: a failed Telegram send must never break the calling
// request. Callers don't await side effects beyond logging.
//
// NB: bot comes from bot/instance (never ../bot): this module is required by
// bot/claimCallbacks.js, and going through the bot.js entry would be a
// require cycle handing one side an empty exports object.

const { bot } = require('../bot/instance');

const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;

function summarizeCard(master) {
  const contactLines = (master.contacts || [])
    .map((c) => `  ${c.contactType}: ${c.value}`)
    .join('\n');
  return (
    `🛡 Запит на верифікацію картки\n\n` +
    `👤 ${master.name || '—'}\n` +
    `🔧 ${master.professionID || '—'} · 📍 ${master.locationID || '—'}\n` +
    (contactLines ? `📞 Контакти:\n${contactLines}\n` : '') +
    (master.about ? `📝 ${String(master.about).slice(0, 200)}\n` : '')
  );
}

// reason: short human note for the admin ("claimed via share link",
// "owner edited the card", …)
async function requestVerification(master, reason) {
  if (!TELEGRAM_ADMIN_CHAT_ID) return;

  const text = summarizeCard(master) + `\nℹ️ ${reason}`;
  const keyboard = {
    inline_keyboard: [[
      { text: 'Verify ✅', callback_data: `verify:approve:${master._id}` },
      { text: 'Decline ❌', callback_data: `verify:decline:${master._id}` },
    ]],
  };

  try {
    if (master.photo) {
      await bot.sendPhoto(TELEGRAM_ADMIN_CHAT_ID, master.photo, {
        caption: text,
        reply_markup: keyboard,
      });
    } else {
      await bot.sendMessage(TELEGRAM_ADMIN_CHAT_ID, text, {
        reply_markup: keyboard,
      });
    }
  } catch (err) {
    console.error('[verify] admin notify failed:', err.message);
  }
}

module.exports = { requestVerification };
