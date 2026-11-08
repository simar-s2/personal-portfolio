// Drives a local Chrome to screenshot pages of the built site.
//   node scripts/shoot.mjs <path> <out.png> [width] [height] [dark|light] [--full] [--js=<code>]
// Used for the README pictures, the poster images and checking renders by eye.

import puppeteer from 'puppeteer-core';

const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith('--'));
const [path, out, width = '1440', height = '1000', theme = 'dark'] = args.filter((a) => !a.startsWith('--'));
const code = flags.find((f) => f.startsWith('--js='))?.slice(5);
const base = process.env.SHOOT_BASE ?? 'http://localhost:4321/';

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars'],
});
const page = await browser.newPage();
await page.setViewport({ width: +width, height: +height, deviceScaleFactor: +(process.env.SHOOT_SCALE ?? 2) });
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
page.on('console', (m) => {
  if (['error', 'warn'].includes(m.type())) console.log(m.type().toUpperCase(), m.text());
});
await page.evaluateOnNewDocument((t) => {
  try {
    localStorage.setItem('theme', t);
  } catch {}
}, theme);
await page.goto(base + path, { waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts.ready);
if (flags.includes('--render')) {
  await page.evaluate(() => document.querySelector('[data-render]')?.scrollIntoView({ block: 'center' }));
  await page.waitForFunction('window.__renderReady === true', { timeout: 20000 });
}
if (code) await page.evaluate(code);
await new Promise((r) => setTimeout(r, +(process.env.SHOOT_WAIT ?? 900)));
const selector = flags.find((f) => f.startsWith('--el='))?.slice(5);
if (selector) {
  const el = await page.$(selector);
  await el.screenshot({ path: out });
} else {
  await page.screenshot({ path: out, fullPage: flags.includes('--full') });
}
await browser.close();
