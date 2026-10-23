import { test, expect } from '../fixtures';
import { getRecipes } from '../utils';

test('boots a deep link from inline configuration without an environment request', async ({ page }) => {
  const environmentRequests: string[] = [];
  page.on('request', request => {
    if (request.url().includes('/api/environment')) environmentRequests.push(request.url());
  });
  await page.goto('/importalas?source=bookmark#draft');
  await expect(page).toHaveURL(/\/importalas\?source=bookmark#draft$/);
  await expect(page.getByRole('textbox').first()).toBeVisible();
  expect(environmentRequests).toEqual([]);
});

test('sends browser logs to the same-origin collector', async ({ page }) => {
  await page.goto('/');
  const payload = page.waitForRequest(request => request.url().endsWith('/_telemetry/collect') && (request.postData() ?? '').includes('cooking-faro-check'));
  await page.evaluate(() => console.info('cooking-faro-check'));
  expect((await payload).postDataJSON().meta.app.name).toBe('cooking-client');
});

test('API validates bearer tokens and rejects unsafe cross-origin requests', async ({ page, request, apiHeaders }) => {
  expect((await request.get('/api/recipes')).status()).toBe(401);
  expect((await request.get('/api/recipes', { headers: { Authorization: 'Bearer forged' } })).status()).toBe(401);
  expect((await request.get('/api/recipes', { headers: apiHeaders })).status()).toBe(200);
  for (const origin of [undefined, 'null', 'http://sibling.localhost:8160']) {
    const headers = { ...apiHeaders, ...(origin ? { Origin: origin } : {}) };
    expect((await request.post('/api/recipes/import', { headers, data: { text: 'Goulash' } })).status()).toBe(403);
  }
  expect(await getRecipes()).toHaveLength(0);
});
