import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

const [appOrigin, assetBaseUrl] = process.argv.slice(2);
const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  await context.addCookies([{ name: 'fixture-session', value: 'private', url: appOrigin }]);
  const page = await context.newPage();
  const assets = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (['script', 'stylesheet', 'font', 'image', 'manifest'].includes(request.resourceType())) {
      assets.push(request.url());
    }
  });
  await page.route('**/_telemetry/collect', route => route.fulfill({ status: 202, json: {} }));
  const telemetry = page.waitForRequest(request => request.url() === `${appOrigin}/_telemetry/collect` && request.method() === 'POST');
  await page.goto(`${appOrigin}/?source=bookmark`);
  assert.equal((await telemetry).postDataJSON().meta.app.name, 'cooking-client');
  assert.equal(await page.evaluate(() => '__APP_CONFIG__' in window), false);
  await expect(page.getByRole('heading', { name: 'Még nincs egyetlen recept sem' })).toBeVisible();
  await page.evaluate(async () => {
    for (const font of ['400 16px Roboto', '400 24px "Material Icons"']) {
      if (!(await document.fonts.load(font)).length) throw new Error(`Missing bundled font: ${font}`);
    }
  });
  // Exercise a real lazy route and refreshing it with a query string.
  await page.getByRole('link', { name: 'Recept importálása', exact: true }).click();
  await expect(page).toHaveURL(`${appOrigin}/importalas`);
  await page.goto(`${appOrigin}/importalas?source=bookmark`);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hogyan adnád hozzá?' })).toBeVisible();
  assert.equal(await page.evaluate(() => document.baseURI), `${appOrigin}/`);
  assert.deepEqual(errors, []);

  const manifest = await page.evaluate(async () => {
    const url = document.querySelector('link[rel="manifest"]').href;
    return (await fetch(url, { credentials: 'omit' })).json();
  });
  for (const field of ['id', 'scope', 'start_url']) assert.equal(manifest[field], `${appOrigin}/`);
  await page.evaluate(url => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = resolve;
    image.onerror = reject;
    image.src = url;
  }), new URL(manifest.icons[0].src, `${assetBaseUrl}manifest.webmanifest`).href);

  for (const suffix of ['.js', '.css', '.woff2', '.png']) {
    assert(assets.some(url => url.endsWith(suffix)), `No ${suffix} request was exercised`);
  }
  assert(assets.some(url => /\/chunk-.*\.js$/.test(url)), 'Lazy modules must load from storage');
  assert(assets.every(url => url.startsWith(assetBaseUrl)), `Assets escaped storage: ${assets}`);
  assert.equal(await page.evaluate(async url => (await fetch(url)).status, `${assetBaseUrl}missing.js`), 404);
  const corsBlocked = await page.evaluate(async url => {
    try { await fetch(url); return false; } catch { return true; }
  }, `${assets.find(url => url.endsWith('.js'))}?no-cors`);
  assert(corsBlocked, 'The browser must enforce CORS for cross-origin assets');
} finally {
  await browser.close();
}
