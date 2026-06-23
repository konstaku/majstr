import { describe, it, expect } from 'vitest';

const { buildOriginPolicy } = require('../../app');

describe('CORS buildOriginPolicy', () => {
  it('allows the apex and every https majstr.xyz subdomain (no env edit needed)', () => {
    const allow = buildOriginPolicy(['https://majstr.xyz']);
    for (const o of [
      'https://majstr.xyz',
      'https://www.majstr.xyz',
      'https://app.majstr.xyz',
      'https://fr.majstr.xyz',
      'https://it.majstr.xyz',
    ]) {
      expect(allow(o), o).toBe(true);
    }
  });

  it('rejects look-alikes, suffix attacks, and non-https majstr origins', () => {
    const allow = buildOriginPolicy(['https://majstr.xyz']);
    for (const o of [
      'http://fr.majstr.xyz', // not https
      'https://majstr.xyz.evil.com', // suffix attack
      'https://evilmajstr.xyz', // no dot boundary
      'https://fr.majstr.xyz.attacker.io',
      'https://notmajstr.xyz',
    ]) {
      expect(allow(o), o).toBe(false);
    }
  });

  it('still honours explicit off-domain origins in the list (dev/preview)', () => {
    const allow = buildOriginPolicy(['http://localhost:3000', 'https://majstr.xyz']);
    expect(allow('http://localhost:3000')).toBe(true);
    expect(allow('https://some-preview.vercel.app')).toBe(false);
  });

  it('with "*" allows everything; with no origin returns false', () => {
    expect(buildOriginPolicy(['*'])('https://anything.example')).toBe(true);
    expect(buildOriginPolicy(['https://majstr.xyz'])(undefined)).toBe(false);
  });
});
