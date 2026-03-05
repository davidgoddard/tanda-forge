# Testing and Quality

## Policy

- TQ-POL-001: All new code must include unit tests where feasible.
- TQ-POL-002: Non-trivial changes require tests or explicit justification in the PR notes.

## Test Types

- TQ-TYPE-001: Unit tests for logic (playlist rules, scan logic, analysis parsing).
- TQ-TYPE-002: Integration tests for IPC contracts and database queries.
- TQ-TYPE-003: End-to-end smoke tests for app launch and basic playback flow.
- TQ-TYPE-004: End-to-end workflow tests for Electron UI using Playwright
  (`tests/e2e/*.e2e.ts`) with seeded fixture data for deterministic setup/search/
  clipboard/playlist/menu interactions.

## Tooling

- TQ-TOOL-001: Test runner: Vitest.
- TQ-TOOL-002: Assertion library: built-in (Vitest).
- TQ-TOOL-003: IPC mocks: lightweight in-memory main process harness.
- TQ-TOOL-004: Playwright Electron runner (`@playwright/test`) for UI-driven
  regression scenarios.
- TQ-TOOL-005: Seeded Electron fixture harness (`tests/e2e/support/electron-app.ts`)
  is used to isolate workflow tests from user library state.

## Quality Gates

- TQ-GATE-001: Tests must pass before release builds.
- TQ-GATE-002: Linting and type-checking are required for CI (planned).
- TQ-GATE-003: Regression-prone workflows (legacy import, scan, tanda timeline,
  cortina selection, trim/normalization readiness) must be covered by explicit
  automated checks or a documented smoke checklist run per change.
- TQ-GATE-004: Diagnostics must expose missing prerequisite data (analysis, trims,
  loudness/gain, waveforms) so operators can detect incomplete states after import/scan.
