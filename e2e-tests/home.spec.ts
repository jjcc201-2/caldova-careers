import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Derive the expected posting count from the job content collection so this
// assertion stays correct as roles are added or removed.
const jobsDir = fileURLToPath(new URL('../src/content/jobs', import.meta.url));
const expectedRoleCount = readdirSync(jobsDir).filter((f) => f.endsWith('.md')).length;

test.describe('Open roles listing', () => {
    test('shows the roles grid with all postings', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByRole('heading', { name: 'Open roles' })).toBeVisible();

        const grid = page.getByTestId('roles-grid');
        await expect(grid).toBeVisible();
        await expect(page.getByTestId('role-card')).toHaveCount(expectedRoleCount);
    });

    /**
     * Exercises visible results and control state against prerendered real postings,
     * complementing the pure helper tests with browser and accessibility coverage.
     */
    test.describe('Role filters', () => {
      test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await expect(page.getByLabel('Department', { exact: true })).toBeVisible();
      });

      test('derives unique, sorted options from the complete listing', async ({ page }) => {
        const departments = await page.getByTestId('role-department').allTextContents();
        const locations = await page.getByTestId('role-location').allTextContents();
        const expectedDepartments = [...new Set(departments.map((value) => value.trim()))].sort();
        const expectedLocations = [...new Set(locations.map((value) => value.trim()))].sort();

        await expect(page.getByLabel('Department', { exact: true }).locator('option'))
          .toHaveText(['All departments', ...expectedDepartments]);
        await expect(page.getByLabel('Location', { exact: true }).locator('option'))
          .toHaveText(['All locations', ...expectedLocations]);
        await expect(page.getByTestId('roles-count')).toHaveText(`${expectedRoleCount} roles shown`);
      });

      test('filters by department without changing location or the URL', async ({ page }) => {
        await page.getByLabel('Department', { exact: true }).selectOption('Finance');
        const cards = page.locator('[data-testid="role-card"]:visible');

        await expect(cards.getByTestId('role-title')).toHaveText([
          'Financial Analyst',
          'Financial Reconciliation Specialist',
        ]);
        await expect(cards.getByTestId('role-department')).toHaveText(['Finance', 'Finance']);
        await expect(page.getByLabel('Location', { exact: true })).toHaveValue('');
        await expect(page.getByTestId('roles-count')).toHaveText('2 roles shown');
        await expect(page.getByTestId('filtered-empty-state')).toBeHidden();
        await expect(page).toHaveURL(/\/$/);
      });

      test('filters by an exact location independently, including remote roles', async ({ page }) => {
        await page.getByLabel('Location', { exact: true }).selectOption('Remote (US & Canada)');
        const cards = page.locator('[data-testid="role-card"]:visible');

        await expect(cards.getByTestId('role-title')).toHaveText([
          'Data Platform Engineer',
          'Senior Frontend Engineer',
        ]);
        await expect(cards.getByTestId('role-location')).toHaveText([
          'Remote (US & Canada)',
          'Remote (US & Canada)',
        ]);
        await expect(page.getByLabel('Department', { exact: true })).toHaveValue('');
        await expect(page.getByTestId('roles-count')).toHaveText('2 roles shown');
      });

      test('combines filters with AND and lets either selection be cleared', async ({ page }) => {
        const department = page.getByLabel('Department', { exact: true });
        const location = page.getByLabel('Location', { exact: true });
        const titles = page.locator('[data-testid="role-card"]:visible').getByTestId('role-title');

        await test.step('match both filters', async () => {
          await department.selectOption('Finance');
          await location.focus();
          await location.selectOption('Woodinville, WA, USA');
          await expect(titles).toHaveText(['Financial Analyst']);
          await expect(page.getByTestId('roles-count')).toHaveText('1 role shown');
          await expect(location).toBeFocused();
        });

        await test.step('clear department while retaining location', async () => {
          await department.selectOption('');
          await expect(location).toHaveValue('Woodinville, WA, USA');
          await expect(titles).toHaveText([
            'Financial Analyst',
            'Procurement Analyst',
            'Regulatory Compliance Specialist',
          ]);
        });

        await test.step('clear location while retaining department', async () => {
          await department.selectOption('Finance');
          await location.selectOption('');
          await expect(department).toHaveValue('Finance');
          await expect(titles).toHaveText(['Financial Analyst', 'Financial Reconciliation Specialist']);
        });
      });

      test('shows clear empty results and leaves all options available', async ({ page }) => {
        const department = page.getByLabel('Department', { exact: true });
        const location = page.getByLabel('Location', { exact: true });
        const departmentOptions = await department.locator('option').allTextContents();
        const locationOptions = await location.locator('option').allTextContents();

        await department.selectOption('Finance');
        await location.selectOption('Remote (US & Canada)');

        await expect(page.locator('[data-testid="role-card"]:visible')).toHaveCount(0);
        await expect(page.getByRole('link', { name: /View role/ })).toHaveCount(0);
        await expect(page.getByTestId('roles-grid')).toBeHidden();
        await expect(page.getByTestId('filtered-empty-state')).toBeVisible();
        await expect(page.getByTestId('filtered-empty-state')).toContainText('No roles match these filters.');
        await expect(page.getByTestId('roles-count')).toHaveText('0 roles shown');
        await expect(department.locator('option')).toHaveText(departmentOptions);
        await expect(location.locator('option')).toHaveText(locationOptions);

        await location.selectOption('Helsinki, Finland');
        await expect(page.locator('[data-testid="role-card"]:visible').getByTestId('role-title'))
          .toHaveText(['Financial Reconciliation Specialist']);
        await expect(page.getByTestId('filtered-empty-state')).toBeHidden();
      });

      for (const location of ['Woodinville, WA, USA', 'Remote (US & Canada)']) {
        test(`resets both filters from Finance and ${location}`, async ({ page }) => {
          const originalTitles = await page.getByTestId('role-title').allTextContents();
          await page.getByLabel('Department', { exact: true }).selectOption('Finance');
          await page.getByLabel('Location', { exact: true }).selectOption(location);
          await page.getByRole('button', { name: 'Reset filters' }).click();

          await expect(page.getByLabel('Department', { exact: true })).toHaveValue('');
          await expect(page.getByLabel('Location', { exact: true })).toHaveValue('');
          await expect(page.locator('[data-testid="role-card"]:visible')).toHaveCount(expectedRoleCount);
          await expect(page.getByTestId('role-title')).toHaveText(originalTitles);
          await expect(page.getByTestId('roles-count')).toHaveText(`${expectedRoleCount} roles shown`);
          await expect(page.getByTestId('filtered-empty-state')).toBeHidden();
          await expect(page.getByRole('button', { name: 'Reset filters' })).toBeFocused();
        });
      }

      test('reloads with both filters cleared', async ({ page }) => {
        await page.getByLabel('Department', { exact: true }).selectOption('Finance');
        await page.getByLabel('Location', { exact: true }).selectOption('Helsinki, Finland');
        await page.reload();

        await expect(page.getByLabel('Department', { exact: true })).toHaveValue('');
        await expect(page.getByLabel('Location', { exact: true })).toHaveValue('');
        await expect(page.locator('[data-testid="role-card"]:visible')).toHaveCount(expectedRoleCount);
      });

      test('supports filtering and reset using the keyboard', async ({ page }) => {
        const department = page.getByLabel('Department', { exact: true });
        await department.focus();
        await department.press('Home');
        await department.press('ArrowDown');

        await expect(department).toHaveValue('Compliance');
        await expect(page.locator('[data-testid="role-card"]:visible').getByTestId('role-title'))
          .toHaveText(['Regulatory Compliance Specialist']);
        await expect(department).toBeFocused();
        await department.press('Tab');
        await expect(page.getByLabel('Location', { exact: true })).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(page.getByRole('button', { name: 'Reset filters' })).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(page.locator('[data-testid="role-card"]:visible')).toHaveCount(expectedRoleCount);
      });

      test('has accessible filtered and empty result states', async ({ page }) => {
        await page.getByLabel('Department', { exact: true }).selectOption('Finance');
        for (const location of ['Woodinville, WA, USA', 'Remote (US & Canada)']) {
          await page.getByLabel('Location', { exact: true }).selectOption(location);
          const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
          expect(results.violations).toEqual([]);
        }
      });
    });

    /** Verifies progressive enhancement preserves role browsing without a client script. */
    test.describe('Roles without JavaScript', () => {
      test.use({ javaScriptEnabled: false });

      test('keeps all roles and detail links usable without inert filter controls', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByTestId('department-filter')).toBeHidden();
        await expect(page.getByTestId('location-filter')).toBeHidden();
        await expect(page.getByTestId('reset-filters')).toBeHidden();
        await expect(page.locator('[data-testid="role-card"]:visible')).toHaveCount(expectedRoleCount);
        await page.getByTestId('role-card').first().click();
        await expect(page.getByTestId('role-detail-title')).toBeVisible();
      });
    });

    test('links through to a role detail page', async ({ page }) => {
        await page.goto('/');
        const firstCard = page.getByTestId('role-card').first();
        const title = await firstCard.getByTestId('role-title').textContent();
        await firstCard.click();
        await expect(page.getByTestId('role-detail-title')).toHaveText(title!.trim());
        await expect(page.getByTestId('apply-form')).toBeVisible();
    });

    for (const { title, location } of [
        { title: 'Senior Frontend Engineer', location: 'Remote (US & Canada)' },
        { title: 'Financial Analyst', location: 'Woodinville, WA, USA' },
    ]) {
        test(`shows ${title} location on its card and details`, async ({ page }) => {
            await page.goto('/');
            const card = page.getByTestId('role-card').filter({
                has: page.getByRole('heading', { name: title, exact: true }),
            });

            await expect(card).toBeVisible();
            await expect(card.getByTestId('role-location')).toBeVisible();
            await expect(card.getByTestId('role-location')).toHaveText(location);
            await card.click();
            await expect(page.getByText(location, { exact: true })).toBeVisible();
        });
    }

    test('has no automatically detectable accessibility violations', async ({ page }) => {
        await page.goto('/');
        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa'])
            .analyze();
        expect(results.violations).toEqual([]);
    });
});
