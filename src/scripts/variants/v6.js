/* =============================================================================
   v6.js - "PROBE"
   -----------------------------------------------------------------------------
   The landing is an intake, not a brochure. From load the screen fills and asks
   the visitor what software they keep building by hand, one short step at a time.
   Each answer drops a labelled node into a living physarum (slime-mold) network
   on the background; the network grows toward the nodes and connects them. At the
   close the proposed-tool node lights up and the field resolves a path through
   all the answers to it.

   Two engines:
   1. PHYSARUM FIELD. The classic agent transport model in vanilla canvas2D. A
      Float32 trail grid at half resolution; a few thousand agents that sense the
      trail ahead with three sensors (left, centre, right), turn toward the
      strongest, step forward, and deposit onto the trail. Each frame the trail
      diffuses (a cheap 3x3 blur) and decays. Rendered as a soft glowing field
      warm-white at the cores tinted toward studio-blue, on the dark ground. Each
      answer seeds a strong attractant well at a node position so the veins grow
      to it and link the accumulating nodes.
   2. THE INTAKE. A small state machine over a fixed sequence of steps. Domain +
      pain map through a lookup table over the real catalogue to one proposed
      tool. Real, selectable, keyboard-operable DOM controls; the canvas is
      decorative and aria-hidden.

   GOTCHA notes carried from variant 5:
   - fitCanvas calls onResize SYNCHRONOUSLY; grab ctx before calling it.
   - the field canvas is OPAQUE: cleared to the ground each frame, light added on
     top, so it never re-darkens at page composite.
   - reduced motion: render ONE settled frame, all transitions instant, the form
     fully usable.

   House rule: no em dashes or en dashes anywhere, including comments. Use ' - ',
   commas, periods.
============================================================================= */

import {
  prefersReducedMotion, rafLoop, fitCanvas, mulberry32, readPalette,
} from '../glyph-core.js';

const reduced = prefersReducedMotion();

/* small math */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;

