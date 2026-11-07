import { defineConfig } from 'astro/config';

// GitHub Pages serves this repo under /personal-portfolio. Once a custom domain
// is set up, set SITE_URL to it and BASE_PATH to "/" in the deploy workflow.
export default defineConfig({
  site: process.env.SITE_URL ?? 'https://simar-s2.github.io',
  base: process.env.BASE_PATH ?? '/personal-portfolio',
  trailingSlash: 'always',
  build: { inlineStylesheets: 'always' },
  devToolbar: { enabled: false },
  markdown: {
    shikiConfig: {
      themes: { dark: 'vesper', light: 'github-light' },
      defaultColor: false,
    },
  },
});
