# MFE Scaffolding Requirements

**Document Status:** Active  
**Created:** 2025-11-27  
**Parent Feature:** MFE CLI Tool  
**Related Docs:**

- [Architecture Decisions](./architecture-decisions.md) - ADR-047
- [Orchestration Requirements](./orchestration-requirements.md)
- [GraphQL BFF Requirements](./graphql-bff-requirements.md)

---

## Purpose

This document captures requirements for the scaffolding (code generation) capabilities of the MFE CLI tool. The goal is to provide teams with production-ready starting points that include testing infrastructure, configuration, and best practices from day one.

---

## Core Principle

**Generated projects should be immediately runnable AND testable.**

Teams shouldn't need to configure Jest, set up mocking patterns, or figure out how to test Module Federation. The CLI provides all of this out of the box.

---

## Requirements

### REQ-SCAFFOLD-001: Generated Test Files for All MFE Types

**Must:**

- Every scaffolded MFE (shell, remote, API, BFF) includes working test files
- Tests are not stubs - they contain real assertions that pass
- Tests demonstrate patterns for the specific MFE type
- `npm test` works immediately after scaffolding

**Generated Test Coverage by Type:**

| MFE Type   | Test Files Generated                  | Purpose                                        |
| ---------- | ------------------------------------- | ---------------------------------------------- |
| **Shell**  | `App.test.tsx`, `routing.test.tsx`    | Component mounting, remote loading, navigation |
| **Remote** | `App.test.tsx`, `federation.test.tsx` | Component render, standalone mode, contracts   |
| **API**    | `<entity>.controller.test.ts`         | CRUD operations, validation, error handling    |
| **BFF**    | `graphql.test.ts`                     | Introspection, JWT forwarding, upstream errors |

**Reference:** ADR-047

---

### REQ-SCAFFOLD-002: Module Federation Mock Configuration

**Must:**

- Shell projects include mocks for remote loading
- Remote projects include federation contract tests
- Mock patterns are reusable for team-written tests
- Singleton shared module validation included

**Shell Mock Pattern:**

```typescript
// src/setupTests.ts - Generated
import '@testing-library/jest-dom';

// Mock Module Federation runtime
jest.mock('@module-federation/runtime', () => ({
  loadRemote: jest.fn(),
  init: jest.fn()
}));

// Mock remote modules
jest.mock('../remotes', () => ({
  loadRemote: jest.fn().mockResolvedValue({
    default: () => <div data-testid="mock-remote">Mock Remote</div>
  })
}));
```

**Remote Contract Test Pattern:**

```typescript
// src/__tests__/federation.test.tsx - Generated
describe('Federation Contract', () => {
  it('exports App component as default', async () => {
    const module = await import('../App');
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe('function');
  });

  it('component renders without provider dependencies', () => {
    // Remote must work standalone for development
    const App = require('../App').default;
    const { container } = render(<App standalone />);
    expect(container).not.toBeEmptyDOMElement();
  });

  it('does not bundle React (uses shared singleton)', () => {
    // Validate Module Federation sharing works
    const webpackModules = (window as any).__webpack_modules__ || {};
    const reactModules = Object.keys(webpackModules)
      .filter(k => k.includes('node_modules/react/'));
    // Should be 0 or 1 (shared, not bundled)
    expect(reactModules.length).toBeLessThanOrEqual(1);
  });
});
```

---

### REQ-SCAFFOLD-003: Test Utility Helpers

**Must:**

- Generate `testUtils.ts` with common helpers
- Include `renderWithProviders()` for React projects
- Include mock factories for common patterns
- Helpers are typed (TypeScript) and documented

**Generated Test Utilities:**

```typescript
// src/testUtils.ts - Generated for React projects
import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from './theme';

/**
 * Wrapper with all application providers.
 * Use this for integration tests that need routing, theming, etc.
 */
const AllTheProviders = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <ThemeProvider theme={theme}>
      {children}
    </ThemeProvider>
  </BrowserRouter>
);

/**
 * Render with all providers configured.
 * @example
 * const { getByText } = renderWithProviders(<MyComponent />);
 */
export const renderWithProviders = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

/**
 * Create a mock remote component for testing shell apps.
 * @example
 * jest.mock('../remotes', () => ({ loadRemote: () => createMockRemote('dashboard') }));
 */
export const createMockRemote = (name: string) => ({
  default: () => <div data-testid={`mock-${name}`}>Mock {name}</div>
});

/**
 * Create a mock API response for fetch testing.
 * @example
 * global.fetch = jest.fn().mockResolvedValue(createMockResponse({ users: [] }));
 */
export const createMockResponse = <T>(data: T, status = 200) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => data,
  text: async () => JSON.stringify(data)
});
```

