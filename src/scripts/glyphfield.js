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
  // Recent pointer samples, each { x, y, s } with s decaying 1 -> 0. They give
  // the cursor a subtle trace: a fading tail of disturbed glyphs behind it.
  const trail = [];

  // Active settled words. Each: { text, col, row, born, life } in ms-phases.
  const words = [];
  let lastSpawn = 0;
  let t = 0; // accumulated seconds, drives drift + phases

  // Idle glyph alphabet: faint texture from ramp low end + dots.
  const IDLE = [GLYPHS.ramp[1], GLYPHS.ramp[2], GLYPHS.ramp[3], GLYPHS.ramp[4],
                GLYPHS.dots[0], GLYPHS.dots[5]];
  // Agitation scramble: lively but LIGHT, so the cursor wake stays at the
  // field's own weight. The solid blocks (#, ░, ▒, ▓) are dropped on purpose;
  // a glyph with heavy ink coverage reads dark even at a faint colour.
  const CHURN = GLYPHS.noise.filter((g) => !'#░▒▓'.includes(g));

  // Text keep-out. Grid rects covering the hero's real headline, paragraph and
  // buttons. Settled WORDS never spawn or render inside them, so the readable
  // copy is never sat under a decoded word (the worst on a phone, where the copy
  // fills the screen). The faint idle texture still drifts everywhere; only the
  // words are held out. Remeasured on resize and after the webfont swaps in.
  let keepOut = [];
  function measureKeepOut() {
    const hero = canvas.closest('.hero');
    if (!hero || !cw || !ch) { keepOut = []; return; }
    const cr = canvas.getBoundingClientRect();
    const padX = cw, padY = ch * 0.75;     // a little breathing room around the copy
    const next = [];
    hero.querySelectorAll('.hero__claim, .hero__sub, .hero__intro, .hero__cta').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      next.push({
        c0: Math.floor((r.left   - cr.left - originX - padX) / cw),
        c1: Math.ceil( (r.right  - cr.left - originX + padX) / cw),
        r0: Math.floor((r.top    - cr.top  - originY - padY) / ch),
        r1: Math.ceil( (r.bottom - cr.top  - originY + padY) / ch),
      });
    });
    keepOut = next;
  }
  // True if a word of length n at (col,row) would touch any keep-out rect.
  function hitsKeepOut(col, row, n) {
    for (const k of keepOut) {
      if (row >= k.r0 && row <= k.r1 && col <= k.c1 && col + n - 1 >= k.c0) return true;
    }
    return false;
  }

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
      measureKeepOut();       // the copy reflowed; refresh the no-word zone
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
      if (hitsKeepOut(col, row, n)) continue;   // never under the real copy / buttons
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
    // Subtle "develops in" reveal: the field fades up over the first ~1.1s.
    const intro = Math.min(1, t / 1.1);

    // Cells owned by a live word. The idle pass skips them so the word REPLACES
    // the character underneath instead of overprinting a second glyph on it.
    const occupied = new Set();
    for (const w of words) {
      for (let k = 0; k < w.text.length; k++) occupied.add((w.col + k) + ',' + w.row);
    }

    // Pointer-active region: a bounding box around the live cursor and its
    // trail, padded by the largest radius. The per-cell agitation work below
    // only runs inside it, so a still or absent cursor costs almost nothing.
    let axMin = Infinity, axMax = -Infinity, ayMin = Infinity, ayMax = -Infinity;
    if (pX >= 0) {
      const ext = 232;
      axMin = pX - ext; axMax = pX + ext; ayMin = pY - ext; ayMax = pY + ext;
      for (let i = 0; i < trail.length; i++) {
        const p = trail[i];
        if (p.s <= 0.02) continue;
        if (p.x - ext < axMin) axMin = p.x - ext;
        if (p.x + ext > axMax) axMax = p.x + ext;
        if (p.y - ext < ayMin) ayMin = p.y - ext;
        if (p.y + ext > ayMax) ayMax = p.y + ext;
      }
    }

    // First pass: the idle field. The cursor disturbs the glyphs that are
    // ALREADY there and sprinkles only a few new ones at the field's edge, so
    // the wake follows the real distribution instead of stamping a solid disk.
    for (let r = 0; r < rows; r++) {
      const cy = originY + r * ch + ch / 2;
      for (let c = 0; c < cols; c++) {
        if (occupied.has(c + ',' + r)) continue;
        const cx = originX + c * cw;
        const ccx = cx + cw / 2;

        // Cursor agitation, only for cells inside the active box. The radius is
        // not a clean circle: a per-cell noise wobble breaks it into soft lobes
        // that morph slowly, and a decaying trail trails the moving cursor.
        let agi = 0;
        if (pX >= 0 && ccx >= axMin && ccx <= axMax && cy >= ayMin && cy <= ayMax) {
          const wob = 0.72 + 0.46 * noise(ccx * 0.011 + driftT, cy * 0.011 - driftT);
          const R = 188 * wob;
          agi = falloff(Math.hypot(ccx - pX, cy - pY), R) * (0.5 + 0.5 * wake);
          for (let i = 0; i < trail.length; i++) {
            const p = trail[i];
            if (p.s <= 0.02) continue;
            const a = falloff(Math.hypot(ccx - p.x, cy - p.y), R * 0.82) * p.s * 0.55;
            if (a > agi) agi = a;
          }
        }

        // Background density: a smooth mask, denser on the right. A cell that is
        // present holds an idle glyph at rest.
        const mask = noise(c * 0.16 + 11, r * 0.16 + driftT);
        const rightBias = (c < calmCol ? 0.26 : 0.52) * (mobile ? 0.62 : 1);
        const present = mask <= rightBias;

        // What the cursor does here:
        //  - present cell: agitate the glyph that is already there.
        //  - empty cell : sprinkle only a few, biased toward the field's edge
        //    and only close to the cursor, so the field thickens rather than a
        //    blob appearing in dead space. Never a fill.
        let summon = 0;
        if (present) {
          summon = agi;
        } else if (agi > 0.3) {
          const edge = 1 - Math.min(1, (mask - rightBias) / 0.28); // 1 at edge -> 0 deep empty
          const sparkle = noise(c * 0.73 + 31, r * 0.73 + driftT * 1.4);
          if (sparkle > 0.86 - 0.18 * agi - 0.16 * edge) summon = agi * 0.6;
        }
        if (!present && summon <= 0) continue;

        // Character drifts with noise; agitation churns it faster (the glitch).
        const churn = noise(c * 0.3, r * 0.3 + driftT * 2 + summon * 4);
        const glyph = (summon > 0.15)
          ? CHURN[(churn * CHURN.length) | 0]
          : IDLE[(churn * IDLE.length) | 0];

        // Colour stays in the SAME brightness band as the idle field. The cursor
        // reads through the churning character and a gentle accent tint, NOT by
        // darkening, so the wake sits at the field's own weight. Opacity is the
        // idle opacity, never lifted.
        const baseC = mixHex(pal.inkFaint, pal.inkSoft, 0.2 + churn * 0.42);
        const col = summon > 0.04 ? mixHex(baseC, pal.accent, 0.22 * summon) : baseC;
        ctx.globalAlpha = intro;
        ctx.fillStyle = col;
        ctx.fillText(glyph, cx, cy);
      }
    }
    ctx.globalAlpha = 1;

    // Second pass: settled words on top, so they read clearly.
    for (let i = words.length - 1; i >= 0; i--) {
      const w = words[i];
      const ph = wordPhase(t - w.born);
      if (!ph.alive) { words.splice(i, 1); continue; }
      // If a late reflow (webfont swap, resize) moved the copy under this word,
      // drop it rather than render a word over the text.
      if (hitsKeepOut(w.col, w.row, w.text.length)) { words.splice(i, 1); continue; }
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
        ctx.globalAlpha = intro;
        ctx.fillStyle = mixHex(pal.inkFaint, dark, Math.min(1, weight));
        ctx.fillText(glyph, cx, cy);
      }
    }
    ctx.globalAlpha = 1;
  }

  // --- Pointer wake (skip on touch, where hover is meaningless) -------------
  // Listen on the whole hero, not the canvas: the headline + copy (hero__inner)
  // sit ABOVE the canvas, so a listener on the canvas never fires over the text.
  // Listening on the hero section catches the pointer everywhere and we map it to
  // the canvas box, so the wake follows the cursor across the entire hero.
  const surface = canvas.closest('.hero') || canvas;
  const onMove = (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    pX = x; pY = y; wake = 1;
    // Drop a fresh trail sample once the cursor has moved a little, so a fast
    // sweep leaves a spread-out tail and a slow drift leaves a short one.
    const last = trail.length ? trail[trail.length - 1] : null;
    if (!last || Math.hypot(x - last.x, y - last.y) > 13) {
      trail.push({ x, y, s: 1 });
      if (trail.length > 18) trail.shift();
    }
  };
  const onLeave = () => { pX = -1; pY = -1; trail.length = 0; };
  let pointerWired = false;
  function wirePointer() {
    if (pointerWired || (matchMedia && matchMedia('(pointer: coarse)').matches)) return;
    surface.addEventListener('pointermove', onMove, { passive: true });
    surface.addEventListener('pointerleave', onLeave, { passive: true });
    pointerWired = true;
  }

  let stop = () => {};

  // --- Reduced motion: one settled frame, no loop ---------------------------
  if (prefersReducedMotion()) {
    const settle = () => {
      measureKeepOut();
      words.length = 0;
      t = 4.2;                 // a moment where idle texture is present
      spawnWord(); spawnWord(); spawnWord(); spawnWord();
      // force one of them to be accent + mid-hold so the frame reads finished
      for (const w of words) { w.born = t - 1.4; }
      if (words.length && !words.some((w) => w.accent)) words[0].accent = true;
      draw();
    };
    settle();
    // The webfont reflows the copy after first paint; re-settle so words clear it.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(settle);
    return () => { dispose(); };
  }

  // --- Animated: gate startup on visibility ---------------------------------
  onVisible(canvas, () => {
    wirePointer();
    measureKeepOut();
    // The hero copy reflows when the webfont swaps in; re-measure so words clear it.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureKeepOut);
    stop = rafLoop((dt) => {
      const sec = dt / 1000;
      t += sec;
      // wake decays toward calm over ~0.8s
      wake = Math.max(0, wake - sec / 0.8);
      // trail samples fade over ~0.55s; the oldest (front) expires first.
      for (let i = 0; i < trail.length; i++) trail[i].s -= sec / 0.55;
      while (trail.length && trail[0].s <= 0) trail.shift();
      // spawn cadence: a new word attempt every ~2.4s, staggered
      if (t - lastSpawn > 1.0) { lastSpawn = t; spawnWord(); }
      draw();
    }, { fps: 30 });
  });

  return () => {
    stop();
    dispose();
    if (pointerWired) {
      surface.removeEventListener('pointermove', onMove);
      surface.removeEventListener('pointerleave', onLeave);
    }
  };
}