/* =============================================================================
   v5.js - "FIELD"
   -----------------------------------------------------------------------------
   A hand-written WebGL point-cloud typography field you move through. The cloud
   spells words: each word is rasterised into an offscreen 2D canvas, the filled
   pixels become 3D points, and the points are rendered as gl.POINTS with a hand
   written vertex + fragment shader (perspective, soft round discs, depth fog,
   accent tint by z). The cloud drifts and breathes, looks toward the pointer,
   and on scroll reassembles into the active station's data-word while the camera
   dollies between stations.

   No three.js, no libraries. We get the WebGL context ourselves and manage our
   own buffers and shaders. If WebGL is unavailable we fall back to a 2D canvas
   glyph field (built on glyph-core) so the page keeps its atmosphere.

   The page also wires:
     - the #field-toggle pause / resume control (aria-pressed + dot state),
     - the .v5-trades tabs (show one .v5-trade-list, keyboard reachable).

   Reduced motion: one static, fully assembled cloud (the claim word), no drift,
   no dolly, no parallax. All real copy lives in DOM panels, never in the canvas.

   House rule: no em dashes or en dashes anywhere, including comments. Use ' - ',
   commas, periods.
============================================================================= */

import {
  prefersReducedMotion, makeNoise2D, mulberry32,
  rafLoop, fitCanvas, cellMetrics, readPalette,
} from '../glyph-core.js';

const reduced = prefersReducedMotion();

/* small math */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

/* the seven stations, in scroll order, with the word the cloud settles into.
   This mirrors data-word on each <section class="v5-station">; we read it from
   the DOM rather than hard-code, so the page is the source of truth. */

/* ---------------------------------------------------------------------------
   Rasterise a word into points. Draw the word big into an offscreen 2D canvas,
   read back the alpha channel, and emit one normalised point per filled pixel,
   strided so the total stays under a budget. Returns Float32Array [x,y, ...] in
   a -1..1 box (x right, y up), centred, aspect-corrected.
--------------------------------------------------------------------------- */
function wordPoints(word, budget) {
  const W = 1024, H = 320;
  const off = document.createElement('canvas');
  off.width = W; off.height = H;
  const o = off.getContext('2d', { willReadFrequently: true });
  o.clearRect(0, 0, W, H);
  o.fillStyle = '#fff';
  o.textAlign = 'center';
  o.textBaseline = 'middle';
  // a heavy serif fills densely and reads as the claim voice
  let size = 240;
  const family = "'IBM Plex Serif', Georgia, serif";
  o.font = `600 ${size}px ${family}`;
  // shrink to fit the offscreen width with margin
  let w = o.measureText(word).width;
  const maxW = W * 0.9;
  if (w > maxW) {
    size = Math.max(60, Math.floor(size * (maxW / w)));
    o.font = `600 ${size}px ${family}`;
    w = o.measureText(word).width;
  }
  o.fillText(word, W / 2, H / 2 + size * 0.02);

  const data = o.getImageData(0, 0, W, H).data;

  // collect filled pixels, then stride to the budget
  const filled = [];
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      const a = data[(y * W + x) * 4 + 3];
      if (a > 100) filled.push(x, y);
    }
  }
  const count = filled.length / 2;
  const stride = Math.max(1, Math.ceil(count / budget));

  const pts = [];
  const aspect = W / H;
  const rng = mulberry32(0x5EED ^ word.length);
  for (let i = 0; i < count; i += stride) {
    const x = filled[i * 2];
    const y = filled[i * 2 + 1];
    // normalise to -1..1, y up; jitter a touch so edges are not a hard stencil
    const nx = ((x / W) * 2 - 1) * aspect + (rng() - 0.5) * 0.01 * aspect;
    const ny = -((y / H) * 2 - 1) + (rng() - 0.5) * 0.01;
    pts.push(nx, ny);
  }
  return new Float32Array(pts);
}

