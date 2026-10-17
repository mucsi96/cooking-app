import { test, expect } from '../fixtures';
import { getRecipes } from '../utils';

test('follows a bootstrap redirect before starting Angular', async ({ page }) => {
  await page.route('**/api/environment?*', route => {
    const target = new URL(route.request().url()).searchParams.get('returnTo');
    expect(target).toBe('/importalas?source=bookmark#draft');
    return route.fulfill({ json: { redirectTo: '/test-login' } });
  });
  await page.route('**/test-login', route => route.fulfill({ contentType: 'text/html', body: 'Mock sign-in' }));
  await page.goto('/importalas?source=bookmark#draft');
  await expect(page).toHaveURL('/test-login');
  await expect(page.getByText('Mock sign-in')).toBeVisible();
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
