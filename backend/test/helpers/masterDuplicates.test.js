import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';

const Master = require('../../database/schema/Master');
const { findDuplicateMasters, summarizeDuplicate } = require('../../helpers/masterDuplicates');
const { connect, clearAll, disconnect } = require('../db');

beforeAll(() => connect('duplicates-test'));
afterEach(clearAll);
afterAll(disconnect);

const phone = (value) => ({ contactType: 'phone', value });
const tg = (value) => ({ contactType: 'telegram', value });

describe('findDuplicateMasters', () => {
  it('detects a shared phone regardless of formatting (last 9 digits)', async () => {
    const existing = await Master.create({
      name: 'Existing',
      status: 'approved',
      contacts: [phone('+39 333 1234567')],
    });

    const dups = await findDuplicateMasters([phone('0039-333-12-345-67')]);
    expect(dups.map((d) => String(d._id))).toEqual([String(existing._id)]);
  });

  it('detects a shared telegram handle case-insensitively', async () => {
    const existing = await Master.create({
      name: 'Existing',
      status: 'pending',
      contacts: [tg('@MajstrOlena')],
    });

    const dups = await findDuplicateMasters([tg('t.me/majstrolena')]);
    expect(dups.map((d) => String(d._id))).toEqual([String(existing._id)]);
  });

  it('excludes drafts by default', async () => {
    await Master.create({ name: 'Draft', status: 'draft', contacts: [phone('+39 333 1234567')] });
    expect(await findDuplicateMasters([phone('+39 333 1234567')])).toEqual([]);
  });

  it('honours a custom status whitelist', async () => {
    await Master.create({ name: 'Draft', status: 'draft', contacts: [phone('+39 333 1234567')] });
    const dups = await findDuplicateMasters([phone('+39 333 1234567')], { statuses: ['draft'] });
    expect(dups).toHaveLength(1);
  });

  it('excludes the given id (self, on edit)', async () => {
    const self = await Master.create({
      name: 'Self',
      status: 'approved',
      contacts: [phone('+39 333 1234567')],
    });
    expect(
      await findDuplicateMasters([phone('+39 333 1234567')], { excludeId: self._id })
    ).toEqual([]);
  });

  it('returns [] when contacts produce no usable keys', async () => {
    expect(await findDuplicateMasters([])).toEqual([]);
    expect(await findDuplicateMasters([phone('123')])).toEqual([]); // too short
  });
});

describe('summarizeDuplicate', () => {
  it('produces the compact API shape', async () => {
    const m = await Master.create({
      name: 'Олена',
      status: 'approved',
      professionID: 'seamstress',
      locationID: 'milan',
      claimable: true,
      contacts: [phone('+39 333 1234567')],
    });

    expect(summarizeDuplicate(m)).toEqual({
      id: String(m._id),
      name: 'Олена',
      professionID: 'seamstress',
      locationID: 'milan',
      status: 'approved',
      source: 'self_submitted',
      claimable: true,
      contacts: [{ contactType: 'phone', value: '+39 333 1234567' }],
    });
  });
});
