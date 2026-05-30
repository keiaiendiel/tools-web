/* =============================================================================
   catalog.js — the decoding catalog
   -----------------------------------------------------------------------------
   The bench list, in the dark "machine room" section, assembles itself when it
   scrolls into view. Each line's name resolves left-to-right out of scramble
   noise into the real text, staggered down the list, like a readout locking in.

   Pure DOM text. No canvas. We only ever rewrite the .nm span's textContent (and
   briefly flicker the .tag), never the structure: the .who span and the authored
   spans are left exactly as the page rendered them.

   House rules honoured: colour and layout are CSS's job here; we just move text.
   Determinism via mulberry32 so a given line scrambles the same way every time.
   Under reduced motion we settle every name instantly and wire no animation.
============================================================================= */

import { GLYPHS, mulberry32, prefersReducedMotion, onVisible } from './glyph-core.js';

/* Timing, in ms. Kept short so the list reads as alive, not as a screensaver. */
const STAGGER   = 55;   // delay added per line on the reveal cascade
const DECODE_MS = 700;  // how long one line takes to fully lock on reveal
const HOVER_MS  = 350;  // shorter re-scramble when a settled line is hovered
const TAG_FLICK = 3;    // how many noise chars the .tag cycles before restoring
const FRAME_MS  = 1000 / 30; // 30fps text churn is plenty and easy on the CPU

const NOISE = GLYPHS.noise;

/* Pick a noise glyph from a seeded stream. Spaces stay spaces so word shape and
   line length never jump around while a name resolves. */
function scrambleChar(realCh, rnd) {
  if (realCh === ' ') return ' ';
  return NOISE[(rnd() * NOISE.length) | 0];
}

export function initCatalog(ul) {
  const items = Array.from(ul.querySelectorAll('li'));
  if (!items.length) return;

  /* Cache the truth for each line up front: the real name (from data-nm, the
     authored source), its .nm span, its .tag span and that tag's real text. We
     read data-nm rather than the span so a half-finished scramble can never be
     mistaken for the real value on a later pass. */
  const lines = items.map((li, i) => {
    const nm = li.querySelector('.nm');
    const tag = li.querySelector('.tag');
    const realName = li.getAttribute('data-nm') || (nm ? nm.textContent : '');
    return {
      i,
      nm,
      tag,
      realName,
      tagText: tag ? tag.textContent : '',
      rnd: mulberry32(i * 2654435761 + 1),
      anim: 0,   // active rAF handle for this line, for debouncing
    };
  }).filter((l) => l.nm);

  /* ---- reduced motion: one settled, legible frame, no loop, no listeners ---- */
  if (prefersReducedMotion()) {
    for (const l of lines) {
      l.nm.textContent = l.realName;
      if (l.tag) l.tag.textContent = l.tagText;
    }
    return;
  }

  /* Before reveal, blank the names so the assembly reads as an arrival rather
     than a flash-then-scramble. The .who and .tag spans are untouched. */
  for (const l of lines) l.nm.textContent = '';

  /* Run one decode pass on a line: characters lock left-to-right over `dur` ms,
     each unlocked slot showing fresh noise per frame. `flickerTag` adds the
     brief tag churn used on the first reveal. Self-debounces via line.anim:
     a new pass cancels the one in flight so rapid hovers never stack. */
  function decode(line, dur, { flickerTag = false } = {}) {
    if (line.anim) cancelAnimationFrame(line.anim);
    const real = line.realName;
    const n = real.length;
    const start = performance.now();
    let lastDraw = 0;

    const step = (now) => {
      const t = Math.min(1, (now - start) / dur);
      // throttle the visible churn; the final frame always draws exact text
      if (now - lastDraw >= FRAME_MS || t >= 1) {
        lastDraw = now;
        // number of characters locked to their real value so far
        const locked = Math.floor(t * n);
        let out = '';
        for (let c = 0; c < n; c++) {
          out += c < locked ? real[c] : scrambleChar(real[c], line.rnd);
        }
        line.nm.textContent = out;

        if (flickerTag && line.tag) {
          if (t >= 1) {
            line.tag.textContent = line.tagText; // restore exactly as authored
          } else if (line.tagText) {
            // cycle a couple of noise chars in place of the short tag word
            let tg = '';
            for (let c = 0; c < Math.min(TAG_FLICK, line.tagText.length); c++) {
              tg += NOISE[(line.rnd() * NOISE.length) | 0];
            }
            line.tag.textContent = tg;
          }
        }
      }

      if (t >= 1) {
        line.nm.textContent = real;            // end on the exact real text
        if (flickerTag && line.tag) line.tag.textContent = line.tagText;
        line.anim = 0;
        return;
      }
      line.anim = requestAnimationFrame(step);
    };
    line.anim = requestAnimationFrame(step);
  }

  /* ---- reveal: staggered cascade once the list scrolls into view ---- */
  onVisible(ul, () => {
    for (const l of lines) {
      setTimeout(() => decode(l, DECODE_MS, { flickerTag: true }), l.i * STAGGER);
    }
  });

  /* ---- hover: cheap re-scramble that always resettles to the real name ----
     Bound per line. The debounce lives in decode() (it cancels the in-flight
     pass), so flicking across many lines stays light and never piles up. */
  for (const l of lines) {
    const li = items[l.i];
    li.addEventListener('mouseenter', () => decode(l, HOVER_MS));
  }
}