/* ---------------------------------------------------------------------------
   Build the full target set for a word: N points in 3D. We take the 2D word
   point set and lend it depth + a stable per-point identity so the SAME index
   maps cleanly when we tween from one word to the next. Points beyond the word
   set wrap around (so two words with different counts still tween 1:1 against a
   fixed pool of N points).
--------------------------------------------------------------------------- */
function makeTargets(pool, word2d, scale, depth, rng) {
  // pool: number of points we keep alive across the whole life of the field.
  const out = new Float32Array(pool * 3);
  const wn = word2d.length / 2;
  for (let i = 0; i < pool; i++) {
    const s = (i % wn) * 2;
    const x = word2d[s] * scale;
    const y = word2d[s + 1] * scale;
    // depth: a thin slab so the word stays readable but has parallax volume
    const z = (rng() - 0.5) * depth;
    out[i * 3] = x;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = z;
  }
  return out;
}

/* =============================================================================
   THE WEBGL FIELD
============================================================================= */
function initFieldGL(canvas, stations, controls) {
  // get the GL context OURSELVES, before any synchronous resize callback
  // touches it (the fitCanvas TDZ discipline, applied to raw GL).
  // Opaque drawing buffer cleared to the ground colour, with additive point
  // glow on top. An alpha:true buffer with non-premultiplied additive blending
  // gets re-darkened by the small accumulated alpha at page-composite time, so
  // the points read as near-black. Opaque compositing avoids that entirely; the
  // depth fog is shaped by the .v5-vignette overlay above the canvas.
  const opts = { antialias: true, alpha: false, depth: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' };
  const gl = canvas.getContext('webgl2', opts) || canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
  if (!gl) return false;

  const pal = readPalette();
  const accent = hexToRgb(pal.accent || '#362cca');
  const paper = hexToRgb('#efeae0');

  const isSmall = Math.min(window.innerWidth, window.innerHeight) < 720;
  const POOL = reduced ? 4200 : (isSmall ? 3200 : 9000);

  /* ----- shaders ----------------------------------------------------------- */
  const vsrc = `
    attribute vec3 a_pos;
    attribute float a_rnd;
    uniform mat3 u_rot;        // mouse-look + drift rotation
    uniform vec3 u_cam;        // camera offset (dolly via z)
    uniform float u_fov;       // focal length
    uniform float u_size;      // base point size in px
    uniform float u_aspect;    // width / height
    uniform float u_dpr;
    varying mediump float v_depth;     // 0 (near) .. 1 (far), for fog + tint
    varying mediump float v_rnd;
    void main() {
      vec3 p = u_rot * a_pos;
      p += u_cam;
      // simple perspective: divide by distance from camera along -z
      float zc = max(0.001, -p.z + u_fov);
      vec2 proj = vec2(p.x, p.y) * (u_fov / zc);
      proj.x /= u_aspect;
      gl_Position = vec4(proj, 0.0, 1.0);
      // point size falls off with distance; a touch of per-point variance
      float ps = u_size * u_dpr * (u_fov / zc) * (0.7 + a_rnd * 0.6);
      gl_PointSize = clamp(ps, 0.5, 36.0 * u_dpr);
      // depth normalised across a working slab for fog / tint
      v_depth = clamp((zc - u_fov * 0.5) / (u_fov * 1.6), 0.0, 1.0);
      v_rnd = a_rnd;
    }
  `;
  const fsrc = `
    precision mediump float;
    uniform vec3 u_paper;
    uniform vec3 u_accent;
    uniform float u_alpha;     // global field alpha (entrance + pause fade)
    varying mediump float v_depth;
    varying mediump float v_rnd;
    void main() {
      // soft round disc from point coord
      vec2 d = gl_PointCoord - vec2(0.5);
      float r = length(d);
      float a = smoothstep(0.5, 0.18, r);
      if (a <= 0.0) discard;
      // colour: paper near, tinted toward accent with depth, dimmed far
      vec3 col = mix(u_paper, u_accent, clamp(v_depth * 1.15, 0.0, 1.0));
      // a few points glint brighter (closer to accent-white)
      col += (v_rnd > 0.93 ? 0.25 : 0.0) * vec3(0.45, 0.42, 0.7);
      // depth fog: far points fade into the ground
      float fog = 1.0 - v_depth * 0.82;
      float alpha = a * u_alpha * fog * (0.55 + v_rnd * 0.45);
      gl_FragColor = vec4(col, alpha);
    }
  `;

  const prog = makeProgram(gl, vsrc, fsrc);
  if (!prog) return false;
  gl.useProgram(prog);

  const A_pos = gl.getAttribLocation(prog, 'a_pos');
  const A_rnd = gl.getAttribLocation(prog, 'a_rnd');
  const U_rot = gl.getUniformLocation(prog, 'u_rot');
  const U_cam = gl.getUniformLocation(prog, 'u_cam');
  const U_fov = gl.getUniformLocation(prog, 'u_fov');
  const U_size = gl.getUniformLocation(prog, 'u_size');
  const U_aspect = gl.getUniformLocation(prog, 'u_aspect');
  const U_dpr = gl.getUniformLocation(prog, 'u_dpr');
  const U_paper = gl.getUniformLocation(prog, 'u_paper');
  const U_accent = gl.getUniformLocation(prog, 'u_accent');
  const U_alpha = gl.getUniformLocation(prog, 'u_alpha');

  gl.uniform3f(U_paper, paper[0] / 255, paper[1] / 255, paper[2] / 255);
  gl.uniform3f(U_accent, accent[0] / 255, accent[1] / 255, accent[2] / 255);

  /* ----- per-point buffers ------------------------------------------------- */
  // live positions (what we draw), current velocity-free tween, and per-point rnd
  const pos = new Float32Array(POOL * 3);   // current drawn positions
  const tgt = new Float32Array(POOL * 3);   // target positions (active word)
  const rnd = new Float32Array(POOL);       // stable per-point random 0..1
  const seedRng = mulberry32(1337);
  for (let i = 0; i < POOL; i++) rnd[i] = seedRng();

  // start positions: a loose cloud sphere so the first assembly reads as a gather
  for (let i = 0; i < POOL; i++) {
    const a = seedRng() * Math.PI * 2;
    const b = Math.acos(2 * seedRng() - 1);
    const rr = 1.4 + seedRng() * 1.4;
    pos[i * 3] = Math.sin(b) * Math.cos(a) * rr;
    pos[i * 3 + 1] = Math.sin(b) * Math.sin(a) * rr;
    pos[i * 3 + 2] = Math.cos(b) * rr;
  }

  const posBuf = gl.createBuffer();
  const rndBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, rndBuf);
  gl.bufferData(gl.ARRAY_BUFFER, rnd, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW);

  /* ----- precompute word target sets --------------------------------------- */
  // unique words from the stations, each rasterised once
  const SCALE = 1.0;     // word half-extent in world units (x)
  const DEPTH = 0.55;    // slab depth
  const wordCache = new Map();
  const getTargets = (word) => {
    if (wordCache.has(word)) return wordCache.get(word);
    const w2d = wordPoints(word, Math.min(POOL, 7000));
    // a fresh deterministic rng per word so z slab is stable
    const r = mulberry32(0xA11CE ^ hashStr(word));
    const t = makeTargets(POOL, w2d, SCALE, DEPTH, r);
    wordCache.set(word, t);
    return t;
  };

  /* ----- GL viewport sizing ------------------------------------------------ */
  let cssW = 1, cssH = 1, dpr = 1, aspect = 1;
  const onResize = () => {
    const rect = canvas.getBoundingClientRect();
    cssW = Math.max(1, Math.round(rect.width));
    cssH = Math.max(1, Math.round(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    aspect = cssW / cssH;
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  onResize();
  const ro = ('ResizeObserver' in window) ? new ResizeObserver(onResize) : null;
  if (ro) ro.observe(canvas); else window.addEventListener('resize', onResize, { passive: true });

  /* ----- GL state ---------------------------------------------------------- */
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);       // additive: glints add up, reads as light

  /* ----- camera / interaction state --------------------------------------- */
  const state = {
    active: 0,            // active station index
    activeF: 0,           // smoothed station float (for dolly)
    targetActive: 0,
    pointerX: 0,          // -1..1 from window centre
    pointerY: 0,
    lookX: 0,             // smoothed look
    lookY: 0,
    alpha: 0,             // global field alpha, ramps in on entrance
    alphaTarget: 1,
    t: 0,                 // seconds
    morph: 1,             // 0..1 tween progress toward current target word
    fromWord: null,
    toWord: null,
  };

  // set the first target to the hero word and snap morph done at start
  const firstWord = stations[0] ? stations[0].word : 'MADE';
  state.toWord = firstWord;
  state.fromWord = firstWord;
  tgt.set(getTargets(firstWord));

  // pointer look (whole window). On touch we use drag.
  const setPointer = (cx, cy) => {
    state.pointerX = (cx / window.innerWidth) * 2 - 1;
    state.pointerY = (cy / window.innerHeight) * 2 - 1;
  };
  if (!reduced) {
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return; // touch handled via drag below
      setPointer(e.clientX, e.clientY);
    }, { passive: true });

    // touch / pen drag: a relative look that eases back to centre
    let dragId = null, dragX = 0, dragY = 0;
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      dragId = e.pointerId; dragX = e.clientX; dragY = e.clientY;
    }, { passive: true });
    window.addEventListener('pointermove', (e) => {
      if (e.pointerId !== dragId) return;
      const dx = (e.clientX - dragX) / window.innerWidth;
      const dy = (e.clientY - dragY) / window.innerHeight;
      state.pointerX = clamp(state.pointerX + dx * 2.2, -1.4, 1.4);
      state.pointerY = clamp(state.pointerY + dy * 2.2, -1.4, 1.4);
      dragX = e.clientX; dragY = e.clientY;
    }, { passive: true });
    const endDrag = (e) => { if (e.pointerId === dragId) dragId = null; };
    window.addEventListener('pointerup', endDrag, { passive: true });
    window.addEventListener('pointercancel', endDrag, { passive: true });
  }

  /* ----- station detection: IntersectionObserver picks the active one ------ */
  const sectionEls = stations.map((s) => s.el);
  const beginMorph = (idx) => {
    if (idx === state.targetActive && state.toWord === stations[idx].word) return;
    state.targetActive = idx;
    const nextWord = stations[idx].word;
    if (nextWord !== state.toWord) {
      // tween from where we are to the new word
      state.fromWord = state.toWord;
      state.toWord = nextWord;
      tgt.set(getTargets(nextWord));
      state.morph = 0; // re-run the settle, points chase the new tgt
    }
  };

  if (!reduced && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      // choose the most-visible intersecting station
      let best = -1, bestRatio = 0;
      entries.forEach((e) => {
        const idx = sectionEls.indexOf(e.target);
        if (idx < 0) return;
        if (e.isIntersecting && e.intersectionRatio > bestRatio) {
          bestRatio = e.intersectionRatio; best = idx;
        }
      });
      if (best >= 0) { state.active = best; beginMorph(best); }
    }, { threshold: [0.25, 0.45, 0.65, 0.85] });
    sectionEls.forEach((el) => el && io.observe(el));
  }

  /* ----- drift rotation: small breathing yaw / pitch ----------------------- */
  function buildRot(ax, ay) {
    // R = Ry(ay) * Rx(ax). Returned COLUMN-MAJOR for GLSL (uniformMatrix3fv with
    // transpose=false). Row-major R is:
    //   [  cy,    sy*sx,   sy*cx ]
    //   [  0,     cx,     -sx    ]
    //   [ -sy,    cy*sx,   cy*cx ]
    // so column-major array is [col0, col1, col2].
    const cy = Math.cos(ay), sy = Math.sin(ay);
    const cx = Math.cos(ax), sx = Math.sin(ax);
    return new Float32Array([
      cy,        0,       -sy,        // col 0
      sy * sx,   cx,       cy * sx,   // col 1
      sy * cx,  -sx,       cy * cx,   // col 2
    ]);
  }

  /* ----- the frame --------------------------------------------------------- */
  function frame(dt) {
    const dts = Math.min(0.05, dt / 1000);
    state.t += dts;

    // smooth look toward pointer (parallax). On no input it eases to centre.
    const lookEase = 0.06;
    state.lookX = lerp(state.lookX, state.pointerX, lookEase);
    state.lookY = lerp(state.lookY, state.pointerY, lookEase);

    // dolly: smooth the active station float
    state.activeF = lerp(state.activeF, state.targetActive, 0.05);

    // global alpha ramp (entrance, and pause fade handled by setRunning)
    state.alpha = lerp(state.alpha, state.alphaTarget, 0.05);

    // morph progress: ease the points toward the active word target
    if (state.morph < 1) state.morph = Math.min(1, state.morph + dts * 0.9);

    // breathing rotation + pointer look
    const driftY = Math.sin(state.t * 0.16) * 0.12 + state.lookX * 0.5;
    const driftX = Math.cos(state.t * 0.13) * 0.06 - state.lookY * 0.32;
    const rot = buildRot(driftX, driftY);

    // camera: dolly slightly with station (later stations push the word back so
    // the headline recedes as you read), and parallax-shift with look
    const dolly = -0.18 - state.activeF * 0.06;
    const camX = state.lookX * 0.12;
    const camY = -state.lookY * 0.08;
    const fov = 2.2;

    // ease points toward target with a per-point breathing wobble
    const k = reduced ? 1 : (0.06 + smooth(state.morph) * 0.06);
    const breathe = reduced ? 0 : 1;
    for (let i = 0; i < POOL; i++) {
      const b = i * 3;
      let tx = tgt[b], ty = tgt[b + 1], tz = tgt[b + 2];
      if (breathe) {
        // gentle organic breathing on the settled word
        const ph = rnd[i] * 6.2831;
        tx += Math.sin(state.t * 0.7 + ph) * 0.012;
        ty += Math.cos(state.t * 0.6 + ph * 1.3) * 0.012;
        tz += Math.sin(state.t * 0.5 + ph * 0.7) * 0.03;
      }
      pos[b] += (tx - pos[b]) * k;
      pos[b + 1] += (ty - pos[b + 1]) * k;
      pos[b + 2] += (tz - pos[b + 2]) * k;
    }

    // upload + draw
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, pos);

    gl.clearColor(0.027, 0.025, 0.05, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(prog);
    gl.uniformMatrix3fv(U_rot, false, rot);
    gl.uniform3f(U_cam, camX, camY, dolly);
    gl.uniform1f(U_fov, fov);
    gl.uniform1f(U_size, isSmall ? 2.0 : 2.6);
    gl.uniform1f(U_aspect, aspect);
    gl.uniform1f(U_dpr, dpr);
    gl.uniform1f(U_alpha, state.alpha);

    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.enableVertexAttribArray(A_pos);
    gl.vertexAttribPointer(A_pos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, rndBuf);
    gl.enableVertexAttribArray(A_rnd);
    gl.vertexAttribPointer(A_rnd, 1, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.POINTS, 0, POOL);
  }

  /* ----- reduced motion: assemble once, paint one settled frame ------------ */
  if (reduced) {
    // run the easing to completion in one synchronous settle, then draw once
    tgt.set(getTargets(firstWord));
    state.alpha = 1;
    for (let pass = 0; pass < 60; pass++) {
      for (let i = 0; i < POOL; i++) {
        const b = i * 3;
        pos[b] += (tgt[b] - pos[b]) * 0.2;
        pos[b + 1] += (tgt[b + 1] - pos[b + 1]) * 0.2;
        pos[b + 2] += (tgt[b + 2] - pos[b + 2]) * 0.2;
      }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, pos);
    gl.clearColor(0.027, 0.025, 0.05, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(prog);
    gl.uniformMatrix3fv(U_rot, false, buildRot(0.02, 0.08));
    gl.uniform3f(U_cam, 0, 0, -0.18);
    gl.uniform1f(U_fov, 2.2);
    gl.uniform1f(U_size, isSmall ? 2.0 : 2.6);
    gl.uniform1f(U_aspect, aspect);
    gl.uniform1f(U_dpr, dpr);
    gl.uniform1f(U_alpha, 1);
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.enableVertexAttribArray(A_pos);
    gl.vertexAttribPointer(A_pos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, rndBuf);
    gl.enableVertexAttribArray(A_rnd);
    gl.vertexAttribPointer(A_rnd, 1, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.POINTS, 0, POOL);

    // expose a no-op running control so the toggle still toggles aria state
    controls.setRunning = () => {};
    controls.isReduced = true;
    return true;
  }

  /* ----- run loop (rafLoop pauses on tab hide) ----------------------------- */
  let stop = rafLoop(frame, { fps: 60 });
  let running = true;

  controls.setRunning = (on) => {
    if (on === running) return;
    running = on;
    if (on) {
      state.alphaTarget = 1;
      if (!stop) stop = rafLoop(frame, { fps: 60 });
    } else {
      // fade out, then stop the loop a beat later so the fade is seen
      state.alphaTarget = 0;
      setTimeout(() => {
        if (!running && stop) { stop(); stop = null; }
      }, 520);
    }
  };
  controls.isReduced = false;

  // tidy on teardown (defensive; static site)
  window.addEventListener('pagehide', () => {
    if (stop) { stop(); stop = null; }
    if (ro) ro.disconnect();
    try {
      gl.deleteBuffer(posBuf); gl.deleteBuffer(rndBuf); gl.deleteProgram(prog);
      const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
    } catch (e) { /* ignore */ }
  }, { once: true });

  return true;
}