function hexToRgb(h) {
  const s = (h || '#000').trim().replace('#', '');
  const n = parseInt(s.length === 3 ? s.split('').map((c) => c + c).join('') : s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/* =============================================================================
   THE INTAKE MODEL
   The step sequence + the answer-to-tool lookup. The vocabulary is the real
   catalogue: content.en field examples and bench items. Copy lives here so the
   page stays one source of truth; the Astro page renders the same definitions.
============================================================================= */

/* domains, in content.en.fields.examples order. value is the lookup key. */
const DOMAINS = [
  'Studios', 'Brands', 'Galleries', 'Music', 'Film',
  'Architecture', 'Events', 'New media', 'Shops', 'Admin',
];

/* the pain a visitor keeps solving by hand. Each carries a key the mapper uses. */
const PAINS = [
  { k: 'export', label: 'the same export, over and over' },
  { k: 'layout', label: 'laying the same thing out again' },
  { k: 'spreadsheet', label: 'wrangling a spreadsheet into shape' },
  { k: 'template', label: 'formatting to a template' },
  { k: 'calc', label: 'calculating the same numbers' },
  { k: 'files', label: 'chasing and renaming files' },
  { k: 'other', label: 'something else' },
];

const STARTS = [
  'a finished design', 'a spreadsheet or CSV', 'a folder of files',
  'a list in my head', 'a camera or sensor', 'nothing yet',
];

const RUNNERS = ['just me', 'my team', 'a client, on their own'];

/* The mapper. Combine domain (step 1) and pain (step 2) into one named tool with
   a one or two line description in Kindl's voice. A sensible lookup table over
   the real catalogue, not clever AI. Tool names and lines are drawn from / adapt
   content.en bench items and field examples. */
const TOOLS = {
  'identity':   { nm: 'Identity generator', d: 'Your finished visual, rebuilt as a generator your team runs alone. On brand every time, without you in the loop.' },
  'poster':     { nm: 'Poster generator', d: 'One layout, every version of the run, made on the spot. The repeating part, instantly, in your style.' },
  'catalogue':  { nm: 'Exhibition catalogue from CSV', d: 'A spreadsheet of works in, a laid-out catalogue out. The same export, off your desk for good.' },
  'labels':     { nm: 'Label and wall-text generator', d: 'One sheet of works, a full set of labels and wall texts to your template, ready to print.' },
  'stageplot':  { nm: 'Stage plot and rider', d: 'A parametric stage plot and rider. The file stays editable. The JPG that never quite fit is gone.' },
  'releaseforge': { nm: 'Release forge', d: 'Your release metadata, formatted once and exported to every place it has to go.' },
  'callsheet':  { nm: 'Call sheet generator', d: 'A shoot day in, a clean call sheet out, to your format, every time.' },
  'rename':     { nm: 'Footage batch-rename', d: 'A folder of files in, named and sorted to your scheme. The chasing and renaming, done once.' },
  'areacalc':   { nm: 'Material, area and cost calc', d: 'The same numbers you run on paper, parametric and reusable, so the next quote is one input away.' },
  'moodboard':  { nm: 'Moodboard generator', d: 'A folder of references in, a laid-out board out, in your studio style.' },
  'seating':    { nm: 'Seating and table layout', d: 'Room and headcount in, a seating plan out. The layout you keep redrawing, parametric.' },
  'runofshow':  { nm: 'Run-of-show and cue sheet', d: 'A show in, a clean cue sheet and run-of-show out. The template fills itself.' },
  'eventbudget':{ nm: 'Event budget calculator', d: 'The same numbers you run for every event, parametric and reusable.' },
  'poseosc':    { nm: 'pose-to-OSC', d: 'Your body into OSC, in the browser, no heavy setup. The kind of utility new media shares.' },
  'wiringbom':  { nm: 'Wiring diagram and BOM', d: 'Your installation parts in, a wiring diagram and bill of materials out, every revision.' },
  'pixelmap':   { nm: 'Pixel mapper', d: 'Your fixture layout in, a pixel map out. The mapping you keep redoing by hand, parametric.' },
  'mockup':     { nm: 'Product mockup generator', d: 'A folder of product shots in, a set of on-brand mockups out, in one pass.' },
  'pricelabel': { nm: 'Price label and QR generator', d: 'A spreadsheet of products in, a set of labels and QR codes out, to your template.' },
  'pricecalc':  { nm: 'Product-price calculator', d: 'The same margins and costs you run by hand, parametric, so a price is one input away.' },
  'watermark':  { nm: 'Batch watermark and resize', d: 'A folder of images in, watermarked and resized out, in one pass.' },
  'invoice':    { nm: 'Custom invoice generator', d: 'Your invoice, exactly your layout, filled from a line or a spreadsheet, every time.' },
  'csvreport':  { nm: 'CSV report dashboard', d: 'A spreadsheet in, a readable report out. The wrangling, done once and reusable.' },
  'format':     { nm: 'Format converter', d: 'A file in one shape, the same file in the shape you need. The conversion you keep doing by hand.' },
  'generic':    { nm: 'A tool the exact size of your task', d: 'Tell me the task and the shape of your data; I build the tool around it, in your style, and hand it over.' },
};

/* domain -> default pain -> tool key. A small, considered table. Where a domain
   has no specific tool for a pain, it falls through to a sensible studio default
   or the generic 'made to order' answer. */
const MAP = {
  'Studios':      { export: 'identity', layout: 'poster', template: 'poster', spreadsheet: 'csvreport', calc: 'pricecalc', files: 'watermark', _: 'identity' },
  'Brands':       { export: 'identity', layout: 'poster', template: 'poster', spreadsheet: 'csvreport', calc: 'pricecalc', files: 'watermark', _: 'identity' },
  'Galleries':    { export: 'catalogue', layout: 'catalogue', template: 'labels', spreadsheet: 'catalogue', calc: 'areacalc', files: 'rename', _: 'catalogue' },
  'Music':        { export: 'releaseforge', layout: 'stageplot', template: 'stageplot', spreadsheet: 'releaseforge', calc: 'eventbudget', files: 'rename', _: 'stageplot' },
  'Film':         { export: 'callsheet', layout: 'callsheet', template: 'callsheet', spreadsheet: 'csvreport', calc: 'eventbudget', files: 'rename', _: 'callsheet' },
  'Architecture': { export: 'moodboard', layout: 'moodboard', template: 'areacalc', spreadsheet: 'areacalc', calc: 'areacalc', files: 'rename', _: 'areacalc' },
  'Events':       { export: 'seating', layout: 'seating', template: 'runofshow', spreadsheet: 'eventbudget', calc: 'eventbudget', files: 'rename', _: 'seating' },
  'New media':    { export: 'poseosc', layout: 'pixelmap', template: 'wiringbom', spreadsheet: 'wiringbom', calc: 'wiringbom', files: 'rename', _: 'poseosc' },
  'Shops':        { export: 'mockup', layout: 'pricelabel', template: 'pricelabel', spreadsheet: 'pricelabel', calc: 'pricecalc', files: 'watermark', _: 'mockup' },
  'Admin':        { export: 'invoice', layout: 'invoice', template: 'invoice', spreadsheet: 'csvreport', calc: 'csvreport', files: 'format', _: 'invoice' },
};

/* "for whom" line from the chosen domain, in lower-key catalogue language. */
const FOR = {
  'Studios': 'in-house and design teams', 'Brands': 'brands and agencies',
  'Galleries': 'curators and galleries', 'Music': 'touring and labels',
  'Film': 'production and editors', 'Architecture': 'architects and interiors',
  'Events': 'event production', 'New media': 'VJ and installation',
  'Shops': 'e-shops and makers', 'Admin': 'studios and firms',
};

function resolveTool(answers) {
  const domain = answers.domain;
  const pain = answers.pain; // a key
  if (!domain) return TOOLS.generic;
  const row = MAP[domain];
  if (!row) return TOOLS.generic;
  if (pain === 'other' || !pain) {
    // an open answer: offer the domain default, or generic if truly none
    return TOOLS[row._] || TOOLS.generic;
  }
  return TOOLS[row[pain] || row._] || TOOLS.generic;
}

/* =============================================================================
   THE PHYSARUM FIELD
   Float32 trail grid at half resolution. Agents sense, turn, move, deposit. Trail
   diffuses + decays each frame. Rendered as a glowing field with attractant wells
   seeded at the answer nodes so the network grows to them and connects them.
============================================================================= */
function initField(canvas, host) {
  const ctx = canvas.getContext('2d');                 // grab BEFORE fitCanvas
  if (!ctx) return { seedNode() {}, reset() {}, resolve() {}, dispose() {} };

  const pal = readPalette();
  const ACCENT = hexToRgb(pal.accent || '#362cca');     // [54,44,202]
  const ACCENT_LIT = hexToRgb('#6f66e6');
  const PAPER = hexToRgb('#efeae0');
  const GROUND = hexToRgb('#07080d');

  const isSmall = Math.min(window.innerWidth, window.innerHeight) < 720;
  const SCALE = isSmall ? 3 : 2;                        // canvas px per grid cell
  const N_AGENTS = reduced ? 2600 : (isSmall ? 1500 : 5000);

  // simulation tunables
  const SENSE_DIST = isSmall ? 7 : 9;                   // sensor reach (grid cells)
  const SENSE_ANG = 0.5;                                // sensor offset angle (rad)
  const TURN = 0.42;                                    // turn speed toward strongest
  const SPEED = isSmall ? 0.9 : 1.05;                   // step length (grid cells)
  const DEPOSIT = 5.2;                                  // trail laid per step
  const DECAY = 0.92;                                   // trail multiplied each frame
  const WELL_DEPOSIT = 26;                              // attractant kept at a node
  const WELL_FALLOFF = 0.985;                           // wells fade slowly over time

  let cssW = 1, cssH = 1, dpr = 1;
  let gw = 1, gh = 1;                                   // grid dimensions
  let trail = new Float32Array(1);
  let next = new Float32Array(1);

  // agents: position (grid space), heading
  let ax = new Float32Array(N_AGENTS);
  let ay = new Float32Array(N_AGENTS);
  let ah = new Float32Array(N_AGENTS);
  const rng = mulberry32(60606);

  // attractant wells: persistent deposit points the nodes sit on. {gx, gy, str}
  const wells = [];
  // a faint connective bias toward the centroid of placed nodes, so the network
  // reads as linking the answers rather than drifting apart.
  let cx = 0.5, cy = 0.5; // centroid in 0..1

  // offscreen low-res buffer we paint the trail into, then upscale with smoothing
  let buf = document.createElement('canvas');
  let bctx = buf.getContext('2d');
  let img = null;

  function allocGrid() {
    // half-resolution trail grid, but bounded so the diffuse + render loops stay
    // cheap on large displays: pick the larger of the base scale and the scale
    // that keeps the longest grid side under GRID_MAX cells.
    const GRID_MAX = isSmall ? 240 : 420;
    const longSide = Math.max(cssW, cssH);
    const effScale = Math.max(SCALE, longSide / GRID_MAX);
    gw = Math.max(2, Math.ceil(cssW / effScale));
    gh = Math.max(2, Math.ceil(cssH / effScale));
    trail = new Float32Array(gw * gh);
    next = new Float32Array(gw * gh);
    buf.width = gw; buf.height = gh;
    bctx = buf.getContext('2d');
    img = bctx.createImageData(gw, gh);
  }

  function spawnAgents() {
    // seed agents in a loose disc near centre so the first growth reads as a
    // gather, with random headings
    const mx = gw * 0.5, my = gh * 0.5;
    const r = Math.min(gw, gh) * 0.28;
    for (let i = 0; i < N_AGENTS; i++) {
      const a = rng() * TAU;
      const rr = Math.sqrt(rng()) * r;
      ax[i] = clamp(mx + Math.cos(a) * rr, 1, gw - 2);
      ay[i] = clamp(my + Math.sin(a) * rr, 1, gh - 2);
      ah[i] = rng() * TAU;
    }
  }

  const onResize = (w, h) => {
    cssW = w; cssH = h;
    allocGrid();
    spawnAgents();
    // re-place wells in grid space from their stored 0..1 coords
    for (const wl of wells) { wl.gx = wl.nx * gw; wl.gy = wl.ny * gh; }
    if (reduced) renderStatic();
  };

  const view = fitCanvas(canvas, { onResize });        // calls onResize now
  dpr = view.dpr;

  /* ----- sampling helpers (clamped grid reads) ----- */
  function sense(gx, gy, heading, off) {
    const a = heading + off;
    const sx = gx + Math.cos(a) * SENSE_DIST;
    const sy = gy + Math.sin(a) * SENSE_DIST;
    const ix = clamp(sx | 0, 0, gw - 1);
    const iy = clamp(sy | 0, 0, gh - 1);
    return trail[iy * gw + ix];
  }

  /* ----- one simulation step: sense, turn, move, deposit ----- */
  function step() {
    // recompute centroid pull target from wells
    if (wells.length) {
      let sx = 0, sy = 0;
      for (const wl of wells) { sx += wl.nx; sy += wl.ny; }
      cx = sx / wells.length; cy = sy / wells.length;
    }
    const cgx = cx * gw, cgy = cy * gh;

    for (let i = 0; i < N_AGENTS; i++) {
      const x = ax[i], y = ay[i], h = ah[i];
      // three sensors
      const fc = sense(x, y, h, 0);
      const fl = sense(x, y, h, -SENSE_ANG);
      const fr = sense(x, y, h, SENSE_ANG);
      let nh = h;
      if (fc > fl && fc > fr) {
        // keep heading
      } else if (fc < fl && fc < fr) {
        // both sides stronger: turn randomly left or right
        nh += (rng() < 0.5 ? -1 : 1) * TURN;
      } else if (fl < fr) {
        nh += TURN;
      } else if (fr < fl) {
        nh -= TURN;
      }
      // a gentle pull toward the node centroid keeps the web linking the answers
      if (wells.length > 1) {
        const toC = Math.atan2(cgy - y, cgx - x);
        let dd = toC - nh;
        while (dd > Math.PI) dd -= TAU;
        while (dd < -Math.PI) dd += TAU;
        nh += dd * 0.012;
      }
      // a touch of wander so the veins do not over-straighten
      nh += (rng() - 0.5) * 0.08;

      let nx = x + Math.cos(nh) * SPEED;
      let ny = y + Math.sin(nh) * SPEED;
      // bounce off the edges with a randomised reflection so agents stay on field
      if (nx < 1 || nx >= gw - 1 || ny < 1 || ny >= gh - 1) {
        nx = clamp(nx, 1, gw - 2);
        ny = clamp(ny, 1, gh - 2);
        nh = rng() * TAU;
      }
      ax[i] = nx; ay[i] = ny; ah[i] = nh;
      // deposit
      const di = ((ny | 0) * gw + (nx | 0));
      trail[di] += DEPOSIT;
    }

    // keep attractant wells topped up so growth keeps heading to the nodes
    for (const wl of wells) {
      wl.str *= WELL_FALLOFF;
      const r = 2;
      const igx = wl.gx | 0, igy = wl.gy | 0;
      for (let oy = -r; oy <= r; oy++) {
        for (let ox = -r; ox <= r; ox++) {
          const px = igx + ox, py = igy + oy;
          if (px < 0 || px >= gw || py < 0 || py >= gh) continue;
          const fall = 1 - (Math.abs(ox) + Math.abs(oy)) / (2 * r + 1);
          trail[py * gw + px] += WELL_DEPOSIT * wl.str * fall;
        }
      }
    }
  }

  /* ----- diffuse (cheap 3x3 average) + decay ----- */
  function diffuse() {
    const t = trail, o = next;
    for (let y = 0; y < gh; y++) {
      const y0 = (y > 0 ? y - 1 : 0) * gw;
      const y1 = y * gw;
      const y2 = (y < gh - 1 ? y + 1 : gh - 1) * gw;
      for (let x = 0; x < gw; x++) {
        const x0 = x > 0 ? x - 1 : 0;
        const x2 = x < gw - 1 ? x + 1 : gw - 1;
        const sum =
          t[y0 + x0] + t[y0 + x] + t[y0 + x2] +
          t[y1 + x0] + t[y1 + x] + t[y1 + x2] +
          t[y2 + x0] + t[y2 + x] + t[y2 + x2];
        o[y1 + x] = (sum * 0.1111111) * DECAY;
      }
    }
    // swap
    const tmp = trail; trail = next; next = tmp;
  }

  /* ----- render the trail as a glowing bioluminescent field ----- */
  function render() {
    const d = img.data;
    const gr0 = GROUND[0], gr1 = GROUND[1], gr2 = GROUND[2];
    const n = gw * gh;
    for (let i = 0; i < n; i++) {
      const v = trail[i];
      // soft response curve: dim background, blooming cores
      let m = v * 0.05;
      if (m > 1) m = 1;
      // tint: faint cores read studio-blue, bright cores warm paper-white
      // low intensity -> accent, high intensity -> paper, via a two-stage mix
      const t1 = m;                       // 0..1 overall brightness
      const warm = clamp((m - 0.45) / 0.55, 0, 1); // warms toward paper at the cores
      const rTip = lerp(ACCENT_LIT[0], PAPER[0], warm);
      const gTip = lerp(ACCENT_LIT[1], PAPER[1], warm);
      const bTip = lerp(ACCENT_LIT[2], PAPER[2], warm);
      const j = i * 4;
      d[j]     = clamp(gr0 + (rTip - gr0) * t1, 0, 255);
      d[j + 1] = clamp(gr1 + (gTip - gr1) * t1, 0, 255);
      d[j + 2] = clamp(gr2 + (bTip - gr2) * t1, 0, 255);
      d[j + 3] = 255;
    }
    bctx.putImageData(img, 0, 0);

    // upscale the low-res buffer with smoothing for a soft, organic glow
    ctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.drawImage(buf, 0, 0, gw, gh, 0, 0, cssW, cssH);

    // a faint additive bloom over the brightest wells so the nodes feel lit
    if (wells.length) {
      ctx.globalCompositeOperation = 'lighter';
      for (const wl of wells) {
        const px = wl.nx * cssW, py = wl.ny * cssH;
        const rad = (wl.tool ? 90 : 54) * (0.7 + wl.str * 0.6);
        const g = ctx.createRadialGradient(px, py, 0, px, py, rad);
        const tip = wl.tool ? PAPER : ACCENT_LIT;
        const a = (wl.tool ? 0.20 : 0.10) * clamp(wl.str, 0, 1);
        g.addColorStop(0, `rgba(${tip[0]},${tip[1]},${tip[2]},${a})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(px - rad, py - rad, rad * 2, rad * 2);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  /* ----- one settled static frame for reduced motion ----- */
  function renderStatic() {
    if (gw <= 2 || gh <= 2) return;
    // run a fixed number of steps to settle a pleasing web, then render once
    trail.fill(0);
    spawnAgents();
    // if no wells, seed a few quiet anchors so the static frame has structure
    const hadWells = wells.length > 0;
    if (!hadWells) {
      const pts = [[0.32, 0.36], [0.68, 0.34], [0.5, 0.62], [0.28, 0.66], [0.72, 0.66]];
      for (const [nx, ny] of pts) wells.push({ nx, ny, gx: nx * gw, gy: ny * gh, str: 1, tool: false });
    }
    for (let s = 0; s < 90; s++) { step(); diffuse(); }
    render();
    if (!hadWells) wells.length = 0;
  }

  /* ----- public: drop an attractant well at a node (0..1 coords) ----- */
  function seedNode(nx, ny, tool) {
    const w = { nx, ny, gx: nx * gw, gy: ny * gh, str: 1.2, tool: !!tool };
    wells.push(w);
    // a sharp local deposit so growth heads there immediately
    const igx = w.gx | 0, igy = w.gy | 0, r = 4;
    for (let oy = -r; oy <= r; oy++) {
      for (let ox = -r; ox <= r; ox++) {
        const px = igx + ox, py = igy + oy;
        if (px < 0 || px >= gw || py < 0 || py >= gh) continue;
        const dist = Math.hypot(ox, oy);
        if (dist > r) continue;
        trail[py * gw + px] += 140 * (1 - dist / r);
      }
    }
    if (reduced) renderStatic();
  }

  /* ----- public: at the close, light the tool node and pull the web to it ----- */
  function resolve(nx, ny) {
    seedNode(nx, ny, true);
    // strengthen the tool well so the network resolves a path to it
    const wl = wells[wells.length - 1];
    wl.str = 2.2;
    if (reduced) renderStatic();
  }

  /* ----- public: clear back to the opening state (start over) ----- */
  function reset() {
    wells.length = 0;
    cx = 0.5; cy = 0.5;
    trail.fill(0);
    spawnAgents();
    if (reduced) renderStatic();
  }

  /* ----- run ----- */
  if (reduced) {
    renderStatic();
    return { seedNode, reset, resolve, dispose: () => view.dispose() };
  }

  // prime a couple of steps so the first visible frame is not empty
  for (let s = 0; s < 8; s++) { step(); diffuse(); }

  let visible = true;
  const stop = rafLoop(() => {
    if (!visible) return;
    step();
    diffuse();
    render();
  }, { fps: 60 });

  // pause when the host is off-screen (defensive; it usually fills the screen)
  let io = null;
  if ('IntersectionObserver' in window && host) {
    io = new IntersectionObserver((entries) => {
      for (const e of entries) visible = e.isIntersecting;
    }, { threshold: 0 });
    io.observe(host);
  }

  return {
    seedNode,
    reset,
    resolve,
    dispose: () => { stop(); view.dispose(); if (io) io.disconnect(); },
  };
}

/* =============================================================================
   THE INTAKE CONTROLLER
   Drives the step sequence, the DOM controls, the progress trace, the node chips,
   and hands node positions + the resolve to the field.
============================================================================= */
function initIntake(field) {
  const intake = document.querySelector('[data-intake]');
  const nodesHost = document.querySelector('[data-nodes]');
  if (!intake || !nodesHost) return;

  const stepWrap = intake.querySelector('[data-step]');
  const traceWrap = intake.querySelector('[data-trace]');

  // answers gathered across the run
  const answers = { domain: null, pain: null, painLabel: null, start: null, runner: null, wish: '' };

  // node positions: a calm, deterministic constellation so the web reads as a
  // map of the answers. Coordinates in 0..1. The tool sits at the centre-low,
  // where the veins resolve.
  const NODE_POS = [
    [0.27, 0.30],  // step 1 domain
    [0.71, 0.31],  // step 2 pain
    [0.24, 0.66],  // step 3 start
    [0.74, 0.67],  // step 4 runner
    [0.5, 0.24],   // step 5 wish (optional)
  ];
  const TOOL_POS = [0.5, 0.58];

  let stepIndex = 0;
  const placedNodes = []; // {el, idx}

  /* ----- the step definitions. Each renders its own controls. ----- */
  const steps = [
    {
      kicker: 'step 1',
      q: 'What do you make?',
      hint: 'Pick the closest. It points the tool at the right kind of work.',
      build: () => choiceStep(DOMAINS.map((d) => ({ value: d, label: d })), 'single', (v) => {
        answers.domain = v.value;
        return v.label;
      }, () => answers.domain),
    },
    {
      kicker: 'step 2',
      q: 'What do you keep doing by hand?',
      hint: 'The repeating part. The thing you wish a tool just did for you.',
      build: () => choiceStep(PAINS.map((p) => ({ value: p.k, label: p.label })), 'single', (v) => {
        answers.pain = v.value;
        answers.painLabel = v.label;
        return v.label;
      }, () => answers.pain),
    },
    {
      kicker: 'step 3',
      q: 'What does the work start from?',
      hint: 'The shape of your input. It decides what the tool reads.',
      build: () => choiceStep(STARTS.map((s) => ({ value: s, label: s })), 'single', (v) => {
        answers.start = v.value;
        return v.label;
      }, () => answers.start),
    },
    {
      kicker: 'step 4',
      q: 'Who runs it?',
      hint: 'It changes how the tool is handed over.',
      build: () => choiceStep(RUNNERS.map((r) => ({ value: r, label: r })), 'single', (v) => {
        answers.runner = v.value;
        return v.label;
      }, () => answers.runner),
    },
    {
      kicker: 'step 5, optional',
      q: 'The tool you wish existed:',
      hint: 'One line, in your words. Or leave it and I will read the shape of your answers.',
      free: true,
      build: () => freeStep(),
    },
  ];

  const TOTAL = steps.length; // 5 question steps, then the synthesis

  /* ----- build the progress trace cells (one per step + the synthesis) ----- */
  function buildTrace() {
    traceWrap.innerHTML = '';
    for (let i = 0; i <= TOTAL; i++) {
      const cell = document.createElement('span');
      cell.className = 'v6-trace__cell';
      traceWrap.appendChild(cell);
    }
  }
  function paintTrace(active) {
    const cells = traceWrap.querySelectorAll('.v6-trace__cell');
    cells.forEach((c, i) => {
      c.classList.toggle('is-done', i < active);
      c.classList.toggle('is-now', i === active);
    });
  }

  /* ----- a single / multi choice step body ----- */
  function choiceStep(options, mode, onPick, getCurrent) {
    const frag = document.createElement('div');
    const list = document.createElement('div');
    list.className = 'v6-opts';
    list.setAttribute('role', mode === 'single' ? 'radiogroup' : 'group');
    list.setAttribute('aria-label', 'options');

    options.forEach((opt) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'v6-opt';
      btn.setAttribute('role', mode === 'single' ? 'radio' : 'checkbox');
      const sel = getCurrent() === opt.value;
      btn.setAttribute(mode === 'single' ? 'aria-checked' : 'aria-pressed', String(sel));
      btn.innerHTML = '<span class="v6-opt__mark" aria-hidden="true"></span><span class="v6-opt__label"></span>';
      btn.querySelector('.v6-opt__label').textContent = opt.label;
      btn.addEventListener('click', () => {
        // single select: clear siblings
        list.querySelectorAll('.v6-opt').forEach((b) => b.setAttribute('aria-checked', 'false'));
        btn.setAttribute('aria-checked', 'true');
        const label = onPick(opt);
        // advance after a short, calm beat so the choice is seen
        advanceWithNode(label);
      });
      list.appendChild(btn);
    });
    frag.appendChild(list);
    return { el: frag, focus: () => list.querySelector('.v6-opt')?.focus(), value: () => getCurrent() };
  }

  /* ----- the free-text step body ----- */
  function freeStep() {
    const frag = document.createElement('div');
    const wrap = document.createElement('div');
    wrap.className = 'v6-field-wrap';
    const id = 'v6-wish';
    const input = document.createElement('input');
    input.type = 'text';
    input.id = id;
    input.className = 'v6-input';
    input.placeholder = 'e.g. turn our CSV into a laid-out catalogue';
    input.value = answers.wish || '';
    input.setAttribute('aria-label', 'the tool you wish existed');
    input.maxLength = 120;
    // enter submits the step
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commitFree(); }
    });
    wrap.appendChild(input);
    frag.appendChild(wrap);
    return {
      el: frag,
      focus: () => input.focus(),
      value: () => input.value.trim(),
      commit: () => { answers.wish = input.value.trim(); },
      input,
    };
  }

  /* ----- node placement: drop a labelled chip over the field, seed the well ----- */
  function placeNode(idx, label, isTool) {
    const pos = isTool ? TOOL_POS : NODE_POS[idx];
    if (!pos) return;
    const el = document.createElement('div');
    el.className = 'v6-node' + (isTool ? ' v6-node--tool' : '');
    el.style.left = (pos[0] * 100).toFixed(2) + '%';
    el.style.top = (pos[1] * 100).toFixed(2) + '%';
    el.innerHTML = '<span class="v6-node__dot" aria-hidden="true"></span><span class="v6-node__txt"></span>';
    el.querySelector('.v6-node__txt').textContent = label;
    nodesHost.appendChild(el);
    placedNodes.push({ el, idx });
    // reveal on next frame so the transition runs
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-in')));
    // seed the field
    if (isTool) field.resolve(pos[0], pos[1]);
    else field.seedNode(pos[0], pos[1], false);
  }

  /* ----- step transition machinery ----- */
  let current = null; // the active step body { el, focus, value, ... }

  function renderStep(i, dir) {
    stepIndex = i;

    if (i >= steps.length) { renderSynthesis(dir); return; }

    const def = steps[i];
    // build the new step DOM offscreen
    const body = def.build();
    const stepEl = document.createElement('div');
    stepEl.className = 'v6-step';
    stepEl.setAttribute('role', 'group');
    stepEl.setAttribute('aria-label', def.q);

    const kicker = document.createElement('p');
    kicker.className = 'v6-kicker';
    kicker.textContent = def.kicker;
    // only the first step is the page h1; later steps are h2 for a sane outline
    const q = document.createElement(i === 0 ? 'h1' : 'h2');
    q.className = 'v6-q';
    q.textContent = def.q;

    stepEl.appendChild(kicker);
    stepEl.appendChild(q);
    if (def.hint) {
      const hint = document.createElement('p');
      hint.className = 'v6-hint';
      hint.textContent = def.hint;
      stepEl.appendChild(hint);
    }
    stepEl.appendChild(body.el);

    // controls row: back, spacer, count, and (free step) a continue button
    const controls = document.createElement('div');
    controls.className = 'v6-controls';

    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'v6-ctrl v6-ctrl--back';
    back.innerHTML = '<span aria-hidden="true">←</span> back';
    back.addEventListener('click', () => goBack());
    if (i === 0) back.hidden = true;
    controls.appendChild(back);

    const spacer = document.createElement('span');
    spacer.className = 'v6-spacer';
    controls.appendChild(spacer);

    const count = document.createElement('span');
    count.className = 'v6-count';
    count.textContent = String(i + 1).padStart(2, '0') + ' / ' + String(TOTAL).padStart(2, '0');
    controls.appendChild(count);

    if (def.free) {
      const next = document.createElement('button');
      next.type = 'button';
      next.className = 'v6-ctrl v6-ctrl--next';
      next.innerHTML = 'see the tool <span class="v6-ctrl__arrow" aria-hidden="true">→</span>';
      next.addEventListener('click', () => commitFree());
      controls.appendChild(next);
    }
    stepEl.appendChild(controls);

    swapStep(stepEl, dir);
    current = body;
    paintTrace(i);

    // focus management: move focus into the new step for keyboard users
    if (!reduced) {
      // wait for the entering transition to settle a touch
      setTimeout(() => body.focus && body.focus(), 60);
    } else {
      body.focus && body.focus();
    }
  }

  function swapStep(newEl, dir) {
    const old = stepWrap.firstElementChild;
    if (old && !reduced) {
      old.classList.add('is-leaving');
      newEl.classList.add('is-entering');
      stepWrap.appendChild(newEl);
      // force reflow then drop the entering class so it transitions in
      void newEl.offsetWidth;
      requestAnimationFrame(() => newEl.classList.remove('is-entering'));
      setTimeout(() => { if (old.parentNode === stepWrap) stepWrap.removeChild(old); }, 360);
    } else {
      stepWrap.innerHTML = '';
      stepWrap.appendChild(newEl);
    }
  }

  /* advance from a single-choice step, dropping its node, then go next */
  function advanceWithNode(label) {
    placeNode(stepIndex, label, false);
    const beat = reduced ? 0 : 220;
    setTimeout(() => renderStep(stepIndex + 1, 1), beat);
  }

  /* commit the free-text step (optional), drop a node if filled, go to synth */
  function commitFree() {
    if (current && current.commit) current.commit();
    const wish = (answers.wish || '').trim();
    if (wish) placeNode(stepIndex, wish, false);
    setTimeout(() => renderStep(stepIndex + 1, 1), reduced ? 0 : 180);
  }

  /* step back: remove the last placed node + well is left in the field (the web
     keeps its memory, which reads as organic), but the node chip for the step we
     return to is cleared so re-answering re-drops it. */
  function goBack() {
    if (stepIndex <= 0) return;
    // remove the node placed for the step we are leaving behind (current minus one)
    const target = stepIndex - 1;
    for (let k = placedNodes.length - 1; k >= 0; k--) {
      if (placedNodes[k].idx === target) {
        placedNodes[k].el.remove();
        placedNodes.splice(k, 1);
      }
    }
    renderStep(target, -1);
  }

  /* ----- the synthesis screen ----- */
  function renderSynthesis(dir) {
    const tool = resolveTool(answers);
    const forWhom = FOR[answers.domain] || 'one task, one person';

    // light the tool node and pull the web to it
    placeNode(0, tool.nm, true);
    paintTrace(TOTAL);

    const synth = document.createElement('div');
    synth.className = 'v6-step v6-synth';
    synth.setAttribute('role', 'group');
    synth.setAttribute('aria-label', 'the tool that fits');

    const lead = document.createElement('p');
    lead.className = 'v6-synth__lead';
    lead.textContent = 'From what you said, this is the tool that fits';

    const name = document.createElement('h2');
    name.className = 'v6-synth__name';
    name.textContent = tool.nm;

    const desc = document.createElement('p');
    desc.className = 'v6-synth__desc';
    desc.textContent = tool.d;

    const forLine = document.createElement('p');
    forLine.className = 'v6-synth__for';
    forLine.innerHTML = 'for <b></b>';
    forLine.querySelector('b').textContent = forWhom;

    const links = document.createElement('div');
    links.className = 'v6-links';

    const primary = document.createElement('a');
    primary.className = 'v6-link v6-link--primary';
    primary.href = 'https://kindl.work';
    primary.target = '_blank';
    primary.rel = 'noopener';
    primary.innerHTML = 'start this tool <span aria-hidden="true">↗</span>';

    const bench = document.createElement('a');
    bench.className = 'v6-link';
    bench.href = 'https://kindl.work';
    bench.target = '_blank';
    bench.rel = 'noopener';
    bench.innerHTML = 'see the bench <span aria-hidden="true">↗</span>';

    const studio = document.createElement('a');
    studio.className = 'v6-link';
    studio.href = 'https://kindl.work';
    studio.target = '_blank';
    studio.rel = 'noopener';
    studio.innerHTML = 'the art studio <span aria-hidden="true">↗</span>';

    const restart = document.createElement('button');
    restart.type = 'button';
    restart.className = 'v6-restart';
    restart.innerHTML = '<span aria-hidden="true">↺</span> start over';
    restart.addEventListener('click', () => startOver());

    links.appendChild(primary);
    links.appendChild(bench);
    links.appendChild(studio);
    links.appendChild(restart);

    synth.appendChild(lead);
    synth.appendChild(name);
    synth.appendChild(desc);
    synth.appendChild(forLine);
    synth.appendChild(links);

    swapStep(synth, dir);
    current = null;

    if (!reduced) setTimeout(() => primary.focus(), 80);
    else primary.focus();
  }

  /* ----- start over: clear nodes + field, reset answers, return to step 1 ----- */
  function startOver() {
    placedNodes.forEach((n) => n.el.remove());
    placedNodes.length = 0;
    answers.domain = answers.pain = answers.painLabel = answers.start = answers.runner = null;
    answers.wish = '';
    field.reset();
    renderStep(0, -1);
  }

  /* ----- boot the intake ----- */
  buildTrace();
  renderStep(0, 1);
}

/* =============================================================================
   BOOT
============================================================================= */
function boot() {
  const canvas = document.getElementById('probe-field');
  const main = document.getElementById('main');
  if (!canvas) return;
  let field;
  try {
    field = initField(canvas, main);
  } catch (e) {
    // a no-op field so the intake still works if the canvas init ever throws
    field = { seedNode() {}, reset() {}, resolve() {}, dispose() {} };
  }
  try { initIntake(field); } catch (e) { /* leave the field running */ }

  window.addEventListener('pagehide', () => { try { field.dispose(); } catch (e) { /* ignore */ } }, { once: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
