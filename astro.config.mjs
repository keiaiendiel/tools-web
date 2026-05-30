// @ts-check
import { defineConfig } from 'astro/config';

// tools.kindl.work — small software, made by hand.
// Landing for the Tooling Practice (sibling to the art studio at kindl.work).
//
// Deployed for preview to GitHub Pages at https://keiaiendiel.github.io/tools-web/
// (project pages, hence the base path). When DNS to tools.kindl.work is ready,
// change `site` to 'https://tools.kindl.work', drop the `base` line, and update
// the hard-coded '/tools-web/fonts/...' url() in tokens.css to '/fonts/...'.
export default defineConfig({
  site: 'https://keiaiendiel.github.io',
  base: '/tools-web/',
  trailingSlash: 'ignore',
  output: 'static',
  compressHTML: true,
  devToolbar: { enabled: false },
});
