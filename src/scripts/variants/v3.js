/* =============================================================================
   v3.js - "COMPOSITION"
   -----------------------------------------------------------------------------
   A parametric music video. One full-bleed flow-field particle composition that
   performs continuously and cinematically. Scroll scrubs it through five
   movements; the copy lands as timed captions. An optional hand-built WebAudio
   score (oscillators + filter + slow LFOs) can drive the visuals through an
   AnalyserNode. Muted by default; an internal timeline performs the piece
   without sound. Reduced motion renders one settled frame, audio off.

   House rule: no em dashes or en dashes anywhere, including comments.
============================================================================= */

import {
  fitCanvas,
  rafLoop,
  makeNoise2D,
  mulberry32,
  prefersReducedMotion,
} from '../glyph-core.js';

const reduced = prefersReducedMotion();

/* ---------------------------------------------------------------------------
   Palette: an evolving spectral set anchored on the studio blue. Movements
   drift the field through deep indigo, violet and teal. Always controlled.
   Each movement names two anchor colours the field interpolates between.
--------------------------------------------------------------------------- */
const BLUE = '#362cca';
const MOVEMENTS = [
  { lo: '#241c8e', hi: '#6f66e6', tint: '#362cca' }, // I   hero      indigo blue
  { lo: '#2a2192', hi: '#7b6fe8', tint: '#4a3fd0' }, // II  how       blue with lift
  { lo: '#3a1f9c', hi: '#8a55de', tint: '#6a3bd0' }, // III bench     violet shift
  { lo: '#1d3a8c', hi: '#4fc0cf', tint: '#2bb6c9' }, // IV  interlude  teal opening
  { lo: '#2b2a9e', hi: '#9b6cf0', tint: '#7b3bd6' }, // V   ships      violet
  { lo: '#241c8e', hi: '#6f66e6', tint: '#362cca' }, // VI  order      home to blue
];

