import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://simarsingh.dev',
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
