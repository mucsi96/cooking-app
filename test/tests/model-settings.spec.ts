import { test, expect } from '../fixtures';
import { query } from '../utils';

for (const model of ['claude-sonnet-4-6', 'gpt-6-astra']) {
test(`requires structured recipe JSON from ${model}`, async ({ page }) => {
  await query(`UPDATE cooking.model_settings SET value = jsonb_set(value, '{extraction}', to_jsonb($1::text)) WHERE id = 1`, [model]);
  await page.goto('/importalas');
  for (const text of ['INVALID_JSON', 'FENCED_JSON']) {
    await page.getByLabel('Recept szövege').fill(text);
    await page.getByRole('button', { name: 'Importálás' }).click();
    await expect(page.getByRole('alert')).toContainText('A recept feldolgozása nem sikerült');
    expect((await query('SELECT id FROM cooking.recipes')).rowCount).toBe(0);
  }
  await page.getByLabel('Recept szövege').fill('Goulash');
  await page.getByRole('button', { name: 'Importálás' }).click();
  await expect(page.getByRole('heading', { name: 'Gulyásleves' })).toBeVisible();
  await page.getByRole('button', { name: 'Borítókép módosítása' }).click();
  const dialog = page.getByRole('dialog', { name: 'Borítókép', exact: true });
  await expect(dialog.getByRole('button', { name: /Kép kiválasztása/ })).toHaveCount(3, { timeout: 30000 });
  const response = await fetch(`${process.env.TEST_ANTHROPIC_URL ?? 'http://localhost:3060'}/requests`);
  const requests = await response.json();
  expect(requests.length).toBeGreaterThan(0);
  for (const request of requests) {
    expect(request.outputConfig).toMatchObject({ format: { type: 'json_schema', schema: { type: 'object', additionalProperties: false } } });
  }
  expect(requests).toContainEqual(expect.objectContaining({ outputConfig: { format: { type: 'json_schema', schema: {
    type: 'object', additionalProperties: false, required: ['description'], properties: { description: { type: 'string' } },
  } } } }));
  if (model.startsWith('claude')) {
    expect(requests).toContainEqual(expect.objectContaining({ outputConfig: { format: { type: 'json_schema', schema: expect.objectContaining({
      required: ['title', 'description', 'category', 'servings', 'ingredients', 'steps'],
    }) } } }));
  }
});
}

