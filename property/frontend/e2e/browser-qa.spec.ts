import { expect, test } from '@playwright/test';

test('public pages render without browser errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#root')).toBeVisible();
  await page.goto('/pricing');
  await expect(page.locator('main')).toBeVisible();
  expect(errors).toEqual([]);
});

test('login and keyboard shortcut are usable', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('.auth-modal-panel')).toBeVisible();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K');
  await expect(page.getByRole('dialog', { name: 'Хурдан хайлт' })).toBeVisible();
});

test('mobile layout has no horizontal overflow', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile-only assertion');
  await page.goto('/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});
