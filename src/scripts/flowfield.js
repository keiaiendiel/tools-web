/* =============================================================================
   flowfield.js — the dark-band flow-field (the page's expressive moment)
   -----------------------------------------------------------------------------
   A field of monospace glyphs advected by a noise-driven flow on the --night
   ground. Each particle follows an angle sampled from drifting value-noise,
   steps along it, wraps at the edges, and draws a single glyph at its position.
   Instead of clearing each frame we paint a translucent --night veil so glyph
   trails persist and fade, leaving visible currents. The pointer (or a finger)
   stirs the flow within a radius, curling the field around the cursor.

   Built on glyph-core.js only. Monospace via cellMetrics-style measure. Colour
   read from readPalette (.night, .nightFaint, .accent). Honors reduced motion
   (one settled frame, no loop), gates startup on visibility, pauses off-screen
   via rafLoop. The left ~40% (where the headline sits) is kept calmer so the
   serif text stays readable on the low-contrast ground.
============================================================================= */
import {
  fitCanvas, makeNoise2D, mulberry32, rafLoop, readPalette, mixHex,
  rampGlyph, prefersReducedMotion, onVisible, GLYPHS,
} from './glyph-core.js';

const FONT = "'IBM Plex Mono', ui-monospace, monospace";
const FONT_PX = 14;

