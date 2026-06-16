const { bot } = require('./instance');

// Finalize an admin decision in the admin chat: append a status line to the
// request message AND remove its inline keyboard so the Verify/Approve/Decline
// buttons can't be tapped again.
//
// Verification and moderation requests are sent via sendPhoto when the master
// has a photo (so the message has a `caption`, not `text`). editMessageText
// fails on a photo message — which is why the buttons used to stay put — so we
// branch on the message type. Omitting reply_markup clears the inline keyboard
// in both edit calls. Errors are swallowed (the decision already succeeded).
function editAdminMessage(message, suffix) {
  const body = `${message.text || message.caption || ''}\n\n${suffix}`;
  const opts = { chat_id: message.chat.id, message_id: message.message_id };
  return (message.caption != null
    ? bot.editMessageCaption(body, opts)
    : bot.editMessageText(body, opts)
  ).catch(() => {});
}

module.exports = { editAdminMessage };
