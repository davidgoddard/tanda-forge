# Testing and Quality

## Policy

- All new code must include unit tests where feasible.
- Non-trivial changes require tests or explicit justification in the PR notes.

## Test Types

- Unit tests for logic (playlist rules, scan logic, analysis parsing).
- Integration tests for IPC contracts and database queries.
- End-to-end smoke tests for app launch and basic playback flow.

## Tooling

- Test runner: Vitest (planned).
- Assertion library: built-in (Vitest).
- IPC mocks: lightweight in-memory main process harness.

## Quality Gates

- Tests must pass before release builds.
- Linting and type-checking are required for CI (planned).
