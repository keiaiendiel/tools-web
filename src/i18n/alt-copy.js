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
    h: 'Use a ready-made tool, or get one built for you.',
    cols: [
      { t: 'The tools', px: 'free', d: 'Almost everything runs in your browser. No account, nothing uploaded, nothing to install. A few tools add an optional pro version, pay what you want, yours to keep.' },
      { t: 'A tool of your own', px: 'from €1500', d: 'Fixed packages with a set scope and a set price. A working tool in about a week, from €1500, handed over with a short guide. A custom generator runs from €3000. Bigger systems start with a free first call and a fixed quote you approve before any work begins. You own what gets built. No subscription, no strings.' },
    ],
    cta1: base.order.cta1,
    cta2: base.order.cta2,
  },
};
