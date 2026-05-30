# tools.kindl.work

Landing for the Tooling Practice, the small-software studio sibling to the art
practice at [kindl.work](https://kindl.work). Small software, made by hand: some
you can use in the browser, some built to order.

Astro 6, static, generative-first. The page is a single landing with a hand-rolled
generative layer (no canvas libraries): a self-assembling glyph field, a live
generator demo, a decoding catalog, an interactive examples explorer by trade, and
a glyph flow-field band. Everything honors `prefers-reduced-motion` and pauses
off-screen.

## Develop

```sh
pnpm install
pnpm dev      # http://localhost:4321
pnpm build    # -> dist/
```

## Deploy

Pushed to GitHub Pages at `https://keiaiendiel.github.io/tools-web/` via
`.github/workflows/deploy-pages.yml`. When DNS to `tools.kindl.work` is ready,
change `site` in `astro.config.mjs` to the apex domain, drop the `base` line, and
update the hard-coded `/tools-web/fonts/...` url in `src/styles/tokens.css`.

## Structure

- `src/scripts/glyph-core.js` — shared generative substrate (seeded noise, DPR
  canvas fitter, monospace cell metrics, rAF loop, palette reader, glyph sets).
- `src/scripts/*.js` — one module per generative mount, booted by `main.js`.
- `src/styles/` — `tokens.css` (ink-on-paper palette, IBM Plex Mono/Serif, DR
  Krapka pixel accent, scale) and `kit.css` (layout + components).

Type: IBM Plex Mono + Serif, with DR Krapka Round (pixel variant) as an occasional
display accent. Accent colour `#362cca`.
