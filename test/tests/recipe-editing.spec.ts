import { test, expect } from '../fixtures';
import { GULYAS, insertRecipe, query } from '../utils';

test('long descriptions and steps expand without nested scrolling or horizontal overflow', async ({ page }) => {
  const longText = 'A hozzávalókat alaposan keverd össze, majd lassú tűzön főzd puhára. '.repeat(20);
  const id = await insertRecipe({ ...GULYAS, description: longText, steps: [longText] });
  await page.goto(`/recept/${id}`);
  const edit = page.getByRole('button', { name: 'Recept szerkesztése' });
  await edit.click();
  const dialog = page.getByRole('dialog', { name: 'Recept szerkesztése' });
  for (const label of ['Leírás', 'Elkészítés 1. lépése']) {
    const field = dialog.getByLabel(label, { exact: true });
    await expect(field).toHaveValue(longText);
    await expect.poll(() => field.evaluate(element => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(2);
    await field.fill(longText.repeat(2));
    await expect.poll(() => field.evaluate(element => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(2);
  }
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await dialog.getByRole('button', { name: 'Mégse' }).click();
  await expect(edit).toBeFocused();
});

test('edits original quantities, ingredients and preparation and persists after reload', async ({ page, apiHeaders }) => {
  const id = await insertRecipe(GULYAS);
  await page.goto(`/recept/${id}`);
  await page.getByRole('button', { name: 'Adagok növelése' }).click();
  await page.getByRole('button', { name: 'Recept szerkesztése' }).click();
  const dialog = page.getByRole('dialog', { name: 'Recept szerkesztése' });
  await expect(dialog.getByLabel('Mennyiség 1', { exact: true })).toHaveValue('500');
  await dialog.getByLabel('Hozzávaló 1 neve').fill('marhahús');
  await dialog.getByLabel('Mennyiség 1', { exact: true }).fill('750');
  await dialog.getByRole('button', { name: 'Hozzávaló 2 törlése' }).click();
  await dialog.getByRole('button', { name: 'Hozzávaló hozzáadása' }).click();
  await dialog.getByLabel('Hozzávaló 3 neve').fill('víz');
  await dialog.getByLabel('Mennyiség 3').fill('1.5');
  await dialog.getByLabel('Mértékegység 3').fill('l');
  await dialog.getByLabel('Recept neve').fill('Házi gulyás');
  await dialog.getByLabel('Leírás', { exact: true }).fill('Átdolgozott családi recept.');
  await dialog.getByLabel('Alapadagok száma').fill('6');
  await dialog.getByLabel('Kategória').click();
  await page.getByRole('option', { name: 'Főétel', exact: true }).click();
  await dialog.getByLabel('Elkészítés 1. lépése').fill('Pirítsd meg a húst.');
  await dialog.getByRole('button', { name: '2. lépés törlése' }).click();
  await dialog.getByRole('button', { name: 'Lépés hozzáadása' }).click();
  await dialog.getByLabel('Elkészítés 2. lépése').fill('Főzd puhára a vízben.');
  await dialog.getByRole('button', { name: 'Mentés', exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Házi gulyás' })).toBeVisible();
  await expect(page.getByText('6 adag')).toBeVisible();
  await expect(page.getByText('750 g')).toBeVisible();
  const response = await page.request.get(`/api/recipes/${id}`, { headers: apiHeaders });
  expect(await response.json()).toMatchObject({
    title: 'Házi gulyás', description: 'Átdolgozott családi recept.', category: 'Főétel', servings: 6,
    ingredients: [{ name: 'marhahús', amount: 750, unit: 'g' }, GULYAS.ingredients[2], { name: 'víz', amount: 1.5, unit: 'l' }],
    steps: ['Pirítsd meg a húst.', 'Főzd puhára a vízben.'],
  });
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Házi gulyás' })).toBeVisible();
});

test('cancel discards edits and failed saves keep the draft for retry', async ({ page }) => {
  const id = await insertRecipe(GULYAS);
  await page.goto(`/recept/${id}`);
  await page.getByRole('button', { name: 'Recept szerkesztése' }).click();
  const dialog = page.getByRole('dialog', { name: 'Recept szerkesztése' });
  await dialog.getByLabel('Recept neve').fill('Elvetett név');
  await dialog.getByRole('button', { name: 'Mégse' }).click();
  await page.getByRole('button', { name: 'Recept szerkesztése' }).click();
  await expect(dialog.getByLabel('Recept neve')).toHaveValue(GULYAS.title);
  await dialog.getByLabel('Mennyiség 1', { exact: true }).fill('');
  await dialog.getByLabel('Mértékegység 1', { exact: true }).fill('');
  await page.route(`**/api/recipes/${id}`, route => route.request().method() === 'PUT'
    ? route.fulfill({ status: 500, json: { message: 'Hiba' } }) : route.fallback());
  await dialog.getByRole('button', { name: 'Mentés', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog.getByLabel('Mennyiség 1', { exact: true })).toHaveValue('');
  await page.unroute(`**/api/recipes/${id}`);
  await dialog.getByRole('button', { name: 'Mentés', exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(page.getByText('marhalábszár')).toBeVisible();
  await expect(page.getByText('500 g')).toBeHidden();
});

test('API validates edits, enforces authentication and Origin, and preserves images', async ({ page, apiHeaders }) => {
  const id = await insertRecipe(GULYAS);
  await page.goto(`/recept/${id}`);
  const url = `/api/recipes/${id}`;
  const headers = { ...apiHeaders, Origin: new URL(page.url()).origin };
  expect((await page.request.put(url, { headers: { Origin: headers.Origin }, data: GULYAS })).status()).toBe(401);
  expect((await page.request.put(url, { headers: apiHeaders, data: GULYAS })).status()).toBe(403);
  for (const patch of [{ ingredients: [] }, { steps: [' '] }, { servings: 0 }, { category: 'invalid' },
    { ingredients: [{ name: 'só', amount: -1, unit: null }] },
    { ingredients: [{ name: 'só', amount: 100000000, unit: null }] }]) {
    expect((await page.request.put(url, { headers, data: { ...GULYAS, ...patch } })).status()).toBe(400);
  }
  expect(await (await page.request.get(url, { headers })).json()).toMatchObject({ ...GULYAS });
  expect((await page.request.put('/api/recipes/00000000-0000-0000-0000-000000000001', { headers, data: GULYAS })).status()).toBe(404);
  const image = await query(`INSERT INTO cooking.image_generation_jobs (id, recipe_id, status, created_at) VALUES (gen_random_uuid(), $1, 'COMPLETED', now()) RETURNING id`, [id]);
  const imageId = image.rows[0].id;
  await query('UPDATE cooking.recipes SET image_id = $1 WHERE id = $2', [imageId, id]);
  expect((await page.request.put(url, { headers, data: { ...GULYAS, description: 'Új leírás.' } })).status()).toBe(204);
  expect(await (await page.request.get(url, { headers })).json()).toMatchObject({ ...GULYAS, description: 'Új leírás.', imageId });
  expect((await query('SELECT id FROM cooking.image_generation_jobs WHERE recipe_id = $1', [id])).rows).toEqual([{ id: imageId }]);
});
