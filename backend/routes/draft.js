const Master = require('../database/schema/Master');
const MasterAudit = require('../database/schema/MasterAudit');
const User = require('../database/schema/User');
const Profession = require('../database/schema/Profession');
const Location = require('../database/schema/Location');
const createOGimageForMaster = require('../helpers/generateOpenGraph');
const { masterWebUrl } = require('../helpers/masterUrl');
const { isKnownCountry } = require('../helpers/validateCountry');
const { localizedName } = require('../lang');
const { bot } = require('../bot');

const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const PUBLIC_WEB_URL = process.env.PUBLIC_WEB_URL || 'https://majstr.xyz';

const AVAILABILITY_EMOJI = { available: '🟢', next_week: '🟡', busy: '🔴' };
const { LANG_LABELS } = require('../helpers/langLabels');

async function buildAdminNotificationText(draft) {
  const [profEntry, locEntry] = await Promise.all([
    Profession.findOne({ id: draft.professionID }).lean(),
    Location.findOne({ id: draft.locationID }).lean(),
  ]);
  const profName = localizedName(profEntry?.name, 'uk', draft.professionID);
  const locName = localizedName(locEntry?.name, 'uk', draft.locationID);

  const lines = [
    `🆕 Нова картка майстра на модерації`,
    ``,
    `👤 ${draft.name || '—'}`,
    `🔧 ${profName}`,
    `📍 ${locName}`,
  ];

  if (draft.availability) {
    const emoji = AVAILABILITY_EMOJI[draft.availability] || '';
    lines.push(`${emoji} ${draft.availability}`);
  }

  if (draft.languages && draft.languages.length) {
    const badges = draft.languages.map(l => LANG_LABELS[l] || l.toUpperCase()).join(' · ');
    lines.push(`🗣 ${badges}`);
  }

  if (draft.contacts && draft.contacts.length) {
    lines.push(``, `📞 Контакти:`);
    for (const c of draft.contacts) {
      lines.push(`  ${c.contactType}: ${c.value}`);
    }
  }

  const tags = draft.tags?.ua?.length ? draft.tags.ua : draft.tags?.en ?? [];
  if (tags.length) {
    lines.push(``, `🏷 ${tags.slice(0, 6).join(' · ')}`);
  }

  if (draft.about) {
    const snippet = draft.about.length > 200 ? draft.about.slice(0, 200) + '…' : draft.about;
    lines.push(``, `📝 ${snippet}`);
  }

  return lines.join('\n');
}

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

  // Country, when provided, must reference a real Country doc. A typo or unknown
  // code would otherwise persist and — via the Master schema's `default: 'IT'` —
  // a missing country silently mislabels the master as Italian.
  if (body.countryID !== undefined && !(await isKnownCountry(body.countryID))) {
    return res.status(422).json({ errors: { countryID: 'unknown country' } });
  }

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

  // Community referral (phase-2 endorsement): if the user arrived via a
  // community share link and the window is still open, tag this card so the
  // "Рекомендовано спільнотою" badge shows once it's approved. Consume the
  // stamp either way so a single link grants at most one badge.
  const ref = req.user.referredCommunity;
  if (ref && ref.communityId && ref.expiresAt && new Date(ref.expiresAt) > new Date()) {
    const has = (draft.communityIds || []).includes(ref.communityId);
    if (!has) draft.communityIds = [...(draft.communityIds || []), ref.communityId];
  }
  if (ref && ref.communityId) {
    await User.updateOne(
      { _id: req.user._id },
      { $set: { referredCommunity: { communityId: null, expiresAt: null } } }
    ).catch(err => console.error('Failed to clear referral stamp:', err.message));
  }

  // OG image is best-effort — failure must not block master creation.
  try {
    const ogUrl = await createOGimageForMaster(draft);
    draft.OGimage = ogUrl.toString();
  } catch (err) {
    console.error('[OG] generation failed, continuing without image:', err.message);
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
    // pre-save hook has run → draft.approved is now true.
    // Regenerate OG so the verified stamp is included.
    createOGimageForMaster(draft)
      .then(ogUrl => Master.findByIdAndUpdate(draft._id, { OGimage: ogUrl.toString() }))
      .catch(err => console.error('[OG] admin auto-approve OG regeneration failed:', err.message));

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
    const approveKeyboard = {
      inline_keyboard: [[
        { text: '✅ Схвалити', callback_data: `master:approve:${draft._id}` },
        { text: '❌ Відхилити', callback_data: `master:decline:${draft._id}` },
      ]],
    };
    const caption = await buildAdminNotificationText(draft).catch(() => `🆕 ${draft.name || '—'}`);

    if (draft.photo) {
      bot.sendPhoto(TELEGRAM_ADMIN_CHAT_ID, draft.photo, {
        caption,
        reply_markup: approveKeyboard,
      }).catch(err => console.error('Failed to notify admin (photo):', err));
    } else {
      bot.sendMessage(TELEGRAM_ADMIN_CHAT_ID, caption, {
        reply_markup: approveKeyboard,
      }).catch(err => console.error('Failed to notify admin:', err));
    }
  }

  return res.json({ masterID: draft._id, status: 'pending' });
}

async function getMine(req, res) {
  const masters = await Master.find({ ownerUserID: req.user._id })
    .sort({ updatedAt: -1 });
  // Attach the public share URL so owners can one-tap-share their card (the
  // per-master OG image unfurls from this page).
  const withShare = masters.map((m) => ({
    ...m.toObject(),
    shareUrl: masterWebUrl(m, 'uk', PUBLIC_WEB_URL),
  }));
  res.json({ masters: withShare });
}

module.exports = { getDraft, patchDraft, deleteDraft, submitDraft, getMine };
// Shared with routes/ownedMaster.js — owner edits validate exactly like
// draft patches.
module.exports.validatePatch = validatePatch;
module.exports.DRAFT_FIELDS = DRAFT_FIELDS;
