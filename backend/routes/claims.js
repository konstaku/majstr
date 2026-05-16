const mongoose = require('mongoose');
const Master = require('../database/schema/Master');
const MasterClaim = require('../database/schema/MasterClaim');
const MasterAudit = require('../database/schema/MasterAudit');
const { bot } = require('../bot');

const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;

function normalizePhone(p) {
  return String(p).replace(/[^\d]/g, '');
}

function phoneMatches(claimantPhone, masterContacts) {
  const claimantDigits = normalizePhone(claimantPhone);
  if (!claimantDigits) return false;

  const cardPhones = masterContacts
    .filter(c => /phone|tel|whatsapp|viber/i.test(c.contactType))
    .map(c => normalizePhone(c.value))
    .filter(Boolean);

  return cardPhones.some(p =>
    p === claimantDigits ||
    p.endsWith(claimantDigits) ||
    claimantDigits.endsWith(p)
  );
}

async function submitClaim(req, res) {
  const { masterID, phone, notes } = req.body || {};

  if (!masterID) return res.status(400).json({ error: 'masterID required' });
  if (!mongoose.Types.ObjectId.isValid(masterID)) {
    return res.status(400).json({ error: 'invalid_master_id' });
  }

  const master = await Master.findById(masterID);
  if (!master) return res.status(404).json({ error: 'master_not_found' });
  if (!master.claimable) return res.status(409).json({ error: 'not_claimable' });

  if (master.ownerUserID && master.ownerUserID.equals(req.user._id)) {
    return res.status(409).json({ error: 'already_owner' });
  }

  // Build evidence from what the claimant provided
  const evidence = [];
  if (phone) {
    evidence.push({ type: 'phone_match', value: normalizePhone(phone) });
  }
  if (notes) {
    evidence.push({ type: 'other', notes });
  }

  // Admin claims always queue for paper trail — decision 2026-05-16
  const autoApproved =
    !req.user.isAdmin && !!phone && phoneMatches(phone, master.contacts);

  let claim;
  try {
    claim = await MasterClaim.create({
      masterID: master._id,
      claimantUserID: req.user._id,
      claimantTelegramID: req.user.telegramID,
      evidence,
      status: autoApproved ? 'approved' : 'pending',
      autoApproved,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'claim_already_pending' });
    }
    throw err;
  }

  if (autoApproved) {
    const previousOwnerID = master.ownerUserID || null;

    await Master.findByIdAndUpdate(master._id, {
      ownerUserID: req.user._id,
      telegramID: req.user.telegramID,
      claimable: false,
      claimedAt: new Date(),
    });

    await MasterAudit.create({
      masterID: master._id,
      actorUserID: req.user._id,
      actorTelegramID: req.user.telegramID,
      action: 'edit',
      diff: { ownerUserID: [previousOwnerID, req.user._id] },
      reason: 'claim approved (phone match)',
    }).catch(err => console.error('Failed to write claim audit row:', err));
  } else {
    // Queue to admin — send link + claimant info
    if (TELEGRAM_ADMIN_CHAT_ID) {
      const handle = req.user.username
        ? `@${req.user.username}`
        : req.user.firstName || String(req.user.telegramID);
      const evidenceSummary = evidence.length
        ? evidence.map(e => e.type).join(', ')
        : 'none';

      bot.sendMessage(
        TELEGRAM_ADMIN_CHAT_ID,
        `📋 New ownership claim\n` +
        `Card: https://majstr.xyz/?card=${master._id}\n` +
        `Claimant: ${handle} (${req.user.telegramID})\n` +
        `Evidence: ${evidenceSummary}`,
        {
          reply_markup: {
            inline_keyboard: [[
              { text: 'Approve ✅', callback_data: `claim:approve:${claim._id}` },
              { text: 'Decline ❌', callback_data: `claim:decline:${claim._id}` },
            ]],
          },
        }
      ).catch(err => console.error('Failed to notify admin of claim:', err));
    }
  }

  return res.status(201).json({ claim, autoApproved });
}

async function getMyClaims(req, res) {
  const claims = await MasterClaim.find({ claimantUserID: req.user._id })
    .sort({ createdAt: -1 });
  res.json({ claims });
}

async function withdrawClaim(req, res) {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'invalid_claim_id' });
  }

  const claim = await MasterClaim.findById(id);
  if (!claim) return res.status(404).json({ error: 'claim_not_found' });

  if (!claim.claimantUserID.equals(req.user._id)) {
    return res.status(403).json({ error: 'forbidden' });
  }

  if (claim.status !== 'pending') {
    return res.status(409).json({ error: 'claim_not_withdrawable', status: claim.status });
  }

  claim.status = 'withdrawn';
  await claim.save();

  res.status(204).end();
}

module.exports = { submitClaim, getMyClaims, withdrawClaim, normalizePhone, phoneMatches };
