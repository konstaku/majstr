const Master = require('../database/schema/Master');
const MasterAudit = require('../database/schema/MasterAudit');
const User = require('../database/schema/User');
const i18n = require('../i18n');
const { masterWebUrl } = require('../helpers/masterUrl');
const { bot, getUserLang, REVALIDATE_SECRET, PUBLIC_WEB_URL } = require('./instance');

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
    return bot.editMessageText(`${message.text}\n\nℹ️ Вже оброблено (${master.status}).`, {
      chat_id: message.chat.id,
      message_id: message.message_id,
    }).catch(() => {});
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
    await bot.editMessageText(
      `${message.text}\n\n✅ Схвалено — ${from.first_name}`,
      { chat_id: message.chat.id, message_id: message.message_id }
    ).catch(() => {});

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
    await bot.editMessageText(
      `${message.text}\n\n❌ Відхилено — ${from.first_name}`,
      { chat_id: message.chat.id, message_id: message.message_id }
    ).catch(() => {});

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
