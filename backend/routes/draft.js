const Master = require('../database/schema/Master');
const MasterAudit = require('../database/schema/MasterAudit');
const createOGimageForMaster = require('../helpers/generateOpenGraph');
const { bot } = require('../bot');

const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;

const DRAFT_FIELDS = [
  'name', 'professionID', 'locationID', 'countryID',
  'contacts', 'about', 'photo', 'tags', 'languages', 'availability',
];
const AVAILABILITY_VALUES = ['available', 'next_week', 'busy'];

function validatePatch(body) {
  const errors = {};

  if (body.name !== undefined) {
    if (typeof body.name !== 'string') errors.name = 'must be a string';
    else if (body.name.length > 80) errors.name = 'max 80 characters';
  }
  if (body.about !== undefined) {
    if (typeof body.about !== 'string') errors.about = 'must be a string';
    else if (body.about.length > 1000) errors.about = 'max 1000 characters';
  }
  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) errors.tags = 'must be an array';
    else if (body.tags.length > 10) errors.tags = 'max 10 tags';
  }
  if (body.contacts !== undefined) {
    if (!Array.isArray(body.contacts)) errors.contacts = 'must be an array';
    else if (body.contacts.length > 5) errors.contacts = 'max 5 contacts';
  }
  if (body.availability !== undefined && !AVAILABILITY_VALUES.includes(body.availability)) {
    errors.availability = `must be one of: ${AVAILABILITY_VALUES.join(', ')}`;
  }

  return Object.keys(errors).length ? errors : null;
}

async function getDraft(req, res) {
  const draft = await Master.findOne({ ownerUserID: req.user._id, status: 'draft' });
  res.json({ draft: draft || null });
}

async function patchDraft(req, res) {
  const body = req.body || {};

  const errors = validatePatch(body);
  if (errors) return res.status(422).json({ errors });

  const update = { lastEditedAt: new Date() };
  for (const key of DRAFT_FIELDS) {
    if (body[key] !== undefined) update[key] = body[key];
  }

  try {
    const draft = await Master.findOneAndUpdate(
      { ownerUserID: req.user._id, status: 'draft' },
      {
        $set: update,
        $setOnInsert: {
          ownerUserID: req.user._id,
          telegramID: req.user.telegramID,
          status: 'draft',
          source: 'self_submitted',
          claimable: false,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return res.json({ draft });
  } catch (err) {
    if (err.code === 11000) {
      // User already has a pending or approved master; one active card per user in v1.
      return res.status(409).json({ error: 'active_master_exists' });
    }
    throw err;
  }
}

async function deleteDraft(req, res) {
  await Master.deleteOne({ ownerUserID: req.user._id, status: 'draft' });
  res.status(204).end();
}

async function submitDraft(req, res) {
  const draft = await Master.findOne({ ownerUserID: req.user._id, status: 'draft' });
  if (!draft) return res.status(404).json({ error: 'no_draft' });

  // Required fields for a publishable card
  const errors = {};
  if (!draft.name || !draft.name.trim()) errors.name = 'required';
  if (!draft.professionID) errors.professionID = 'required';
  if (!Array.isArray(draft.contacts) || draft.contacts.length === 0) {
    errors.contacts = 'at least one contact required';
  } else if (draft.contacts.some(c => !c.contactType || !c.value)) {
    errors.contacts = 'each contact must have contactType and value';
  }
  if (Object.keys(errors).length) return res.status(422).json({ errors });

  // Mongoose-level validation (enum checks, etc.)
  const mongooseError = draft.validateSync();
  if (mongooseError) {
    const fieldErrors = {};
    for (const [field, err] of Object.entries(mongooseError.errors)) {
      fieldErrors[field] = err.message;
    }
    return res.status(422).json({ errors: fieldErrors });
  }

  // Generate OG image before changing status so the draft stays intact on failure
  let ogUrl;
  try {
    ogUrl = await createOGimageForMaster(draft);
    draft.OGimage = ogUrl.toString();
  } catch (err) {
    console.error('OG image generation failed:', err);
    return res.status(500).json({ error: 'og_generation_failed' });
  }

  draft.status = 'pending';
  draft.submittedAt = new Date();
  await draft.save();

  await MasterAudit.create({
    masterID: draft._id,
    actorUserID: req.user._id,
    actorTelegramID: req.user.telegramID,
    action: 'submit',
    from: 'draft',
    to: 'pending',
  }).catch(err => console.error('Failed to write submit audit row:', err));

  if (TELEGRAM_ADMIN_CHAT_ID) {
    bot.sendMessage(
      TELEGRAM_ADMIN_CHAT_ID,
      `New master added, check it: https://majstr.xyz/admin\n${draft.OGimage}`
    ).catch(err => console.error('Failed to notify admin:', err));
  }

  // Admin submissions skip the approval queue
  if (req.user.isAdmin) {
    draft.status = 'approved';
    draft.approvedAt = new Date();
    await draft.save();

    await MasterAudit.create({
      masterID: draft._id,
      actorUserID: req.user._id,
      actorTelegramID: req.user.telegramID,
      action: 'approve',
      from: 'pending',
      to: 'approved',
      reason: 'auto-approved (admin)',
    }).catch(err => console.error('Failed to write auto-approve audit row:', err));
  }

  return res.json({ masterID: draft._id });
}

async function getMine(req, res) {
  const masters = await Master.find({ ownerUserID: req.user._id })
    .sort({ updatedAt: -1 });
  res.json({ masters });
}

module.exports = { getDraft, patchDraft, deleteDraft, submitDraft, getMine };
