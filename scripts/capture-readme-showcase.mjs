import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const repoRoot = path.resolve(process.argv[2] || process.cwd());
const frameDir = path.join(repoRoot, '.showcase-frames');
const assetDir = path.join(repoRoot, 'docs', 'assets');
const posterPath = path.join(assetDir, 'growtopia-explorer-showcase-poster.png');
const showcaseUrl = 'https://growtopia-explorer.vercel.app/workflow-demo.html?capture=1';
const width = 1280;
const height = 720;
const fps = 12;
const durationMs = 20000;
const playbackRate = 0.75;
const frameCount = Math.floor((durationMs / 1000) * fps);
const frameIntervalMs = 1000 / fps;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));

await fs.rm(frameDir, { recursive: true, force: true });
await fs.mkdir(frameDir, { recursive: true });
await fs.mkdir(assetDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: 1,
  reducedMotion: 'no-preference'
});
const page = await context.newPage();

// Slow the showcase clock without changing the production page itself.
// 0.75x turns the 15-second product timeline into a calmer 20-second README loop.
await page.addInitScript((rate) => {
  const nativeNow = performance.now.bind(performance);
  const realOrigin = nativeNow();
  const virtualOrigin = realOrigin;
  Object.defineProperty(performance, 'now', {
    configurable: true,
    value: () => virtualOrigin + (nativeNow() - realOrigin) * rate
  });
}, playbackRate);

page.on('console', (message) => {
  if (message.type() === 'error') console.error(`[browser] ${message.text()}`);
});
page.on('pageerror', (error) => console.error(`[pageerror] ${error.message}`));

try {
  await page.goto(showcaseUrl, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForSelector('#demo-stage', { state: 'visible', timeout: 30000 });
  await page.waitForSelector('#world-demo-canvas', { state: 'attached', timeout: 30000 });
  await page.waitForTimeout(1200);

  const assetError = page.locator('#asset-error:not([hidden])');
  if (await assetError.count()) {
    const errorText = await assetError.innerText();
    throw new Error(`Showcase reported an asset error: ${errorText}`);
  }

  // Restart after all page assets are warm so the exported loop starts cleanly at frame 0.
  await page.evaluate(() => document.getElementById('restart-demo')?.click());
  await page.waitForTimeout(80);

  const captureStart = performance.now();
  for (let index = 0; index < frameCount; index += 1) {
    const dueAt = captureStart + index * frameIntervalMs;
    const remaining = dueAt - performance.now();
    if (remaining > 1) await delay(remaining);

    const filename = `frame-${String(index).padStart(4, '0')}.png`;
    await page.screenshot({
      path: path.join(frameDir, filename),
      type: 'png',
      fullPage: false,
      animations: 'allow'
    });
  }

  // Use a late Build/Play frame as a static social / fallback poster.
  const posterSecond = 15.4;
  const posterFrame = `frame-${String(Math.min(frameCount - 1, Math.round(fps * posterSecond))).padStart(4, '0')}.png`;
  await fs.copyFile(path.join(frameDir, posterFrame), posterPath);

  console.log(`Captured ${frameCount} frames at ${width}x${height} / ${fps} fps / ${playbackRate}x playback.`);
} finally {
  await context.close();
  await browser.close();
}