/* =============================================================================
   2D FALLBACK FIELD  (no WebGL): a drifting monospace glyph field, built on
   glyph-core, so the page still has atmosphere. Words still assemble, drawn as
   bright glyphs over the breathing ground.
============================================================================= */
function initFieldFallback(canvas, stations, controls) {
  const ctx = canvas.getContext('2d');
  if (!ctx) { controls.setRunning = () => {}; return; }
  const pal = readPalette();
  const noise = makeNoise2D(0xF1E1D);
  const FONT = "'IBM Plex Mono', monospace";
  const accent = pal.accentLit || '#6f66e6';
  const ramp = [' ', ' ', '.', '.', ':', '-', '=', '+', '*', '#'];

  let cssW = 1, cssH = 1, cols = 0, rows = 0, cw = 0, ch = 0, fontPx = 14;
  // word stencil: a Set of "gx,gy" cells the active word fills, recomputed on
  // word change and resize
  let wordCells = new Set();
  let activeWord = stations[0] ? stations[0].word : 'MADE';

  const onResize = (w, h) => {
    cssW = w; cssH = h;
    fontPx = w < 560 ? 15 : w < 960 ? 14 : 13;
    const m = cellMetrics(ctx, fontPx, FONT);
    cw = m.w; ch = Math.round(fontPx * 1.34);
    cols = Math.max(1, Math.ceil(w / cw) + 1);
    rows = Math.max(1, Math.ceil(h / ch) + 1);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    computeWord(activeWord);
  };
  const fc = fitCanvas(canvas, { onResize });

  // rasterise a word into grid cells centred on screen
  function computeWord(word) {
    activeWord = word;
    wordCells = new Set();
    const off = document.createElement('canvas');
    const ow = Math.max(2, cols), oh = Math.max(2, rows);
    off.width = ow; off.height = oh;
    const o = off.getContext('2d', { willReadFrequently: true });
    o.clearRect(0, 0, ow, oh);
    o.fillStyle = '#fff'; o.textAlign = 'center'; o.textBaseline = 'middle';
    let size = Math.floor(oh * 0.46);
    o.font = `700 ${size}px ${FONT}`;
    let w = o.measureText(word).width;
    const maxW = ow * 0.86;
    if (w > maxW) { size = Math.max(6, Math.floor(size * (maxW / w))); o.font = `700 ${size}px ${FONT}`; }
    o.fillText(word, ow / 2, oh / 2);
    const data = o.getImageData(0, 0, ow, oh).data;
    for (let gy = 0; gy < oh; gy++) {
      for (let gx = 0; gx < ow; gx++) {
        if (data[(gy * ow + gx) * 4 + 3] > 110) wordCells.add(gx + ',' + gy);
      }
    }
  }

  if (!reduced && 'IntersectionObserver' in window) {
    const els = stations.map((s) => s.el);
    const io = new IntersectionObserver((entries) => {
      let best = -1, bestRatio = 0;
      entries.forEach((e) => {
        const idx = els.indexOf(e.target);
        if (idx >= 0 && e.isIntersecting && e.intersectionRatio > bestRatio) { bestRatio = e.intersectionRatio; best = idx; }
      });
      if (best >= 0 && stations[best].word !== activeWord) computeWord(stations[best].word);
    }, { threshold: [0.25, 0.45, 0.65, 0.85] });
    els.forEach((el) => el && io.observe(el));
  }

  let t = 0;
  function draw() {
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.font = `${fontPx}px ${FONT}`;
    ctx.textBaseline = 'middle';
    const tt = t * 0.00035;
    const drift = t * 0.00016;
    for (let gy = 0; gy < rows; gy++) {
      const py = gy * ch + ch * 0.5;
      const ny = gy * 0.09;
      for (let gx = 0; gx < cols; gx++) {
        const nx = gx * 0.09;
        let v = noise(nx + drift, ny - drift * 0.6) * 0.7 + noise(nx * 2.1 - tt, ny * 2.1 + tt) * 0.3;
        const breath = 0.5 + 0.5 * Math.sin(tt * 1.6 + (gx + gy) * 0.04);
        v *= 0.6 + 0.4 * breath;
        const inWord = wordCells.has(gx + ',' + gy);
        if (inWord) {
          // bright accent glyph forming the word
          const gi = Math.min(ramp.length - 1, 6 + ((breath * 3) | 0));
          ctx.globalAlpha = 0.55 + 0.4 * breath;
          ctx.fillStyle = accent;
          ctx.fillText('#', gx * cw, py);
        } else {
          let gi = (v * ramp.length) | 0; if (gi >= ramp.length) gi = ramp.length - 1;
          const g = ramp[gi];
          if (g === ' ') continue;
          ctx.globalAlpha = 0.08 + v * 0.2;
          ctx.fillStyle = pal.nightFaint || '#3a3947';
          ctx.fillText(g, gx * cw, py);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  if (reduced) { t = 14000; draw(); controls.setRunning = () => {}; controls.isReduced = true; return; }

  let stop = rafLoop((dt) => { t += dt; draw(); }, { fps: 45 });
  let running = true;
  controls.setRunning = (on) => {
    if (on === running) return;
    running = on;
    if (on && !stop) stop = rafLoop((dt) => { t += dt; draw(); }, { fps: 45 });
    else if (!on && stop) { stop(); stop = null; ctx.clearRect(0, 0, cssW, cssH); draw(); }
  };
  controls.isReduced = false;
  window.addEventListener('pagehide', () => { if (stop) stop(); fc.dispose(); }, { once: true });
}

/* =============================================================================
   THE TOGGLE  (pause / resume the field, reflect state)
============================================================================= */
function initToggle(controls) {
  const btn = document.getElementById('field-toggle');
  if (!btn) return;
  const label = btn.querySelector('.v5-toggle__label');
  // start running (matches aria-pressed=true in markup), unless reduced
  let on = !controls.isReduced;
  const reflect = () => {
    btn.setAttribute('aria-pressed', String(on));
    if (label) label.textContent = on ? 'field' : 'field off';
  };
  // under reduced motion the field is a single static frame; the toggle is inert
  if (controls.isReduced) {
    on = true; // dot stays lit but CSS kills its pulse animation under reduce
    reflect();
    btn.setAttribute('aria-disabled', 'true');
    return;
  }
  reflect();
  btn.addEventListener('click', () => {
    on = !on;
    controls.setRunning(on);
    reflect();
  });
}

/* =============================================================================
   THE TRADES TABS  (show one .v5-trade-list, keyboard reachable)
============================================================================= */
function initTrades() {
  const root = document.querySelector('.v5-trades');
  if (!root) return;
  const tabs = Array.from(root.querySelectorAll('.v5-trade'));
  const lists = Array.from(root.querySelectorAll('.v5-trade-list'));
  if (!tabs.length) return;

  const byName = new Map();
  lists.forEach((l) => byName.set(l.getAttribute('data-trade-list'), l));

  const select = (name, focusTab) => {
    tabs.forEach((tab) => {
      const on = tab.getAttribute('data-trade') === name;
      tab.classList.toggle('is-on', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
      if (on && focusTab) tab.focus();
    });
    lists.forEach((l) => {
      const on = l.getAttribute('data-trade-list') === name;
      l.classList.toggle('is-on', on);
      if (on) l.removeAttribute('hidden'); else l.setAttribute('hidden', '');
    });
  };

  // initialise roving tabindex to the on tab (or first)
  const startTab = tabs.find((t) => t.classList.contains('is-on')) || tabs[0];
  tabs.forEach((t) => { t.tabIndex = (t === startTab) ? 0 : -1; });

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab.getAttribute('data-trade'), false));
    tab.addEventListener('keydown', (e) => {
      let j = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = tabs.length - 1;
      if (j >= 0) { e.preventDefault(); select(tabs[j].getAttribute('data-trade'), true); }
    });
  });
}

/* =============================================================================
   HELPERS  (GL program build, hex, hash)
============================================================================= */
function makeShader(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    // a compile failure means we fall back; do not throw, just report null
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}
function makeProgram(gl, vsrc, fsrc) {
  const vs = makeShader(gl, gl.VERTEX_SHADER, vsrc);
  const fs = makeShader(gl, gl.FRAGMENT_SHADER, fsrc);
  if (!vs || !fs) return null;
  const p = gl.createProgram();
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  gl.deleteShader(vs); gl.deleteShader(fs);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { gl.deleteProgram(p); return null; }
  return p;
}
function hexToRgb(h) {
  const s = h.trim().replace('#', '');
  const n = parseInt(s.length === 3 ? s.split('').map((c) => c + c).join('') : s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* =============================================================================
   BOOT
============================================================================= */
function boot() {
  const canvas = document.getElementById('field-gl');

  // read the stations and their words from the DOM (the page is the source)
  const stationEls = Array.from(document.querySelectorAll('.v5-station'));
  const stations = stationEls.map((el) => ({
    el,
    idx: parseInt(el.getAttribute('data-station') || '0', 10),
    word: (el.getAttribute('data-word') || 'FIELD').toUpperCase(),
  }));

  // controls object the toggle drives; the field init fills setRunning + isReduced
  const controls = { setRunning: () => {}, isReduced: reduced };

  if (canvas && stations.length) {
    let ok = false;
    try { ok = initFieldGL(canvas, stations, controls); }
    catch (e) { ok = false; }
    if (!ok) {
      // WebGL unavailable or failed: 2D atmosphere fallback on the same canvas
      try { initFieldFallback(canvas, stations, controls); }
      catch (e) { /* leave the CSS ground; the page still reads */ }
    }
  }

  initToggle(controls);
  initTrades();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
