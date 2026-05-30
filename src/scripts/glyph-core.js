/* =============================================================================
   glyph-core.js — shared generative substrate for tools.kindl.work
   -----------------------------------------------------------------------------
   No external dependencies. One small module every generative piece imports, so
   the whole page speaks one visual language: same glyph sets, same seeded noise,
   same motion discipline, same palette read from CSS custom properties.

   House rules for anything built on top of this:
   - Vanilla JS. No frameworks, no canvas libs.
   - Always honor prefers-reduced-motion: render one settled frame, no loop.
   - Read colour from readPalette(), never hard-code hex. The palette lives in
     tokens.css so a theme change is one file.
   - Pause work when the element is off-screen or the tab is hidden.
   - Monospace only. Measure the cell with cellMetrics(); never assume px.
============================================================================= */

/* ---------- Glyph sets -----------------------------------------------------
   ramp  : luminance ladder, light -> dark. Index a 0..1 value into it.
   blocks: partial-fill blocks for dither / weight.
   noise : the scramble alphabet a cell cycles through before it "settles".
   box   : box-drawing, for rules, frames, margins.
   dots  : sparse punctuation for idle / negative space.                       */
export const GLYPHS = {
  ramp:   [' ', '.', '·', ':', '-', '=', '+', '*', '#', '%', '@'],
  blocks: ['░', '▒', '▓', '█'],
  noise:  ['/', '\\', '|', '_', '-', '=', '+', '<', '>', '[', ']', '{', '}',
           '(', ')', '·', '.', ':', '*', '#', '░', '▒', '▓', '┤', '┐', '└',
           '┴', '┬', '├', '─', '┼', 'k', 'i', 'n', 'd', 'l', '0', '1'],
  box:    ['─', '│', '┌', '┐', '└', '┘', '├', '┤', '┬', '┴', '┼'],
  dots:   ['·', '∴', '∵', '⋮', '⋯', '°'],
};

/* Words the catalog / field can settle into. Tool shorthands + the claim.
   Kept short so they fit a cell row. */
export const WORDS = [
  'PLOT', 'GEN', 'STAGE', 'PATCH', 'OSC', 'POSE', 'BOM', 'WIRING', 'RIDER',
  'CALC', 'EDICE', 'TRIAGE', 'CODEX', 'FORGE', 'PRESET', 'CUE', 'SACN',
  'PIXEL', 'MAP', 'IDENTITY', 'POSTER', 'INVOICE', 'CATALOG', 'TOOL',
  'OKO', 'MIDI', 'DMX', 'LIDAR', 'MESH', 'GRID', 'SIGNAL', 'SENSOR',
  'LAYOUT', 'RENDER', 'MASK', 'FLOW', 'TRACE', 'LOOP', 'SHADER', 'VERTEX',
  'GLYPH', 'MOTION', 'VECTOR', 'RASTER', 'HUE', 'CUSTOM', 'FIT', 'BUILD',
  'TUNE', 'SCAN', 'PROBE', 'PARSE', 'EXPORT', 'DRAFT', 'SHIP',
];

/* ---------- Seeded randomness ----------------------------------------------
   mulberry32: deterministic 32-bit PRNG. Same seed -> same sequence, so a
   reload reproduces a layout when we want it to, and varies when we don't.   */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- Value noise (2D, optional time) --------------------------------
   Cheap smooth noise on a hashed lattice. Returns 0..1. Good enough for
   drifting fields; not simplex, but stable and dependency-free.              */
export function makeNoise2D(seed = 1337) {
  const rng = mulberry32(seed);
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + t * (b - a);
  const grad = (h, x, y) => {
    // hashed unit-ish gradient
    const u = (h & 1) ? x : -x;
    const v = (h & 2) ? y : -y;
    return u + v;
  };
  return function (x, y) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);
    const aa = perm[perm[X] + Y];
    const ab = perm[perm[X] + Y + 1];
    const ba = perm[perm[X + 1] + Y];
    const bb = perm[perm[X + 1] + Y + 1];
    const x1 = lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u);
    const x2 = lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u);
    // map roughly to 0..1
    return (lerp(x1, x2, v) + 1) / 2;
  };
}

