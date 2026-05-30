/* =============================================================================
   generator-demo.js — one template, every version, on the spot
   -----------------------------------------------------------------------------
   The interactive proof of the thesis next to it: a generator makes the
   repeating part instantly, on brand. A responsive grid of small abstract
   "marks" (mini posters / identities) shares ONE construction rule, so they
   read as a family; each cell is a deterministic variation seeded from its
   index plus a global batch seed. Move the pointer across the figure and two
   global parameters shift (x -> accent-vs-ink balance + glyph skew of the
   marks, y -> density / structure), and every cell regenerates live: every
   version of the work, the moment you ask. Idle, the parameters drift slowly
   on value-noise so the grid keeps breathing. Click / tap re-seeds the whole
   batch into a fresh family.

   Built on glyph-core.js only. Monospace measured via cellMetrics. Colour read
   from readPalette (ink + accent + paper, nothing else). Honors reduced motion
   (one settled, varied batch, no loop) and gates startup on visibility.
============================================================================= */
import {
  fitCanvas, cellMetrics, makeNoise2D, mulberry32, rafLoop,
  readPalette, mixHex, rampGlyph, prefersReducedMotion, onVisible, GLYPHS,
} from './glyph-core.js';

const FONT = "'IBM Plex Mono', ui-monospace, monospace";

/* Short, brand-ish labels for the marks. Two or three chars so they sit on one
   row of a small cell and read as an identity tag, not a word. */
const LABELS = [
  'GEN', 'KW', 'OKO', 'AV', 'LED', 'OSC', 'MAP', 'DMX', 'POS', 'CUE',
  'BOM', 'TD', 'PX', 'RIG', 'SCN', 'IDN', 'STG', 'KIT', 'EDI', 'FX',
];

