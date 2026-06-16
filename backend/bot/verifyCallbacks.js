const Master = require('../database/schema/Master');
const MasterAudit = require('../database/schema/MasterAudit');
const User = require('../database/schema/User');
const i18n = require('../i18n');
const createOGimageForMaster = require('../helpers/generateOpenGraph');
const { masterWebUrl } = require('../helpers/masterUrl');
const { bot, getUserLang, REVALIDATE_SECRET, PUBLIC_WEB_URL } = require('./instance');
const { editAdminMessage } = require('./editAdminMessage');

// verify:approve:<masterID> / verify:decline:<masterID> — moderator decision
// on a verification request (helpers/verification.js). Approve grants the
// VERIFIED badge (verified=true) + search priority; visibility (status) is
// never touched here.
async function handleVerifyCallback(queryId, message, data, from) {
  const [, action, masterId] = data.split(':');
  if (!masterId || !['approve', 'decline'].includes(action)) {
    return bot.answerCallbackQuery(queryId, { text: 'Невідома дія' });
  }

  const master = await Master.findById(masterId);
  if (!master) {
    return bot.answerCallbackQuery(queryId, { text: 'Картку не знайдено' });
  }

  const adminUser = await User.findOne({ telegramID: from.id });

  if (action === 'approve') {
    if (master.verified) {
      return bot.answerCallbackQuery(queryId, { text: 'Вже верифіковано' });
    }

    master.verified = true;
    master.verifiedAt = new Date();
    await master.save();

    await MasterAudit.create({
      masterID: master._id,
      actorUserID: adminUser?._id,
      actorTelegramID: from.id,
      action: 'approve',
      reason: 'verified by admin',
    }).catch(err => console.error('Failed to write verify audit row:', err));

    await bot.answerCallbackQuery(queryId, { text: '✅ Верифіковано' });
    await editAdminMessage(message, `✅ Верифіковано — ${from.first_name}`);

    // Refresh the OG card (verified stamp) and the public pages.
    createOGimageForMaster(master)
      .then(ogUrl => Master.updateOne({ _id: master._id }, { $set: { OGimage: ogUrl.toString() } }))
      .catch(err => console.error('[OG] verify regeneration failed:', err.message));
    if (REVALIDATE_SECRET) {
      await fetch(`${PUBLIC_WEB_URL}/api/revalidate?secret=${REVALIDATE_SECRET}`, { method: 'POST' })
        .catch(err => console.error('[revalidate] failed:', err.message));
    }

    if (master.telegramID) {
      const oLang = await getUserLang(master.telegramID);
      bot.sendMessage(
        master.telegramID,
        i18n.t(oLang, 'owner.verified', {
          url: masterWebUrl(master, oLang, PUBLIC_WEB_URL),
        })
      ).catch(() => {});
    }
  } else {
    await MasterAudit.create({
      masterID: master._id,
      actorUserID: adminUser?._id,
      actorTelegramID: from.id,
      action: 'reject',
      reason: 'verification declined by admin',
    }).catch(err => console.error('Failed to write verify audit row:', err));

    await bot.answerCallbackQuery(queryId, { text: '❌ Відхилено' });
    await editAdminMessage(message, `❌ Верифікацію відхилено — ${from.first_name}`);

    if (master.telegramID) {
      const oLang = await getUserLang(master.telegramID);
      bot.sendMessage(master.telegramID, i18n.t(oLang, 'owner.verifyDeclined')).catch(() => {});
    }
  }
}

module.exports = { handleVerifyCallback };
