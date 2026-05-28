---
id: 0013
title: Generated MFE Test Templates
status: Implemented
date: 2025-12-13
deciders: [sean]
enforcement: code
supersedes: []
superseded-by: []
tags: [testing, codegen, scaffolding, tdd]
summary: Every scaffolded MFE project includes working test files that teams can run immediately and extend, with an 80% coverage threshold configured from day one.
rationale-summary: Providing runnable tests from scaffolding reduces the testing setup overhead that commonly delays teams and establishes a TDD culture baseline through immediate coverage gates.
long-form: true
---

# ADR-013: Generated MFE Test Templates

## Context

Teams scaffolding new MFEs typically spend significant time setting up test infrastructure (mock configuration, provider wrappers, coverage thresholds). This setup overhead delays testing and often means the first few features ship without tests. Module Federation adds additional complexity (shared module mocking, federation contract tests).

## Decision

Generate working test files as part of MFE scaffolding. Every shell, remote, API, and BFF project includes starter tests that teams can run immediately with `npm test` and extend.

**Generated test structure by MFE type:**

| MFE Type | Generated Test Files | Key Coverage |
|---|---|---|
| Shell | `App.test.tsx`, `routing.test.tsx` | Remote loading, error boundaries, navigation |
| Remote | `App.test.tsx`, `federation.test.tsx` | Component render, standalone mode, contracts |
| API | `<entity>.controller.test.ts` | CRUD operations, validation, error handling |
| BFF | `graphql.test.ts` | Introspection, JWT forwarding, upstream errors |

**Generated project structure:**

```
my-mfe/
├── src/
│   ├── __tests__/
│   │   ├── App.test.tsx
│   │   ├── routing.test.tsx       # shells only
│   │   └── federation.test.tsx    # remotes only
│   ├── setupTests.ts              # Jest/RTL setup, MF mocks
│   └── testUtils.ts               # renderWithProviders, factories
├── jest.config.js                 # 80% threshold, proper env
└── package.json                   # test scripts configured
```

**Example generated shell test:**

```typescript
// src/__tests__/App.test.tsx
jest.mock('../remotes', () => ({
  loadRemote: jest.fn().mockResolvedValue({ default: () => <div>Mock Remote</div> })
}));

describe('Shell App', () => {
  it('renders without crashing', () => {
    render(<App />);
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('handles remote loading failure gracefully', async () => {
    const { loadRemote } = require('../remotes');
    loadRemote.mockRejectedValueOnce(new Error('Network error'));
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });
});
```

**Coverage threshold (generated jest.config.js):**

```javascript
module.exports = {
  testEnvironment: 'jsdom',
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },
};
```

## Consequences

**Positive:**
- `npm test` works on day one
- Tests demonstrate patterns teams should follow (mocking, providers, federation contracts)
- 80% coverage threshold from day one encourages TDD culture
- Module Federation mocks prevent integration surprises early

**Negative:**
- Generated tests must be kept current with scaffold template evolution
- Teams may treat generated tests as sufficient rather than extending them

## References

- REQ-SCAFFOLD-001 through REQ-SCAFFOLD-005
- ADR-014: Incremental TypeScript Migration
