// Builds the still images from the real renderer: posters that show before WebGL starts,
// thumbnails for the home page, and share images. Run `npm run build && npm run preview`
// in one terminal, then `npm run posters` in another.

import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

const base = process.env.SHOOT_BASE ?? 'http://localhost:4321/personal-portfolio/';
const ids = ['quorumdb', 'cluster-scheduler', 'kbsync', 'facemesh', 'quizzera'];
mkdirSync('public/posters', { recursive: true });
mkdirSync('public/og', { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars'],
});

async function open(path, theme, width = 1200, height = 1000) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 2 });
  await page.evaluateOnNewDocument((t) => localStorage.setItem('theme', t), theme);
  await page.goto(base + path, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  return page;
}

for (const id of ids) {
  for (const theme of ['dark', 'light']) {
    const page = await open(`projects/${id}/?still`, theme);
    await page.addStyleTag({
      content: '.hint,.dock,.dock-fade,.tabs{display:none!important}.poster{display:none!important}[data-reveal]{transition:none!important;opacity:1!important;transform:none!important}',
    });
    await page.evaluate(() => document.querySelector('[data-render]').scrollIntoView({ block: 'start' }));
    await page.waitForFunction('window.__renderReady === true', { timeout: 30000 });
    await new Promise((r) => setTimeout(r, 900));
    const stage = await page.$('.stage');

    const full = await stage.screenshot();
    await sharp(full).resize(1600).webp({ quality: 78 }).toFile(`public/posters/${id}-${theme}.webp`);

    // Thumbnails read better without labels.
    await page.addStyleTag({ content: '.labels{display:none!important}' });
    await new Promise((r) => setTimeout(r, 150));
    const bare = await stage.screenshot();
    await sharp(bare).resize(480, 312, { fit: 'cover' }).webp({ quality: 78 }).toFile(`public/posters/${id}-tile-${theme}.webp`);
    if (theme === 'dark') {
      await sharp(full).resize(1200, 630, { fit: 'cover' }).jpeg({ quality: 82 }).toFile(`public/og/${id}.jpg`);
    }
    await page.close();
    console.log('done', id, theme);
  }
}

const home = await open('', 'dark', 1200, 630);
await home.addStyleTag({ content: '.dock,.dock-fade{display:none!important}' });
await new Promise((r) => setTimeout(r, 1200));
await sharp(await home.screenshot()).resize(1200, 630).jpeg({ quality: 82 }).toFile('public/og/home.jpg');
await browser.close();
