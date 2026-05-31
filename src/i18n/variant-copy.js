/* =============================================================================
   variant-copy.js - bespoke copy per design variant (English).
   -----------------------------------------------------------------------------
   Each variant speaks in the register of its own aesthetic, all in the studio
   voice: precise, grounded, direct, not salesy. No em dashes or en dashes.

   Built on content.en so the factual layer (the bench tool list, the fields by
   trade) stays shared and in sync; only the voiced prose differs per variant.

   Messaging rethink (2026-05-31), applied across all variants:
     - dropped the hero feature-bullets (cut to one task / browser-native / no account)
     - the old "what ships first" ranking is now "how it goes": an honest sequence
       of working together, not a ranked menu (the first conversation is free)
     - dropped the license tier; the commercial bit leads with a free first call
   content.en (the live main site) is intentionally left untouched.
============================================================================= */
import { content } from './content.js';

const base = content.en;

/* The work, as a short honest sequence. Heading is voiced per variant. */
const howItGoes = (h) => ({
  h,
  items: [
    { no: '01', nm: 'Tell me the task', what: 'What you keep doing by hand, and the shape of your data. A short message or a call is enough to start.', who: 'to start' },
    { no: '02', nm: 'I build it to fit', what: 'A tool in about a week, fixed scope, in your style. You watch it take shape, it is not a black box.', who: 'about a week' },
    { no: '03', nm: 'You own it', what: 'Handed over with docs, running in your browser or on your machine. No account, no subscription, no lock-in.', who: 'yours to keep' },
  ],
});

/* What it costs, plainly. License tier dropped; free first conversation leads. */
const ways = (h) => ({
  h,
  cols: [
    { t: 'Use it', px: 'free', d: 'Most of the bench runs in your browser. No account, nothing to install, nothing uploaded anywhere. Open it and go.' },
    { t: 'Talk it through', px: 'free', d: 'Tell me the task and what your data looks like. The first conversation costs nothing, and often it settles whether a small tool is the answer at all.' },
    { t: 'Built to order', px: 'from €1500', d: 'A tool in about a week, fixed scope, handed over with docs. Or a custom generator from €3000. No open-ended brief.' },
  ],
  cta1: base.order.cta1,
  cta2: base.order.cta2,
});

