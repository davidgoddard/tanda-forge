# Development and verification workflow

Use `docs/code-map.md` to locate a feature, then inspect only the relevant source
and tests. `AGENTS.md` defines which verification level applies.

## Concise checks

`scripts/run-quiet.js` runs a command without a shell, so paths and arguments are
passed safely on macOS, Windows and Linux. Successful checks print one summary
line plus any warning/error/deprecation lines. Failures print the final 80 lines
and retain the complete log in the operating system's temporary directory.

Examples:

```sh
npm run verify:test -- tests/cortina-picker.test.ts
npm run verify:renderer
npm run verify:e2e -- tests/e2e/bpm.e2e.ts
npm run verify:full
```

Use `npm test -- <path>` directly when interactive test output is helpful. Use
`npm run preflight` for release preparation; `verify:full` is its concise-output
equivalent. E2E tests remain a separate explicit check because they launch the
Electron application and exercise stateful workflows.

## Integration and release

Pull requests run unit tests and the production build in CI. Publishing a GitHub
Release runs the same quality job, builds all supported packages, stages and
checks pinned FFmpeg tools, verifies package integrity, and uploads the assets.
Local commits and feature-branch pushes require only checks appropriate to their
changes. Integration into `main` and release candidates require comprehensive
checks for the exact revision. Preparing a release does not authorise creating a
tag, publishing a GitHub Release, or pushing.

## Lightweight efficiency comparison

For a representative minor fix, record only information already exposed by the
Codex session and command summaries: elapsed time, tool calls, files inspected,
verification commands/output volume, reported input/cached/output/reasoning
tokens and cost (when available), and later corrections. Compare two similar
fixes in a short table. Mark unavailable fields as unavailable; do not estimate
tokens or cost. No repository telemetry is required.