/* number of stages the scroll is divided into (the 6 <section data-mv>). */
const STAGE_COUNT = MOVEMENTS.length;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/* blend a list of hex anchors by a 0..(n-1) float index, returns [r,g,b] */
function gradeAt(stops, x) {
  const n = stops.length;
  const f = clamp(x, 0, n - 1.0001);
  const i = Math.floor(f);
  const t = f - i;
  const a = hexToRgb(stops[i]);
  const b = hexToRgb(stops[Math.min(i + 1, n - 1)]);
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

/* ---------------------------------------------------------------------------
   The generative score (WebAudio). Hand-built ambient drone:
   - three detuned sine/triangle oscillators (a slow chord around the blue),
   - one low pulse osc for a heartbeat,
   - a lowpass filter swept by a slow LFO,
   - a master gain ramped up on start, down on stop,
   - an AnalyserNode the visuals read amplitude + low/high energy from.
   Never autoplays. Resumes only on a user gesture.
--------------------------------------------------------------------------- */
class Score {
  constructor() {
    this.ctx = null;
    this.on = false;
    this.analyser = null;
    this.freq = null;
    this.time = null;
    this.master = null;
    this.nodes = [];
  }
  async start() {
    if (this.on) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!this.ctx) this.ctx = new AC();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.16, now + 2.2);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 620;
    filter.Q.value = 1.6;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.84;

    filter.connect(master);
    master.connect(analyser);
    analyser.connect(ctx.destination);

    // slow filter sweep LFO
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.045;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 360;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    // a quiet chord around the studio blue: a low root, a fifth, a soft third
    const voices = [
      { f: 55.0,  type: 'sine',     g: 0.5,  det: 0 },
      { f: 82.41, type: 'sine',     g: 0.34, det: 3 },
      { f: 110.0, type: 'triangle', g: 0.22, det: -4 },
      { f: 164.8, type: 'sine',     g: 0.12, det: 5 },
    ];
    const voiceNodes = voices.map((v) => {
      const osc = ctx.createOscillator();
      osc.type = v.type;
      osc.frequency.value = v.f;
      osc.detune.value = v.det;
      const g = ctx.createGain();
      g.gain.value = v.g;
      // a slow amplitude shimmer per voice
      const aLfo = ctx.createOscillator();
      aLfo.frequency.value = 0.05 + Math.random() * 0.08;
      const aGain = ctx.createGain();
      aGain.gain.value = v.g * 0.4;
      aLfo.connect(aGain);
      aGain.connect(g.gain);
      aLfo.start();
      osc.connect(g);
      g.connect(filter);
      osc.start();
      return [osc, aLfo];
    });

    // a slow pulse: a low triangle gated by a sub-bpm LFO, the "beat"
    const pulse = ctx.createOscillator();
    pulse.type = 'triangle';
    pulse.frequency.value = 41.2;
    const pulseGain = ctx.createGain();
    pulseGain.gain.value = 0.0001;
    const beat = ctx.createOscillator();
    beat.type = 'sine';
    beat.frequency.value = 0.5; // ~30 pulses per minute, a calm heart
    const beatShape = ctx.createGain();
    beatShape.gain.value = 0.18;
    beat.connect(beatShape);
    beatShape.connect(pulseGain.gain);
    pulse.connect(pulseGain);
    pulseGain.connect(filter);
    pulse.start();
    beat.start();

    // hold references the cursor can nudge while sound is on
    this.filter = filter;
    this.baseCutoff = 620; // the LFO sweeps around this; the cursor offsets it
    this.voiceOscs = voiceNodes.map((vn) => vn[0]); // for a touch of detune
    this.voiceBaseDet = voices.map((v) => v.det);
    this.baseMaster = 0.16; // the level start() ramps to; nudge stays under it
    this.master = master;
    this.analyser = analyser;
    this.freq = new Uint8Array(analyser.frequencyBinCount);
    this.time = new Uint8Array(analyser.fftSize);
    this.nodes = [lfo, pulse, beat, ...voiceNodes.flat()];
    this.on = true;
  }
  async stop() {
    if (!this.on || !this.ctx) return;
    const now = this.ctx.currentTime;
    try { this.master.gain.cancelScheduledValues(now); } catch (e) { /* ignore */ }
    try { this.master.gain.setValueAtTime(this.master.gain.value, now); } catch (e) { /* ignore */ }
    try { this.master.gain.exponentialRampToValueAtTime(0.0001, now + 0.9); } catch (e) { /* ignore */ }
    const nodes = this.nodes;
    setTimeout(() => {
      nodes.forEach((n) => { try { n.stop(); } catch (e) { /* ignore */ } });
    }, 1000);
    this.nodes = [];
    this.analyser = null;
    this.filter = null;
    this.voiceOscs = [];
    this.on = false;
  }
  /* nudge(y01, intensity01) - let the cursor lean on the score, gently.
     y01:        pointer height, 0 at top .. 1 at bottom of the viewport
     intensity01: 0..1, from pointer speed and pull strength
     Everything ramps with setTargetAtTime so there is no zipper noise. The
     LFO keeps modulating filter.frequency on top of this offset; we only move
     the resting cutoff and add a whisker of detune + level. Stays musical. */
  nudge(y01, intensity01) {
    if (!this.on || !this.ctx || !this.filter) return;
    const now = this.ctx.currentTime;
    // higher cursor opens the filter, lower closes it. A calm, narrow range.
    const cutoff = lerp(360, 1180, clamp(1 - y01, 0, 1));
    const tc = 0.18; // slow time constant: smooth, never sudden
    try { this.filter.frequency.setTargetAtTime(cutoff, now, tc); } catch (e) { /* ignore */ }
    // a small lift in level with intensity, always under the base ceiling
    const level = this.baseMaster * (1 + clamp(intensity01, 0, 1) * 0.22);
    try { this.master.gain.setTargetAtTime(level, now, 0.25); } catch (e) { /* ignore */ }
    // a whisker of extra detune per voice, scaled by intensity (max a few cents)
    const wobble = clamp(intensity01, 0, 1) * 6;
    for (let i = 0; i < this.voiceOscs.length; i++) {
      const target = this.voiceBaseDet[i] + wobble * (i % 2 ? -1 : 1);
      try { this.voiceOscs[i].detune.setTargetAtTime(target, now, 0.3); } catch (e) { /* ignore */ }
    }
  }
  /* relax() - cursor left or stopped: ease params back to their resting state. */
  relax() {
    if (!this.on || !this.ctx || !this.filter) return;
    const now = this.ctx.currentTime;
    try { this.filter.frequency.setTargetAtTime(this.baseCutoff, now, 0.4); } catch (e) { /* ignore */ }
    try { this.master.gain.setTargetAtTime(this.baseMaster, now, 0.5); } catch (e) { /* ignore */ }
    for (let i = 0; i < this.voiceOscs.length; i++) {
      try { this.voiceOscs[i].detune.setTargetAtTime(this.voiceBaseDet[i], now, 0.5); } catch (e) { /* ignore */ }
    }
  }
  // returns { level, low, high } in 0..1, or zeros when off
  read() {
    if (!this.on || !this.analyser) return { level: 0, low: 0, high: 0 };
    this.analyser.getByteFrequencyData(this.freq);
    const n = this.freq.length;
    let lowSum = 0, highSum = 0, total = 0;
    const split = (n * 0.22) | 0;
    for (let i = 0; i < n; i++) {
      const v = this.freq[i];
      total += v;
      if (i < split) lowSum += v; else highSum += v;
    }
    return {
      level: clamp(total / (n * 255), 0, 1),
      low: clamp(lowSum / (split * 255 || 1), 0, 1),
      high: clamp(highSum / ((n - split) * 255 || 1), 0, 1),
    };
  }
}

