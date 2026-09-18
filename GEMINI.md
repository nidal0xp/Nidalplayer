# Antigravity Agent Guidelines

## 1. Mandatory Post-Fix Testing
- Every time a fix or code change is made, **always test and verify that it works** before completing the task.
- Run unit/integration tests (`node tests/test_all.mjs`), syntax validations (`node --check <file>`), and build steps as applicable.

## 2. Transparent Error & Issue Reporting
- If any error, warning, or unexpected failure pops up during testing, execution, or building, **always report it directly and transparently to the user**.
- Never silently ignore, conceal, or gloss over errors.
- Clearly explain what failed, the root cause, and the resolution.