---

### REQ-SCAFFOLD-004: Coverage Threshold Configuration

**Must:**

- Generate `jest.config.js` with 80% coverage thresholds
- Configure appropriate `testEnvironment` per MFE type
- Include proper module mappers for path aliases
- Exclude generated/boilerplate files from coverage

**Generated Jest Configuration:**

```javascript
// jest.config.js - Generated
module.exports = {
  // 'jsdom' for shell/remote, 'node' for API/BFF
  testEnvironment: '<%= testEnvironment %>',

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],

  // Module resolution
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/index.tsx',
    '!src/reportWebVitals.ts',
  ],

  // 80% threshold encourages TDD from day one
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },

  // Transforms
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
};
```

**Test Environment by Type:**

| MFE Type   | testEnvironment | Reason                        |
| ---------- | --------------- | ----------------------------- |
| **Shell**  | `jsdom`         | React components, DOM testing |
| **Remote** | `jsdom`         | React components, DOM testing |
| **API**    | `node`          | Express/Fastify, no DOM       |
| **BFF**    | `node`          | GraphQL server, no DOM        |

---

### REQ-SCAFFOLD-005: API Test Patterns

**Must:**

- Generate controller tests using supertest
- Include database mock patterns
- Cover CRUD happy paths and error cases
- Demonstrate validation testing

**Generated Controller Test:**

```typescript
// src/__tests__/controllers/<%= name %>.controller.test.ts
import request from 'supertest';
import app from '../../app';
import { db } from '../../db';

// Mock database layer
jest.mock('../../db');

describe('<%= Name %> Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /<%= pluralName %>', () => {
    it('returns all items', async () => {
      (db.findAll as jest.Mock).mockResolvedValue([{ id: '1', name: 'Test Item' }]);

      const response = await request(app).get('/<%= pluralName %>');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe('Test Item');
    });

    it('handles database errors gracefully', async () => {
      (db.findAll as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app).get('/<%= pluralName %>');

      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /<%= pluralName %>', () => {
    it('creates item with valid data', async () => {
      const newItem = { name: 'New Item', description: 'Test' };
      (db.create as jest.Mock).mockResolvedValue({ id: '1', ...newItem });

      const response = await request(app).post('/<%= pluralName %>').send(newItem);

      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();
      expect(db.create).toHaveBeenCalledWith(newItem);
    });

    it('validates required fields', async () => {
      const response = await request(app).post('/<%= pluralName %>').send({}); // Missing required fields

      expect(response.status).toBe(400);
      expect(response.body.errors).toContainEqual(expect.objectContaining({ field: 'name' }));
    });

    it('rejects invalid data types', async () => {
      const response = await request(app).post('/<%= pluralName %>').send({ name: 12345 }); // Should be string

      expect(response.status).toBe(400);
    });
  });

  describe('GET /<%= pluralName %>/:id', () => {
    it('returns item by ID', async () => {
      (db.findById as jest.Mock).mockResolvedValue({ id: '1', name: 'Test' });

      const response = await request(app).get('/<%= pluralName %>/1');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('1');
    });

    it('returns 404 for unknown ID', async () => {
      (db.findById as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get('/<%= pluralName %>/unknown');

      expect(response.status).toBe(404);
    });
  });
});
```

---

### REQ-SCAFFOLD-006: BFF/GraphQL Test Patterns

**Must:**

- Generate GraphQL endpoint tests
- Include introspection query tests
- Test JWT context forwarding
- Test upstream service error handling

**Generated BFF Test:**

