# Husky Pre-commit Hook Setup

To enable pre-commit hooks for 100% generator coverage enforcement:

## Installation

```bash
npm install --save-dev husky
npx husky install
npx husky add .husky/pre-commit "npm test -- src/codegen/generators --coverage --collectCoverageFrom='src/codegen/generators/**/*.js' --passWithNoTests"
chmod +x .husky/pre-commit
```

## Manual Setup (Already Done)

The pre-commit hook has been created at `.husky/pre-commit` and is ready to use.
It will automatically run when you commit changes.

## Testing the Hook

Test the pre-commit hook manually:

```bash
./.husky/pre-commit
```

If generators have 100% coverage, you'll see: ✅ Generator tests passed with 100% coverage
If coverage drops below 100%, the hook will fail and block the commit.

## Disabling the Hook Temporarily

If you need to bypass the hook for a specific commit:

```bash
git commit --no-verify -m "your message"
```

⚠️ Use sparingly - TDD mandate (ADR-022) requires 100% generator coverage.
