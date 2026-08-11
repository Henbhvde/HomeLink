import { expect, test, type Page } from '@playwright/test';

const password = 'HomeLink123!';

async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.locator('input[name="homelink-role-email"]').fill(email);
  await page.locator('input[name="homelink-role-password"]').fill(password);
  await page.getByRole('button', { name: 'Нэвтрэх', exact: true }).last().click();
}

test('login routes manager to dashboard', async ({ page }) => {
  await login(page, 'manager@homelink.mn');
  await expect(page).toHaveURL(/\/manager$/);
  await expect(page.getByRole('heading', { name: 'Хянах самбар' })).toBeVisible();
});

test('manager dashboard loads core metrics', async ({ page }) => {
  await login(page, 'manager@homelink.mn');
  await expect(page.getByText('Төлбөрийн урсгал')).toBeVisible();
  await expect(page.getByText('Засварын хүсэлт')).toBeVisible();
});

test('resident can start a payment', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, 'resident@homelink.mn');
  await page.getByRole('button', { name: /A-1203/ }).click();
  await page.getByRole('button', { name: 'Төлбөр төлөх' }).click();
  await expect(page.getByRole('heading', { name: '₮110,000 төлөх' })).toBeVisible();
  await page.getByRole('button', { name: 'Би төлсөн' }).click();
  await expect(page.getByText('Төлбөрийн баталгаажуулалтыг хүлээж байна.')).toBeVisible();
});

test('manager creates a maintenance request', async ({ page }) => {
  await login(page, 'manager@homelink.mn');
  await page.goto('/manager/maintenance');
  await page.getByRole('button', { name: 'Хүсэлт үүсгэх' }).first().click();
  await page.getByPlaceholder('Асуудлыг товч бичнэ үү').fill('E2E туршилтын хүсэлт');
  await page.getByPlaceholder('B орц · Лифт').fill('A орц · 1 давхар');
  await page.getByRole('button', { name: 'Хүсэлт илгээх' }).click();
  await expect(page.getByText('E2E туршилтын хүсэлт')).toBeVisible();
});
