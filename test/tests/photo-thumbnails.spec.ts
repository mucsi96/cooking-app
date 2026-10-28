import { test, expect } from '../fixtures';
import { PHOTO, uploadThumbnail } from '../photo';
import { GULYAS, insertRecipe, query } from '../utils';

test('offers camera and library photos, validates size, removes previews and retries rejected uploads', async ({ page }) => {
  const id = await insertRecipe(GULYAS);
  await page.goto(`/recept/${id}`);
  await page.getByRole('button', { name: 'Borítókép módosítása' }).click();
  const dialog = page.getByRole('dialog', { name: 'Borítókép', exact: true });
  const camera = dialog.getByLabel('Étel lefotózása');
  const gallery = dialog.getByLabel('Ételfotó kiválasztása');
  const upload = dialog.getByRole('button', { name: 'Borítóképek készítése fotóból' });
  await expect(camera).toHaveAttribute('capture', 'environment');
  await expect(gallery).toHaveAttribute('accept', 'image/*');
  await expect(upload).toBeDisabled();
  await camera.setInputFiles({ name: 'etel.bmp', mimeType: 'image/bmp', buffer: PHOTO });
  await expect(dialog.getByRole('img', { name: 'Kiválasztott ételfotó' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Fotó eltávolítása' }).click();
  await expect(upload).toBeDisabled();
  await expect(dialog.getByRole('img', { name: 'Kiválasztott ételfotó' })).toBeHidden();
  await gallery.setInputFiles({ name: 'nagy.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(15 * 1024 * 1024 + 1) });
  await expect(dialog.getByRole('alert')).toContainText('legfeljebb 15 MB');
  await expect(upload).toBeDisabled();
  await gallery.setInputFiles({ name: 'hibas.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('not an image') });
  await upload.click();
  await expect(dialog.getByRole('alert')).toContainText('nem támogatott vagy sérült');
  await expect(upload).toBeEnabled();
  await expect(dialog.getByText('hibas.jpg')).toBeVisible();
  await uploadThumbnail(dialog);
  await expect(dialog.getByRole('button', { name: /Kép kiválasztása/ })).toHaveCount(3, { timeout: 30000 });
  await expect(dialog.getByRole('img', { name: 'Kiválasztott ételfotó' })).toBeHidden();
  expect((await query('SELECT source_photo FROM cooking.image_generation_jobs WHERE recipe_id = $1', [id])).rows).toEqual([
    { source_photo: null }, { source_photo: null }, { source_photo: null },
  ]);
  const requests = await (await fetch(`${process.env.TEST_OPENAI_URL ?? 'http://localhost:3061'}/requests`)).json();
  expect(requests.filter((request: any) => request.operation === 'edit')).toHaveLength(3);
  expect(requests.some((request: any) => request.operation === 'image')).toBe(false);
});

test('requires an authenticated photo upload and rejects invalid input without queuing work', async ({ page, apiHeaders }) => {
  const id = await insertRecipe(GULYAS);
  await page.goto(`/recept/${id}`);
  const headers = { ...apiHeaders, Origin: new URL(page.url()).origin };
  const url = `/api/recipes/${id}/images`;
  const multipart = { image: { name: 'etel.bmp', mimeType: 'image/bmp', buffer: PHOTO } };
  expect((await page.request.post(url, { headers: { Origin: headers.Origin }, multipart })).status()).toBe(401);
  expect((await page.request.post(url, { headers: apiHeaders, multipart })).status()).toBe(403);
  expect((await page.request.post(url, { headers })).status()).toBe(400);
  expect((await page.request.post(url, { headers, multipart: { text: 'no photo' } })).status()).toBe(400);
  expect((await page.request.post(url, { headers, multipart: { image: { ...multipart.image, buffer: Buffer.alloc(0) } } })).status()).toBe(400);
  expect((await page.request.post(url, { headers, multipart: { image: { ...multipart.image, buffer: Buffer.from('invalid') } } })).status()).toBe(415);
  expect((await page.request.post(url, { headers, multipart: { image: { ...multipart.image, buffer: Buffer.alloc(15 * 1024 * 1024 + 1) } } })).status()).toBe(413);
  expect((await page.request.post('/api/recipes/00000000-0000-0000-0000-000000000001/images', { headers, multipart })).status()).toBe(404);
  expect((await query('SELECT id FROM cooking.image_generation_jobs')).rowCount).toBe(0);
});

test('shows failed thumbnail jobs, clears source bytes and permits a new photo upload', async ({ page }) => {
  const id = await insertRecipe(GULYAS);
  await query(`UPDATE cooking.model_settings SET value = jsonb_set(value, '{images}', '[{"id":"gpt-image-2.5-sunburst-medium","count":1}]') WHERE id = 1`);
  const mock = process.env.TEST_OPENAI_URL ?? 'http://localhost:3061';
  await page.request.post(`${mock}/image-edit-behavior`, { data: { fail: true } });
  await page.goto(`/recept/${id}`);
  await page.getByRole('button', { name: 'Borítókép módosítása' }).click();
  const dialog = page.getByRole('dialog', { name: 'Borítókép', exact: true });
  await uploadThumbnail(dialog);
  await expect(dialog.getByRole('status')).toHaveText('A kép elkészítése nem sikerült.', { timeout: 30000 });
  expect((await query('SELECT status, source_photo FROM cooking.image_generation_jobs WHERE recipe_id = $1', [id])).rows).toEqual([{ status: 'FAILED', source_photo: null }]);
  await page.request.post(`${mock}/image-edit-behavior`, { data: { fail: false } });
  await uploadThumbnail(dialog);
  const candidate = dialog.getByRole('button', { name: /Kép kiválasztása/ });
  await expect(candidate).toHaveCount(1, { timeout: 30000 });
  await candidate.click();
  await expect(candidate).toHaveAttribute('aria-pressed', 'true');
});

test('finishes legacy pending jobs and keeps their completed images selectable', async ({ page }) => {
  const id = await insertRecipe(GULYAS);
  await query(`INSERT INTO cooking.image_generation_jobs (id, recipe_id, status, created_at) VALUES (gen_random_uuid(), $1, 'PENDING', now())`, [id]);
  await page.goto(`/recept/${id}`);
  await page.getByRole('button', { name: 'Borítókép módosítása' }).click();
  const dialog = page.getByRole('dialog', { name: 'Borítókép', exact: true });
  const candidate = dialog.getByRole('button', { name: /Kép kiválasztása/ });
  await expect(candidate).toHaveCount(1, { timeout: 30000 });
  await candidate.click();
  await expect(candidate).toHaveAttribute('aria-pressed', 'true');
});
