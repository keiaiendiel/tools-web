/* =============================================================================
   v1.js - "PRESS"
   Two small jobs: a faint generative HALFTONE that "prints" behind the hero
   claim and then drifts slowly, and the accessible tabbed contents in the
   fields section. The print-on-load reveal of the copy is pure CSS.
============================================================================= */
import {
  fitCanvas, rafLoop, makeNoise2D, readPalette, cellMetrics, GLYPHS, prefersReducedMotion,
} from '../glyph-core.js';

function hexToRgb(h) {
  h = (h || '#17150f').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/* Faint monospace halftone, mapped from value noise to the luminance ramp. It
   reads as ink soaking into paper, then settling to a slow drift. */
function halftone(canvas) {
  const ctx = canvas.getContext('2d'); // grab BEFORE fitCanvas (onResize fires synchronously)
  const pal = readPalette();
  const [ir, ig, ib] = hexToRgb(pal.ink);
  const noise = makeNoise2D(20260531);
  const ramp = GLYPHS.ramp;
  const fontPx = 15;
  const family = "'IBM Plex Mono', monospace";
  let cols = 0, rows = 0, cw = 0, ch = 0, W = 0, H = 0;
  let visible = true;

  const layout = (w, h) => {
    W = w; H = h;
    const m = cellMetrics(ctx, fontPx, family);
    cw = m.w || fontPx * 0.6;
    ch = fontPx * 1.18;
    cols = Math.ceil(w / cw) + 1;
    rows = Math.ceil(h / ch) + 1;
    ctx.font = `${fontPx}px ${family}`;
    ctx.textBaseline = 'middle';
  };

  fitCanvas(canvas, { onResize: (w, h) => layout(w, h) });

  const start = performance.now();
  const draw = (now) => {
    if (!visible) { ctx.clearRect(0, 0, W, H); return; }
    const elapsed = (now - start) / 1000;
    const bloom = Math.min(1, elapsed / 1.4);
    const t = elapsed;
    ctx.clearRect(0, 0, W, H);
    for (let r = 0; r < rows; r++) {
      const y = r * ch + ch * 0.5;
      for (let c = 0; c < cols; c++) {
        let n = noise(c * 0.11 + t * 0.02, r * 0.11 + t * 0.012 + Math.sin(t * 0.1 + c * 0.03) * 0.18);
        n = n * n;
        const a = n * 0.14 * bloom;
        if (a < 0.012) continue;
        const g = ramp[Math.min(ramp.length - 1, (n * ramp.length) | 0)];
        if (g === ' ') continue;
        ctx.fillStyle = `rgba(${ir},${ig},${ib},${a.toFixed(3)})`;
        ctx.fillText(g, c * cw, y);
      }
    }
  };

  if (prefersReducedMotion()) { draw(start + 1400); return; }

  // Pause the field while the hero is off-screen (keeps it cheap on scroll).
  if (typeof IntersectionObserver === 'function') {
    const io = new IntersectionObserver((es) => { visible = es[0] && es[0].isIntersecting; }, { threshold: 0 });
    io.observe(canvas);
  }
  rafLoop((dt, now) => draw(now), { fps: 30 });
}

/* Accessible tablist for the fields section (roving tabindex). */
function initTabs(root) {
  const tabs = Array.from(root.querySelectorAll('.v1-tab'));
  if (!tabs.length) return;
  const select = (i) => {
    tabs.forEach((t, j) => {
      const on = j === i;
      t.classList.toggle('is-on', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      const p = document.getElementById('v1-panel-' + j);
      if (p) {
        p.classList.toggle('is-on', on);
        if (on) p.removeAttribute('hidden'); else p.setAttribute('hidden', '');
      }
    });
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(i));
    t.addEventListener('keydown', (e) => {
      let ni = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') ni = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ni = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') ni = 0;
      else if (e.key === 'End') ni = tabs.length - 1;
      if (ni !== null) { e.preventDefault(); select(ni); tabs[ni].focus(); }
    });
  });
}

function boot() {
  const c = document.querySelector('[data-halftone]');
  if (c) halftone(c);
  const tabsRoot = document.querySelector('[data-fieldtabs]');
  if (tabsRoot) initTabs(tabsRoot);
}

if (document.readyState !== 'loading') boot();
else document.addEventListener('DOMContentLoaded', boot);
