# Testing and Quality

## Policy

- TQ-POL-001: All new code must include unit tests where feasible.
- TQ-POL-002: Non-trivial changes require tests or explicit justification in the PR notes.

## Test Types

- TQ-TYPE-001: Unit tests for logic (playlist rules, scan logic, analysis parsing).
- TQ-TYPE-002: Integration tests for IPC contracts and database queries.
- TQ-TYPE-003: End-to-end smoke tests for app launch and basic playback flow.

## Tooling

- TQ-TOOL-001: Test runner: Vitest (planned).
- TQ-TOOL-002: Assertion library: built-in (Vitest).
- TQ-TOOL-003: IPC mocks: lightweight in-memory main process harness.

## Quality Gates

- TQ-GATE-001: Tests must pass before release builds.
- TQ-GATE-002: Linting and type-checking are required for CI (planned).
