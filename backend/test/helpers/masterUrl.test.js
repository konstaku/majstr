import { describe, it, expect } from 'vitest';

const { slugify, masterSlug, masterWebUrl } = require('../../helpers/masterUrl');

describe('slugify', () => {
  it('transliterates Ukrainian/Cyrillic to latin', () => {
    expect(slugify('Олена Швачка')).toBe('olena-shvachka');
    expect(slugify('Сергій')).toBe('serhiy');
    expect(slugify('Щука')).toBe('shchuka');
  });

  it('collapses punctuation and trims dashes', () => {
    expect(slugify('  --Hello,   World!--  ')).toBe('hello-world');
    expect(slugify('a+b=c')).toBe('a-b-c');
  });

  it('handles empty/nullish input', () => {
    expect(slugify('')).toBe('');
    expect(slugify(null)).toBe('');
    expect(slugify(undefined)).toBe('');
  });
});

describe('masterSlug', () => {
  const master = {
    _id: { toString: () => '64b1234567890abcdefe9876' },
    name: 'Олена',
    professionID: 'seamstress',
    locationID: 'milan',
  };

  it('combines name, profession, location and the id suffix', () => {
    expect(masterSlug(master)).toBe('olena-seamstress-milan-fe9876');
  });

  it('falls back to "master" when the name slugifies to nothing', () => {
    expect(masterSlug({ ...master, name: '!!!' })).toBe('master-seamstress-milan-fe9876');
  });
});

describe('masterWebUrl', () => {
  const master = {
    _id: { toString: () => '64b1234567890abcdefe9876' },
    name: 'Олена',
    professionID: 'seamstress',
    locationID: 'milan',
  };

  it('uses /ru for Russian UI language', () => {
    expect(masterWebUrl(master, 'ru', 'https://majstr.xyz')).toBe(
      'https://majstr.xyz/ru/m/olena-seamstress-milan-fe9876'
    );
  });

  it.each(['uk', 'en', 'it', undefined])('falls back to /uk for %s', (lang) => {
    expect(masterWebUrl(master, lang, 'https://majstr.xyz')).toMatch('https://majstr.xyz/uk/m/');
  });
});
