import { test, expect } from '../fixtures';

const ENGLISH_GOULASH_TEXT = `Traditional Hungarian Goulash Soup

Serves 4

Ingredients:
- 500 g beef shank
- 2 onions
- 2 tablespoons sweet paprika
- 400 g potatoes
- 2 carrots
- salt to taste

Instructions:
Fry the diced onions, add the cubed beef and brown it. Sprinkle with paprika,
pour water over it and simmer for an hour. Add the diced potatoes and carrots
and cook until tender. Season with salt and serve hot.`;

const RECIPE_PHOTO = Buffer.concat([
  Buffer.from([
    0x42, 0x4d, 70, 0, 0, 0, 0, 0, 0, 0, 54, 0, 0, 0,
    40, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 1, 0, 24, 0,
    0, 0, 0, 0, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
  ]),
  Buffer.from([0, 0, 0, 255, 255, 255, 0, 0, 255, 255, 255, 0, 0, 0, 0, 0]),
]);

test('imports a pasted English recipe as a structured Hungarian recipe', async ({
  page,
}) => {
  await page.goto('/importalas');

  await page.getByLabel('Recept szövege').fill(ENGLISH_GOULASH_TEXT);
  await page.getByRole('button', { name: 'Importálás' }).click();

  // The AI extracted, translated and persisted recipe is shown in Hungarian
  await expect(page.getByRole('heading', { name: 'Gulyásleves' })).toBeVisible();
  await expect(page.getByText('Leves', { exact: true })).toBeVisible();
  await expect(page.getByText('marhalábszár')).toBeVisible();
  await expect(page.getByText('500 g')).toBeVisible();
  await expect(
    page.getByText('Pirítsd meg a felkockázott vöröshagymát', { exact: false })
  ).toBeVisible();
});

test('recognizes and imports a recipe from an existing photo', async ({ page }) => {
  await page.goto('/importalas');

  const photoInput = page.getByLabel('Receptfotó kiválasztása');
  await expect(photoInput).toHaveAttribute('accept', 'image/*');
  await photoInput.setInputFiles({
    name: 'recept.jpg',
    mimeType: 'image/jpeg',
    buffer: RECIPE_PHOTO,
  });

  await expect(page.getByRole('img', { name: 'Kiválasztott receptfotó' })).toBeVisible();
  await page.getByRole('button', { name: 'Recept felismerése' }).click();

  await expect(page.getByRole('heading', { name: 'Gulyásleves' })).toBeVisible();
  await expect(page.getByText('marhalábszár')).toBeVisible();
});

test('offers the rear camera and lets the user remove a selected photo', async ({ page }) => {
  await page.goto('/importalas');

  const cameraInput = page.getByLabel('Recept lefotózása');
  await expect(cameraInput).toHaveAttribute('capture', 'environment');
  await cameraInput.setInputFiles({
    name: 'kamera.jpg',
    mimeType: 'image/jpeg',
    buffer: RECIPE_PHOTO,
  });
  await page.getByRole('button', { name: 'Fotó eltávolítása' }).click();

  await expect(page.getByRole('img', { name: 'Kiválasztott receptfotó' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Recept felismerése' })).toBeHidden();
});

test('generates several thumbnail candidates and lets the user pick a favorite', async ({
  page,
}) => {
  await page.goto('/importalas');

  await page.getByLabel('Recept szövege').fill(ENGLISH_GOULASH_TEXT);
  await page.getByRole('button', { name: 'Importálás' }).click();
  await expect(page.getByRole('heading', { name: 'Gulyásleves' })).toBeVisible();

  // Several candidates are generated right away
  const candidates = page.getByRole('button', { name: /Kép kiválasztása/ });
  await expect(candidates).toHaveCount(3, { timeout: 30000 });

  // Picking a favorite sets it as the recipe thumbnail
  await candidates.first().click();
  await expect(candidates.first()).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('img', { name: 'Gulyásleves' })).toBeVisible();

  // The chosen thumbnail shows up on the category listing
  await page.getByRole('link', { name: 'Receptek' }).click();
  await expect(page.getByRole('link', { name: 'Gulyásleves' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Gulyásleves' })).toBeVisible();
});
