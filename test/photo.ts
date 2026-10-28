import { Locator } from '@playwright/test';

// A real 2x2 BMP: the API must decode it and send normalized JPEG to the provider.
export const PHOTO = Buffer.concat([
  Buffer.from([
    0x42, 0x4d, 70, 0, 0, 0, 0, 0, 0, 0, 54, 0, 0, 0,
    40, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 1, 0, 24, 0,
    0, 0, 0, 0, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
  ]),
  Buffer.from([0, 0, 0, 255, 255, 255, 0, 0, 255, 255, 255, 0, 0, 0, 0, 0]),
]);

export async function uploadThumbnail(dialog: Locator): Promise<void> {
  await dialog.getByLabel('Ételfotó kiválasztása').setInputFiles({ name: 'etel.bmp', mimeType: 'image/bmp', buffer: PHOTO });
  await dialog.getByRole('button', { name: 'Borítóképek készítése fotóból' }).click();
}