test('persists model settings and uses selected OpenAI data and image models', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Felhasználói menü' }).click();
  await page.getByRole('menuitem', { name: 'Beállítások' }).click();
  await page.getByRole('combobox', { name: 'Recept felismerése', exact: true }).click();
  for (const id of ['gpt-6-astra', 'gpt-6-sol', 'gpt-5.5', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna']) {
    await expect(page.getByRole('option', { name: id, exact: true })).toBeAttached();
  }
  await page.getByRole('option', { name: 'gpt-6-astra', exact: true }).click();
  await page.getByRole('combobox', { name: 'Képleírás készítése', exact: true }).click();
  await page.getByRole('option', { name: 'gpt-6-sol', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'gpt-image-2.5-sunburst (medium) képek száma', exact: true }).fill('0');
  await page.getByRole('spinbutton', { name: 'gpt-image-2.5-flare (xhigh) képek száma', exact: true }).fill('2');
  await page.getByRole('button', { name: 'Mentés', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('A beállításokat mentettük.');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Recept felismerése', exact: true })).toContainText('gpt-6-astra');
  await expect(page.getByRole('spinbutton', { name: 'gpt-image-2.5-flare (xhigh) képek száma', exact: true })).toHaveValue('2');
  await page.goto('/importalas');
  await page.getByLabel('Recept szövege').fill('Goulash');
  await page.getByRole('button', { name: 'Importálás' }).click();
  await expect(page.getByRole('heading', { name: 'Gulyásleves' })).toBeVisible();
  await page.getByRole('button', { name: 'Borítókép módosítása' }).click();
  const dialog = page.getByRole('dialog', { name: 'Borítókép', exact: true });
  await expect(dialog.getByRole('button', { name: /Kép kiválasztása/ })).toHaveCount(2, { timeout: 30000 });
  const response = await fetch(`${process.env.TEST_OPENAI_URL ?? 'http://localhost:3061'}/requests`);
  const requests = await response.json();
  const extraction = requests.find((request: any) => request.model === 'gpt-6-astra');
  expect(extraction).toMatchObject({ operation: 'chat', photo: false,
    responseFormat: { type: 'json_schema', json_schema: { name: 'recipe', strict: true,
      schema: { type: 'object', additionalProperties: false,
        required: ['title', 'description', 'category', 'servings', 'ingredients', 'steps'],
        properties: {
          category: { enum: ['Reggeli', 'Leves', 'Főétel', 'Köret', 'Saláta', 'Desszert', 'Sütemény', 'Ital', 'Egyéb'] },
          servings: { type: 'integer' },
          ingredients: { type: 'array', items: { additionalProperties: false,
            required: ['name', 'amount', 'unit'], properties: {
              amount: { type: ['number', 'null'] }, unit: { type: ['string', 'null'] },
            } } },
        },
      },
    } },
  });
  expect(requests).toContainEqual({ operation: 'chat', model: 'gpt-6-sol', photo: false,
    responseFormat: { type: 'json_schema', json_schema: { name: 'image_description', strict: true, schema: {
      type: 'object', additionalProperties: false, required: ['description'], properties: { description: { type: 'string' } },
    } } },
  });
  expect(requests.filter((request: any) => request.operation === 'image')).toEqual([
    { operation: 'image', model: 'gpt-image-2.5-flare', quality: 'xhigh' },
    { operation: 'image', model: 'gpt-image-2.5-flare', quality: 'xhigh' },
  ]);
});

test('validates image counts and supports disabling automatic images', async ({ page }) => {
  await page.goto('/beallitasok');
  const count = page.getByRole('spinbutton', { name: 'gpt-image-2.5-sunburst (medium) képek száma', exact: true });
  await count.fill('-1');
  await expect(page.getByRole('button', { name: 'Mentés', exact: true })).toBeDisabled();
  await count.fill('0');
  await page.getByRole('button', { name: 'Mentés', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('A beállításokat mentettük.');
  await page.goto('/importalas');
  await page.getByLabel('Recept szövege').fill('Goulash');
  await page.getByRole('button', { name: 'Importálás' }).click();
  await expect(page.getByRole('heading', { name: 'Gulyásleves' })).toBeVisible();
  expect((await query('SELECT id FROM cooking.image_generation_jobs')).rowCount).toBe(0);
});

test('model settings API rejects invalid values and requires authentication', async ({ page }) => {
  await page.goto('/beallitasok');
  await expect(page.getByRole('combobox', { name: 'Recept felismerése', exact: true })).toBeVisible();
  const token = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(key => key.startsWith('oidc.user'));
    return key ? JSON.parse(localStorage.getItem(key)!).access_token : null;
  });
  const headers = { Authorization: `Bearer ${token}` };
  const initial = await (await page.request.get('/api/settings/models', { headers })).json();
  for (const data of [
    { ...initial, extraction: 'unknown-model' },
    { ...initial, images: null },
    { ...initial, images: [{ id: 'gpt-image-2-low', count: -1 }] },
    { ...initial, images: [{ id: 'gpt-image-2-low', count: 1.5 }] },
    { ...initial, images: [{ id: 'gpt-image-2-low', count: 11 }] },
    { ...initial, images: [{ id: 'unknown-model', count: 1 }] },
    { ...initial, images: [{ id: 'gpt-image-2-low', count: 1 }, { id: 'gpt-image-2-low', count: 1 }] },
  ]) {
    expect((await page.request.put('/api/settings/models', { headers, data })).status()).toBe(400);
  }
  expect(await (await page.request.get('/api/settings/models', { headers })).json()).toEqual(initial);
  expect((await page.request.put('/api/settings/models', { data: initial })).status()).toBe(401);
  expect((await page.request.get('/api/settings/models')).status()).toBe(401);
});
