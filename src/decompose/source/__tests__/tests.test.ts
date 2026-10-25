import * as ts from 'typescript';
import { describeTestFile, mergeJestResults } from '../tests';

const SOURCES = new Set(['src/components/BerthTile.tsx', 'src/api/client.ts', 'src/store/AppContext.tsx']);

describe('describeTestFile', () => {
  it('records what a unit test touches and how it tests', () => {
    const t = describeTestFile(
      ts,
      'src/components/__tests__/BerthTile.test.tsx',
      `import { render } from '@testing-library/react';
       import BerthTile from '../BerthTile';
       jest.mock('../../store/AppContext');
       jest.mock('axios');
       it('renders', () => { expect(render(<BerthTile />).container).toMatchSnapshot(); });
       it.skip('shows the vessel', () => {});
       xit('old behaviour', () => {});
       it.todo('handles errors');`,
      SOURCES
    );
    expect(t).toEqual({
      file: 'src/components/__tests__/BerthTile.test.tsx',
      kind: 'unit',
      touches: ['src/components/BerthTile.tsx'],
      mocks: ['axios', 'src/store/AppContext.tsx'],
      tests: 4,
      skipped: 2,
      todo: 1,
      snapshots: 1,
      structuralSelectors: 0,
      fixedWaits: 0,
    });
  });

  it('marks Playwright specs as e2e and counts brittle selectors and fixed waits', () => {
    const t = describeTestFile(
      ts,
      'e2e/smoke.spec.ts',
      `import { expect, test } from '@playwright/test';
       test('board', async ({ page }) => {
         await page.click('nav > div > a:nth-child(1)');
         await page.waitForTimeout(3000);
         await expect(page.locator('main table tbody tr:nth-child(1) td:nth-child(3)')).toHaveText('VR-88213');
       });`,
      SOURCES
    );
    expect(t).toMatchObject({ kind: 'e2e', tests: 1, structuralSelectors: 2, fixedWaits: 1 });
  });
});

describe('mergeJestResults', () => {
  it('attaches per-test outcomes to their files and totals them', () => {
    const files = [describeTestFile(ts, 'src/a.test.ts', `it('x', () => {}); it('y', () => {});`, SOURCES)];
    const totals = mergeJestResults(
      files,
      {
        testResults: [
          {
            name: '/work/app/src/a.test.ts',
            assertionResults: [
              { fullName: 'x', status: 'passed' },
              { fullName: 'y', status: 'failed' },
              { fullName: 'z', status: 'pending' },
            ],
          },
        ],
      },
      '/work/app'
    );
    expect(totals).toEqual({ ran: true, reason: null, passed: 1, failed: 1, skipped: 1 });
    expect(files[0].results).toEqual([
      { name: 'x', status: 'passed' },
      { name: 'y', status: 'failed' },
      { name: 'z', status: 'skipped' },
    ]);
    expect(files[0].excluded).toBe(false);
  });

  it('marks a unit test the configured suite never ran as excluded', () => {
    const files = [
      describeTestFile(ts, 'src/a.test.ts', `it('x', () => {});`, SOURCES),
      describeTestFile(ts, 'src/ignored.test.ts', `it('y', () => {});`, SOURCES),
      describeTestFile(ts, 'e2e/smoke.spec.ts', `import { test } from '@playwright/test'; test('z', async () => {});`, SOURCES),
    ];
    mergeJestResults(files, { testResults: [{ name: '/w/src/a.test.ts', assertionResults: [{ fullName: 'x', status: 'passed' }] }] }, '/w');
    expect(files.map((f) => [f.file, f.excluded])).toEqual([
      ['src/a.test.ts', false],
      ['src/ignored.test.ts', true],
      // Jest does not run e2e specs; that is not an exclusion.
      ['e2e/smoke.spec.ts', undefined],
    ]);
  });
});

describe('describeTestFile — support files', () => {
  it('treats setupTests as support, not a test', () => {
    expect(describeTestFile(ts, 'src/setupTests.ts', `import '@testing-library/jest-dom';`, SOURCES).kind).toBe('support');
  });
});
