/* =============================================================================
   ambient.js — background texture, two pieces
   -----------------------------------------------------------------------------
   Both are deliberately quiet. They are the room tone of the page, never the
   thing you look at. They follow the same house rules as the hero field:
   monospace cells, seeded value-noise drift, palette read from CSS, motion
   gated by reduced-motion / visibility / frame-rate.

   initAmbient(el)     — the <div class="amb"> section dividers. A generative
                         ASCII hairline (box-drawing + low ramp + dots) that
                         drifts slowly. el.textContent is rewritten each tick.
   initFootField(canvas) — the footer background canvas on the dark --night
                         ground. A sparse, slow glyph field with rare accent
                         glints. A calmer, darker cousin of the hero field.
============================================================================= */

import {
  GLYPHS, makeNoise2D, rafLoop, onVisible, prefersReducedMotion,
  readPalette, rampGlyph,
} from './glyph-core.js';

/* Approximate advance width of one IBM Plex Mono cell at --t-xs (12px).
   The .amb strip is CSS-styled text, not a canvas, so we cannot cellMetrics()
   it cheaply; ~7px per char is close enough and we recompute on resize.       */
const AMB_CHAR_PX = 7;

/* -----------------------------------------------------------------------------
   PART 1 — initAmbient(el)
   A living hairline rule. Two rows of low-ink glyphs whose pattern is sampled
   from drifting 2D value noise. Box-drawing for structure, a low slice of the
   ramp for weight, occasional dots for breath. Breathes at ~6fps.
----------------------------------------------------------------------------- */
export function initAmbient(el) {
  // A short, calm palette of glyphs. Mostly the horizontal rule and spaces, so
  // the strip reads as a hairline first and texture second.
  const RULE = '─';
  const lowRamp = GLYPHS.ramp.slice(1, 6);          // '.', '·', ':', '-', '='
  const box = ['─', '─', '─', '┄', '┈', '│', '┼', '┴', '┬'];
  const dots = GLYPHS.dots;
  const noise = makeNoise2D(0xa3b1);

  // How many character columns fit the strip's current width.
  let cols = colCount();
  function colCount() {
    const w = el.clientWidth || el.getBoundingClientRect().width || 480;
    return Math.max(8, Math.floor(w / AMB_CHAR_PX));
  }

  /* Build one row of glyphs for a given noise row-offset and time. The noise
     field is sampled along x; thresholds decide whether a cell is blank rule,
     light texture, a box accent, or a rare dot. Mostly blank keeps it a rule. */
  function row(rowSeed, t) {
    let out = '';
    for (let x = 0; x < cols; x++) {
      const n = noise(x * 0.06 + t, rowSeed);        // 0..1, drifts with t
      const m = noise(x * 0.21 - t * 0.5, rowSeed + 9.0);
      if (n < 0.46) {
        out += RULE;                                  // the hairline itself
      } else if (n < 0.72) {
        out += rampGlyph((n - 0.46) / 0.26, lowRamp); // faint weight
      } else if (m > 0.78) {
        out += dots[(m * dots.length) | 0 % dots.length];
      } else {
        out += box[(m * box.length) | 0];             // a structural tick
      }
    }
    return out;
  }

  // Reduced motion: one settled decorative row, no loop, no observers.
  if (prefersReducedMotion()) {
    el.textContent = row(0.5, 0);
    return () => {};
  }

  // Recompute width on resize; only relayout the string when the count changes.
  let onResize = () => {
    const next = colCount();
    if (next !== cols) cols = next;
  };
  window.addEventListener('resize', onResize, { passive: true });

  // Slow drift. ~6fps is plenty: this should breathe, not flicker.
  let t = 0;
  let stopLoop = () => {};
  const stopVis = onVisible(el, () => {
    stopLoop = rafLoop(() => {
      t += 0.012;                                     // gentle forward drift
      el.textContent = row(0, t) + '\n' + row(2.7, t * 0.8 + 1.5);
    }, { fps: 6 });
  });

  // Paint one frame immediately so the strip is never empty before it scrolls in.
  el.textContent = row(0, 0) + '\n' + row(2.7, 1.5);

  return () => { stopVis(); stopLoop(); window.removeEventListener('resize', onResize); };
}