```typescript
// src/__tests__/graphql.test.ts
import request from 'supertest';
import app from '../server';

// Mock Mesh execute function
jest.mock('../.mesh', () => ({
  execute: jest.fn(),
  createBuiltMeshHTTPHandler: jest.fn(() => (req, res, next) => next()),
}));

describe('GraphQL BFF', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Introspection', () => {
    it('responds to introspection query', async () => {
      const { execute } = require('../.mesh');
      execute.mockResolvedValue({
        data: { __schema: { types: [{ name: 'Query' }] } },
      });

      const response = await request(app)
        .post('/graphql')
        .send({ query: '{ __schema { types { name } } }' });

      expect(response.status).toBe(200);
      expect(response.body.data.__schema).toBeDefined();
    });
  });

  describe('JWT Forwarding', () => {
    it('forwards Authorization header to upstream', async () => {
      const { execute } = require('../.mesh');
      execute.mockResolvedValue({ data: { users: [] } });

      await request(app)
        .post('/graphql')
        .set('Authorization', 'Bearer test-jwt-token')
        .send({ query: '{ users { id } }' });

      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            headers: expect.objectContaining({
              authorization: 'Bearer test-jwt-token',
            }),
          }),
        })
      );
    });

    it('includes request ID in context', async () => {
      const { execute } = require('../.mesh');
      execute.mockResolvedValue({ data: {} });

      await request(app)
        .post('/graphql')
        .set('X-Request-ID', 'req-123')
        .send({ query: '{ health }' });

      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            requestId: 'req-123',
          }),
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('handles upstream service timeout', async () => {
      const { execute } = require('../.mesh');
      execute.mockRejectedValue(new Error('ETIMEDOUT'));

      const response = await request(app).post('/graphql').send({ query: '{ users { id } }' });

      // GraphQL returns 200 with errors array
      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('timeout');
    });

    it('handles upstream service 5xx errors', async () => {
      const { execute } = require('../.mesh');
      execute.mockRejectedValue({
        status: 503,
        message: 'Service Unavailable',
      });

      const response = await request(app).post('/graphql').send({ query: '{ users { id } }' });

      expect(response.body.errors).toBeDefined();
    });
  });
});
```

---

## Success Criteria

1. ✅ `npm test` passes immediately after `mfe shell|remote|api|bff <name>`
2. ✅ Generated tests cover at least 3 happy paths and 2 error paths
3. ✅ Coverage threshold of 80% is configured and met by generated tests
4. ✅ Module Federation mocks work for shell/remote projects
5. ✅ Database mocks work for API projects
6. ✅ GraphQL mocks work for BFF projects
7. ✅ `testUtils.ts` provides reusable helpers
8. ✅ Teams can copy/extend patterns for their own tests

---

## Non-Goals (For Now)

- ❌ E2E test templates (Playwright/Cypress) - future enhancement
- ❌ Visual regression tests - team responsibility
- ❌ Performance tests - team responsibility
- ❌ Load tests - team responsibility

---

## Template Variables

Templates use EJS variables for customization:

| Variable                 | Example           | Usage                     |
| ------------------------ | ----------------- | ------------------------- |
| `<%= name %>`            | `user-dashboard`  | Project name (kebab-case) |
| `<%= Name %>`            | `UserDashboard`   | PascalCase for classes    |
| `<%= pluralName %>`      | `users`           | Plural for REST endpoints |
| `<%= testEnvironment %>` | `jsdom` or `node` | Jest environment          |
| `<%= port %>`            | `3001`            | Dev server port           |

---

## File Structure Generated

```
my-mfe/
├── src/
│   ├── __tests__/
│   │   ├── App.test.tsx              # Component tests
│   │   ├── routing.test.tsx          # Navigation (shells only)
│   │   ├── federation.test.tsx       # Contracts (remotes only)
│   │   └── controllers/              # API tests (API/BFF only)
│   │       └── user.controller.test.ts
│   ├── setupTests.ts                 # Jest setup, MF mocks
│   └── testUtils.ts                  # Helpers, factories
├── jest.config.js                    # 80% threshold configured
└── package.json                      # test scripts ready
```

---

## Related ADRs

- **ADR-047:** Generated MFE test templates

---

## Revision History

| Date       | Version | Changes                          | Author |
| ---------- | ------- | -------------------------------- | ------ |
| 2025-11-27 | 1.0     | Initial scaffolding requirements | Sean   |
