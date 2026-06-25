const mongoose = require('mongoose');
const Master = require('../database/schema/Master');
const MasterClaim = require('../database/schema/MasterClaim');
const MasterAudit = require('../database/schema/MasterAudit');
const { requestVerification } = require('../helpers/verification');
const { masterWebUrl } = require('../helpers/masterUrl');
const { bot } = require('../bot');

const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const PUBLIC_WEB_URL = process.env.PUBLIC_WEB_URL || 'https://majstr.xyz';

// Accept only the deep-link-encoded sources; anything else is recorded as
// 'unknown' so a bad client value can never poison the growth-gate split.
function normalizeSource(s) {
  return MasterClaim.SOURCES.includes(s) ? s : 'unknown';
}

function normalizePhone(p) {
  return String(p).replace(/[^\d]/g, '');
}

function telegramHandleMatches(username, masterContacts) {
  if (!username) return false;
  const normalized = username.toLowerCase().replace(/^@/, '');
  const tgContacts = masterContacts
    .filter(c => /^telegram$/i.test(c.contactType))
    .map(c => c.value.toLowerCase().replace(/^@/, '').trim())
    .filter(Boolean);
  return tgContacts.some(h => h === normalized);
}

function telegramIdMatches(userTelegramID, master) {
  return !!(userTelegramID && master.telegramID && master.telegramID === userTelegramID);
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
  const { masterID, phone, notes, source } = req.body || {};

  if (!masterID) return res.status(400).json({ error: 'masterID required' });
  if (!mongoose.Types.ObjectId.isValid(masterID)) {
    return res.status(400).json({ error: 'invalid_master_id' });
  }

  const master = await Master.findById(masterID);
  if (!master) return res.status(404).json({ error: 'master_not_found' });

  // Ownership is checked BEFORE claimability: a master who already claimed
  // their card and re-opens the same deep link must land on card management
  // (the client routes `already_owner` → /my-cards), not hit the dead-end
  // "not_claimable" error — claiming sets claimable:false, so the order matters.
  if (master.ownerUserID && master.ownerUserID.equals(req.user._id)) {
    return res.status(409).json({ error: 'already_owner' });
  }

  if (!master.claimable) return res.status(409).json({ error: 'not_claimable' });

  // One active card per owner (partial unique index on ownerUserID). Without
  // this the ownership transfer below throws E11000. A real (submitted) card —
  // pending or approved — legitimately blocks the claim, so surface a clear
  // 409. But an unsubmitted `draft` is an abandoned "add card" attempt (often
  // an empty, unsubmittable shell); it must not permanently dead-end the user
  // out of claiming their real (e.g. scraped) card. Supersede it: drop the
  // draft, then proceed with the claim.
  const activeCard = await Master.findOne({
    ownerUserID: req.user._id,
    status: { $in: Master.ACTIVE_STATUSES },
  });
  if (activeCard) {
    if (activeCard.status === 'draft') {
      await Master.deleteOne({ _id: activeCard._id });
    } else {
      return res.status(409).json({ error: 'active_card_exists' });
    }
  }

  // Build evidence from what the claimant provided
  const evidence = [];
  if (phone) {
    evidence.push({ type: 'phone_match', value: normalizePhone(phone) });
  }
  if (req.user.username) {
    evidence.push({ type: 'social_handle', value: req.user.username });
  }
  if (notes) {
    evidence.push({ type: 'other', notes });
  }

  const phoneMatch = !!phone && phoneMatches(phone, master.contacts);
  const handleMatch = telegramHandleMatches(req.user.username, master.contacts);
  const idMatch = telegramIdMatches(req.user.telegramID, master);
  // Admin claims always queue for paper trail — decision 2026-05-16
  const autoApproved = !req.user.isAdmin && (phoneMatch || handleMatch || idMatch);

  let claim;
  try {
    claim = await MasterClaim.create({
      masterID: master._id,
      claimantUserID: req.user._id,
      claimantTelegramID: req.user.telegramID,
      evidence,
      status: autoApproved ? 'approved' : 'pending',
      source: normalizeSource(source),
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

    try {
      await Master.findByIdAndUpdate(master._id, {
        ownerUserID: req.user._id,
        telegramID: req.user.telegramID,
        claimable: false,
        claimedAt: new Date(),
      });
    } catch (err) {
      // Race with the pre-check above: claimant acquired an active card
      // between the two queries. Roll the claim back and answer cleanly.
      if (err.code === 11000) {
        claim.status = 'rejected';
        claim.reason = 'claimant already owns an active card';
        await claim.save().catch(() => {});
        return res.status(409).json({ error: 'active_card_exists' });
      }
      throw err;
    }

    await MasterAudit.create({
      masterID: master._id,
      actorUserID: req.user._id,
      actorTelegramID: req.user.telegramID,
      action: 'edit',
      diff: { ownerUserID: [previousOwnerID, req.user._id] },
      reason: 'claim approved (phone match)',
    }).catch(err => console.error('Failed to write claim audit row:', err));

    // Ownership established → queue the card for moderator verification
    // (VERIFIED badge), even if the new owner never edits anything.
    const claimed = await Master.findById(master._id);
    requestVerification(claimed, 'card claimed by its master (auto-approved)').catch(err =>
      console.error('[verify] request failed:', err)
    );
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

  // The public card URL the new owner shares — the per-master OG image unfurls
  // from this page (the share loop's engine). Valid whether the claim was
  // auto-approved or queued; the card is already public either way.
  const shareUrl = masterWebUrl(master, 'uk', PUBLIC_WEB_URL);

  return res.status(201).json({ claim, autoApproved, shareUrl });
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