export const vcopy = {
  /* ---- 1 PRESS: a studio broadsheet, a printer's voice -------------------- */
  1: {
    ...base,
    title: 'Antonín Kindl - a small press for software',
    hero: {
      ...base.hero,
      sub: 'An edition of tools, each set for one task and one reader.',
      intro: 'I am Antonín Kindl. Next to the art studio at kindl.work I keep a small press for software: most pieces you can open and use today, and if the one you need is not in the catalogue, you tell me the task and I set it for you.',
      meta: ['one task at a time', 'open and use today', 'kept small'],
    },
    how: {
      ...base.how,
      h: 'A tool the exact size of the task.',
      cap: 'One template, every version of the work struck from it, clean each time. That is the whole job of a generator: the repeat, set once, on brand.',
    },
    bench: { ...base.bench, h: 'The catalogue.', intro: 'Four lines where the studio has an edge and the budgets are real. The list grows; this is its working face.' },
    fields: { ...base.fields, h: 'It sets in your trade too.', intro: 'The same idea travels across trades. Pick one and read what a small tool can be.' },
    band: { line1: 'Made to fit,', line2: 'one tool at a time.', sub: 'No platform, no subscription. A file you open, or a tool I set for you and hand over.' },
    ships: howItGoes('How it goes.'),
    order: ways('What it costs, plainly.'),
    footer: { ...base.footer, sigBold: 'Small software, made to fit.' },
  },

  /* ---- 2 TERMINAL: system voice, lowercase, terse, builder to builder ----- */
  2: {
    ...base,
    title: 'antonin kindl - small software, made to fit',
    hero: {
      ...base.hero,
      sub: 'some run in your browser now. for the rest, tell me what you keep doing by hand.',
      intro: "i'm antonin kindl. i build small tools, one task and one person at a time, next to the art studio at kindl.work. open one in the browser, or describe the tool that should exist and i'll build it.",
      meta: [],
    },
    how: {
      ...base.how,
      h: 'a tool the exact size of the task',
      cap: 'one template in, every version out. that is the whole job of a generator: the repeat, instant, on brand.',
    },
    bench: { ...base.bench, h: 'what comes off the bench', intro: 'four lines where the edge is real and the budgets exist. the catalog grows. this is the working face of it.' },
    fields: { ...base.fields, h: 'it fits your field too', intro: 'same idea, any trade. pick one and see what a small tool can be.' },
    band: { line1: 'made to fit,', line2: 'one tool at a time.', sub: 'no platform. no subscription. no account. a file you open, or a tool i build and hand you.' },
    ships: howItGoes('how it goes'),
    order: ways('how it works, and what it costs'),
    footer: { ...base.footer, sigBold: 'small software, made to fit.' },
  },

  /* ---- 3 COMPOSITION: clipped, cadenced, captions to a piece -------------- */
  3: {
    ...base,
    title: 'Antonín Kindl - small software, made to fit',
    hero: {
      ...base.hero,
      sub: 'Some you can open now. Some I build for the one task you keep circling.',
      intro: 'Antonín Kindl. I build small software, one task, one person, beside the art studio at kindl.work. Open one in the browser, or name the tool you keep wishing for and I make it.',
      meta: [],
    },
    how: {
      ...base.how,
      h: 'A tool the size of one task.',
      cap: 'One template. Every version, on the beat. The repeat handed back to you, instant and on brand.',
    },
    bench: { ...base.bench, h: 'What comes off the bench.', intro: 'Four lines where the edge shows and the budgets are real. The catalog keeps growing.' },
    fields: { ...base.fields, h: 'It carries to your field.', intro: 'The same idea, across every trade. Pick one and watch what a small tool becomes.' },
    band: { line1: 'Made to fit,', line2: 'one tool at a time.', sub: 'No platform, no subscription, no account. A file you open, or a tool I build and hand you.' },
    ships: howItGoes('How it goes.'),
    order: ways('Three ways. The price is in the open.'),
    footer: { ...base.footer, sigBold: 'Small software, made to fit.' },
  },

  /* ---- 4 SCHEMATIC: spec-sheet, drafting annotations, declarative --------- */
  4: {
    ...base,
    title: 'Antonín Kindl - small software, built to one task',
    hero: {
      ...base.hero,
      sub: 'Spec: small tools, cut to one task. Most run in the browser; the rest are built to order.',
      intro: 'Antonín Kindl, design engineer. I build small software to one task and one operator, alongside the art studio at kindl.work. Open one in the browser, or specify the tool that should exist and I draw it up and build it.',
      meta: ['scope: one task', 'runs: browser', 'owner: you'],
    },
    how: {
      ...base.how,
      h: 'A tool dimensioned to the task.',
      cap: 'One template, every instance struck off the same drawing. That is the function of a generator: the repeat, to spec, every time.',
    },
    bench: { ...base.bench, h: 'Bench schedule.', intro: 'Four lines where the studio has an edge and the budgets are real. The schedule grows; this is its working face.' },
    fields: { ...base.fields, h: 'Fits your field, to spec.', intro: 'The same drawing travels across trades. Select one and read what a small tool can be.' },
    band: { line1: 'Built to fit,', line2: 'one tool at a time.', sub: 'No platform, no subscription, no account. A file you own, or a tool drawn up and handed over.' },
    ships: howItGoes('Sequence of work.'),
    order: ways('Cost, to spec.'),
    footer: { ...base.footer, sigBold: 'Small software, made to fit.' },
  },

  /* ---- 5 FIELD: spare, spatial, exploratory ------------------------------- */
  5: {
    ...base,
    title: 'Antonín Kindl - small software, made to fit',
    hero: {
      ...base.hero,
      sub: 'Some you can open now. Some I build for the task you keep returning to.',
      intro: 'Antonín Kindl. I build small software, one task and one person at a time, alongside the art studio at kindl.work. Open one in the browser, or tell me the tool you wish existed and I make it.',
      meta: [],
    },
    how: {
      ...base.how,
      h: 'A tool the exact size of the task.',
      cap: 'One template, every version of the work, made on the spot. The repeat, instant, on brand.',
    },
    bench: { ...base.bench, h: 'What comes off the bench.', intro: 'Four lines where the edge shows and the budgets are real. The catalog grows; this is its working face.' },
    fields: { ...base.fields, h: 'It fits your field too.', intro: 'The same idea travels across trades. Move through one and see what a small tool can be.' },
    band: { line1: 'Made to fit,', line2: 'one tool at a time.', sub: 'No platform, no subscription, no account. A file you open, or a tool I build and hand you.' },
    ships: howItGoes('How it goes.'),
    order: ways('Three ways. The price is open.'),
    footer: { ...base.footer, sigBold: 'Small software, made to fit.' },
  },
};