/* -----------------------------------------------------------------------------
   PART 2 — initFootField(canvas)
   A sparse drifting glyph field on the dark footer ground. Very low contrast in
   --night-faint, with rare single-cell --accent glints. Slower and quieter than
   the hero. Gated by onVisible so it is idle until the footer is near.

   Note on colour: the footer element redefines --fg locally, but readPalette()
   resolves against :root, so for the night-specific tones we read the raw
   --night-* custom properties off :root directly.
----------------------------------------------------------------------------- */
export function initFootField(canvas) {
  const FONT = "'IBM Plex Mono', ui-monospace, monospace";
  const FONT_PX = 13;
  const LEADING = 1.5;                                // row height = px * leading

  // Colours: brand palette plus the night-specific tones from :root.
  const pal = readPalette();
  const rootStyle = getComputedStyle(document.documentElement);
  const nightFaint = rootStyle.getPropertyValue('--night-faint').trim() || '#3a3947';
  const accent = pal.accent || '#362cca';

  const ctx = canvas.getContext('2d');
  const noise = makeNoise2D(0x5e1f);

  let cw = FONT_PX, ch = FONT_PX * LEADING;           // cell box, measured below
  let cols = 0, rows = 0;
  let vw = 0, vh = 0, dprLocal = 1;

  // Size and grid. We size the canvas by hand (no fitCanvas) because the
  // footer canvas is absolutely positioned and we want the full footer box.
  function resize() {
    const rect = canvas.getBoundingClientRect();
    vw = Math.max(1, Math.round(rect.width));
    vh = Math.max(1, Math.round(rect.height));
    dprLocal = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(vw * dprLocal);
    canvas.height = Math.round(vh * dprLocal);
    ctx.setTransform(dprLocal, 0, 0, dprLocal, 0, 0);
    ctx.font = `${FONT_PX}px ${FONT}`;
    ctx.textBaseline = 'middle';
    cw = ctx.measureText('M').width || FONT_PX * 0.6;
    ch = FONT_PX * LEADING;
    cols = Math.ceil(vw / cw) + 1;
    rows = Math.ceil(vh / ch) + 1;
  }

  // One frame. Sparse: most cells stay empty. A drifting noise field decides
  // which cells light up and how bright; rare peaks become an accent glint.
  function draw(t) {
    ctx.clearRect(0, 0, vw, vh);
    ctx.font = `${FONT_PX}px ${FONT}`;
    ctx.textBaseline = 'middle';
    const ramp = GLYPHS.ramp;
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        // Slow, large-scale drift. Two octaves so it is not a flat gradient.
        const n = noise(gx * 0.10 + t, gy * 0.14 - t * 0.4) * 0.7
                + noise(gx * 0.33 - t * 0.2, gy * 0.30 + t) * 0.3;
        if (n < 0.62) continue;                        // most cells blank
        const x = gx * cw, y = gy * ch + ch * 0.5;
        if (n > 0.93) {
          // Rare accent glint: a single bright cell. Kept sparse on purpose.
          ctx.fillStyle = accent;
          ctx.globalAlpha = 0.55;
          ctx.fillText(rampGlyph((n - 0.62) / 0.38), x, y);
        } else {
          // The body of the field: very low-contrast night-faint glyphs.
          ctx.fillStyle = nightFaint;
          ctx.globalAlpha = 0.35 + (n - 0.62) * 0.9;   // 0.35..~0.63
          const g = rampGlyph((n - 0.62) / 0.31);
          ctx.fillText(g === ' ' ? '·' : g, x, y);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  resize();
  const ro = ('ResizeObserver' in window) ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(canvas);
  else window.addEventListener('resize', resize, { passive: true });

  // Reduced motion: one static sparse frame, no loop, no visibility gate.
  if (prefersReducedMotion()) {
    draw(0);
    return () => { if (ro) ro.disconnect(); else window.removeEventListener('resize', resize); };
  }

  // Gate the loop on the footer nearing the viewport. ~20fps is calm; the drift
  // constant below keeps it slower than the hero regardless of frame rate.
  let t = 0;
  let stopLoop = () => {};
  const stopVis = onVisible(canvas, () => {
    stopLoop = rafLoop(() => {
      t += 0.004;                                      // slow forward drift
      draw(t);
    }, { fps: 20 });
  }, { rootMargin: '0px 0px 20% 0px' });

  return () => {
    stopVis(); stopLoop();
    if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
  };
}