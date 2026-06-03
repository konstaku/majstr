'use strict';

/**
 * #119 — one-shot backfill: fix Masters where a phone number is stored as
 * contactType:'telegram' (or a @handle as 'phone').
 *
 * Dry-run by default; pass --apply to write changes.
 *
 * Usage (from backend/):
 *   node scripts/fix-contact-types.js           # dry-run, shows what would change
 *   node scripts/fix-contact-types.js --apply   # write corrections to prod DB
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { runDB } = require('../database/db');
const Master = require('../database/schema/Master');
const MasterAudit = require('../database/schema/MasterAudit');

const APPLY = process.argv.includes('--apply');

const TG_HANDLE_RE = /^@?[A-Za-z][A-Za-z0-9_]{4,31}$/;

function autoCorrect(contacts) {
  let changed = false;
  const fixed = (contacts || []).map((c) => {
    const digits = String(c.value || '').replace(/\D/g, '');
    const looksLikePhone = digits.length >= 8;
    const looksLikeTg = TG_HANDLE_RE.test(String(c.value || '').trim());

    if (c.contactType === 'telegram' && looksLikePhone && !looksLikeTg) {
      changed = true;
      return { contactType: 'phone', value: String(c.value).replace(/^@/, '') };
    }
    if (
      (c.contactType === 'phone' || c.contactType === 'whatsapp' || c.contactType === 'viber') &&
      looksLikeTg &&
      !looksLikePhone
    ) {
      changed = true;
      return { contactType: 'telegram', value: c.value };
    }
    return c;
  });
  return { fixed, changed };
}

async function main() {
  await runDB();
  const masters = await Master.find({ 'contacts.0': { $exists: true } })
    .select('_id name contacts')
    .lean();

  let total = 0;
  let fixed = 0;

  for (const m of masters) {
    total++;
    const { fixed: corrected, changed } = autoCorrect(m.contacts);
    if (!changed) continue;

    console.log(`\n[${m._id}] ${m.name}`);
    for (let i = 0; i < m.contacts.length; i++) {
      const before = m.contacts[i];
      const after = corrected[i];
      if (before.contactType !== after.contactType || before.value !== after.value) {
        console.log(`  contact[${i}]: ${before.contactType}:"${before.value}" → ${after.contactType}:"${after.value}"`);
      }
    }

    if (APPLY) {
      await Master.updateOne({ _id: m._id }, { $set: { contacts: corrected } });
      await MasterAudit.create({
        masterID: m._id,
        action: 'update',
        from: { contacts: m.contacts },
        to: { contacts: corrected },
        reason: 'fix-contact-types-119',
      });
    }
    fixed++;
  }

  console.log(`\n${APPLY ? 'Fixed' : 'Would fix'} ${fixed} of ${total} masters.`);
  if (!APPLY && fixed > 0) {
    console.log('Re-run with --apply to write changes.');
  }
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