/* ---------- Motion discipline ---------------------------------------------- */
export function prefersReducedMotion() {
  return typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* rafLoop(fn, {fps}) -> stop()
   Calls fn(dt, t) on a frame-rate-capped loop. Auto-pauses when the document
   is hidden, resumes on return. Never runs under reduced motion (caller should
   render one settled frame instead).                                          */
export function rafLoop(fn, { fps = 60 } = {}) {
  if (prefersReducedMotion()) { return () => {}; }
  let raf = 0;
  let last = performance.now();
  let acc = 0;
  const frame = 1000 / fps;
  let running = true;
  const tick = (now) => {
    if (!running) return;
    raf = requestAnimationFrame(tick);
    const dt = now - last;
    last = now;
    acc += dt;
    if (acc < frame) return;
    acc = acc % frame;
    fn(dt, now);
  };
  const onVis = () => {
    if (document.hidden) { running = false; cancelAnimationFrame(raf); }
    else if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(tick); }
  };
  document.addEventListener('visibilitychange', onVis);
  raf = requestAnimationFrame(tick);
  return () => { running = false; cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', onVis); };
}

/* onVisible(el, cb): fire cb once when el first enters the viewport. Falls back
   to immediate call when IntersectionObserver is missing.                     */
export function onVisible(el, cb, { rootMargin = '0px 0px -10% 0px' } = {}) {
  if (typeof IntersectionObserver !== 'function') { cb(); return () => {}; }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { cb(); io.unobserve(e.target); }
    }
  }, { threshold: 0.12, rootMargin });
  io.observe(el);
  return () => io.disconnect();
}

/* ---------- Canvas helpers -------------------------------------------------- */
/* fitCanvas(canvas) -> { ctx, resize, dispose }
   DPR-aware sizing bound to the element's box. resize() re-reads the box; it is
   also wired to a ResizeObserver and window resize. onResize callback fires
   after each (re)size with (cssW, cssH, dpr).                                  */
export function fitCanvas(canvas, { onResize } = {}) {
  const ctx = canvas.getContext('2d');
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (onResize) onResize(w, h, dpr);
  };
  resize();
  const ro = ('ResizeObserver' in window) ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(canvas);
  else window.addEventListener('resize', resize, { passive: true });
  const dispose = () => { if (ro) ro.disconnect(); else window.removeEventListener('resize', resize); };
  return { ctx, resize, dispose, get dpr() { return dpr; } };
}

/* cellMetrics(ctx, fontPx, family) -> { w, h }
   Measures a monospace cell at the given size. h is line height (fontPx * 1.0
   advance; callers usually pad). Sets ctx.font as a side effect.              */
export function cellMetrics(ctx, fontPx, family = "'IBM Plex Mono', monospace") {
  ctx.font = `${fontPx}px ${family}`;
  ctx.textBaseline = 'middle';
  const m = ctx.measureText('M');
  const w = m.width;
  const h = fontPx; // monospace rows; caller multiplies for leading
  return { w, h };
}

/* ---------- Palette --------------------------------------------------------
   Read brand colours from CSS custom properties on :root so JS and CSS never
   drift. Returns resolved colour strings.                                     */
export function readPalette(el = document.documentElement) {
  const s = getComputedStyle(el);
  const get = (name, fallback) => (s.getPropertyValue(name).trim() || fallback);
  return {
    paper:    get('--paper', '#f4f1ea'),
    paper2:   get('--paper-2', '#ebe7dd'),
    ink:      get('--ink', '#17150f'),
    inkSoft:  get('--ink-soft', '#6b6657'),
    inkFaint: get('--ink-faint', '#c4bfb1'),
    inkGhost: get('--ink-ghost', '#d7d1c2'),
    night:      get('--night', '#100f14'),
    nightFaint: get('--night-faint', '#3a3947'),
    accent:   get('--accent', '#362cca'),
    accentSoft: get('--accent-soft', 'rgba(54,44,202,0.12)'),
  };
}

/* Small util: clamp + map a value to a glyph from a ramp. */
export function rampGlyph(value01, ramp = GLYPHS.ramp) {
  const v = value01 < 0 ? 0 : value01 > 1 ? 1 : value01;
  return ramp[Math.min(ramp.length - 1, (v * ramp.length) | 0)];
}

/* Mix two hex colours (a,b) by t (0..1). Both must be #rrggbb. */
export function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
  const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bl})`;
}
