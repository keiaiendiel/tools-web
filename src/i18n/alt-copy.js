/* =============================================================================
   alt-copy.js - one shared copy source for the two alternate landings,
   /lab (Terminal) and /space (Composition). They are the same studio said two
   ways, so the words, the "how it goes" steps and the pricing live HERE, in one
   place, and both pages render them. Edit once, both update.

   Built on content.en so the factual layer (the tool list, the fields by trade,
   the renamed "lab" catalog) stays in sync with the main site. Only the parts
   that differ from the main site are overridden: the hero meta become footer
   facts, "what ships first" becomes an honest "how it goes" sequence, and the
   pricing drops the license tier for free tools + a free first call + built to
   order. English only.
============================================================================= */
import { content } from './content.js';

const base = content.en;

export const altCopy = {
  ...base,
  hero: { ...base.hero, meta: ['one task at a time', 'in the browser', 'no lock-in'] },
  ships: {
    h: 'How it goes.',
    items: [
      { no: '01', nm: 'Tell me the task', what: 'What you keep doing by hand, and the shape of your data. A short message or a call is enough to start.', who: 'to start' },
      { no: '02', nm: 'I build it to fit', what: 'A tool in about a week, fixed scope, in your style. You watch it take shape, it is not a black box.', who: 'about a week' },
      { no: '03', nm: 'You own it', what: 'Handed over with docs, running in your browser or on your machine. No account, no subscription, no lock-in.', who: 'yours to keep' },
    ],
  },
  order: {
    h: 'Three ways. The price is open.',
    cols: [
      { t: 'Use it', px: 'free', d: 'Most of the lab runs in your browser. No account, nothing to install, nothing uploaded anywhere. Open it and go.' },
      { t: 'Talk it through', px: 'free', d: 'Tell me the task and what your data looks like. The first conversation costs nothing, and often it settles whether a small tool is the answer at all.' },
      { t: 'Built to order', px: 'from €1500', d: 'A tool in about a week, fixed scope, handed over with docs. Or a custom generator from €3000. No open-ended brief.' },
    ],
    cta1: base.order.cta1,
    cta2: base.order.cta2,
  },
};