/* ---------------------------------------------------------------------------
   Boot
--------------------------------------------------------------------------- */
function boot() {
  const canvas = document.querySelector('[data-stage]');
  if (!canvas) return;

  const isSmall = Math.min(window.innerWidth, window.innerHeight) < 720;
  const noise = makeNoise2D(20260531);
  const rng = mulberry32(7);

  /* ----- particle field ----- */
  // Particles drift along a noise flow field. Count scales with screen size.
  let W = 1, H = 1;
  const baseCount = isSmall ? 240 : 620;
  const N = baseCount;
  const px = new Float32Array(N);
  const py = new Float32Array(N);
  const plx = new Float32Array(N); // previous, for streaks
  const ply = new Float32Array(N);
  const plife = new Float32Array(N);
  const pseed = new Float32Array(N);

  const ctx = canvas.getContext('2d');

  function spawn(i, full) {
    px[i] = rng() * W;
    py[i] = rng() * H;
    plx[i] = px[i];
    ply[i] = py[i];
    plife[i] = full ? rng() : (0.4 + rng() * 0.6);
    pseed[i] = rng();
  }

  const onResize = (cssW, cssH) => {
    W = cssW; H = cssH;
    for (let i = 0; i < N; i++) spawn(i, true);
    if (reduced) renderStatic();
  };

  const view = fitCanvas(canvas, { onResize });

  /* ----- composition state (smoothed) ----- */
  const state = {
    progress: 0,   // global scroll 0..1
    stage: 0,      // active movement index
    energy: 0,     // 0..1 drives flow speed + brightness (audio or timeline)
    energyS: 0,    // smoothed
    flowS: 0,      // smoothed flow scale
    beat: 0,       // 0..1 beat pulse value
    t: 0,          // seconds since start
  };
  const score = new Score();

  /* ----- gravity well (follows the cursor / touch) --------------------------
     The pointer pulls the field toward it and sets it swirling, like matter
     near a black hole, then the field eases back to its noise flow when the
     pointer stops or leaves. Everything is smoothed so it feels physical, not
     jumpy: a lerped position, a strength that fades in and out, a soft falloff
     radius and a tangential (orbital) term so particles curve around it rather
     than only collapsing inward. Reduced motion never wires any of this up.    */
  const well = {
    tx: 0, ty: 0,      // raw target (last pointer position)
    x: 0, y: 0,        // smoothed position the physics actually uses
    have: false,       // a pointer has been seen at least once
    active: false,     // pointer currently moving / present
    strength: 0,       // 0..1, eases in while active, out when idle / gone
    speed: 0,          // smoothed pointer speed in px per frame, for the audio
    lastT: 0,          // timestamp of last pointer sample, to detect "stopped"
  };
  // radius of influence scales with the smaller screen edge, lighter on mobile
  const wellRadius = () => Math.min(W, H) * (isSmall ? 0.34 : 0.42);

  /* ----- scroll scrub ----- */
  function computeProgress() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
    state.progress = p;
    state.stage = clamp(Math.round(p * (STAGE_COUNT - 1)), 0, STAGE_COUNT - 1);
    updateTransport();
  }

  /* ----- transport indicator ----- */
  const romans = ['I', 'II', 'III', 'IV', 'V', 'V'];
  const noEl = document.querySelector('[data-mvmt-no]');
  const fillEl = document.querySelector('[data-mvmt-fill]');
  let lastRoman = '';
  function updateTransport() {
    if (noEl) {
      const r = romans[state.stage] || 'I';
      if (r !== lastRoman) { noEl.textContent = r; lastRoman = r; }
    }
    if (fillEl) fillEl.style.width = (state.progress * 100).toFixed(1) + '%';
  }

  /* ----- caption choreography ----------------------------------------------
     Each movement's [data-cap] elements get a stagger via --d (from data-d).
     We reveal a movement's captions when it is active or nearly active, mark
     them "out" when scrolled well past, reset when scrolled back above. The
     base reveal observer in the layout does not run here (these are scoped to
     .v3 captions which we drive ourselves), so set --d up front.            */
  const sections = Array.from(document.querySelectorAll('.v3-mv'));
  sections.forEach((sec) => {
    sec.querySelectorAll('[data-cap]').forEach((el) => {
      el.style.setProperty('--d', el.dataset.d || '0');
    });
  });

  if (reduced) {
    // one settled frame: everything visible, no scrubbing
    sections.forEach((sec) => sec.querySelectorAll('[data-cap]').forEach((el) => el.classList.add('v3-on')));
    computeProgress();
    renderStatic();
    return;
  }

  // IntersectionObserver drives caption entrance / exit per movement.
  const capIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const caps = e.target.querySelectorAll('[data-cap]');
      const r = e.intersectionRatio;
      if (e.isIntersecting && r > 0.18) {
        caps.forEach((c) => { c.classList.add('v3-on'); c.classList.remove('v3-out'); });
      } else if (!e.isIntersecting) {
        const rect = e.boundingClientRect;
        if (rect.top < 0) {
          // scrolled above the viewport: drift out and up
          caps.forEach((c) => { c.classList.add('v3-out'); });
        } else {
          // below the viewport, not yet seen: keep hidden, ready to enter
          caps.forEach((c) => { c.classList.remove('v3-on', 'v3-out'); });
        }
      }
    });
  }, { threshold: [0, 0.18, 0.4, 0.7] });
  sections.forEach((s) => capIO.observe(s));

  /* ----- internal timeline (drives energy when muted) ----------------------
     A slow breathing envelope plus a calm beat, so the piece performs without
     sound. Energy lifts gently with scroll velocity and settles. The beat is a
     half-rectified slow sine, the same calm heart the score uses.            */
  let scrollVel = 0;
  let lastScrollY = window.scrollY;
  let scrollT = performance.now();

  function timelineEnergy(tSec) {
    const breath = 0.5 + 0.5 * Math.sin(tSec * 0.42);        // 0..1 slow swell
    const stageLift = 0.18 + state.stage * 0.06;             // later movements warmer
    const velLift = clamp(scrollVel * 0.0009, 0, 0.5);       // motion adds energy
    return clamp(0.28 + breath * 0.34 + stageLift * 0.4 + velLift, 0, 1);
  }
  function timelineBeat(tSec) {
    const s = Math.sin(tSec * Math.PI * 0.5); // 0.5 Hz, calm
    return s > 0 ? s * s : 0;
  }

  /* ----- scroll listener (throttled via rAF flag) ----- */
  let scrollQueued = false;
  function onScroll() {
    const now = performance.now();
    const dy = Math.abs(window.scrollY - lastScrollY);
    const dt = Math.max(1, now - scrollT);
    scrollVel = scrollVel * 0.7 + (dy / dt) * 300 * 0.3;
    lastScrollY = window.scrollY;
    scrollT = now;
    if (!scrollQueued) {
      scrollQueued = true;
      requestAnimationFrame(() => { computeProgress(); scrollQueued = false; });
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', computeProgress, { passive: true });
  computeProgress();

  /* ----- pointer + touch wiring for the gravity well ------------------------
     We listen on window so the well also responds over the captions (they sit
     above the canvas). Only attached here, past the reduced-motion return, so
     reduced motion never animates anything. Samples are cheap: store the raw
     target and a speed estimate; the smoothing happens in the frame loop.      */
  function sampleWell(clientX, clientY, now) {
    const x = clientX, y = clientY;
    if (well.have) {
      const dx = x - well.tx, dy = y - well.ty;
      const inst = Math.sqrt(dx * dx + dy * dy);
      well.speed = well.speed * 0.7 + inst * 0.3; // smoothed px per move
    } else {
      // first sample: snap the smoothed position so it does not lunge in
      well.x = x; well.y = y;
    }
    well.tx = x; well.ty = y;
    well.have = true;
    well.active = true;
    well.lastT = now;
  }
  const onPointerMove = (e) => sampleWell(e.clientX, e.clientY, performance.now());
  const onPointerLeave = () => { well.active = false; };
  const onTouchMove = (e) => {
    const t = e.touches && e.touches[0];
    if (t) sampleWell(t.clientX, t.clientY, performance.now());
  };
  const onTouchEnd = () => { well.active = false; };
  // pointer events cover mouse + pen + most touch; keep an explicit touch path
  // too for older mobile Safari, both passive so scrolling never stalls.
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerleave', onPointerLeave, { passive: true });
  window.addEventListener('pointercancel', onPointerLeave, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: true });
  window.addEventListener('touchend', onTouchEnd, { passive: true });
  window.addEventListener('touchcancel', onTouchEnd, { passive: true });
  window.addEventListener('blur', onPointerLeave, { passive: true });

  /* ----- sound toggle ----- */
  const soundBtn = document.querySelector('[data-sound]');
  const soundLabel = document.querySelector('[data-sound-label]');
  let audioOn = false;
  if (soundBtn) {
    soundBtn.addEventListener('click', async () => {
      audioOn = !audioOn;
      soundBtn.setAttribute('aria-pressed', String(audioOn));
      if (soundLabel) soundLabel.textContent = audioOn ? 'sound on' : 'sound off';
      if (audioOn) {
        try { await score.start(); } catch (e) { audioOn = false; soundBtn.setAttribute('aria-pressed', 'false'); if (soundLabel) soundLabel.textContent = 'sound off'; }
      } else {
        score.stop();
      }
    });
  }

  /* ----- the field, one frame ---------------------------------------------- */
  let started = 0;
  function frame(dt, now) {
    if (!started) started = now;
    const tSec = (now - started) / 1000;
    state.t = tSec;

    // energy + beat: prefer audio when on, else internal timeline
    const a = audioOn ? score.read() : null;
    const targetEnergy = a ? clamp(0.3 + a.level * 1.3, 0, 1) : timelineEnergy(tSec);
    const targetBeat = a ? a.low : timelineBeat(tSec);
    state.energyS = lerp(state.energyS, targetEnergy, 0.06);
    state.beat = lerp(state.beat, targetBeat, 0.18);
    // decay scroll velocity each frame
    scrollVel *= 0.94;

    /* advance the gravity well. If the pointer has not moved for a moment we
       treat it as stopped: the swirl keeps going but stops fading in. When the
       pointer leaves or the touch ends, strength eases back to zero and the
       field returns to its plain noise flow. */
    if (well.have) {
      // smooth the position toward the raw target so the pull never snaps
      well.x = lerp(well.x, well.tx, 0.14);
      well.y = lerp(well.y, well.ty, 0.14);
      // if no new sample for ~140ms, the pointer has stopped moving
      if (well.active && now - well.lastT > 140) well.active = false;
      // strength eases in while active, eases out while idle or gone
      const targetStrength = well.active ? 1 : 0;
      well.strength = lerp(well.strength, targetStrength, well.active ? 0.07 : 0.045);
      well.speed *= 0.86; // pointer speed estimate decays toward rest
      if (well.strength < 0.002 && !well.active) well.strength = 0;
    }

    // when audio is on, let the well lean on the score; otherwise leave it.
    if (audioOn) {
      if (well.have && well.strength > 0.01) {
        const y01 = clamp(well.y / Math.max(1, H), 0, 1);
        // intensity blends pull strength with a touch of pointer speed
        const intensity = clamp(well.strength * (0.4 + clamp(well.speed / 90, 0, 1) * 0.6), 0, 1);
        score.nudge(y01, intensity);
      } else {
        score.relax();
      }
    }

    // palette: blend the two stages we sit between, by global progress
    const sf = state.progress * (STAGE_COUNT - 1);
    const si = Math.floor(sf);
    const st = sf - si;
    const A = MOVEMENTS[si];
    const B = MOVEMENTS[Math.min(si + 1, STAGE_COUNT - 1)];
    const cLo = gradeAt([A.lo, B.lo], st);
    const cHi = gradeAt([A.hi, B.hi], st);

    drawField(tSec, dt, cLo, cHi);
  }

  /* ----- draw the flow field ----- */
  function drawField(tSec, dt, cLo, cHi) {
    const energy = state.energyS;
    const beat = state.beat;

    // fade the previous frame for long, cinematic trails
    ctx.globalCompositeOperation = 'source-over';
    const fade = 0.10 + (1 - energy) * 0.06; // higher energy = longer trails
    ctx.fillStyle = `rgba(7, 6, 15, ${fade})`;
    ctx.fillRect(0, 0, W, H);

    // additive light for the particles
    ctx.globalCompositeOperation = 'lighter';

    const flowScale = 0.0014 + energy * 0.0009;
    const speed = (0.6 + energy * 2.4) * (1 + beat * 0.5);
    const zt = tSec * (0.05 + energy * 0.04);
    const cx = W * 0.5, cy = H * 0.46;

    const lineW = isSmall ? 1.0 : 1.25;
    ctx.lineWidth = lineW;
    ctx.lineCap = 'round';

    // gravity well parameters, computed once per frame for the whole field.
    // wActive: is the well pulling at all this frame. wR: soft falloff radius.
    // wPull: peak inward acceleration. wSwirl: tangential (orbital) component
    // so particles curve around the well instead of only collapsing into it.
    const wActive = well.have && well.strength > 0.002;
    const wR = wellRadius();
    const wR2 = wR * wR;
    const wPull = 2.6 * well.strength * (0.7 + energy * 0.5);
    const wSwirl = 1.7 * well.strength;
    const wx = well.x, wy = well.y;

    for (let i = 0; i < N; i++) {
      // flow angle from layered noise
      const nx = px[i] * flowScale;
      const ny = py[i] * flowScale;
      const ang = (noise(nx + zt, ny - zt) * 2 - 1) * Math.PI * 2
                + (noise(nx * 0.4 - zt * 0.5, ny * 0.4) - 0.5) * Math.PI;

      // a gentle pull toward centre keeps the composition framed
      const toCx = (cx - px[i]) * 0.00018;
      const toCy = (cy - py[i]) * 0.00018;

      plx[i] = px[i];
      ply[i] = py[i];
      let vx = Math.cos(ang) * speed + toCx * W;
      let vy = Math.sin(ang) * speed + toCy * H;

      // gravity well: a soft-falloff pull plus an orbital swirl around it
      if (wActive) {
        const gx = wx - px[i];
        const gy = wy - py[i];
        const d2 = gx * gx + gy * gy;
        if (d2 < wR2) {
          const d = Math.sqrt(d2) || 0.0001;
          // smooth falloff: full near the centre, zero at the radius edge.
          // a small core softens the singularity so it never goes jumpy.
          const t = 1 - d / wR;
          const fall = t * t * (3 - 2 * t);
          const soft = d / (d + wR * 0.12); // tames the very centre
          const ux = gx / d, uy = gy / d;    // unit vector toward the well
          const pull = wPull * fall * soft;
          vx += ux * pull;
          vy += uy * pull;
          // tangential term: rotate the inward vector 90 degrees to orbit
          const swirl = wSwirl * fall;
          vx += -uy * swirl;
          vy += ux * swirl;
        }
      }

      px[i] += vx;
      py[i] += vy;

      plife[i] -= 0.0026 + (1 - plife[i]) * 0.001;

      // wrap + respawn
      if (px[i] < -20 || px[i] > W + 20 || py[i] < -20 || py[i] > H + 20 || plife[i] <= 0) {
        spawn(i, false);
        continue;
      }

      // colour: blend the stage gradient by a per-particle seed + radius
      const dxn = (px[i] - cx) / W;
      const dyn = (py[i] - cy) / H;
      const rad = clamp(Math.sqrt(dxn * dxn + dyn * dyn) * 1.5, 0, 1);
      const mixT = clamp(pseed[i] * 0.6 + rad * 0.5 + beat * 0.2, 0, 1);
      const r = Math.round(lerp(cLo[0], cHi[0], mixT));
      const g = Math.round(lerp(cLo[1], cHi[1], mixT));
      const b = Math.round(lerp(cLo[2], cHi[2], mixT));

      // alpha: fade in/out over life, dimmer at edges, lifted by energy
      const lifeFade = plife[i] < 0.15 ? plife[i] / 0.15 : (plife[i] > 0.85 ? (1 - plife[i]) / 0.15 : 1);
      const edge = 1 - rad * 0.55;
      const alpha = clamp((0.10 + energy * 0.22) * lifeFade * edge, 0, 0.5);

      ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.beginPath();
      ctx.moveTo(plx[i], ply[i]);
      ctx.lineTo(px[i], py[i]);
      ctx.stroke();
    }

    // a soft central bloom that pulses with the beat, the "instrument"
    const bloomR = Math.min(W, H) * (0.18 + beat * 0.07 + energy * 0.05);
    const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, bloomR);
    const br = Math.round(lerp(cLo[0], cHi[0], 0.7));
    const bg = Math.round(lerp(cLo[1], cHi[1], 0.7));
    const bb = Math.round(lerp(cLo[2], cHi[2], 0.7));
    bloom.addColorStop(0, `rgba(${br},${bg},${bb},${0.05 + beat * 0.06})`);
    bloom.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, W, H);

    // a faint glow at the well so the cursor reads as a presence in the field.
    // Same blue family as the bloom, no new hue, fades with the well strength.
    if (well.have && well.strength > 0.01) {
      const gR = wellRadius() * 0.5;
      const glow = ctx.createRadialGradient(well.x, well.y, 0, well.x, well.y, gR);
      const ga = 0.10 * well.strength;
      glow.addColorStop(0, `rgba(${br},${bg},${bb},${ga})`);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.globalCompositeOperation = 'source-over';
  }

  /* ----- one settled frame for reduced motion ----- */
  function renderStatic() {
    if (W <= 1 || H <= 1) return;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#07060f';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';

    const cLo = hexToRgb(MOVEMENTS[0].lo);
    const cHi = hexToRgb(MOVEMENTS[0].hi);
    const cx = W * 0.5, cy = H * 0.46;
    const zt = 0;
    const flowScale = 0.0017;

    // walk each particle a fixed number of steps to draw a frozen flow image
    for (let i = 0; i < N; i++) {
      let x = px[i], y = py[i];
      ctx.beginPath();
      ctx.moveTo(x, y);
      const dxn = (x - cx) / W, dyn = (y - cy) / H;
      const rad = clamp(Math.sqrt(dxn * dxn + dyn * dyn) * 1.5, 0, 1);
      const mixT = clamp(pseed[i] * 0.6 + rad * 0.5, 0, 1);
      const r = Math.round(lerp(cLo[0], cHi[0], mixT));
      const g = Math.round(lerp(cLo[1], cHi[1], mixT));
      const b = Math.round(lerp(cLo[2], cHi[2], mixT));
      ctx.strokeStyle = `rgba(${r},${g},${b},${0.16 * (1 - rad * 0.5)})`;
      ctx.lineWidth = 1.1;
      ctx.lineCap = 'round';
      for (let s = 0; s < 26; s++) {
        const ang = (makeNoiseStep(x * flowScale + zt, y * flowScale - zt)) * Math.PI * 2;
        x += Math.cos(ang) * 2.2;
        y += Math.sin(ang) * 2.2;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // central bloom
    const bloomR = Math.min(W, H) * 0.22;
    const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, bloomR);
    bloom.addColorStop(0, 'rgba(111,102,230,0.10)');
    bloom.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
  }
  function makeNoiseStep(x, y) { return noise(x, y) * 2 - 1; }

  /* ----- run ----- */
  // Prime the field with a couple of frames before showing, so the first
  // visible frame is already populated rather than empty black.
  if (W > 1 && H > 1) {
    ctx.fillStyle = '#07060f';
    ctx.fillRect(0, 0, W, H);
  }
  const stop = rafLoop(frame, { fps: 60 });

  // tidy up if the page is ever torn down (defensive; static site)
  window.addEventListener('pagehide', () => {
    stop();
    score.stop();
    view.dispose();
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerleave', onPointerLeave);
    window.removeEventListener('pointercancel', onPointerLeave);
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('touchend', onTouchEnd);
    window.removeEventListener('touchcancel', onTouchEnd);
    window.removeEventListener('blur', onPointerLeave);
  }, { once: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
