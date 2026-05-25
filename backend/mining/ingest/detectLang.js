'use strict';

// Coarse language hint stored on RawMessage. Deliberately cheap and
// dependency-free — this is only a routing/analytics hint. The real
// language-aware understanding happens in the M2 classifier, not here.
//
// Buckets: 'uk' | 'ru' | 'other' | null
//   - Cyrillic with Ukrainian-specific letters (і ї є ґ) -> 'uk'
//   - Cyrillic without them -> 'ru' (rough; good enough for a hint)
//   - mostly Latin / unknown -> 'other'
//   - no letters -> null
function detectLang(text) {
  if (!text || typeof text !== 'string') return null;
  let cyr = 0;
  let lat = 0;
  for (const ch of text) {
    if (/[Ѐ-ӿ]/.test(ch)) cyr += 1;
    else if (/[A-Za-zÀ-ɏ]/.test(ch)) lat += 1;
  }
  if (cyr === 0 && lat === 0) return null;
  if (cyr >= lat) return /[іїєґІЇЄҐ]/.test(text) ? 'uk' : 'ru';
  return 'other';
}

module.exports = { detectLang };
