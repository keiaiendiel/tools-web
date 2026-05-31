/* =============================================================================
   v2.js - "TERMINAL"
   -----------------------------------------------------------------------------
   Two systems:
   1. A living ASCII field behind everything: a monospace glyph grid driven by
      seeded value noise that drifts and breathes like a slow organism, and is
      disturbed by the pointer (a local excitation of brighter glyphs that
      decays). 60fps, DPR-capped, cheap, paused off-tab. aria-hidden in markup.
   2. A real terminal you can type into. On load the hero copy types itself as a
      short boot sequence, then a live prompt blinks. Commands print content
      from content.en, formatted as ASCII. Command chips mirror the commands for
      touch and discoverability. Bench tool names decode (scramble then settle)
      on hover.

   All printed copy is real selectable DOM text. The field is the only canvas
   and carries no copy.

   Reduced motion: boot text prints instantly, field renders one settled frame
   and stops, caret is solid, decode is disabled.
============================================================================= */

import {
  fitCanvas, rafLoop, makeNoise2D, readPalette,
  cellMetrics, GLYPHS, prefersReducedMotion, mixHex,
} from '../glyph-core.js';
import { altCopy } from '../../i18n/alt-copy.js';

const c = altCopy;
const reduce = prefersReducedMotion();

/* ---------------------------------------------------------------------------
   PART 1 - the living ASCII field
--------------------------------------------------------------------------- */
function initField() {
  const host = document.querySelector('.v2-field');
  if (!host) return;
  const canvas = host.querySelector('canvas');
  if (!canvas) return;

  // ctx FIRST (fitCanvas calls onResize synchronously; see house rules).
  const ctx = canvas.getContext('2d');
  const pal = readPalette();
  const noise = makeNoise2D(0xC0DE);

  // glyph ramp dark -> light for a phosphor feel (sparse at rest)
  const ramp = [' ', ' ', '.', '.', ':', '-', '=', '+', '*', '#'];
  const FONT = "'IBM Plex Mono', monospace";

  let cols = 0, rows = 0, cw = 0, ch = 0, fontPx = 14;
  let cssW = 0, cssH = 0;
  // excitation buffer: a value per cell that the pointer raises and that decays
  let exc = new Float32Array(0);

  // pointer state in cell coordinates
  const pointer = { cx: -999, cy: -999, active: false, vx: 0, vy: 0 };

  const onResize = (w, h) => {
    cssW = w; cssH = h;
    // bigger cells on small screens keep the grid cheap and the glyphs legible
    fontPx = w < 560 ? 16 : w < 960 ? 15 : 14;
    const m = cellMetrics(ctx, fontPx, FONT); // sets ctx.font as a side effect
    cw = m.w;
    ch = Math.round(fontPx * 1.32);
    cols = Math.max(1, Math.ceil(w / cw) + 1);
    rows = Math.max(1, Math.ceil(h / ch) + 1);
    exc = new Float32Array(cols * rows);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
  };

  const fc = fitCanvas(canvas, { onResize });

  // colour stops, resolved once
  const cGhost = pal.nightFaint || '#3a3947';
  const cBlue = mixHex('#3a3947', '#6f66e6', 0.6); // lifted blue for mid energy
  const cAmber = '#e8a33d';

  // pointer disturbance (the page tracks the pointer over the whole window)
  const setPointer = (clientX, clientY) => {
    const nx = clientX / cw;
    const ny = clientY / ch;
    pointer.vx = nx - pointer.cx;
    pointer.vy = ny - pointer.cy;
    pointer.cx = nx;
    pointer.cy = ny;
    pointer.active = true;
  };
  window.addEventListener('pointermove', (e) => setPointer(e.clientX, e.clientY), { passive: true });
  window.addEventListener('pointerdown', (e) => {
    setPointer(e.clientX, e.clientY);
    // a click drops a stronger excitation
    stampExcitation(2.0);
  }, { passive: true });
  window.addEventListener('pointerleave', () => { pointer.active = false; }, { passive: true });

  // raise excitation in a falloff disc around the pointer cell
  function stampExcitation(strength) {
    if (pointer.cx < 0) return;
    const pcx = pointer.cx;
    const pcy = pointer.cy;
    const R = 5.5;
    const x0 = Math.max(0, Math.floor(pcx - R));
    const x1 = Math.min(cols - 1, Math.ceil(pcx + R));
    const y0 = Math.max(0, Math.floor(pcy - R));
    const y1 = Math.min(rows - 1, Math.ceil(pcy + R));
    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) {
        const dx = gx - pcx;
        const dy = gy - pcy;
        const d2 = dx * dx + dy * dy;
        const fall = Math.max(0, 1 - d2 / (R * R));
        if (fall > 0) {
          const i = gy * cols + gx;
          exc[i] = Math.min(1.4, exc[i] + fall * fall * strength);
        }
      }
    }
  }

  let t = 0;

  function draw(settle) {
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.font = `${fontPx}px ${FONT}`;
    ctx.textBaseline = 'middle';

    const tt = t * 0.00035;       // breathing time
    const drift = t * 0.00018;    // slow horizontal/vertical drift

    for (let gy = 0; gy < rows; gy++) {
      const py = gy * ch + ch * 0.5;
      const ny = gy * 0.085;
      for (let gx = 0; gx < cols; gx++) {
        const i = gy * cols + gx;
        const nx = gx * 0.085;
        // two octaves of drifting noise, plus a slow breath
        let v = noise(nx + drift, ny - drift * 0.6);
        v = v * 0.7 + noise(nx * 2.1 - tt, ny * 2.1 + tt) * 0.3;
        const breath = 0.5 + 0.5 * Math.sin(tt * 1.7 + (gx + gy) * 0.04);
        v = v * (0.62 + 0.38 * breath);

        const e = exc[i];
        const energy = Math.min(1, v + e);

        // glyph from the ramp by energy
        let gi = (energy * ramp.length) | 0;
        if (gi >= ramp.length) gi = ramp.length - 1;
        let g = ramp[gi];

        // excited cells occasionally borrow from the scramble alphabet to feel alive
        if (e > 0.35) {
          const flick = ((gx * 31 + gy * 17 + (t * 0.06 | 0)) % GLYPHS.noise.length) | 0;
          if ((e > 0.7) || ((gx + gy + (t * 0.02 | 0)) & 3) === 0) {
            g = GLYPHS.noise[flick];
          }
        }

        if (g === ' ') continue;

        // colour + alpha by energy. ground = faint ghost, mid = blue, hot = amber
        let col, alpha;
        if (e > 0.55) {
          col = cAmber;
          alpha = Math.min(0.92, 0.4 + e * 0.5);
        } else if (energy > 0.62) {
          col = cBlue;
          alpha = 0.16 + (energy - 0.62) * 1.1 + e * 0.5;
        } else {
          col = cGhost;
          alpha = 0.10 + energy * 0.22 + e * 0.4;
        }
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.fillStyle = col;
        ctx.fillText(g, gx * cw, py);
      }
    }
    ctx.globalAlpha = 1;

    if (!settle) {
      // decay excitation; trail along pointer motion for a live ripple
      const decay = 0.92;
      for (let k = 0; k < exc.length; k++) {
        if (exc[k] > 0.001) exc[k] *= decay; else exc[k] = 0;
      }
      // continuously feed a soft excitation under a moving pointer
      if (pointer.active) {
        const speed = Math.min(3, Math.hypot(pointer.vx, pointer.vy));
        stampExcitation(0.20 + speed * 0.10);
        pointer.vx *= 0.6; pointer.vy *= 0.6;
      }
    }
  }

  if (reduce) {
    // one settled, complete frame and stop
    t = 12000;
    draw(true);
    return;
  }

  let stop = null;
  // only run while visible; rafLoop also pauses on tab hide
  const start = () => {
    if (stop) return;
    stop = rafLoop((dt) => {
      t += dt;
      draw(false);
    }, { fps: 60 });
  };
  start();
}

