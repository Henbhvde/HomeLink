import { expect, test, type Page } from '@playwright/test';

const disableMotion = (page: Page) => page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' });

async function useSession(page: Page, role: 'manager' | 'resident') {
  await page.addInitScript(({ selectedRole }) => localStorage.setItem('homelink-auth-session', JSON.stringify({
    token: 'visual-test-token',
    user: { id: `visual-${selectedRole}`, email: `${selectedRole}@homelink.mn`, fullName: 'Visual Test', role: selectedRole },
  })), { selectedRole: role });
}

test('login modal snapshot', async ({ page }) => {
  await page.goto('/login');
  await disableMotion(page);
  await expect(page.locator('.auth-modal-panel')).toHaveScreenshot('login-modal.png', { animations: 'disabled' });
});

test('manager dashboard snapshot', async ({ page }) => {
  await useSession(page, 'manager');
  await page.goto('/manager');
  await disableMotion(page);
  await expect(page).toHaveScreenshot('manager-dashboard.png', { fullPage: true, animations: 'disabled' });
});

test('resident portal snapshot', async ({ page }) => {
  await useSession(page, 'resident');
  await page.goto('/resident');
  await page.getByRole('button', { name: /A-1203/ }).click();
  await disableMotion(page);
  await expect(page).toHaveScreenshot('resident-portal.png', { fullPage: true, animations: 'disabled' });
});

test('maintenance snapshot', async ({ page }) => {
  await useSession(page, 'manager');
  await page.route('**/api/v1/maintenance-requests', async (route) => route.fulfill({ json: { success: true, message: 'ok', data: [{ id: '#245', title: 'Ус гоожиж байна', unit: 'A-1203', resident: 'Бат-Эрдэнэ', priority: 'Яаралтай', status: 'Ажиллаж байна', assignee: 'Д.Одгэрэл', date: 'Өнөөдөр, 10:24' }] } }));
  await page.route('**/api/v1/maintenance-announcements', async (route) => route.fulfill({ json: { success: true, message: 'ok', data: [] } }));
  await page.goto('/manager/maintenance');
  await disableMotion(page);
  await expect(page).toHaveScreenshot('maintenance.png', { fullPage: true, animations: 'disabled' });
});
