/* =============================================================================
   glyphfield.js — the self-assembling glyph field (hero centerpiece)
   -----------------------------------------------------------------------------
   A coarse monospace grid over the full-bleed hero canvas. Idle: a sparse,
   low-contrast texture of drifting glyphs on warm paper. Every couple of
   seconds a WORD settles into a free region on the right two thirds, decodes
   from noise into letters, holds, then dissolves back. The pointer agitates a
   local radius and leaves a decaying wake.

   Built on glyph-core.js only. Monospace measured via cellMetrics. Colour read
   from readPalette / CSS custom props. Honors reduced motion (one settled frame,
   no loop) and gates startup on visibility.
============================================================================= */
import {
  fitCanvas, cellMetrics, makeNoise2D, rafLoop, readPalette, mixHex,
  rampGlyph, prefersReducedMotion, onVisible, GLYPHS, WORDS,
} from './glyph-core.js';

const FONT = "'IBM Plex Mono', ui-monospace, monospace";

export function initGlyphField(canvas) {
  const noise = makeNoise2D(20260530);   // drifting character field
  const wordNoise = makeNoise2D(7);       // decode scramble per word cell

  // Grid + palette state, rebuilt on every resize.
  let pal = readPalette();
  let cols = 0, rows = 0;        // grid dimensions
  let cw = 0, ch = 0;            // cell width / row height in css px
  let originX = 0, originY = 0;  // top-left padding so the grid is centered
  let calmCol = 0;               // columns left of this stay quiet (headline zone)
  let mobile = false;            // narrow viewport: sparser, words kept low
  const fontPx = 15;

  // Pointer wake. pX/pY in css px, -1 when absent; wake decays toward 0.
  let pX = -1, pY = -1, wake = 0;

  // Active settled words. Each: { text, col, row, born, life } in ms-phases.
  const words = [];
  let lastSpawn = 0;
  let t = 0; // accumulated seconds, drives drift + phases

  // Idle glyph alphabet: faint texture from ramp low end + dots.
  const IDLE = [GLYPHS.ramp[1], GLYPHS.ramp[2], GLYPHS.ramp[3], GLYPHS.ramp[4],
                GLYPHS.dots[0], GLYPHS.dots[5]];

  // Grab our own 2D context up front. fitCanvas runs resize()/onResize
  // synchronously, so a ctx destructured from its return value would be in the
  // temporal dead zone when onResize first fires. This const is initialized first.
  const ctx = canvas.getContext('2d');

  const { dispose } = fitCanvas(canvas, {
    onResize: (cssW, cssH) => {
      pal = readPalette();
      const m = cellMetrics(ctx, fontPx, FONT);
      cw = m.w;
      ch = Math.round(fontPx * 1.18);     // a touch of leading
      cols = Math.max(1, Math.floor(cssW / cw));
      rows = Math.max(1, Math.floor(cssH / ch));
      // center the grid in the leftover sub-cell space
      originX = Math.round((cssW - cols * cw) / 2);
      originY = Math.round((cssH - rows * ch) / 2);
      // Headline sits over the left third; keep roughly the left 38% calm.
      calmCol = Math.round(cols * 0.38);
      mobile = cssW < 720;    // on phones the headline is full width
      words.length = 0;       // stale placements no longer fit the grid
      lastSpawn = 0;
    },
  });

  // Smooth falloff (smoothstep) for the cursor radius, 1 at center -> 0 at edge.
  const falloff = (d, r) => {
    if (d >= r) return 0;
    const x = 1 - d / r;
    return x * x * (3 - 2 * x);
  };

  /* Find a free region on the right two thirds for a word of length n.
     Avoids the calm headline columns and any cell already owned by a live
     word (plus a one-cell margin). Returns {col,row} or null. */
  function placeWord(n) {
    // Desktop: right two thirds, away from the headline columns. Mobile: any
    // column but only the lower half, so words never collide with the headline.
    const minCol = mobile ? 1 : Math.max(calmCol + 1, Math.round(cols * 0.40));
    const maxCol = cols - n - 1;
    if (maxCol < minCol) return null;
    const rowStart = mobile ? Math.floor(rows * 0.5) : 1;
    const rowSpan = Math.max(1, rows - rowStart - 1);
    for (let tries = 0; tries < 32; tries++) {
      const col = minCol + Math.floor(Math.random() * (maxCol - minCol + 1));
      const row = rowStart + Math.floor(Math.random() * rowSpan);
      let clear = true;
      for (const w of words) {
        if (Math.abs(w.row - row) > 1) continue;
        // overlap test on the spanned columns, padded by one cell
        if (col - 1 <= w.col + w.text.length && col + n + 1 >= w.col) {
          clear = false; break;
        }
      }
      if (clear) return { col, row };
    }
    return null;
  }

  function spawnWord() {
    if (words.length >= (mobile ? 4 : 6)) return;
    const text = WORDS[(Math.random() * WORDS.length) | 0];
    const spot = placeWord(text.length);
    if (!spot) return;
    // Up to two accent words at once, for a livelier field.
    const accentCount = words.filter((w) => w.accent).length;
    words.push({
      text,
      col: spot.col,
      row: spot.row,
      born: t,
      accent: accentCount < 2 && Math.random() < 0.4,
    });
  }

  // Phase envelope for a settled word: 0 idle -> 1 fully formed.
  // 500ms fade in, 2200ms hold, 600ms dissolve. Returns {decode, ink} where
  // decode 0..1 is how "locked" the letters are and ink 0..1 is darkness.
  function wordPhase(age) {
    const IN = 0.4, HOLD = 2.4, OUT = 0.6;
    if (age < IN) { const p = age / IN; return { decode: p, ink: p, alive: true }; }
    if (age < IN + HOLD) return { decode: 1, ink: 1, alive: true };
    if (age < IN + HOLD + OUT) {
      const p = 1 - (age - IN - HOLD) / OUT;
      return { decode: p, ink: p, alive: true };
    }
    return { decode: 0, ink: 0, alive: false };
  }

  /* Draw the whole grid for the current time. Single full-redraw; a coarse grid
     at 30fps is cheap and keeps the code legible. */
  function draw() {
    const cssW = cols * cw + originX;
    const cssH = rows * ch + originY;
    // Clear to paper.
    ctx.fillStyle = pal.paper;
    ctx.fillRect(0, 0, cssW + cw, cssH + ch);
    ctx.font = `${fontPx}px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    const driftT = t * 0.26;

    // First pass: idle field.
    for (let r = 0; r < rows; r++) {
      const cy = originY + r * ch + ch / 2;
      for (let c = 0; c < cols; c++) {
        // Sparse: a smooth mask gates which cells show a glyph at all.
        const mask = noise(c * 0.16 + 11, r * 0.16 + driftT);
        // Calmer on the left (headline zone), denser to the right.
        const rightBias = (c < calmCol ? 0.26 : 0.52) * (mobile ? 0.62 : 1);
        if (mask > rightBias) continue;

        const cx = originX + c * cw;

        // Pointer agitation: distance from this cell's center to the pointer.
        let agi = 0;
        if (pX >= 0) {
          const dx = cx + cw / 2 - pX;
          const dy = cy - pY;
          agi = falloff(Math.hypot(dx, dy), 156) * (0.55 + 0.45 * wake);
        }

        // Character drifts with noise; agitation churns it faster.
        const churn = noise(c * 0.3, r * 0.3 + driftT * 2 + agi * 4);
        let glyph;
        if (agi > 0.15) {
          // agitated cells pull from the scramble alphabet
          glyph = GLYPHS.noise[(churn * GLYPHS.noise.length) | 0];
        } else {
          glyph = IDLE[(churn * IDLE.length) | 0];
        }

        // Colour: faintest ghost ink, lifting toward ink/accent under the cursor.
        let col;
        if (agi > 0.04) {
          const base = mixHex(pal.inkGhost || pal.inkFaint, pal.ink, 0.55 * agi);
          col = mixHex(base, pal.accent, 0.5 * agi);
        } else {
          // idle: faint -> soft by the drift mask. Enough presence to read as a
          // living substrate of glyphs, still quiet behind the headline.
          col = mixHex(pal.inkFaint, pal.inkSoft, 0.2 + churn * 0.42);
        }
        ctx.fillStyle = col;
        ctx.fillText(glyph, cx, cy);
      }
    }

    // Second pass: settled words on top, so they read clearly.
    for (let i = words.length - 1; i >= 0; i--) {
      const w = words[i];
      const ph = wordPhase(t - w.born);
      if (!ph.alive) { words.splice(i, 1); continue; }
      const cy = originY + w.row * ch + ch / 2;
      for (let k = 0; k < w.text.length; k++) {
        const cx = originX + (w.col + k) * cw;
        // Decode: below the per-cell threshold the cell still scrambles.
        const settled = ph.decode > wordNoise(w.col + k + 3, w.row + driftT * 3);
        let glyph, weight;
        if (settled) {
          glyph = w.text[k];
          weight = ph.ink;
        } else {
          glyph = GLYPHS.noise[(noise(cx, cy + t) * GLYPHS.noise.length) | 0];
          weight = ph.ink * 0.6;
        }
        // Ink: faint -> dark ink, accent words tinted toward the studio blue.
        const dark = w.accent ? pal.accent : pal.ink;
        ctx.fillStyle = mixHex(pal.inkFaint, dark, Math.min(1, weight));
        ctx.fillText(glyph, cx, cy);
      }
    }
  }

  // --- Pointer wake (skip on touch, where hover is meaningless) -------------
  const onMove = (e) => {
    const rect = canvas.getBoundingClientRect();
    pX = e.clientX - rect.left;
    pY = e.clientY - rect.top;
    wake = 1;
  };
  const onLeave = () => { pX = -1; pY = -1; };
  let pointerWired = false;
  function wirePointer() {
    if (pointerWired || (matchMedia && matchMedia('(pointer: coarse)').matches)) return;
    canvas.addEventListener('pointermove', onMove, { passive: true });
    canvas.addEventListener('pointerleave', onLeave, { passive: true });
    pointerWired = true;
  }

  let stop = () => {};

  // --- Reduced motion: one settled frame, no loop ---------------------------
  if (prefersReducedMotion()) {
    t = 4.2;                 // a moment where idle texture is present
    spawnWord(); spawnWord(); spawnWord(); spawnWord();
    // force one of them to be accent + mid-hold so the frame reads finished
    for (const w of words) { w.born = t - 1.4; }
    if (words.length && !words.some((w) => w.accent)) words[0].accent = true;
    draw();
    return () => { dispose(); };
  }

  // --- Animated: gate startup on visibility ---------------------------------
  onVisible(canvas, () => {
    wirePointer();
    stop = rafLoop((dt) => {
      const sec = dt / 1000;
      t += sec;
      // wake decays toward calm over ~0.8s
      wake = Math.max(0, wake - sec / 0.8);
      // spawn cadence: a new word attempt every ~2.4s, staggered
      if (t - lastSpawn > 1.0) { lastSpawn = t; spawnWord(); }
      draw();
    }, { fps: 30 });
  });

  return () => {
    stop();
    dispose();
    if (pointerWired) {
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
    }
  };
}