// Claim approve/decline callbacks — moved verbatim from bot.js. Part of the
// in-progress claim flow; do not edit alongside unrelated refactors.
const Master = require('../database/schema/Master');
const MasterClaim = require('../database/schema/MasterClaim');
const MasterAudit = require('../database/schema/MasterAudit');
const User = require('../database/schema/User');
const { requestVerification } = require('../helpers/verification');
const { bot, PUBLIC_WEB_URL } = require('./instance');

async function handleClaimCallback(queryId, message, data, from) {
  // data format: claim:approve:<claimID> or claim:decline:<claimID>
  const [, action, claimId] = data.split(':');
  if (!claimId || !['approve', 'decline'].includes(action)) {
    return bot.answerCallbackQuery(queryId, { text: 'Невідома дія' });
  }

  const claim = await MasterClaim.findById(claimId);
  if (!claim) {
    return bot.answerCallbackQuery(queryId, { text: 'Claim not found' });
  }
  if (claim.status !== 'pending') {
    await bot.answerCallbackQuery(queryId, { text: `Already ${claim.status}` });
    return bot.editMessageText(`Already ${claim.status}.`, {
      chat_id: message.chat.id,
      message_id: message.message_id,
    });
  }

  const adminUser = await User.findOne({ telegramID: from.id });

  if (action === 'approve') {
    const master = await Master.findById(claim.masterID);
    const previousOwnerID = master?.ownerUserID || null;

    await Master.findByIdAndUpdate(claim.masterID, {
      ownerUserID: claim.claimantUserID,
      telegramID: claim.claimantTelegramID,
      claimable: false,
      claimedAt: new Date(),
    });

    claim.status = 'approved';
    claim.reviewedBy = adminUser?._id;
    claim.reviewedAt = new Date();
    await claim.save();

    await MasterAudit.create({
      masterID: claim.masterID,
      actorUserID: adminUser?._id,
      actorTelegramID: from.id,
      action: 'edit',
      diff: { ownerUserID: [previousOwnerID, claim.claimantUserID] },
      reason: 'claim approved by admin',
    }).catch(err => console.error('Failed to write claim audit row:', err));

    await bot.answerCallbackQuery(queryId, { text: '✅ Approved' });
    await bot.editMessageText(
      `${message.text}\n\n✅ Approved by ${from.first_name}`,
      { chat_id: message.chat.id, message_id: message.message_id }
    );

    // Notify claimant
    bot.sendMessage(
      claim.claimantTelegramID,
      `✅ Your claim was approved! You are now the owner of the card:\n${PUBLIC_WEB_URL}/?card=${claim.masterID}`
    ).catch(() => {});

    // Ownership established → queue the card for moderator verification.
    const claimed = await Master.findById(claim.masterID);
    if (claimed) {
      requestVerification(claimed, 'claim approved by admin').catch(err =>
        console.error('[verify] request failed:', err)
      );
    }

  } else {
    claim.status = 'rejected';
    claim.reviewedBy = adminUser?._id;
    claim.reviewedAt = new Date();
    await claim.save();

    await MasterAudit.create({
      masterID: claim.masterID,
      actorUserID: adminUser?._id,
      actorTelegramID: from.id,
      action: 'reject',
      reason: 'claim declined by admin',
    }).catch(err => console.error('Failed to write claim audit row:', err));

    await bot.answerCallbackQuery(queryId, { text: '❌ Declined' });
    await bot.editMessageText(
      `${message.text}\n\n❌ Declined by ${from.first_name}`,
      { chat_id: message.chat.id, message_id: message.message_id }
    );

    // Notify claimant
    bot.sendMessage(
      claim.claimantTelegramID,
      `❌ Your ownership claim could not be verified. Contact support for more info.`
    ).catch(() => {});
  }
}

module.exports = { handleClaimCallback };