export function initGeneratorDemo(canvas) {
  // Two independent noise fields: one drifts the global params when idle, one
  // gives each mark a little internal life that varies across the family.
  const driftNoise = makeNoise2D(20260530);
  const markNoise = makeNoise2D(404);

  // Grab our own context up front. fitCanvas runs resize()/onResize
  // synchronously, so a ctx destructured from its return value would be in the
  // temporal dead zone when onResize first fires. This const is initialized
  // before fitCanvas is called.
  const ctx = canvas.getContext('2d');

  let pal = readPalette();

  // Layout, rebuilt on every resize.
  let viewW = 0, viewH = 0;        // css px of the canvas box
  let gx = 0, gy = 0;              // grid columns / rows of marks
  let cellW = 0, cellH = 0;        // size of one mark cell in css px
  let originX = 0, originY = 0;    // margin so the grid is centered
  let fontPx = 13;                 // glyph size inside a mark
  let gw = 0, gh = 0;              // monospace cell advance / line height
  // Inner-mark layout, written by layout(). Declared BEFORE fitCanvas (which
  // runs onResize -> layout synchronously) so they are not in the temporal
  // dead zone when the first resize fires.
  let innerPad = 8, markCols = 5, markRows = 4;

  // Global generator parameters, 0..1. paramX is the accent-vs-ink + skew dial,
  // paramY is the density / structure dial. The whole point: these two move and
  // the entire family re-renders. Idle they drift; pointer takes over on move.
  let paramX = 0.42, paramY = 0.5;

  // Pointer state. pointerOn is true while a pointer drives the params; on leave
  // the idle drift resumes. Works without any pointer at all (stays idle).
  let pointerOn = false;
  let targetX = paramX, targetY = paramY;   // pointer goal, eased toward
  let t = 0;                                 // accumulated seconds, drives drift
  let batchSeed = (Math.random() * 1e9) | 0; // re-rolled on click / tap

  const { dispose } = fitCanvas(canvas, {
    onResize: (cssW, cssH) => {
      pal = readPalette();
      viewW = cssW;
      viewH = cssH;
      layout();
    },
  });

  /* Choose a grid that lands between ~4x2 and ~6x3 depending on width, with
     square-ish cells, then measure the monospace glyph that fits a cell. */
  function layout() {
    const margin = Math.round(Math.min(viewW, viewH) * 0.06);
    const innerW = Math.max(40, viewW - margin * 2);
    const innerH = Math.max(40, viewH - margin * 2);

    // Columns scale with width (4 narrow .. 6 wide); rows with height (2 .. 3).
    gx = viewW < 420 ? 4 : viewW < 640 ? 5 : 6;
    gy = viewH < 260 ? 2 : 3;

    cellW = innerW / gx;
    cellH = innerH / gy;
    originX = Math.round((viewW - cellW * gx) / 2);
    originY = Math.round((viewH - cellH * gy) / 2);

    // A mark uses a small inner monospace grid. Size the glyph so ~5-7 columns
    // and ~4-6 rows of glyphs fit a cell with a little padding.
    const pad = Math.max(6, Math.round(Math.min(cellW, cellH) * 0.16));
    const usableW = cellW - pad * 2;
    const usableH = cellH - pad * 2;
    // Aim for 6 glyph columns across the usable width; clamp to a legible range.
    fontPx = Math.max(9, Math.min(16, Math.floor(usableW / 6)));
    const m = cellMetrics(ctx, fontPx, FONT);
    gw = m.w;
    gh = Math.round(fontPx * 1.18);
    // store derived inner-grid bounds on closure vars used by drawMark
    innerPad = pad;
    markCols = Math.max(3, Math.floor(usableW / gw));
    markRows = Math.max(3, Math.floor(usableH / gh));
  }

  /* Draw one mark into its cell. Every mark runs the SAME template:
       - a baseline of weight blocks whose density follows paramY,
       - one accent stroke (column or diagonal) whose presence follows paramX,
       - a 2-3 char label tag pinned to a corner.
     Per-cell variety comes only from the cell's own seeded RNG + markNoise, so
     the family stays coherent while no two cells match. */
  function drawMark(cellIndex, x0, y0) {
    // Deterministic per-cell RNG: index + batch seed. Same inputs -> same mark.
    const rng = mulberry32((cellIndex * 2654435761 + batchSeed) >>> 0);

    // Per-cell constants drawn once, so the mark has a stable "personality"
    // that the two global dials then modulate.
    const seedA = rng();                 // structure phase
    const seedB = rng();                 // accent placement
    const label = LABELS[(rng() * LABELS.length) | 0];
    const accentMode = rng();            // <.5 vertical stroke, else diagonal
    const labelCorner = (rng() * 4) | 0; // which corner the tag pins to

    // Global dials -> local behaviour.
    // density: how filled the mark is (paramY), nudged per cell so the family
    // breathes unevenly rather than in lockstep.
    const density = 0.18 + paramY * 0.62 + (seedA - 0.5) * 0.18;
    // skew: glyph row offset that leans the mark (paramX), small and tasteful.
    const skew = (paramX - 0.5) * 1.8;
    // accentBalance: how much of the mark tips toward the studio blue (paramX).
    const accentBalance = 0.12 + paramX * 0.7;

    const baseX = x0 + innerPad;
    const baseY = y0 + innerPad;

    // The accent stroke position within the mark, stable per cell.
    const strokeCol = 1 + ((seedB * (markCols - 2)) | 0);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `${fontPx}px ${FONT}`;

    for (let r = 0; r < markRows; r++) {
      // skew shifts each row horizontally a little; lower rows lean more.
      const rowShift = Math.round(skew * (r - (markRows - 1) / 2));
      const cy = baseY + r * gh + gh / 2;
      for (let c = 0; c < markCols; c++) {
        // Weight field for this glyph: structured noise unique to the cell,
        // gated by the global density dial. Above the gate -> a weighted glyph.
        const n = markNoise(
          (cellIndex * 3.1 + c) * 0.55 + seedA * 7,
          (cellIndex * 1.7 + r) * 0.55 + seedB * 5
        );
        const onStroke = (c === strokeCol);

        let glyph = null;
        let weight = 0;     // 0..1 ink darkness
        let useAccent = false;

        if (onStroke && accentMode < 0.5) {
          // vertical accent stroke: present in proportion to paramX.
          if (n < accentBalance + 0.25) {
            glyph = GLYPHS.blocks[Math.min(3, (1 + n * 3) | 0)];
            weight = 0.85;
            useAccent = true;
          }
        } else if (accentMode >= 0.5 && c === ((r + (seedB * markCols) | 0) % markCols)) {
          // diagonal accent: a moving column down the rows.
          if (n < accentBalance + 0.2) {
            glyph = GLYPHS.blocks[Math.min(3, (1 + n * 3) | 0)];
            weight = 0.85;
            useAccent = true;
          }
        }

        if (glyph === null) {
          // body of the mark: dithered weight blocks / ramp under the density
          // gate, otherwise empty paper. This is the bulk of the family look.
          if (n < density) {
            // pick block weight by how far below the gate we are -> a gradient.
            const w = 1 - n / Math.max(0.001, density);
            if (w > 0.66) glyph = GLYPHS.blocks[3];
            else if (w > 0.4) glyph = GLYPHS.blocks[2];
            else if (w > 0.18) glyph = GLYPHS.blocks[1];
            else glyph = rampGlyph(0.4 + w, GLYPHS.ramp);
            weight = 0.35 + w * 0.5;
          }
        }

        if (glyph === null || glyph === ' ') continue;

        const cx = baseX + c * gw + rowShift;
        // Colour: ink for the body, accent for the stroke. The accent dial also
        // tints a few body glyphs toward blue so x reads as a hue shift overall.
        let colHex;
        if (useAccent) {
          colHex = mixHex(pal.ink, pal.accent, 0.55 + accentBalance * 0.4);
        } else {
          const tint = accentBalance * 0.32 * n;   // faint blue lift on body
          const body = mixHex(pal.inkSoft, pal.ink, weight);
          colHex = mixHex(body, pal.accent, tint);
        }
        ctx.fillStyle = colHex;
        ctx.fillText(glyph, cx, cy);
      }
    }

    // Label tag: 2-3 chars pinned to a corner, always legible ink so each mark
    // reads as a finished little identity rather than only texture.
    drawLabel(label, x0, y0, labelCorner);
  }

  /* The small mono label in one corner of a cell. */
  function drawLabel(label, x0, y0, corner) {
    const lpx = Math.max(8, Math.round(fontPx * 0.82));
    ctx.font = `${lpx}px ${FONT}`;
    ctx.textBaseline = 'middle';
    const text = label;
    const tw = ctx.measureText(text).width;
    const inset = Math.max(5, innerPad - 1);
    const left = (corner === 0 || corner === 2);
    const top = (corner === 0 || corner === 1);
    ctx.textAlign = left ? 'left' : 'right';
    const tx = left ? x0 + inset : x0 + cellW - inset;
    const ty = top ? y0 + inset + lpx / 2 : y0 + cellH - inset - lpx / 2;
    // a hair of accent on the tag so the brand-blue is always somewhere present.
    ctx.fillStyle = mixHex(pal.ink, pal.accent, 0.22 + paramX * 0.25);
    ctx.fillText(text, tx, ty);
    // keep the measured width from being treated as dead (lint-friendly no-op).
    void tw;
  }

  /* One full pass: clear to the panel colour, draw a hairline grid, then every
     mark for the current params. A 6x3 grid of small marks at 30fps is cheap. */
  function draw() {
    ctx.fillStyle = pal.paper2;
    ctx.fillRect(0, 0, viewW, viewH);

    // Hairline separation between cells. Faint ink, single device pixel.
    ctx.strokeStyle = mixHex(pal.inkGhost, pal.inkFaint, 0.5);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 1; c < gx; c++) {
      const x = Math.round(originX + c * cellW) + 0.5;
      ctx.moveTo(x, originY);
      ctx.lineTo(x, originY + gy * cellH);
    }
    for (let r = 1; r < gy; r++) {
      const y = Math.round(originY + r * cellH) + 0.5;
      ctx.moveTo(originX, y);
      ctx.lineTo(originX + gx * cellW, y);
    }
    ctx.stroke();

    // The marks: one shared template, every cell a seeded variation.
    for (let r = 0; r < gy; r++) {
      for (let c = 0; c < gx; c++) {
        const idx = r * gx + c;
        const x0 = originX + c * cellW;
        const y0 = originY + r * cellH;
        drawMark(idx, x0, y0);
      }
    }
  }

  // --- Pointer drives the params; without one, idle drift owns them ----------
  const setFromEvent = (e) => {
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) / Math.max(1, rect.width);
    const py = (e.clientY - rect.top) / Math.max(1, rect.height);
    targetX = Math.min(1, Math.max(0, px));
    targetY = Math.min(1, Math.max(0, py));
    pointerOn = true;
  };
  const onMove = (e) => { setFromEvent(e); };
  const onLeave = () => { pointerOn = false; };
  const onDown = (e) => {
    // Re-seed the whole batch: a fresh family on tap / click.
    batchSeed = (Math.random() * 1e9) | 0;
    setFromEvent(e);
    // Redraw immediately so a tap feels instant even under reduced motion.
    draw();
  };

  canvas.addEventListener('pointermove', onMove, { passive: true });
  canvas.addEventListener('pointerleave', onLeave, { passive: true });
  canvas.addEventListener('pointercancel', onLeave, { passive: true });
  canvas.addEventListener('pointerdown', onDown, { passive: true });

  let stop = () => {};

  // --- Reduced motion: one settled, varied batch, no loop -------------------
  // Pointer move / tap still re-seed and redraw (cheap, single pass), but no
  // animation loop ever starts.
  if (prefersReducedMotion()) {
    // A pleasant settled mid-pose: a little accent, mid density.
    paramX = 0.5;
    paramY = 0.46;
    draw();
    // Under reduced motion we still let a tap reshuffle, redraw on move so the
    // params follow the pointer one frame at a time without animating.
    const rmMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      paramX = Math.min(1, Math.max(0, (e.clientX - rect.left) / Math.max(1, rect.width)));
      paramY = Math.min(1, Math.max(0, (e.clientY - rect.top) / Math.max(1, rect.height)));
      draw();
    };
    canvas.addEventListener('pointermove', rmMove, { passive: true });
    return () => {
      dispose();
      canvas.removeEventListener('pointermove', rmMove);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('pointercancel', onLeave);
      canvas.removeEventListener('pointerdown', onDown);
    };
  }

  // --- Animated: gate startup on visibility ---------------------------------
  onVisible(canvas, () => {
    stop = rafLoop((dt) => {
      const sec = dt / 1000;
      t += sec;

      if (pointerOn) {
        // Ease the live params toward the pointer goal so motion stays smooth.
        paramX += (targetX - paramX) * Math.min(1, sec * 9);
        paramY += (targetY - paramY) * Math.min(1, sec * 9);
      } else {
        // Idle: drift the two dials on slow value-noise so the family breathes.
        const dx = driftNoise(t * 0.06, 11.0);
        const dy = driftNoise(31.0, t * 0.05);
        // ease toward the drift target rather than snapping, keeps it gentle.
        paramX += (dx - paramX) * Math.min(1, sec * 0.8);
        paramY += (dy - paramY) * Math.min(1, sec * 0.8);
      }

      draw();
    }, { fps: 30 });
  });

  return () => {
    stop();
    dispose();
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerleave', onLeave);
    canvas.removeEventListener('pointercancel', onLeave);
    canvas.removeEventListener('pointerdown', onDown);
  };
}