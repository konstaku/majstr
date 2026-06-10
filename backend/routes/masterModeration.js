const Master = require('../database/schema/Master');
const MasterAudit = require('../database/schema/MasterAudit');
const User = require('../database/schema/User');
const i18n = require('../i18n');
const { masterWebUrl } = require('../helpers/masterUrl');
const createOGimageForMaster = require('../helpers/generateOpenGraph');
const { bot } = require('../bot');

const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;

// Returns the authenticated user. JWT verification + revocation check
// happens in the requireAuth middleware.
async function authenticateUser(req, res) {
  console.log(`Auth ok for user ${req.user.firstName} (${req.user.telegramID})`);
  res.status(200).json(req.user);
}

// Create a master card. Identity is taken from req.user (verified JWT),
// never from the request body. Body telegramID / ownerUserID / status fields
// are ignored to prevent spoofing.
async function addMaster(req, res) {
  console.log(`=== New master submission from ${req.user.telegramID}`);

  const {
    telegramID: _ignoredTelegramID,
    ownerUserID: _ignoredOwner,
    status: _ignoredStatus,
    approved: _ignoredApproved,
    submittedAt: _ignoredSubmittedAt,
    approvedAt: _ignoredApprovedAt,
    ...safeBody
  } = req.body || {};

  const master = new Master({
    ...safeBody,
    telegramID: req.user.telegramID,
    ownerUserID: req.user._id,
    status: 'pending',
    submittedAt: new Date(),
    source: 'self_submitted',
    claimable: false,
    claimedAt: new Date(),
  });

  const validationError = master.validateSync();
  if (validationError) {
    return res.status(400).send(validationError.message);
  }

  // OG image is best-effort — failure must not block master creation.
  try {
    const ogUrl = await createOGimageForMaster(master);
    master.OGimage = ogUrl.toString();
  } catch (err) {
    console.error('[OG] generation failed, continuing without image:', err.message);
  }

  try {
    await master.save();
  } catch (err) {
    console.error(err);
    return res.status(500).send('Error saving master data');
  }

  try {
    await MasterAudit.create({
      masterID: master._id,
      actorUserID: req.user._id,
      actorTelegramID: req.user.telegramID,
      action: 'submit',
      from: null,
      to: 'pending',
    });
  } catch (err) {
    console.error('Failed to write audit row:', err);
  }

  if (TELEGRAM_ADMIN_CHAT_ID) {
    const contactLines = (master.contacts || []).map(c => `  ${c.contactType}: ${c.value}`).join('\n');
    const adminText =
      `🆕 Нова картка майстра на модерації\n\n` +
      `👤 ${master.name || '—'}\n` +
      (contactLines ? `📞 Контакти:\n${contactLines}\n` : '') +
      (master.about ? `📝 ${master.about.slice(0, 200)}\n` : '');
    const approveKeyboard = {
      inline_keyboard: [[
        { text: '✅ Схвалити', callback_data: `master:approve:${master._id}` },
        { text: '❌ Відхилити', callback_data: `master:decline:${master._id}` },
      ]],
    };
    if (master.photo) {
      bot.sendPhoto(TELEGRAM_ADMIN_CHAT_ID, master.photo, {
        caption: adminText,
        reply_markup: approveKeyboard,
      }).catch(console.error);
    } else {
      bot.sendMessage(TELEGRAM_ADMIN_CHAT_ID, adminText, {
        reply_markup: approveKeyboard,
      }).catch(console.error);
    }
  }

  res.status(200).json({ success: true, masterID: master._id });
}

// Admin action on a pending master. Auth (requireAuth) and admin role
// (requireAdmin) are enforced by middleware — body no longer carries a token.
async function handleApproveMaster(req, res) {
  const { action, masterID, reason } = req.body || {};

  const master = await Master.findById(masterID);
  if (!master) {
    return res.status(404).send('Master not found');
  }

  const previousStatus = master.status;
  const telegramId = master.telegramID;

  try {
    if (action === 'approve') {
      master.status = 'approved';
      master.approvedAt = new Date();
      master.rejectionReason = undefined;
      await master.save();
      // pre-save hook has run → master.approved is now true.
      // Regenerate OG so the image matches the new design and shows the verified stamp.
      createOGimageForMaster(master)
        .then(ogUrl => Master.updateOne({ _id: master._id }, { $set: { OGimage: ogUrl.toString() } }))
        .catch(err => console.error('[OG] regeneration on approval failed:', err.message));

      await MasterAudit.create({
        masterID: master._id,
        actorUserID: req.user._id,
        actorTelegramID: req.user.telegramID,
        action: 'approve',
        from: previousStatus,
        to: 'approved',
      });

      if (telegramId) {
        const ownerUser = await User.findOne({ telegramID: telegramId }).select('uiLanguage').lean();
        const oLang = i18n.normalizeLang(ownerUser?.uiLanguage);
        await bot.sendMessage(
          telegramId,
          i18n.t(oLang, 'owner.approved', {
            url: masterWebUrl(master, oLang, `https://majstr.xyz`),
          })
        );
      }

      return res.status(200).json({ success: true });
    }

    if (action === 'decline') {
      master.status = 'rejected';
      master.rejectedAt = new Date();
      if (reason) master.rejectionReason = reason;
      await master.save();

      await MasterAudit.create({
        masterID: master._id,
        actorUserID: req.user._id,
        actorTelegramID: req.user.telegramID,
        action: 'reject',
        from: previousStatus,
        to: 'rejected',
        reason: reason || undefined,
      });

      if (telegramId) {
        const ownerUser = await User.findOne({ telegramID: telegramId }).select('uiLanguage').lean();
        const oLang = i18n.normalizeLang(ownerUser?.uiLanguage);
        await bot.sendMessage(telegramId, i18n.t(oLang, 'owner.declined'));
      }

      return res.status(200).json({ success: true });
    }

    return res.status(400).send('Unknown action');
  } catch (err) {
    console.error('Admin action failed:', err);
    return res.status(500).send('Action failed');
  }
}

module.exports = { authenticateUser, addMaster, handleApproveMaster };
