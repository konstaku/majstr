import { describe, it, expect } from 'vitest';

const { localizedName } = require('../../lang');

describe('localizedName', () => {
  it('returns the requested language when present', () => {
    expect(localizedName({ en: 'Plumber', it: 'Idraulico' }, 'it', 'id')).toBe('Idraulico');
  });

  it('falls back requested → en → uk', () => {
    expect(localizedName({ en: 'Plumber', uk: 'Сантехнік' }, 'de', 'id')).toBe('Plumber');
    expect(localizedName({ uk: 'Сантехнік' }, 'de', 'id')).toBe('Сантехнік');
  });

  it('treats uk and ua as aliases in both directions', () => {
    expect(localizedName({ ua: 'Сантехнік' }, 'uk', 'id')).toBe('Сантехнік');
    expect(localizedName({ uk: 'Сантехнік' }, 'ua', 'id')).toBe('Сантехнік');
  });

  it('returns any non-empty name before resorting to the fallback id', () => {
    expect(localizedName({ tr: 'Tesisatçı' }, 'uk', 'plumber')).toBe('Tesisatçı');
  });

  it('ignores blank strings', () => {
    expect(localizedName({ en: '   ', uk: 'Сантехнік' }, 'en', 'id')).toBe('Сантехнік');
  });

  it('returns the fallback id for empty or non-object input', () => {
    expect(localizedName({}, 'uk', 'plumber')).toBe('plumber');
    expect(localizedName(null, 'uk', 'plumber')).toBe('plumber');
    expect(localizedName('Plumber', 'uk', 'plumber')).toBe('plumber');
    expect(localizedName(null, 'uk')).toBe('');
  });
});
