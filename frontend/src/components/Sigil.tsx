/**
 * Sigil — deterministic generative pattern used as a master's portrait
 * fallback when no photo exists. Same seed → same sigil, always.
 *
 * Spec & visual reference: `design mockups/sigil-generator.html`.
 * Algorithm: FNV-1a 32-bit hash of `seed|size`  →  Mulberry32 PRNG  →
 * fill-count → cell selection (partial Fisher–Yates) → per-cell shape,
 * rotation, and terra accent assignment.
 *
 * Brand rules respected here:
 *   · cell is 1:1, sigil canvas is 1:1
 *   · square = cell-sided, circle = cell-diameter, triangle = equilateral
 *     (side = cell), bar = exact 1:3 ratio
 *   · uniform gutter (5.5% of canvas) around and between cells, so no
 *     shape ever touches another shape or the outer edge
 *   · ink (#0E0A06) primary, terra (#C84B31) accent
 */

const INK   = "#0E0A06";
const TERRA = "#C84B31";
const PAPER = "#FFFAF0";

type Shape = "square" | "circle" | "triangle" | "bar";

type Cell = {
  idx: number;
  row: number;
  col: number;
  shape: Shape;
  rotation: number;
  color: string;
};

/** FNV-1a 32-bit. Stable, deterministic, no dependencies. */
function fnv1a(str: string): number {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Mulberry32 PRNG seeded by a 32-bit integer. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const randInt = (r: () => number, max: number) => Math.floor(r() * max);

type SigilSpec = {
  size: 3 | 4;
  fillCount: number;
  cells: Cell[];
};

function buildSigil(seed: string, size: 3 | 4): SigilSpec {
  const total = size * size;
  // 4×4: 6–10 (37.5%–62.5%);  3×3: 4–6 (44%–67%) — comparable visual density
  const minFill = size === 4 ? 6 : 4;
  const maxFill = size === 4 ? 10 : 6;

  // include grid size in the hash → same seed renders DIFFERENT sigils
  // at 3×3 vs 4×4 (not zoomed versions of each other)
  const rnd = mulberry32(fnv1a(seed + "|" + size));

  const fillCount = minFill + randInt(rnd, maxFill - minFill + 1);

  // partial Fisher–Yates over the cell index list — pick K of N
  const indices = Array.from({ length: total }, (_, i) => i);
  for (let i = 0; i < fillCount; i++) {
    const j = i + randInt(rnd, total - i);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const filled = indices.slice(0, fillCount);

  // terra accent — 18–36% of filled cells, minimum 1
  const targetTerra = Math.max(1, Math.round(fillCount * (0.18 + rnd() * 0.18)));
  const filledShuf = filled.slice();
  for (let i = filledShuf.length - 1; i > 0; i--) {
    const j = randInt(rnd, i + 1);
    [filledShuf[i], filledShuf[j]] = [filledShuf[j], filledShuf[i]];
  }
  const terraSet = new Set(filledShuf.slice(0, targetTerra));

  const SHAPES: Shape[] = ["square", "circle", "triangle", "bar"];
  const cells: Cell[] = filled.map((idx) => ({
    idx,
    row: Math.floor(idx / size),
    col: idx % size,
    shape: SHAPES[randInt(rnd, SHAPES.length)],
    rotation: randInt(rnd, 4),
    color: terraSet.has(idx) ? TERRA : INK,
  }));

  return { size, fillCount, cells };
}

type SigilProps = {
  /** Stable identifier — e.g. master._id. Required. */
  seed: string;
  /** Grid edge. Defaults to 3 — that's the site-wide variant. */
  size?: 3 | 4;
  /** Render a paper background rect inside the SVG (default true). */
  background?: boolean;
  className?: string;
};

export default function Sigil({
  seed,
  size = 3,
  background = true,
  className,
}: SigilProps) {
  const spec = buildSigil(seed || "?", size);

  // viewBox uses unitless 100×100 — SVG scales to whatever the container is.
  const VB   = 100;
  const gap  = VB * 0.055;   // also = outer pad → uniform breathing room
  const pad  = gap;
  const cell = (VB - pad * 2 - gap * (size - 1)) / size;

  const elements: React.ReactNode[] = [];

  for (const c of spec.cells) {
    const x  = pad + c.col * (cell + gap);
    const y  = pad + c.row * (cell + gap);
    const cx = x + cell / 2;
    const cy = y + cell / 2;
    const key = String(c.idx);

    if (c.shape === "square") {
      elements.push(
        <rect key={key} x={x} y={y} width={cell} height={cell} fill={c.color} />
      );
    } else if (c.shape === "circle") {
      elements.push(
        <circle key={key} cx={cx} cy={cy} r={cell / 2} fill={c.color} />
      );
    } else if (c.shape === "triangle") {
      // equilateral, side = cell; height = cell·√3/2; bbox centered on (cx,cy)
      const rot = c.rotation * 90;
      const s   = cell;
      const h   = cell * Math.sqrt(3) / 2;
      const pts = `${cx},${cy - h / 2} ${cx + s / 2},${cy + h / 2} ${cx - s / 2},${cy + h / 2}`;
      elements.push(
        <polygon
          key={key}
          points={pts}
          fill={c.color}
          transform={`rotate(${rot} ${cx} ${cy})`}
        />
      );
    } else {
      // bar — exact 1:3 (thick = cell/3, length = cell)
      const thick = cell / 3;
      const horizontal = c.rotation % 2 === 0;
      if (horizontal) {
        elements.push(
          <rect key={key} x={x} y={cy - thick / 2} width={cell} height={thick} fill={c.color} />
        );
      } else {
        elements.push(
          <rect key={key} x={cx - thick / 2} y={y} width={thick} height={cell} fill={c.color} />
        );
      }
    }
  }

  return (
    <svg
      className={`sigil${className ? " " + className : ""}`}
      viewBox={`0 0 ${VB} ${VB}`}
      preserveAspectRatio="xMidYMid meet"
      shapeRendering="geometricPrecision"
      aria-hidden="true"
    >
      {background && <rect width={VB} height={VB} fill={PAPER} />}
      {elements}
    </svg>
  );
}