export function initFlowField(canvas) {
  // Flow field + a second noise channel so speed/glyph choice is not locked to
  // the steering angle. Seeds are arbitrary but fixed for a stable look.
  const flow = makeNoise2D(0x10f1e1d);   // steering angle per position + time
  const pick = makeNoise2D(0x533d);      // glyph / accent selection
  const rng = mulberry32(0x9e3779b9);    // particle seeding

  // Palette, refreshed on resize. We lean on .night / .nightFaint / .accent.
  let pal = readPalette();

  // Geometry, rebuilt on resize.
  let vw = 0, vh = 0;        // css px box
  let cw = FONT_PX * 0.6;    // mono cell advance, measured below
  let calmX = 0;             // left of this x the field is quieter (headline)

  // Particle pool. Flat arrays keep the hot loop allocation-free.
  let count = 0;
  let px = new Float32Array(0);   // position x (css px)
  let py = new Float32Array(0);   // position y (css px)
  let pa = new Float32Array(0);   // current heading (radians), eased for trails
  let mobile = false;

  // Pointer state. pX/pY in css px, -1 when absent. The flow curls around it.
  let pX = -1, pY = -1, stir = 0;

  let t = 0;   // accumulated seconds, drives the flow drift

  // Grab the 2D context BEFORE fitCanvas. fitCanvas calls resize()/onResize
  // synchronously, so a ctx destructured from its return value would sit in the
  // temporal dead zone when onResize first fires. This const is initialised now.
  const ctx = canvas.getContext('2d');

  // Seed one particle at a random spot, heading along the local flow.
  function seed(i) {
    const x = rng() * vw;
    const y = rng() * vh;
    px[i] = x;
    py[i] = y;
    pa[i] = flowAngle(x, y, t);
  }

  // The flow angle at a position+time. Noise 0..1 -> a few turns of rotation so
  // the field has long, coherent currents rather than a flat gradient.
  function flowAngle(x, y, time) {
    const n = flow(x * 0.0028 + 13, y * 0.0028 - 7 + time * 0.06);
    return n * Math.PI * 4;   // 0..4π, smooth across space
  }

  function rebuild(cssW, cssH) {
    pal = readPalette();
    vw = cssW;
    vh = cssH;
    ctx.font = `${FONT_PX}px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    cw = ctx.measureText('M').width || FONT_PX * 0.6;
    mobile = cssW < 720;
    // Headline occupies the left third on desktop; keep its zone calmer.
    calmX = mobile ? 0 : cssW * 0.40;

    // Count scales with area, capped 1000 desktop / 400 mobile. One particle per
    // ~1600 css px² reads as a dense-but-legible field at this glyph size.
    const target = Math.round((cssW * cssH) / 1600);
    count = Math.max(60, Math.min(mobile ? 400 : 1000, target));

    px = new Float32Array(count);
    py = new Float32Array(count);
    pa = new Float32Array(count);
    for (let i = 0; i < count; i++) seed(i);

    // Lay the night ground down once so the first veiled frames are not black
    // flashing onto an empty canvas.
    ctx.fillStyle = pal.night;
    ctx.fillRect(0, 0, vw, vh);
  }

  const { dispose } = fitCanvas(canvas, { onResize: rebuild });

  // Smoothstep falloff, 1 at centre -> 0 at radius edge.
  const falloff = (d, r) => {
    if (d >= r) return 0;
    const u = 1 - d / r;
    return u * u * (3 - 2 * u);
  };

  // Advance every particle one step along the flow, with a pointer curl term,
  // then draw its glyph. Called once per animated frame and once for the static
  // reduced-motion pass.
  function step(speedScale) {
    const R = 160;                       // pointer influence radius (css px)
    const accentN = mobile ? 0.02 : 0.03; // fraction of cells that glint accent

    for (let i = 0; i < count; i++) {
      const x = px[i], y = py[i];

      // Base heading from the flow field, eased so trails stay smooth.
      const target = flowAngle(x, y, t);
      let ang = pa[i];
      // Shortest-arc ease toward the field angle.
      let d = target - ang;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      ang += d * 0.18;

      // Local density / calm: thinner and slower under the headline.
      const calm = x < calmX ? 0.45 : 1;

      // Pointer curl: within R the heading bends tangentially around the cursor,
      // so moving the mouse stirs visible eddies rather than just pushing.
      let near = 0;
      if (pX >= 0) {
        const dx = x - pX, dy = y - pY;
        const dist = Math.hypot(dx, dy);
        near = falloff(dist, R) * (0.5 + 0.5 * stir);
        if (near > 0.001) {
          // Tangent angle (perpendicular to the radius) gives a swirl; blend it
          // in by proximity so the field curls around the pointer.
          const tangent = Math.atan2(dy, dx) + Math.PI / 2;
          let td = tangent - ang;
          td = Math.atan2(Math.sin(td), Math.cos(td));
          ang += td * 0.6 * near;
        }
      }
      pa[i] = ang;

      // Step length: a steady base, lifted near the pointer, damped in the calm
      // zone. speedScale lets the static pass take one larger settling stride.
      const stepLen = (cw * 0.9) * calm * (1 + near * 1.4) * speedScale;
      let nx = x + Math.cos(ang) * stepLen;
      let ny = y + Math.sin(ang) * stepLen;

      // Wrap at the edges so the field is endless.
      if (nx < 0) nx += vw; else if (nx >= vw) nx -= vw;
      if (ny < 0) ny += vh; else if (ny >= vh) ny -= vh;
      px[i] = nx; py[i] = ny;

      // Glyph by a noise value (independent of heading) blended with speed near
      // the pointer, so stirred regions scramble toward the dense ramp end.
      const gn = pick(nx * 0.02, ny * 0.02 + t * 0.3);
      const energy = Math.min(1, gn * 0.7 + near * 0.6);
      let glyph;
      if (near > 0.2) {
        // Agitated cells pull from the scramble alphabet.
        glyph = GLYPHS.noise[(gn * GLYPHS.noise.length) | 0];
      } else {
        glyph = rampGlyph(0.15 + energy * 0.7);   // low ramp -> blank-ish ground
        if (glyph === ' ') glyph = GLYPHS.ramp[1]; // never draw nothing
      }

      // Colour: low-contrast near night-faint, lifting slightly with energy.
      // A small fraction glint in the studio blue; cells near the pointer warm
      // toward accent too, so the cursor leaves a faint blue current.
      let colour;
      const isGlint = pick(i * 0.137, t * 0.5) < accentN;
      if (isGlint || near > 0.35) {
        colour = mixHex(pal.nightFaint, pal.accent, isGlint ? 0.85 : 0.45 * near + 0.2);
      } else {
        // night-faint lifted toward a light slate by energy, so the currents
        // read brighter on the dark ground; calm pulls the headline zone back.
        const lift = (0.35 + energy * 0.65) * calm;
        colour = mixHex(pal.nightFaint, '#9a96ad', lift);
      }
      ctx.fillStyle = colour;
      ctx.fillText(glyph, nx, ny);
    }
  }

  // One animated frame: veil, then step + draw. The veil is a translucent night
  // fill (not a clear) so glyph trails persist and fade into the ground.
  function frame() {
    // A firmer veil so trails fade in a few frames instead of stacking into
    // persistent grey layers; the currents stay legible without the smear.
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = pal.night;
    ctx.fillRect(0, 0, vw, vh);
    ctx.globalAlpha = 1;
    ctx.font = `${FONT_PX}px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    step(1);
  }

  // --- Pointer / touch: works with mouse or finger; harmless without one -----
  const setPointer = (e) => {
    const rect = canvas.getBoundingClientRect();
    pX = e.clientX - rect.left;
    pY = e.clientY - rect.top;
    stir = 1;
  };
  const clearPointer = () => { pX = -1; pY = -1; };
  let pointerWired = false;
  function wirePointer() {
    if (pointerWired) return;
    // pointermove/down cover mouse, pen and touch (the mount sets touch-action:
    // none, so touch drags reach us without scrolling the band).
    canvas.addEventListener('pointermove', setPointer, { passive: true });
    canvas.addEventListener('pointerdown', setPointer, { passive: true });
    canvas.addEventListener('pointerleave', clearPointer, { passive: true });
    canvas.addEventListener('pointercancel', clearPointer, { passive: true });
    pointerWired = true;
  }
  function unwirePointer() {
    if (!pointerWired) return;
    canvas.removeEventListener('pointermove', setPointer);
    canvas.removeEventListener('pointerdown', setPointer);
    canvas.removeEventListener('pointerleave', clearPointer);
    canvas.removeEventListener('pointercancel', clearPointer);
    pointerWired = false;
  }

  let stop = () => {};

  // --- Reduced motion: one settled, legible glyph field, no loop ------------
  if (prefersReducedMotion()) {
    // Solid ground, then a few advection strides so particles spread into a
    // coherent field rather than a scatter of seed points. No veil, no loop.
    ctx.fillStyle = pal.night;
    ctx.fillRect(0, 0, vw, vh);
    ctx.font = `${FONT_PX}px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    t = 3.0;                       // a calm moment in the drift
    for (let pass = 0; pass < 26; pass++) step(1.1);
    return () => { dispose(); };
  }

  // --- Animated: idle until the band nears the viewport ---------------------
  const stopVis = onVisible(canvas, () => {
    wirePointer();
    stop = rafLoop((dt) => {
      t += dt / 1000;
      // Stir energy decays toward calm over ~0.7s after the pointer stops.
      stir = Math.max(0, stir - (dt / 1000) / 0.7);
      frame();
    }, { fps: 36 });
  }, { rootMargin: '0px 0px 15% 0px' });

  return () => {
    stop();
    stopVis();
    unwirePointer();
    dispose();
  };
}
