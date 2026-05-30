/* =============================================================================
   v4.js - "SCHEMATIC"
   -----------------------------------------------------------------------------
   The studio as an engineering sheet. Three jobs, all cheap:

   1. STROKE-DRAW. Each inline SVG schematic has hairline paths (.v4-d). On first
      reveal (IntersectionObserver), the lines draw themselves: each path's true
      length sets stroke-dasharray + an initial stroke-dashoffset, then a class
      animates the offset to 0 (the transition lives in v4.css). A small per-path
      stagger reads like a plotter laying lines in sequence. Dots and labels fade
      in after the lines settle (handled in CSS via .is-drawn).

   2. LIVE CROSSHAIR. Over the hero only, a fixed crosshair tracks the pointer
      and a Krapka readout shows the X / Y coordinate of the cursor on the sheet.
      Pure transforms, throttled to rAF, removed on touch / small screens.

   3. REV STAMP. The title block REV cell ticks A, B, C as you scroll the sheet,
      a quiet sign that the drawing is being read.

   Reduced motion: every stroke is set fully drawn immediately (dashoffset 0, no
   transition), the crosshair stays off, the rev stamp is set once. No loops.

   House rule: no em dashes or en dashes anywhere, including comments.
============================================================================= */

import { prefersReducedMotion, onVisible } from '../glyph-core.js';

const reduce = prefersReducedMotion();

/* ---------------------------------------------------------------------------
   1. STROKE-DRAW
--------------------------------------------------------------------------- */
function initDraw() {
  const svgs = document.querySelectorAll('.v4-svg[data-draw]');
  if (!svgs.length) return;

  svgs.forEach((svg) => {
    const paths = svg.querySelectorAll('.v4-d');

    // measure each path and prime its dash. getTotalLength is exact; the
    // data-len attribute is a cheap fallback for engines that throw on it
    // (some do for <rect>/<polyline> in odd states).
    const lens = [];
    paths.forEach((p) => {
      let len = 0;
      try {
        if (typeof p.getTotalLength === 'function') len = p.getTotalLength();
      } catch (e) { /* fall through to the hint */ }
      if (!len || !isFinite(len)) len = parseFloat(p.getAttribute('data-len')) || 120;
      lens.push(len);
      p.style.strokeDasharray = len + ' ' + len;
      p.style.strokeDashoffset = reduce ? '0' : String(len);
    });

    if (reduce) {
      // one settled, complete state, no animation
      svg.classList.add('is-drawn');
      return;
    }

    // draw when the figure first scrolls into view
    onVisible(svg, () => {
      // a small stagger so lines lay down in sequence like a plotter
      paths.forEach((p, i) => {
        const delay = Math.min(i * 55, 900);
        p.style.transitionDelay = delay + 'ms';
        // next frame, release the offset so the transition runs
        requestAnimationFrame(() => {
          requestAnimationFrame(() => { p.style.strokeDashoffset = '0'; });
        });
      });
      svg.classList.add('is-drawn');
    });
  });
}

/* ---------------------------------------------------------------------------
   2. LIVE CROSSHAIR over the hero
--------------------------------------------------------------------------- */
function initCrosshair() {
  if (reduce) return;
  // a real pointer affordance only; skip on coarse / small pointers
  const fine = typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches;
  if (!fine || window.innerWidth < 600) return;

  const cross = document.querySelector('[data-crosshair]');
  const hero = document.querySelector('[data-hero]');
  const read = document.querySelector('[data-cross-read]');
  if (!cross || !hero) return;

  let raf = 0;
  let px = 0, py = 0;
  let over = false;

  const apply = () => {
    raf = 0;
    cross.style.setProperty('--cx', px + 'px');
    cross.style.setProperty('--cy', py + 'px');
    if (read) {
      // a measured readout: sheet-relative coordinates in "mm" (1px = 0.1mm),
      // tabular so the digits do not jitter
      const r = hero.getBoundingClientRect();
      const x = Math.max(0, (px - r.left) * 0.1);
      const y = Math.max(0, (py - r.top) * 0.1);
      read.textContent = 'X ' + x.toFixed(1).padStart(5, '0') + '  Y ' + y.toFixed(1).padStart(5, '0');
    }
  };
  const queue = () => { if (!raf) raf = requestAnimationFrame(apply); };

  const onMove = (e) => {
    px = e.clientX; py = e.clientY;
    const r = hero.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (inside !== over) {
      over = inside;
      cross.classList.toggle('is-on', over);
    }
    if (over) queue();
  };

  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerleave', () => { over = false; cross.classList.remove('is-on'); }, { passive: true });
}

/* ---------------------------------------------------------------------------
   3. REV STAMP ticks with scroll depth
--------------------------------------------------------------------------- */
function initRev() {
  const rev = document.querySelector('[data-rev]');
  if (!rev) return;
  const letters = ['A', 'B', 'C', 'D', 'E'];

  if (reduce) { rev.textContent = 'A'; return; }

  let queued = false;
  let last = 'A';
  const update = () => {
    queued = false;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    const idx = Math.min(letters.length - 1, Math.floor(p * letters.length));
    const next = letters[idx];
    if (next !== last) { rev.textContent = next; last = next; }
  };
  window.addEventListener('scroll', () => {
    if (!queued) { queued = true; requestAnimationFrame(update); }
  }, { passive: true });
  update();
}

/* ---------------------------------------------------------------------------
   boot
--------------------------------------------------------------------------- */
function boot() {
  initDraw();
  initCrosshair();
  initRev();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
