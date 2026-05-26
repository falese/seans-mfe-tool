import { test, expect, Page } from '@playwright/test';

/**
 * Navigate to the game browser (shared setup for game-launching tests).
 */
async function goToGameBrowser(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: "Let's Play! 🎮" }).click();
  await expect(page.getByText('Flappy Bird')).toBeVisible();
}

// ─── Suite: Shell navigation ───────────────────────────────────────────────────

test.describe('Shell navigation', () => {
  test('splash screen', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'ABC Kids' })).toBeVisible();
    await expect(page.getByRole('button', { name: "Let's Play! 🎮" })).toBeVisible();
  });

  test('enter game browser', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: "Let's Play! 🎮" }).click();
    await expect(page.getByText('Flappy Bird')).toBeVisible();
    await expect(page.getByText('Ice Hockey')).toBeVisible();
    await expect(page.getByText('Multiplication Quiz')).toBeVisible();
  });

  test('search filters games', async ({ page }) => {
    await goToGameBrowser(page);
    await page.getByRole('textbox').fill('hockey');
    await expect(page.getByText('Ice Hockey')).toBeVisible();
    await expect(page.getByText('Flappy Bird')).not.toBeVisible();
  });

  test('grade filter', async ({ page }) => {
    await goToGameBrowser(page);
    await page.getByRole('button', { name: '3' }).click();
    // All three games are in the age 4–12 range, at least one should be visible
    const cards = page.locator('.MuiCard-root');
    await expect(cards.first()).toBeVisible();
  });
});

// ─── Suite: Flappy Bird MFE ────────────────────────────────────────────────────

test.describe('Flappy Bird MFE', () => {
  test.beforeEach(async ({ page }) => {
    await goToGameBrowser(page);
  });

  test('loads and shows canvas', async ({ page }) => {
    await page.getByText('Flappy Bird').click();
    await expect(page.locator('[role="progressbar"]')).toBeHidden({ timeout: 15_000 });
    await expect(page.locator('#mfe-game-flappy canvas')).toBeVisible();
    await expect(page.locator('#mfe-game-flappy').getByText(/error/i)).not.toBeVisible();
  });

  test('game responds to spacebar', async ({ page }) => {
    await page.getByText('Flappy Bird').click();
    await expect(page.locator('[role="progressbar"]')).toBeHidden({ timeout: 15_000 });
    await expect(page.locator('#mfe-game-flappy canvas')).toBeVisible();
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);
    await expect(page.locator('#mfe-game-flappy canvas')).toBeVisible();
  });

  test('close returns to browser', async ({ page }) => {
    await page.getByText('Flappy Bird').click();
    await expect(page.locator('[role="progressbar"]')).toBeHidden({ timeout: 15_000 });
    await page.locator('button:has([data-testid="CloseIcon"])').click();
    await expect(page.getByText('Flappy Bird')).toBeVisible();
    await expect(page.getByText('Ice Hockey')).toBeVisible();
  });
});

// ─── Suite: Ice Hockey MFE ─────────────────────────────────────────────────────

test.describe('Ice Hockey MFE', () => {
  test.beforeEach(async ({ page }) => {
    await goToGameBrowser(page);
  });

  test('loads and shows canvas', async ({ page }) => {
    await page.getByText('Ice Hockey').click();
    await expect(page.locator('[role="progressbar"]')).toBeHidden({ timeout: 15_000 });
    await expect(page.locator('#mfe-game-hockey canvas')).toBeVisible();
  });

  test('close returns to browser', async ({ page }) => {
    await page.getByText('Ice Hockey').click();
    await expect(page.locator('[role="progressbar"]')).toBeHidden({ timeout: 15_000 });
    await page.locator('button:has([data-testid="CloseIcon"])').click();
    await expect(page.getByText('Flappy Bird')).toBeVisible();
    await expect(page.getByText('Ice Hockey')).toBeVisible();
  });
});

// ─── Suite: Multiplication Quiz MFE (Angular) ──────────────────────────────────

test.describe('Multiplication Quiz MFE', () => {
  test.beforeEach(async ({ page }) => {
    await goToGameBrowser(page);
  });

  test('loads and shows a question', async ({ page }) => {
    await page.getByText('Multiplication Quiz').click();
    await expect(page.locator('[role="progressbar"]')).toBeHidden({ timeout: 20_000 });
    await expect(
      page.locator('#mfe-game-multiplication-quiz').getByText(/Q 1 \/ 8/)
    ).toBeVisible();
    await expect(
      page.locator('#mfe-game-multiplication-quiz').getByText(/Score:/)
    ).toBeVisible();
  });

  test('answer button is clickable', async ({ page }) => {
    await page.getByText('Multiplication Quiz').click();
    await expect(page.locator('[role="progressbar"]')).toBeHidden({ timeout: 20_000 });
    const answerButtons = page.locator(
      '#mfe-game-multiplication-quiz button:not(.next-btn):not(.restart-btn)'
    );
    await expect(answerButtons.first()).toBeEnabled();
    await answerButtons.first().click();
    const feedbackButton = page.locator(
      '#mfe-game-multiplication-quiz button.correct, #mfe-game-multiplication-quiz button.wrong'
    );
    await expect(feedbackButton.first()).toBeVisible();
  });

  test('next question advances', async ({ page }) => {
    await page.getByText('Multiplication Quiz').click();
    await expect(page.locator('[role="progressbar"]')).toBeHidden({ timeout: 20_000 });
    const answerButtons = page.locator(
      '#mfe-game-multiplication-quiz button:not(.next-btn):not(.restart-btn)'
    );
    await answerButtons.first().click();
    await page.locator('#mfe-game-multiplication-quiz').getByText('Next →').click();
    await expect(
      page.locator('#mfe-game-multiplication-quiz').getByText(/Q 2 \/ 8/)
    ).toBeVisible();
  });

  test('close returns to browser', async ({ page }) => {
    await page.getByText('Multiplication Quiz').click();
    await expect(page.locator('[role="progressbar"]')).toBeHidden({ timeout: 20_000 });
    await page.locator('button:has([data-testid="CloseIcon"])').click();
    await expect(page.getByText('Flappy Bird')).toBeVisible();
    await expect(page.getByText('Multiplication Quiz')).toBeVisible();
  });
});

// ─── Suite: Error boundary (regression) ────────────────────────────────────────

test.describe('Error boundary', () => {
  test('no error fallback visible on normal load', async ({ page }) => {
    await goToGameBrowser(page);

    // Flappy Bird
    await page.getByText('Flappy Bird').click();
    await expect(page.locator('[role="progressbar"]')).toBeHidden({ timeout: 15_000 });
    await expect(page.locator('[data-testid="mfe-error-fallback"]')).not.toBeVisible();
    await page.locator('button:has([data-testid="CloseIcon"])').click();

    // Ice Hockey
    await page.getByText('Ice Hockey').click();
    await expect(page.locator('[role="progressbar"]')).toBeHidden({ timeout: 15_000 });
    await expect(page.locator('[data-testid="mfe-error-fallback"]')).not.toBeVisible();
    await page.locator('button:has([data-testid="CloseIcon"])').click();

    // Multiplication Quiz
    await page.getByText('Multiplication Quiz').click();
    await expect(page.locator('[role="progressbar"]')).toBeHidden({ timeout: 20_000 });
    await expect(page.locator('[data-testid="mfe-error-fallback"]')).not.toBeVisible();
  });
});
