/* =============================================================================
   examples.js — the "it fits your field too" explorer
   -----------------------------------------------------------------------------
   The fields section: a row of chips, one per trade, over a two-column list of
   concrete tools. Click a chip and the list swaps to that field's items, each
   name resolving left-to-right out of scramble noise into the real text,
   staggered down the list, the same readout-locking feel as the dark catalog.

   Pure DOM text. No canvas. We rebuild the <li> rows cleanly on each switch so
   the .nm / .who structure stays valid, and we only ever set textContent on
   those spans. Colour, columns and the selected-chip accent are CSS's job.

   House rules honoured: determinism via mulberry32 (per line index, so a given
   row scrambles the same way every time); under reduced motion lists switch
   instantly to final text with no animation but chips still work; a failed JSON
   parse never throws, it just falls back to instant switching on whatever data
   the page already rendered.
============================================================================= */

import { GLYPHS, mulberry32, prefersReducedMotion, onVisible } from './glyph-core.js';

/* Timing, in ms. Short enough that a switch reads as alive, not as a wait. */
const STAGGER   = 45;   // delay added per line on the reveal cascade
const DECODE_MS = 600;  // how long one line takes to fully lock
const FRAME_MS  = 1000 / 30; // 30fps text churn is plenty and easy on the CPU

const NOISE = GLYPHS.noise;

/* Pick a noise glyph from a seeded stream. Spaces stay spaces so word shape and
   line length never jump around while a name resolves. */
function scrambleChar(realCh, rnd) {
  if (realCh === ' ') return ' ';
  return NOISE[(rnd() * NOISE.length) | 0];
}

