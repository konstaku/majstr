'use strict';

/**
 * Sigil — deterministic generative pattern used as a master's portrait
 * fallback when no photo exists.
 *
 * This is the Node-canvas twin of `frontend/src/components/Sigil.tsx`.
 * Same hash, same PRNG, same shape rules — so the OG image for master
 * `m12` is the exact same pattern the browser draws on cards & modals.
 *
 * Reference: `design mockups/sigil-generator.html`.
 */

// Brand colors — keep in sync with the React component
const INK   = '#0E0A06';
const TERRA = '#C84B31';
const PAPER = '#FFFAF0';

/** FNV-1a 32-bit. Stable, deterministic, no dependencies. */
function fnv1a(str) {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Mulberry32 PRNG seeded by a 32-bit integer. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const randInt = (r, max) => Math.floor(r() * max);

/**
 * Build a deterministic sigil specification from a seed.
 *
 * @param {string} seed  Stable identifier (master._id).
 * @param {3|4}    size  Grid edge. 3 is the site-wide variant.
 * @returns {{size:number, fillCount:number, cells:Array}}
 */
function buildSigil(seed, size = 3) {
  const total = size * size;
  // 4×4: 6–10 (37.5%–62.5%);  3×3: 4–6 (44%–67%) — comparable visual density
  const minFill = size === 4 ? 6 : 4;
  const maxFill = size === 4 ? 10 : 6;

  // include grid size in the hash → 3×3 and 4×4 of the same seed render
  // different sigils (not zoomed versions of each other)
  const rnd = mulberry32(fnv1a(String(seed) + '|' + size));

  const fillCount = minFill + randInt(rnd, maxFill - minFill + 1);

  // partial Fisher–Yates — pick K of N cells
  const indices = Array.from({ length: total }, (_, i) => i);
  for (let i = 0; i < fillCount; i++) {
    const j = i + randInt(rnd, total - i);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const filled = indices.slice(0, fillCount);

  // terra accent — 18%–36% of filled cells, minimum 1
  const targetTerra = Math.max(1, Math.round(fillCount * (0.18 + rnd() * 0.18)));
  const filledShuf = filled.slice();
  for (let i = filledShuf.length - 1; i > 0; i--) {
    const j = randInt(rnd, i + 1);
    [filledShuf[i], filledShuf[j]] = [filledShuf[j], filledShuf[i]];
  }
  const terraSet = new Set(filledShuf.slice(0, targetTerra));

  const SHAPES = ['square', 'circle', 'triangle', 'bar'];
  const cells = filled.map((idx) => ({
    idx,
    row: Math.floor(idx / size),
    col: idx % size,
    shape: SHAPES[randInt(rnd, SHAPES.length)],
    rotation: randInt(rnd, 4),
    color: terraSet.has(idx) ? TERRA : INK,
  }));

  return { size, fillCount, cells };
}

/**
 * Draw a sigil onto a node-canvas 2D context.
 *
 * Shapes are geometrically regular:
 *   · square   = cell-sided
 *   · circle   = cell-diameter
 *   · triangle = equilateral, side = cell
 *   · bar      = exact 1:3 (thick = cell/3, length = cell)
 *
 * Uniform 5.5% gutter so no shape touches another shape or the outer edge.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} seed
 * @param {number} x   top-left x of the sigil block (canvas px)
 * @param {number} y   top-left y of the sigil block (canvas px)
 * @param {number} px  edge length of the sigil block (canvas px)
 * @param {{size?: 3|4, background?: boolean}} [opts]
 */
function drawSigilOnCanvas(ctx, seed, x, y, px, opts = {}) {
  const { size = 3, background = true } = opts;
  const spec = buildSigil(seed, size);

  const gap  = px * 0.055;
  const pad  = gap;
  const cell = (px - pad * 2 - gap * (size - 1)) / size;

  if (background) {
    ctx.fillStyle = PAPER;
    ctx.fillRect(x, y, px, px);
  }

  for (const c of spec.cells) {
    const cellX = x + pad + c.col * (cell + gap);
    const cellY = y + pad + c.row * (cell + gap);
    const cx = cellX + cell / 2;
    const cy = cellY + cell / 2;
    ctx.fillStyle = c.color;

    if (c.shape === 'square') {
      ctx.fillRect(cellX, cellY, cell, cell);

    } else if (c.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(cx, cy, cell / 2, 0, Math.PI * 2);
      ctx.fill();

    } else if (c.shape === 'triangle') {
      // equilateral; rotate around (cx, cy) for 0/90/180/270°
      const s = cell;
      const h = (cell * Math.sqrt(3)) / 2;
      const rot = (c.rotation * Math.PI) / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.moveTo(0, -h / 2);
      ctx.lineTo(s / 2, h / 2);
      ctx.lineTo(-s / 2, h / 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

    } else if (c.shape === 'bar') {
      const thick = cell / 3;
      const horizontal = c.rotation % 2 === 0;
      if (horizontal) {
        ctx.fillRect(cellX, cy - thick / 2, cell, thick);
      } else {
        ctx.fillRect(cx - thick / 2, cellY, thick, cell);
      }
    }
  }
}

module.exports = { buildSigil, drawSigilOnCanvas, INK, TERRA, PAPER };
