const Master = require('../database/schema/Master');
const MasterAudit = require('../database/schema/MasterAudit');
const User = require('../database/schema/User');
const i18n = require('../i18n');
const { masterWebUrl } = require('../helpers/masterUrl');
const { bot, getUserLang, REVALIDATE_SECRET, PUBLIC_WEB_URL } = require('./instance');
const { editAdminMessage } = require('./editAdminMessage');

async function handleMasterCallback(queryId, message, data, from) {
  // data format: master:approve:<masterID> or master:decline:<masterID>
  const [, action, masterId] = data.split(':');
  if (!masterId || !['approve', 'decline'].includes(action)) {
    return bot.answerCallbackQuery(queryId, { text: 'Невідома дія' });
  }

  const master = await Master.findById(masterId);
  if (!master) {
    return bot.answerCallbackQuery(queryId, { text: 'Картку не знайдено' });
  }
  if (master.status !== 'pending') {
    await bot.answerCallbackQuery(queryId, { text: `Вже ${master.status}` });
    return editAdminMessage(message, `ℹ️ Вже оброблено (${master.status}).`);
  }

  const adminUser = await User.findOne({ telegramID: from.id });

  if (action === 'approve') {
    master.status = 'approved';
    master.approvedAt = new Date();
    await master.save();

    await MasterAudit.create({
      masterID: master._id,
      actorUserID: adminUser?._id,
      actorTelegramID: from.id,
      action: 'approve',
      from: 'pending',
      to: 'approved',
      reason: 'approved by admin',
    }).catch(err => console.error('Failed to write approve audit row:', err));

    await bot.answerCallbackQuery(queryId, { text: '✅ Схвалено' });
    await editAdminMessage(message, `✅ Схвалено — ${from.first_name}`);

    // Flush the Next.js ISR cache so the new master page is live immediately.
    // Awaited so the cache is warm before the notification URL is sent.
    if (REVALIDATE_SECRET) {
      await fetch(`${PUBLIC_WEB_URL}/api/revalidate?secret=${REVALIDATE_SECRET}`, { method: 'POST' })
        .catch(err => console.error('[revalidate] failed:', err.message));
    }

    if (master.telegramID) {
      const oLang = await getUserLang(master.telegramID);
      bot.sendMessage(
        master.telegramID,
        i18n.t(oLang, 'owner.approved', {
          url: masterWebUrl(master, oLang, PUBLIC_WEB_URL),
        })
      ).catch(() => {});
    }
  } else {
    master.status = 'rejected';
    master.rejectedAt = new Date();
    await master.save();

    await MasterAudit.create({
      masterID: master._id,
      actorUserID: adminUser?._id,
      actorTelegramID: from.id,
      action: 'reject',
      from: 'pending',
      to: 'rejected',
      reason: 'declined by admin',
    }).catch(err => console.error('Failed to write reject audit row:', err));

    await bot.answerCallbackQuery(queryId, { text: '❌ Відхилено' });
    await editAdminMessage(message, `❌ Відхилено — ${from.first_name}`);

    if (master.telegramID) {
      const oLang = await getUserLang(master.telegramID);
      bot.sendMessage(
        master.telegramID,
        i18n.t(oLang, 'owner.declined')
      ).catch(() => {});
    }
  }
}

module.exports = { handleMasterCallback };
