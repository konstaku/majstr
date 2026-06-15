const Master = require('../database/schema/Master');
const MasterAudit = require('../database/schema/MasterAudit');
const createOGimageForMaster = require('../helpers/generateOpenGraph');
const { requestVerification } = require('../helpers/verification');
const { triggerWebRevalidate } = require('../helpers/revalidateWeb');
const { validatePatch, DRAFT_FIELDS } = require('./draft');

async function editOwnedMaster(req, res) {
  const errors = validatePatch(req.body || {});
  if (errors) return res.status(422).json({ errors });

  const update = { lastEditedAt: new Date() };
  for (const key of DRAFT_FIELDS) {
    if (req.body[key] !== undefined) update[key] = req.body[key];
  }
  Object.assign(req.master, update);

  // Any owner edit revokes the VERIFIED badge until a moderator re-approves
  // (visibility is untouched — the edited card stays live).
  req.master.verified = false;
  req.master.verifiedAt = undefined;

  if (req.body.name || req.body.photo || req.body.professionID) {
    try {
      req.master.OGimage = (await createOGimageForMaster(req.master)).toString();
    } catch (err) {
      console.error('OG regeneration failed:', err);
    }
  }

  await req.master.save();

  // Refresh the public site so the new photo/OG/details reach the grid AND the
  // card-modal detail route (otherwise the modal serves a stale cached record).
  triggerWebRevalidate('owner-edit');

  requestVerification(req.master, 'owner edited the card').catch((err) =>
    console.error('[verify] request failed:', err)
  );

  MasterAudit.create({
    masterID: req.master._id,
    actorUserID: req.user._id,
    actorTelegramID: req.user.telegramID,
    action: 'edit',
    reason: 'owner edit',
  }).catch(err => console.error('Failed to write edit audit row:', err));

  return res.json({ master: req.master });
}

async function setVisibility(req, res) {
  const { hidden } = req.body || {};
  if (typeof hidden !== 'boolean') {
    return res.status(400).json({ error: 'hidden must be true or false' });
  }

  if (hidden) {
    if (req.master.status !== 'approved') {
      return res.status(409).json({ error: 'can_only_hide_approved' });
    }
    req.master.status = 'archived';
    req.master.archivedAt = new Date();
  } else {
    if (req.master.status !== 'archived') {
      return res.status(409).json({ error: 'not_hidden' });
    }
    req.master.status = 'approved';
    req.master.archivedAt = undefined;
  }

  await req.master.save();

  // Hiding/restoring changes the card's presence on the public grid.
  triggerWebRevalidate(hidden ? 'owner-hide' : 'owner-restore');

  MasterAudit.create({
    masterID: req.master._id,
    actorUserID: req.user._id,
    actorTelegramID: req.user.telegramID,
    action: hidden ? 'archive' : 'restore',
    from: hidden ? 'approved' : 'archived',
    to: hidden ? 'archived' : 'approved',
    reason: hidden ? 'owner hid card' : 'owner restored card',
  }).catch(err => console.error('Failed to write visibility audit row:', err));

  return res.status(204).end();
}

async function deleteOwnedMaster(req, res) {
  const masterID = req.master._id;
  const previousStatus = req.master.status;

  await Master.deleteOne({ _id: masterID });

  // Drop the deleted card from the public grid/detail caches.
  triggerWebRevalidate('owner-delete');

  MasterAudit.create({
    masterID,
    actorUserID: req.user._id,
    actorTelegramID: req.user.telegramID,
    action: 'edit',
    from: previousStatus,
    to: null,
    reason: 'owner deleted card',
  }).catch(err => console.error('Failed to write delete audit row:', err));

  return res.status(204).end();
}

module.exports = { editOwnedMaster, setVisibility, deleteOwnedMaster };
