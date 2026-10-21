import { expect, test } from '@playwright/test';

test.describe('iPhone Duo viewer', () => {
  test('shows the Knolling button and the viewer canvas', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('button', { name: 'Knolling' })).toBeVisible();
    await expect(
      page.getByRole('img', { name: '3D view of the closed iPhone Duo' }),
    ).toBeVisible();
  });
});
