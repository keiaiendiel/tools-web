/* =============================================================================
   main.js — boot the generative layer
   -----------------------------------------------------------------------------
   Each module owns one mount point and imports what it needs from glyph-core.js.
   Every init is wrapped in try/catch so a single module failing never takes the
   page down: copy and layout stand on their own, the generative layer is on top.
============================================================================= */
import { initGlyphField } from './glyphfield.js';
import { initCatalog } from './catalog.js';
import { initGeneratorDemo } from './generator-demo.js';
import { initExamples } from './examples.js';
import { initFlowField } from './flowfield.js';
import { initAmbient, initFootField } from './ambient.js';
import { initInquiry } from './inquiry.js';

function safe(label, fn) {
  try { fn(); } catch (err) { console.warn('[tools] ' + label + ' failed', err); }
}

function one(sel, label, init) {
  const el = document.querySelector(sel);
  if (el) safe(label, () => init(el));
}

export function boot() {
  const run = () => {
    one('[data-glyphfield]', 'glyphfield', initGlyphField);
    one('[data-catalog]', 'catalog', initCatalog);
    one('[data-gendemo]', 'gendemo', initGeneratorDemo);
    one('[data-examples]', 'examples', initExamples);
    one('[data-flowfield]', 'flowfield', initFlowField);
    one('[data-ambient-foot]', 'footfield', initFootField);
    one('[data-inquiry]', 'inquiry', initInquiry);
    document.querySelectorAll('[data-ambient]').forEach((el) =>
      safe('ambient', () => initAmbient(el)));
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
}