/* ---------------------------------------------------------------------------
   PART 2 - the terminal
--------------------------------------------------------------------------- */
function initTerminal() {
  const log = document.querySelector('.v2-log');
  const input = document.querySelector('.v2-input');
  const caret = document.querySelector('.v2-caret');
  const chips = document.querySelectorAll('.v2-chip');
  const promptRow = document.querySelector('.v2-prompt');
  if (!log) return;

  const HOST = 'kindl.work:~$';

  // ---- helpers to build real DOM text lines ----------------------------------
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const scrollEnd = () => { log.scrollTop = log.scrollHeight; };

  const line = (html, cls) => {
    const p = el('p', 'v2-line' + (cls ? ' ' + cls : ''), html);
    log.insertBefore(p, promptRow || null);
    return p;
  };
  const gap = () => { log.insertBefore(el('div', 'v2-gap'), promptRow || null); };
  const rule = (n = 46) => line('<span class="v2-rule">' + '-'.repeat(n) + '</span>');

  // a name/audience row with a dotted leader filling the gap (real text)
  const dotRow = (name, who, opts = {}) => {
    const p = el('p', 'v2-line v2-row');
    const nm = el('span', 'nm' + (opts.decode ? ' v2-tool' : ''));
    nm.textContent = name;
    if (opts.decode) nm.dataset.word = name;
    const lead = el('span', 'lead');
    lead.textContent = ' ' + '.'.repeat(80) + ' ';
    const w = el('span', 'who');
    w.textContent = who;
    p.append(nm, lead, w);
    log.insertBefore(p, promptRow || null);
    return p;
  };

  // ---- command implementations -----------------------------------------------
  function cmdHelp() {
    line('<span class="v2-h">Commands.</span> Type one, or tap a chip below.');
    gap();
    const rows = [
      ['help', 'this list'],
      ['about', 'who builds these'],
      ['bench', 'what comes off the bench'],
      ['ships', 'what ships first (01 / 02 / 03)'],
      ['fields', 'how a small tool fits your trade'],
      ['order', 'three ways, the price is on the page'],
      ['kindl', 'open the art studio at kindl.work'],
      ['clear', 'wipe the screen'],
    ];
    for (const [k, d] of rows) {
      line('  <span class="v2-blue">' + esc(k.padEnd(8)) + '</span><span class="v2-soft">' + esc(d) + '</span>');
    }
  }

  function cmdAbout() {
    line('<span class="v2-h">' + esc(c.how.h) + '</span>');
    gap();
    line('<span class="v2-soft">' + esc(c.hero.intro) + '</span>');
    gap();
    line('<span class="v2-soft">' + esc(c.how.p1) + '</span>');
    gap();
    line('<span class="v2-soft">' + esc(c.how.p2) + '</span>');
    gap();
    const meta = c.hero.meta.map((m) => '<span class="v2-em">[</span> ' + esc(m) + ' <span class="v2-em">]</span>').join('   ');
    line(meta);
  }

  function cmdBench() {
    line('<span class="v2-h">' + esc(c.bench.h) + '</span>');
    line('<span class="v2-soft">' + esc(c.bench.intro) + '</span>');
    gap();
    // the four lines
    for (const ln of c.bench.lines) {
      line('<span class="v2-em">+</span> <span class="v2-h">' + esc(ln.k) + '</span>');
      line('  <span class="v2-soft">' + esc(ln.d) + '</span>');
    }
    gap();
    rule(46);
    line('<span class="v2-faint">' + esc('off the bench, by audience') + '</span>');
    gap();
    // 18 items, name + audience, names decode on hover
    for (const it of c.bench.items) {
      dotRow(it.nm, it.who, { decode: true });
    }
    bindDecode();
  }

  function cmdShips() {
    line('<span class="v2-h">' + esc(c.ships.h) + '</span>');
    gap();
    c.ships.items.forEach((s, idx) => {
      const p = el('p', 'v2-line v2-ship');
      p.innerHTML =
        '<span class="no">' + esc(s.no) + '</span>  ' +
        '<span class="snm">' + esc(s.nm) + '</span>  ' +
        '<span class="who">' + esc(s.who) + '</span>';
      log.insertBefore(p, promptRow || null);
      line('   <span class="what v2-soft">' + esc(s.what) + '</span>');
      if (idx < c.ships.items.length - 1) gap();
    });
  }

  function cmdFields() {
    line('<span class="v2-h">' + esc(c.fields.h) + '</span>');
    line('<span class="v2-soft">' + esc(c.fields.intro) + '</span>');
    gap();
    const trades = Object.keys(c.fields.examples);
    line('<span class="v2-faint">' + esc('trades: ') + '</span><span class="v2-blue">' + trades.map(esc).join('  ') + '</span>');
    gap();
    // show three representative trades in full so the section reads as content
    for (const trade of ['Studios', 'Galleries', 'New media']) {
      const rowsArr = c.fields.examples[trade];
      if (!rowsArr) continue;
      line('<span class="v2-em">#</span> <span class="v2-h">' + esc(trade) + '</span>');
      for (const [name, who] of rowsArr) {
        dotRow(name, who, { decode: true });
      }
      gap();
    }
    line('<span class="v2-faint">' + esc('ten trades in all. Tell me yours and I shape one to it.') + '</span>');
    bindDecode();
  }

  function cmdOrder() {
    line('<span class="v2-h">' + esc(c.order.h) + '</span>');
    gap();
    c.order.cols.forEach((col) => {
      const p = el('p', 'v2-line v2-way');
      p.innerHTML =
        '<span class="t">' + esc(col.t) + '</span>' +
        '<span class="px">' + esc(col.px) + '</span>';
      log.insertBefore(p, promptRow || null);
      line('   <span class="v2-way-d v2-soft">' + esc(col.d) + '</span>');
      gap();
    });
    line('<span class="v2-soft">' + esc('Start one, or step over to the art studio:') + '</span>');
    line('  <a href="https://see.kindl.work" target="_blank" rel="noopener">' + esc(c.order.cta1) + ' &#8599;</a>   ' +
         '<a href="https://see.kindl.work" target="_blank" rel="noopener">' + esc(c.order.cta2) + ' &#8599;</a>');
  }

  function cmdKindl() {
    line('<span class="v2-soft">' + esc('opening the art studio ') + '<a href="https://see.kindl.work" target="_blank" rel="noopener">kindl.work &#8599;</a>' + esc(' in a new tab.') + '</span>');
    try { window.open('https://see.kindl.work', '_blank', 'noopener'); } catch (e) { /* popup blocked: link above still works */ }
  }

  function cmdClear() {
    // remove everything above the prompt row
    const kids = Array.from(log.children);
    for (const k of kids) {
      if (k === promptRow) break;
      log.removeChild(k);
    }
    line('<span class="v2-faint">' + esc('screen cleared. type ') + '<span class="v2-blue">help</span>' + esc(' for the menu.') + '</span>');
  }

  function cmdUnknown(raw) {
    line('<span class="v2-em">?</span> <span class="v2-soft">' + esc(raw) + esc(': not a command. Try ') + '</span><span class="v2-blue">help</span><span class="v2-soft">.</span>');
  }

  const COMMANDS = {
    help: cmdHelp, about: cmdAbout, bench: cmdBench, ships: cmdShips,
    fields: cmdFields, order: cmdOrder, kindl: cmdKindl, clear: cmdClear,
  };

  // ---- run a command (shared by typing and chips) ----------------------------
  const history = [];
  let hi = -1;

  function echo(cmd) {
    const p = el('p', 'v2-line v2-echo');
    p.innerHTML = '<span class="pr">' + esc(HOST) + '</span> <span class="cmd">' + esc(cmd) + '</span>';
    log.insertBefore(p, promptRow || null);
  }

  function run(raw, { echoIt = true } = {}) {
    const cmd = String(raw || '').trim().toLowerCase();
    if (!cmd) return;
    if (echoIt) echo(cmd);
    history.push(cmd); hi = history.length;
    const fn = COMMANDS[cmd] || (() => cmdUnknown(cmd));
    fn();
    scrollEnd();
  }

  // ---- decode-on-hover for tool names ----------------------------------------
  function bindDecode() {
    if (reduce) return;
    const tools = log.querySelectorAll('.v2-tool:not([data-bound])');
    tools.forEach((node) => {
      node.dataset.bound = '1';
      let timer = null;
      const target = node.dataset.word || node.textContent;
      const scramble = () => {
        if (timer) return;
        let frame = 0;
        const total = 11;
        const original = target;
        timer = setInterval(() => {
          frame++;
          const reveal = Math.floor((frame / total) * original.length);
          let out = '';
          for (let i = 0; i < original.length; i++) {
            const ch2 = original[i];
            if (i < reveal || ch2 === ' ' || ch2 === '/' || ch2 === '-') {
              out += ch2;
            } else {
              out += GLYPHS.noise[(Math.random() * GLYPHS.noise.length) | 0];
            }
          }
          node.textContent = out;
          if (frame >= total) { clearInterval(timer); timer = null; node.textContent = original; }
        }, 28);
      };
      node.addEventListener('pointerenter', scramble);
      node.addEventListener('focus', scramble);
    });
  }

  // ---- chips ------------------------------------------------------------------
  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const cmd = chip.dataset.cmd;
      run(cmd);
      // keep focus reachable for keyboard users without yanking the mobile keyboard up
      if (cmd !== 'kindl') input && input.focus({ preventScroll: true });
    });
  });

  // ---- input wiring -----------------------------------------------------------
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const v = input.value;
        input.value = '';
        run(v);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (history.length) { hi = Math.max(0, hi - 1); input.value = history[hi] || ''; }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (history.length) { hi = Math.min(history.length, hi + 1); input.value = history[hi] || ''; }
      } else if (e.key === 'l' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        cmdClear(); scrollEnd();
      }
    });
    // keep our drawn caret hugging the input (we keep it simple: caret sits after input)
    // clicking anywhere in the log focuses the input so it feels like a real shell
    log.addEventListener('click', (e) => {
      if (e.target.closest('a') || e.target.closest('.v2-tool')) return;
      const sel = window.getSelection && window.getSelection();
      if (sel && sel.toString().length) return; // do not steal a text selection
      input.focus({ preventScroll: true });
    });
  }

  // ---- the boot sequence ------------------------------------------------------
  // a banner with the hero claim (real text), then a short typed intro, then prompt
  function buildBanner() {
    const b = el('p', 'v2-line');
    const banner = el('h1', 'v2-banner');
    banner.innerHTML = esc(c.hero.claim1) + '<span class="ln2">' + esc(c.hero.claim2) + '</span>';
    b.appendChild(banner);
    log.insertBefore(b, promptRow || null);
    const sub = el('p', 'v2-line v2-banner-sub', esc(c.hero.sub));
    log.insertBefore(sub, promptRow || null);
  }

  // typed boot lines: a couple of system-ish lines + the intro sentence
  const bootLines = [
    { cls: 'v2-faint', text: 'kindl.work small-software bench  -  v.2026  -  ' + c.bench.items.length + ' tools on file' },
    { cls: 'v2-soft', text: c.hero.intro },
    { cls: 'v2-faint', text: "type 'help' or tap a chip. the field behind reacts to your cursor." },
  ];

  function showPromptLive() {
    if (caret) { caret.classList.add('blink'); }
    if (input) {
      input.removeAttribute('disabled');
      input.setAttribute('placeholder', "try: bench");
      // do not autofocus on load (would summon the mobile keyboard); focus on interaction
    }
    if (promptRow) promptRow.style.visibility = 'visible';
  }

  function bootInstant() {
    buildBanner();
    gap();
    for (const bl of bootLines) {
      line('<span class="' + bl.cls + '">' + esc(bl.text) + '</span>');
    }
    gap();
    line('<span class="v2-faint">' + esc('ready.') + '</span>');
    showPromptLive();
    scrollEnd();
  }

  function bootTyped() {
    buildBanner();
    gap();
    let idx = 0;

    const typeOne = (bl, done) => {
      const p = el('p', 'v2-line');
      const span = el('span', bl.cls);
      const cc = el('span', 'v2-bootcaret');
      p.append(span, cc);
      log.insertBefore(p, promptRow || null);
      const full = bl.text;
      let i = 0;
      // vary speed a touch so it feels typed, not metronomic
      const step = () => {
        // print a small burst per tick for snappy boot
        const burst = 2 + ((Math.random() * 2) | 0);
        i = Math.min(full.length, i + burst);
        span.textContent = full.slice(0, i);
        scrollEnd();
        if (i < full.length) {
          setTimeout(step, 14 + (Math.random() * 16));
        } else {
          p.removeChild(cc);
          done();
        }
      };
      step();
    };

    const next = () => {
      if (idx >= bootLines.length) {
        gap();
        const ready = el('p', 'v2-line', '<span class="v2-faint">ready.</span>');
        log.insertBefore(ready, promptRow || null);
        showPromptLive();
        scrollEnd();
        return;
      }
      const bl = bootLines[idx++];
      typeOne(bl, () => setTimeout(next, 120));
    };
    // small delay so the entrance rise settles first
    setTimeout(next, 360);
  }

  // hide prompt until boot finishes (keeps the sequence clean)
  if (promptRow && !reduce) promptRow.style.visibility = 'hidden';

  if (reduce) bootInstant();
  else bootTyped();
}

/* ---------------------------------------------------------------------------
   PART 3 - entrance: rise the shell pieces in, staggered
--------------------------------------------------------------------------- */
function initEntrance() {
  const rises = document.querySelectorAll('.v2-rise');
  if (reduce) {
    rises.forEach((r) => r.classList.add('is-up'));
    return;
  }
  rises.forEach((r, i) => {
    setTimeout(() => r.classList.add('is-up'), 90 + i * 130);
  });
}

/* ---------------------------------------------------------------------------
   boot
--------------------------------------------------------------------------- */
function boot() {
  initEntrance();
  initField();
  initTerminal();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