export function initExamples(root) {
  const chipBox = root.querySelector('[data-examples-chips]');
  const list = root.querySelector('[data-examples-list]');
  if (!chipBox || !list) return;

  const chips = Array.from(chipBox.querySelectorAll('.ex-chip'));
  if (!chips.length) return;

  // --- Data ----------------------------------------------------------------
  // The JSON sits in a sibling <script type="application/json"> inside the same
  // section. Find it from root first, then widen to document. Cache the parsed
  // map; a parse failure leaves `data` null and we fall back to instant switches
  // off whatever the page already rendered. Never throw.
  let data = null;
  try {
    const holder =
      root.querySelector('[data-examples-data]') ||
      (root.closest('section') || document).querySelector('[data-examples-data]') ||
      document.querySelector('[data-examples-data]');
    if (holder && holder.textContent) {
      const parsed = JSON.parse(holder.textContent);
      if (parsed && typeof parsed === 'object') data = parsed;
    }
  } catch (err) {
    data = null; // robust: keep going with the server-rendered list
  }

  const reduce = prefersReducedMotion();
  let activeKey = null;     // which field is shown
  let anims = [];           // active rAF handles for the current list, for cancel

  /* Cancel any decode passes still in flight (used before a fresh switch). */
  function cancelAll() {
    for (const h of anims) cancelAnimationFrame(h);
    anims = [];
  }

  /* Coerce a field's data into an array of [name, who] pairs. Tolerates a
     missing key, a non-array value, or rows that are not well shaped. */
  function itemsFor(key) {
    if (!data) return null;
    const rows = data[key];
    if (!Array.isArray(rows)) return null;
    return rows.map((r) => {
      if (Array.isArray(r)) return [String(r[0] ?? ''), String(r[1] ?? '')];
      return [String(r ?? ''), ''];
    });
  }

  /* Read the currently rendered list back into [name, who] pairs. Used as the
     fallback source when there is no parsed JSON to switch from, and as the seed
     for an optional first-reveal decode of the server-rendered rows. */
  function readRenderedItems() {
    return Array.from(list.querySelectorAll('li')).map((li) => {
      const nm = li.querySelector('.nm');
      const who = li.querySelector('.who');
      const name = li.getAttribute('data-nm') || (nm ? nm.textContent : '');
      return [name, who ? who.textContent : ''];
    });
  }

  /* Build the <li> rows for a set of [name, who] pairs. Structure matches the
     server render exactly: li[data-nm] > span.nm + span.who. When `blankNames`
     is set the .nm starts empty so a following decode reads as an arrival rather
     than a flash-then-scramble; the .who is always final text. */
  function render(items, { blankNames = false } = {}) {
    const frag = document.createDocumentFragment();
    for (const [name, who] of items) {
      const li = document.createElement('li');
      li.setAttribute('data-nm', name);
      const nm = document.createElement('span');
      nm.className = 'nm';
      nm.textContent = blankNames ? '' : name;
      const w = document.createElement('span');
      w.className = 'who';
      w.textContent = who;
      li.appendChild(nm);
      li.appendChild(w);
      frag.appendChild(li);
    }
    list.replaceChildren(frag);
  }

  /* Run one decode pass on a single .nm span: characters lock left-to-right over
     `dur` ms, each unlocked slot showing fresh noise per frame, ending on the
     exact real text. Seeded by the line index so a row resolves the same way
     every time. Returns nothing; pushes its handle into `anims` for cancel. */
  function decodeLine(nmEl, real, lineIndex) {
    const rnd = mulberry32(lineIndex >>> 0);
    const n = real.length;
    const start = performance.now();
    let lastDraw = 0;
    let idx = anims.length;
    anims.push(0);

    const step = (now) => {
      const t = Math.min(1, (now - start) / DECODE_MS);
      // throttle the visible churn; the final frame always draws exact text
      if (now - lastDraw >= FRAME_MS || t >= 1) {
        lastDraw = now;
        const locked = Math.floor(t * n); // chars settled to real value so far
        let out = '';
        for (let c = 0; c < n; c++) {
          out += c < locked ? real[c] : scrambleChar(real[c], rnd);
        }
        nmEl.textContent = out;
      }
      if (t >= 1) {
        nmEl.textContent = real; // end on the exact real text
        anims[idx] = 0;
        return;
      }
      anims[idx] = requestAnimationFrame(step);
    };
    anims[idx] = requestAnimationFrame(step);
  }

  /* Kick a staggered decode cascade over the current list's rows. */
  function runCascade() {
    const rows = Array.from(list.querySelectorAll('li'));
    rows.forEach((li, i) => {
      const nm = li.querySelector('.nm');
      const real = li.getAttribute('data-nm') || (nm ? nm.textContent : '');
      if (!nm) return;
      setTimeout(() => decodeLine(nm, real, i), i * STAGGER);
    });
  }

  /* Switch the list to a field. With parsed data we rebuild rows from it; without
     it we leave the existing rows in place (the server render or the last good
     state). Reduced motion settles to final text; otherwise we cascade-decode. */
  function selectKey(key, { decode = true } = {}) {
    activeKey = key;

    const items = itemsFor(key);
    if (items) {
      if (reduce || !decode) {
        render(items);                 // instant, final text
      } else {
        cancelAll();
        render(items, { blankNames: true });
        runCascade();
      }
    } else if (decode && !reduce) {
      // No JSON for this key: decode whatever rows are already on the page so a
      // chip press still feels responsive, then resettle to the same text.
      cancelAll();
      runCascade();
    }
    // else: nothing parseable to change; leave the rendered list as-is.
  }

  /* Mark one chip selected, clear the rest, and move roving tabindex onto it. */
  function setActiveChip(chip) {
    for (const c of chips) {
      const on = c === chip;
      c.setAttribute('aria-selected', on ? 'true' : 'false');
      c.tabIndex = on ? 0 : -1;
    }
  }

  // Seed roving tabindex from the server-rendered selection (first chip).
  let initialChip = chips.find((c) => c.getAttribute('aria-selected') === 'true') || chips[0];
  setActiveChip(initialChip);
  activeKey = initialChip.getAttribute('data-industry');

  // --- Chip interaction ----------------------------------------------------
  function activate(chip) {
    if (!chip) return;
    const key = chip.getAttribute('data-industry');
    setActiveChip(chip);
    // Re-selecting the already-shown field still re-runs its decode: a small,
    // honest "yes, that one" rather than a dead click.
    selectKey(key, { decode: true });
  }

  chipBox.addEventListener('click', (e) => {
    const chip = e.target.closest('.ex-chip');
    if (chip && chips.includes(chip)) activate(chip);
  });

  chipBox.addEventListener('keydown', (e) => {
    const chip = e.target.closest('.ex-chip');
    if (!chip || !chips.includes(chip)) return;
    const i = chips.indexOf(chip);

    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      activate(chip);
      return;
    }
    // Arrow keys move selection between chips (roving focus).
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % chips.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + chips.length) % chips.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = chips.length - 1;
    if (next < 0) return;

    e.preventDefault();
    const target = chips[next];
    target.focus();
    activate(target);
  });

  // --- First reveal --------------------------------------------------------
  // When the section scrolls into view, decode the already-rendered first list
  // once so it matches the feel of a chip switch. Under reduced motion we do
  // nothing here; the server render is already final and legible.
  let disposeVisible = () => {};
  if (!reduce) {
    disposeVisible = onVisible(root, () => {
      const rows = Array.from(list.querySelectorAll('li'));
      if (!rows.length) return;
      cancelAll();
      // Blank the names in place, then cascade, without rebuilding the DOM:
      // keeps the server-rendered rows and their data-nm intact.
      rows.forEach((li) => {
        const nm = li.querySelector('.nm');
        if (nm) nm.textContent = '';
      });
      runCascade();
    });
  }

  // --- Disposer ------------------------------------------------------------
  return () => {
    cancelAll();
    disposeVisible();
    // Listeners are bound to chipBox, which lives inside root; dropping our
    // references is enough for GC once the section is torn down, but settle the
    // visible state so a re-init starts from clean, final text.
    const rows = Array.from(list.querySelectorAll('li'));
    for (const li of rows) {
      const nm = li.querySelector('.nm');
      const real = li.getAttribute('data-nm');
      if (nm && real != null) nm.textContent = real;
    }
  };
}