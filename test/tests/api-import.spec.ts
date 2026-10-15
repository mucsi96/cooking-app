import { test, expect } from '../fixtures';
import { createHash } from 'node:crypto';

const GERMAN_STRUDEL_TEXT = `Omas Apfelstrudel

Für 8 Portionen

Zutaten: 6 Strudelblätter, 1 kg Äpfel, 100 g Zucker, 1 TL Zimt, 80 g zerlassene Butter.

Die Äpfel reiben und mit Zucker und Zimt vermischen. Die Strudelblätter mit
Butter bestreichen, die Füllung verteilen und den Strudel einrollen.
Bei 180 Grad 35 Minuten goldbraun backen.`;

test('imports a recipe from plain text over the cookie-authenticated API', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Felhasználói menü' })).toHaveText('O');

  const response = await page.request.post('/api/recipes/import', {
    headers: { Origin: new URL(page.url()).origin },
    data: { text: GERMAN_STRUDEL_TEXT },
  });

  expect(response.ok()).toBeTruthy();
  const recipe = await response.json();
  expect(recipe.title).toBe('Almás rétes');
  expect(recipe.category).toBe('Sütemény');
  expect(recipe.servings).toBe(8);
  expect(recipe.ingredients).toContainEqual({
    name: 'réteslap',
    amount: 6,
    unit: 'db',
  });

  // The imported recipe shows up in the Hungarian category listing
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sütemény' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Almás rétes' })).toBeVisible();
});

test('accepts an intentional machine bearer token without a browser cookie or Origin', async ({ page, request }) => {
  await page.goto('/');
  const redirect = 'http://localhost:8160/oauth2/callback';
  const verifier = 'fixture-machine-client-verifier-0123456789abcdef';
  const authorization = await request.get('http://localhost:8060/default/authorize', {
    maxRedirects: 0,
    params: {
      client_id: 'cooking-web', redirect_uri: redirect, response_type: 'code',
      scope: 'openid profile email offline_access api://mock-api-client-id/api-access',
      state: 'fixture-machine-state', nonce: 'fixture-machine-nonce',
      code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256',
    },
  });
  expect(authorization.status()).toBe(302);
  const code = new URL(authorization.headers()['location']).searchParams.get('code')!;
  const tokens = await request.post('http://localhost:8060/default/token', { form: {
    grant_type: 'authorization_code', client_id: 'cooking-web', client_secret: 'fixture-web-secret',
    redirect_uri: redirect, code, code_verifier: verifier,
  } });
  expect(tokens.ok()).toBeTruthy();
  const { access_token } = await tokens.json();
  const response = await request.post('/api/integrations/recipes/import', {
    headers: { Authorization: `Bearer ${access_token}` }, data: { text: GERMAN_STRUDEL_TEXT },
  });
  expect(response.ok()).toBeTruthy();
  expect((await response.json()).title).toBe('Almás rétes');
});
