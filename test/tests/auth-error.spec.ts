import { test, expect } from '../fixtures';
import { getRecipes } from '../utils';

test('uses token-free browser identity and an HttpOnly session', async ({ page, context, request }) => {
  expect((await request.get('/api/recipes')).status()).toBe(401);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Felhasználói menü' })).toHaveText('O');
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('oidc.') || key.startsWith('msal.')))).toEqual([]);
  expect((await context.cookies()).find(cookie => cookie.name === 'cooking-test')?.httpOnly).toBe(true);
  expect(await (await page.request.get('/oauth2/userinfo')).text()).not.toMatch(/access_token|refresh_token|id_token/);
});

test('preserves a recipe draft through expired-session reauthentication', async ({ page }) => {
  await page.goto('/importalas');
  const draft = page.getByLabel('Recept szövege vagy webcíme');
  await draft.fill('Goulash recipe draft');
  await page.request.get('/oauth2/sign_out', { maxRedirects: 0 });
  await page.getByRole('button', { name: 'Importálás', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bejelentkezés szükséges' })).toBeVisible();
  await expect(draft).toHaveValue('Goulash recipe draft');
  expect(await getRecipes()).toHaveLength(0);
  const originalURL = page.url();
  const popup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Újra bejelentkezem' }).click();
  await (await popup).waitForEvent('close');
  await expect(page.getByRole('heading', { name: 'Bejelentkezés szükséges' })).toBeHidden();
  await expect(draft).toHaveValue('Goulash recipe draft');
  expect(page.url()).toBe(originalURL);
  await page.getByRole('button', { name: 'Importálás', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Gulyásleves' })).toBeVisible();
});

test('rejects sibling and missing Origins without creating a recipe', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Felhasználói menü' })).toHaveText('O');
  for (const origin of [undefined, 'null', 'http://sibling.localhost:8160']) {
    const response = await page.request.post('/api/recipes/import', { headers: origin ? { Origin: origin } : {}, data: { text: 'Goulash' } });
    expect(response.status()).toBe(403);
  }
  expect(await getRecipes()).toHaveLength(0);
  expect((await page.request.post('/api/integrations/recipes/import', { data: { text: 'Goulash' } })).status()).toBe(401);
});

test('renews concurrent API requests server-side without navigating the form', async ({ page }) => {
  await page.goto('/importalas');
  const draft = page.getByLabel('Recept szövege vagy webcíme');
  await draft.fill('Unsaved recipe');
  await page.waitForTimeout(6100);
  expect(await page.evaluate(async () => Promise.all(Array.from({ length: 4 }, async () => (await fetch('/api/recipes')).status)))).toEqual([200, 200, 200, 200]);
  await expect(draft).toHaveValue('Unsaved recipe');
});

test('the household user retains Cooking access', async ({ page, request }) => {
  await request.post('http://localhost:8060/test/reset', { data: { user: 'family' } });
  try {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Felhasználói menü' })).toHaveText('F');
    expect((await page.request.get('/api/recipes')).status()).toBe(200);
  } finally {
    await request.post('http://localhost:8060/test/reset', { data: { user: 'owner' } });
  }
});

test('API roles remain enforced after successful Web login', async ({ page, request }) => {
  await request.post('http://localhost:8060/test/reset', { data: { user: 'owner', mode: 'missing_api_role' } });
  try {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Felhasználói menü' })).toHaveText('O');
    expect((await page.request.get('/api/recipes')).status()).toBe(403);
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: 'Bejelentkezés szükséges' })).toBeHidden();
  } finally {
    await request.post('http://localhost:8060/test/reset', { data: { user: 'owner' } });
  }
});

test('explicit logout clears the session and removes the mounted form', async ({ page }) => {
  await page.goto('/importalas');
  await page.getByLabel('Recept szövege vagy webcíme').fill('Private draft');
  await page.getByRole('button', { name: 'Felhasználói menü' }).click();
  await page.getByRole('menuitem', { name: 'Kijelentkezés' }).click();
  await expect(page.getByRole('heading', { name: 'Bejelentkezés szükséges' })).toBeVisible();
  await expect(page.getByLabel('Recept szövege vagy webcíme')).toBeHidden();
  expect((await page.request.get('/api/recipes')).status()).toBe(401);
});
