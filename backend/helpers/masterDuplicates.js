'use strict';

// Duplicate detection by shared contact. A master is a likely duplicate of an
// existing one when they share a normalized contact fingerprint — a phone
// (last 9 digits), a Telegram @handle, an Instagram handle, etc. — computed by
// mining/dedup.contactsToKeys and stored on Master.contactKeys (kept in sync by
// the Master pre-save hook; backfill existing rows with scripts/backfill-contact-keys.js).

const Master = require('../database/schema/Master');
const { contactsToKeys } = require('../mining/dedup');

// Statuses that count as "already taken". Drafts (private, unsubmitted) are
// excluded so a person editing their own draft isn't flagged against itself.
const DEFAULT_STATUSES = ['approved', 'pending'];

// Compact projection used everywhere we surface a duplicate to a human.
const DUP_FIELDS = 'name professionID locationID contacts status source claimable createdAt';

// Find live masters that share a contact fingerprint with `contacts`.
//   contacts   — [{ contactType, value }]
//   opts.excludeId — a Master _id to ignore (self, on edit)
//   opts.statuses  — status whitelist (default approved + pending)
// Returns [] when there are no usable contact keys or no matches.
async function findDuplicateMasters(contacts, opts = {}) {
  const keys = [...contactsToKeys(contacts || [])];
  if (!keys.length) return [];

  const query = {
    contactKeys: { $in: keys },
    status: { $in: opts.statuses || DEFAULT_STATUSES },
  };
  if (opts.excludeId) query._id = { $ne: opts.excludeId };

  return Master.find(query).select(DUP_FIELDS).lean();
}

// Lightweight serializer for API / bot replies.
function summarizeDuplicate(m) {
  return {
    id: String(m._id),
    name: m.name || null,
    professionID: m.professionID || null,
    locationID: m.locationID || null,
    status: m.status,
    source: m.source,
    claimable: !!m.claimable,
    contacts: (m.contacts || []).map((c) => ({
      contactType: c.contactType,
      value: c.value,
    })),
  };
}

module.exports = {
  findDuplicateMasters,
  summarizeDuplicate,
  DEFAULT_STATUSES,
};
