/* =============================================================================
   collapse.js — the build-cost collapse, as an ASCII bar chart
   -----------------------------------------------------------------------------
   The page's thesis in one quiet figure: one small tool went from days to an
   afternoon. Two monospace columns of block glyphs on the light panel.

     LAST YEAR  a tall stack in --ink     ("3 days")
     NOW        a short stack in --accent ("an afternoon")

   On reveal the tall column starts full and erodes from the top, row by row,
   while the short accent column builds up fast. Once both settle it idles with
   an occasional single-cell glyph swap so it stays alive without being busy.

   Reduced motion: one settled frame, no loop.
============================================================================= */
import {
  fitCanvas, cellMetrics, rafLoop, readPalette, mixHex,
  GLYPHS, onVisible, prefersReducedMotion, mulberry32,
} from './glyph-core.js';

const FONT = "'IBM Plex Mono', ui-monospace, monospace";

/* The two facts the figure states. Heights are in glyph rows; the gap between
   them is the whole point, so keep the contrast wide. */
const TALL_ROWS = 13;   // LAST YEAR — dwarfs the other
const SHORT_ROWS = 3;   // NOW — an afternoon

export function initCollapse(canvas) {
  const fontPx = 15;          // panel cell size; legible, not loud
  const leading = 1.18;       // row pitch multiplier for the block stacks
  const rng = mulberry32(0x0c0a5e);

  let pal = readPalette();
  let cell = { w: 9, h: fontPx };
  let W = 0, H = 0;

  // Layout, recomputed on every resize. Two columns centred on the panel,
  // each a vertical run of cells with a label row beneath, sitting on a
  // shared baseline rule.
  let layout = null;

  // Per-bar animation state. fill = how many rows are currently drawn.
  const bars = {
    left:  { rows: TALL_ROWS,  color: () => pal.ink,    fill: 0, target: 0 },
    right: { rows: SHORT_ROWS, color: () => pal.accent, fill: 0, target: 0 },
  };

  let started = false;        // reveal animation kicked off
  let idle = false;           // both bars have settled

  // Own context up front: fitCanvas runs onResize synchronously, so a ctx
  // destructured from its return value would be in the temporal dead zone.
  const ctx = canvas.getContext('2d');

  const { resize, dispose } = fitCanvas(canvas, {
    onResize: (cssW, cssH) => {
      W = cssW; H = cssH;
      cell = cellMetrics(ctx, fontPx, FONT);
      relayout();
      draw();
    },
  });

  function relayout() {
    const rowH = cell.h * leading;
    const marginX = Math.max(cell.w * 3, W * 0.10);
    const baseY = H - rowH * 2.2;          // room for two label rows below
    // Column x-centres: left third and right third of the usable width.
    const usable = W - marginX * 2;
    const leftX = marginX + usable * 0.30;
    const rightX = marginX + usable * 0.70;
    layout = { rowH, baseY, leftX, rightX, marginX };
  }

  // Draw the whole figure at the current fill state.
  function draw() {
    if (!layout) return;
    pal = readPalette();
    ctx.clearRect(0, 0, W, H);
    ctx.font = `${fontPx}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    baselineRule();
    drawBar('left', bars.left);
    drawBar('right', bars.right);
    labels();
  }

  // A faint horizontal rule the bars sit on, in box-drawing glyphs.
  function baselineRule() {
    const { baseY, marginX } = layout;
    const y = baseY + layout.rowH * 0.5;
    const dash = GLYPHS.box[0];            // '─'
    const span = W - marginX * 2;
    const n = Math.max(1, Math.floor(span / cell.w));
    ctx.save();
    ctx.fillStyle = pal.inkFaint;
    ctx.textAlign = 'left';
    let s = '';
    for (let i = 0; i < n; i++) s += dash;
    ctx.fillText(s, marginX, y);
    ctx.restore();
  }

  // One vertical stack of block glyphs, growing upward from the baseline.
  // Lower cells use the heavier blocks, the cap row a lighter one, so the
  // erosion reads as the top crumbling away.
  function drawBar(key, bar) {
    const { baseY, rowH } = layout;
    const x = key === 'left' ? layout.leftX : layout.rightX;
    const drawn = Math.round(bar.fill);
    if (drawn <= 0) return;
    const base = bar.color();
    for (let i = 0; i < drawn; i++) {
      const y = baseY - i * rowH;
      // weight: solid block low, partial near the cap for a settling texture
      const fromTop = drawn - 1 - i;
      let g = GLYPHS.blocks[3];            // '█'
      if (fromTop === 0) g = GLYPHS.blocks[2];        // '▓' cap
      else if (fromTop === 1) g = GLYPHS.blocks[3];
      // idle shimmer: the swapped cell carries its glyph in `shimmer`
      if (idle && shimmer.key === key && shimmer.row === i) g = shimmer.glyph;
      // gentle vertical fade so the tall column doesn't read as a heavy slab
      const t = i / Math.max(1, bar.rows - 1);
      ctx.fillStyle = key === 'left'
        ? mixHex(toHex(base, pal.ink), toHex(pal.paper2, pal.paper2), t * 0.10)
        : base;
      ctx.fillText(g, x, y);
    }
  }

  // Column captions and the two figures, in soft ink beneath each bar.
  function labels() {
    const { baseY, rowH, leftX, rightX } = layout;
    const capY = baseY + rowH * 1.15;
    const valY = baseY + rowH * 2.15;
    ctx.save();
    ctx.font = `${Math.round(fontPx * 0.8)}px ${FONT}`;
    ctx.textAlign = 'center';

    ctx.fillStyle = pal.inkSoft;
    ctx.fillText('LAST YEAR', leftX, capY);
    ctx.fillStyle = pal.accent;
    ctx.fillText('NOW', rightX, capY);

    ctx.font = `${Math.round(fontPx * 0.72)}px ${FONT}`;
    ctx.fillStyle = pal.inkSoft;
    ctx.fillText('3 days', leftX, valY);
    ctx.fillText('an afternoon', rightX, valY);
    ctx.restore();
  }

  // mixHex wants #rrggbb; readPalette may hand back rgb()/named strings, so
  // fall back to the second arg (a known hex) when the first isn't usable.
  function toHex(maybe, fallback) {
    return (typeof maybe === 'string' && /^#[0-9a-f]{6}$/i.test(maybe))
      ? maybe : fallback;
  }

  // ---- reveal + idle ------------------------------------------------------

  // Idle shimmer: which single cell is currently swapped to a noise glyph.
  const shimmer = { key: null, row: -1, glyph: '█', until: 0 };

  function start() {
    if (started) return;
    started = true;

    if (prefersReducedMotion()) {
      // One settled frame: both bars full, no animation.
      bars.left.fill = TALL_ROWS;
      bars.right.fill = SHORT_ROWS;
      idle = true;
      draw();
      return;
    }

    // Begin with the tall column at full height (it will erode) and the short
    // column empty (it will build).
    bars.left.fill = TALL_ROWS;
    bars.left.target = SHORT_ROWS + 5;     // erodes down to a clear-but-tall stop
    bars.right.fill = 0;
    bars.right.target = SHORT_ROWS;

    let t = 0;
    const stop = rafLoop((dt) => {
      t += dt;
      // Right column snaps up fast in the first ~500ms.
      bars.right.fill = Math.min(
        bars.right.target,
        bars.right.fill + (dt / 1000) * 9,
      );
      // Left column erodes from the top, a little slower, with a held beat at
      // the start so the full height registers before it falls.
      if (t > 350) {
        bars.left.fill = Math.max(
          bars.left.target,
          bars.left.fill - (dt / 1000) * 7,
        );
      }
      const settled =
        bars.right.fill >= bars.right.target - 0.01 &&
        bars.left.fill <= bars.left.target + 0.01;
      draw();
      if (settled) {
        bars.left.fill = bars.left.target;
        bars.right.fill = bars.right.target;
        idle = true;
        stop();
        runIdle();
      }
    }, { fps: 24 });
  }

  // Once settled, swap a single random cell to a noise glyph now and then.
  // One cell at a time, brief, mostly silence between swaps.
  function runIdle() {
    if (prefersReducedMotion()) return;
    let acc = 0;
    let next = 1400 + rng() * 2200;        // ms until the next swap
    rafLoop((dt) => {
      acc += dt;
      const now = acc;
      if (shimmer.row >= 0 && now >= shimmer.until) {
        shimmer.key = null; shimmer.row = -1;
        draw();
      }
      if (shimmer.row < 0 && now >= next) {
        // pick a cell on either settled column, away from the very base
        const onLeft = rng() < 0.5;
        const bar = onLeft ? bars.left : bars.right;
        const rows = Math.round(bar.fill);
        if (rows > 1) {
          shimmer.key = onLeft ? 'left' : 'right';
          shimmer.row = 1 + ((rng() * (rows - 1)) | 0);
          shimmer.glyph = GLYPHS.noise[(rng() * GLYPHS.noise.length) | 0];
          shimmer.until = now + 220 + rng() * 180;
          draw();
        }
        next = now + 1600 + rng() * 2600;
      }
    }, { fps: 24 });
  }

  // ---- wiring -------------------------------------------------------------

  // Settle correct sizing, then gate the reveal to first on-screen.
  resize();
  onVisible(canvas, start);

  return {
    dispose() { dispose(); },
  };
}
