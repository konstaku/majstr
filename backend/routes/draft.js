const Master = require('../database/schema/Master');
const MasterAudit = require('../database/schema/MasterAudit');
const createOGimageForMaster = require('../helpers/generateOpenGraph');
const { bot } = require('../bot');

const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;

const DRAFT_FIELDS = [
  'name', 'professionID', 'locationID', 'countryID',
  'contacts', 'about', 'photo', 'tags', 'languages', 'availability',
];
const STRING_FIELDS = ['name', 'professionID', 'locationID', 'countryID', 'about', 'photo'];
const AVAILABILITY_VALUES = ['available', 'next_week', 'busy'];

const isPlainString = (v) => typeof v === 'string';
const isStringArray = (v) => Array.isArray(v) && v.every(isPlainString);

// Reject any object whose keys could drive Mongo operator/dot injection.
function hasInjectionKeys(obj) {
  return Object.keys(obj).some((k) => k.startsWith('$') || k.includes('.'));
}

function validatePatch(body) {
  const errors = {};

  // Type-strict checks double as NoSQL-injection guards: a string field that
  // arrives as an object (e.g. {"$gt":""}) is rejected outright.
  for (const f of STRING_FIELDS) {
    if (body[f] !== undefined && !isPlainString(body[f])) {
      errors[f] = 'must be a string';
    }
  }
  if (!errors.name && body.name !== undefined && body.name.length > 80) {
    errors.name = 'max 80 characters';
  }
  if (!errors.about && body.about !== undefined && body.about.length > 1000) {
    errors.about = 'max 1000 characters';
  }

  if (body.tags !== undefined) {
    const t = body.tags;
    const okShape =
      t && typeof t === 'object' && !Array.isArray(t) &&
      !hasInjectionKeys(t) &&
      (t.ua === undefined || isStringArray(t.ua)) &&
      (t.en === undefined || isStringArray(t.en));
    if (!okShape) errors.tags = 'must be { ua: string[], en?: string[] }';
    else if ((t.ua?.length || 0) + (t.en?.length || 0) > 20) errors.tags = 'too many tags';
  }

  if (body.languages !== undefined && !isStringArray(body.languages)) {
    errors.languages = 'must be an array of strings';
  }

  if (body.contacts !== undefined) {
    if (!Array.isArray(body.contacts)) errors.contacts = 'must be an array';
    else if (body.contacts.length > 5) errors.contacts = 'max 5 contacts';
    else if (
      body.contacts.some(
        (c) =>
          !c || typeof c !== 'object' || Array.isArray(c) || hasInjectionKeys(c) ||
          !isPlainString(c.contactType) || !isPlainString(c.value)
      )
    ) {
      errors.contacts = 'each contact must be { contactType: string, value: string }';
    }
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

    return res.json({ masterID: draft._id, status: 'approved' });
  }

  // Non-admin: queue for review with an actionable admin keyboard.
  if (TELEGRAM_ADMIN_CHAT_ID) {
    const cardUrl = `https://majstr.xyz/?card=${draft._id}`;
    bot.sendMessage(
      TELEGRAM_ADMIN_CHAT_ID,
      `🆕 Нова картка майстра на модерації\n\n` +
        `👤 ${draft.name || '—'}\n` +
        `🔗 ${cardUrl}\n${draft.OGimage || ''}`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Схвалити', callback_data: `master:approve:${draft._id}` },
              { text: '❌ Відхилити', callback_data: `master:decline:${draft._id}` },
            ],
          ],
        },
      }
    ).catch(err => console.error('Failed to notify admin:', err));
  }

  return res.json({ masterID: draft._id, status: 'pending' });
}

async function getMine(req, res) {
  const masters = await Master.find({ ownerUserID: req.user._id })
    .sort({ updatedAt: -1 });
  res.json({ masters });
}

module.exports = { getDraft, patchDraft, deleteDraft, submitDraft, getMine };
