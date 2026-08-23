import { test, expect } from '../fixtures';

test('displays app title in browser tab', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Hello');
});

test('displays app title in header', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Cooking App' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Cooking App' })).toHaveAttribute('href', '/');
});

test('shows user initials in header', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'TU' })).toBeVisible();
});

test('shows user name in popup', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'TU' }).click();
  await expect(page.getByText('Test User')).toBeVisible();
});

test('displays greeting name from database', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome, World' })).toBeVisible();
});

test('displays greeting message from database', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Welcome to the cooking app!')).toBeVisible();
});

test('displays AI-generated greeting', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Hello World!')).toBeVisible();
});
