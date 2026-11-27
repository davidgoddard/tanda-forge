# AGENTS.md — Tanda Forge

## 1. Mission and priorities

Tanda Forge is a cross-platform Electron/TypeScript application for managing music, preparing tandas and running live Argentine tango events.

Deliver correct, maintainable changes independently, with minimal unnecessary investigation, token consumption and administrative work. Protect live playback, audio routing, data integrity and compatibility across macOS, Windows and Linux. Efficiency never overrides correctness or necessary verification.

Follow the user's explicit scope and applicable repository instructions. Use the smallest workflow appropriate to the actual risk. A small patch is not necessarily low risk.

## 2. Select the workflow

Choose automatically; do not ask the user to classify routine tasks. Combine workflows when explicitly requested. Escalate if evidence reveals greater risk or scope.

### A. Minor bug fix (default for isolated defects)

- Restore intended behaviour without changing requirements, architecture or persistent data formats.
- Start with the reported symptom and relevant source/test locations. Use `docs/code-map.md` if present; otherwise search identifiers or the relevant subsection of `docs/handoff.md` as needed.
- Do not routinely read the full handoff, requirements, design documents, decision history or archives. Consult relevant sections when expected behaviour or constraints are unclear.
- Read the smallest useful code and test ranges. Trace dependencies only as necessary.
- Make a minimal maintainable patch; add or update a focused regression test where feasible.
- Run affected tests and relevant type checks or builds. Review the changed diff.
- Do not run full preflight, update project documentation or refactor unrelated code by default.
- Finish with a concise report of the fix and verification.

### B. Feature or substantial change

- Read the relevant handoff sections, requirements, design, implementation and tests.
- Identify affected interfaces, compatibility constraints and user-visible behaviour. Plan briefly, implement incrementally and test affected paths.
- Preserve requirements traceability. Record material new requirements, decisions or documentation obligations in a concise durable note when they would otherwise be lost; reconcile at the release checkpoint.
- Defer broader documentation and full preflight unless risk, dependencies or the user require them.

### C. High-risk change

Use this workflow for changes affecting playback continuity, audio devices/routing, playlist progression, database integrity, schema migration, destructive library operations, IPC security, packaging, or other critical shared behaviour.

- Read relevant requirements, safety constraints, implementation and dependent tests. Inspect the handoff where relevant.
- Assess failure modes, compatibility and recovery. Preserve established safety behaviour and protect user data.
- Add regression coverage and run appropriate broader tests, builds, integration checks or manual checks. Run full preflight if the impact warrants it.
- Escalate material ambiguities or irreversible actions to the user. Do not claim hardware, live audio or platform behaviour was verified when it was not.

### D. Significant refactoring

- Establish a passing baseline for affected behavior, then extract one cohesive responsibility at a time.
- Preserve event order, timing, IPC and persistence contracts. Prefer explicit dependencies and independently testable controllers over shared mutable context objects.
- After each extraction, run focused tests and relevant type checks. At a feature boundary or shared-state/lifecycle change, run the build and relevant end-to-end workflows before continuing.
- Keep milestones independently reviewable. Stop and reassess when coupling or risk is materially greater than expected.

### E. Commit or push

A commit or push alone is NOT a release checkpoint.

- Inspect Git status and the intended diff. Preserve unrelated user changes; do not stage them without authorisation.
- Ensure relevant checks passed for the exact changes, rerunning only checks invalidated by subsequent edits or required by branch policy.
- Commit only when requested or authorised. Use a meaningful commit message.
- Push only when authorised. Respect branch protections and required CI checks. Report pending or failed CI; never bypass required gates.
- Do not automatically reconcile all documentation, bump versions, tag or publish releases.
- A request to merge into the release/main branch requires the release integration checks in workflow F, unless equivalent required checks are already verified for the exact candidate.

### F. Prepare or verify a release

A release checkpoint is an explicit release request or release-branch integration, not every local commit or feature-branch push.

1. Identify the release scope from the appropriate previous release/tag, Git history and current changes. Inspect status and relevant release scripts/workflows; avoid guessing the version or release convention.
2. Review accumulated changes for regressions, outstanding verification and material decisions. Reconcile only affected requirements, design, feature status, handoff and decision records. Update release notes/version metadata according to existing conventions and the requested scope.
3. Run `npm run preflight` (unit tests and production build), relevant Playwright tests, and risk-specific checks. Equivalent successful CI evidence for the exact candidate may be reused when it covers the same checks and environment requirements. Do not repeat unchanged expensive checks without reason.
4. Verify FFmpeg release integrity as specified below. Check relevant packaging and platform workflows; distinguish local verification from remote CI or manual testing.
5. Review the final candidate and ensure required checks still cover it after any corrections. Fix task-related failures; report unrelated or unresolved failures.
6. Report release readiness, version/scope, checks, outstanding blockers and unverified platforms. Do not declare readiness if required checks are incomplete or failed.

Preparing or verifying a release does not itself authorise pushing, tagging or publishing. Perform those operations only as requested or otherwise explicitly authorised. Do not invent credentials or bypass protections. Preserve existing release procedures.

### G. Publish a release

- Publish only with explicit authorisation, after workflow F passes for the exact candidate.
- Follow the repository's existing version, tag and GitHub Release conventions. Do not recreate or move existing tags without explicit direction.
- Confirm CI packaging and integrity checks complete for every supported target before declaring publication successful. Report failed or missing artifacts without bypassing safeguards.

### H. Documentation-only work

Edit only requested documents. A full documentation sweep requires an explicit request. For a sweep, compare current requirements, design, feature status and handoff with implementation and tests; reconcile discrepancies, preserve rationale and report unresolved issues. Do not modify production code without authorisation. No application build is needed unless executable examples, configuration or build-sensitive files change.

## 3. Efficient investigation and execution

- Prefer targeted symbol and filename searches (`rg -l`, `rg -n`) in likely source/test directories before repository-wide searches.
- Use bounded reads (`sed -n`, targeted search context or equivalent). Do not dump large files such as `renderer.ts`, full diffs, archives or lockfiles when smaller ranges suffice.
- Exclude dependencies, generated output, binaries, historical archives and test artifacts from ordinary searches unless relevant. Respect ignore files.
- Reuse known context and previous command results. Do not repeatedly read unchanged instructions or code. Expand scope only when findings justify it.
- Avoid unnecessary parallel investigations, speculative refactoring, dependency changes and repeated full builds.
- Prefer existing local scripts and tools. Do not install new tools solely to complete an ordinary fix when existing tools suffice.
- Batch related independent checks where useful. Inspect targeted diffs rather than dumping the entire working tree.
- Keep successful command output short. Capture verbose logs in a temporary file outside tracked source, preserve the exit status, and show a bounded diagnostic excerpt on failure. Read additional log sections only as needed; do not conceal failures or truncate away relevant diagnostics.
- Keep progress updates brief. Avoid narrating routine commands or repeating the user's request.

## 4. Engineering standards

- Preserve existing functionality, architecture and conventions unless the requested change requires otherwise.
- Use defensive code, meaningful error handling and safe failure behaviour, particularly during live DJ sessions.
- Keep UI strings in the existing language map (i18n), except user data and tag-derived metadata. Maintain applicable translations.
- Add or update tests for modified behaviour wherever feasible; explain important gaps. Do not weaken tests to make a patch pass.
- Prefer coherent feature modules and focused helpers. Extract code from large files when it directly supports the task; do not undertake unrelated structural refactoring merely to save tokens.
- Ask only when materially different interpretations, conflicting requirements, irreversible data loss, substantial architectural decisions or missing resources prevent safe progress. Otherwise use reasonable assumptions and disclose consequential ones.

## 5. Verification commands

Use the existing package scripts and select checks according to the workflow and changed code:

| Purpose | Command |
| --- | --- |
| Focused unit tests | `npm test -- <actual-test-path>` |
| All unit tests | `npm test` |
| Renderer type check | `npx --no-install tsc -p tsconfig.renderer.json --noEmit` |
| Main-process type check | `npx --no-install tsc -p tsconfig.main.json --noEmit` |
| Production build | `npm run build` |
| Focused browser tests | `npm run test:e2e -- <actual-spec-path>` |
| Full preflight | `npm run preflight` |
| Packaging | `npm run package` (only when appropriate to the release/platform) |

For concise captured output, use the matching `npm run verify:*` commands described in `docs/development-workflow.md`.

Use actual paths discovered in the repository; do not run literal placeholders. Check package scripts if they have changed. Prefer focused checks for minor changes; broaden when shared interfaces, build configuration or multiple subsystems are affected. Do not silently substitute type checking for a required production build.

Preserve command exit codes. Diagnose failures introduced by the change. Do not claim a pre-existing failure without evidence, or a skipped check as passed. Report blockers such as unavailable dependencies, hardware or CI access. Avoid coverage runs unless useful or required.

## 6. Project knowledge and continuity

A new developer must be able to continue without previous conversations. Preserve durable knowledge without maintaining a transcript of routine work.

- Approved requirements and design describe intended behaviour; code and tests show actual behaviour. The handoff summarises current state; historical decisions explain rationale. Investigate material discrepancies instead of silently choosing one.
- `docs/handoff.md`: concise architecture, constraints, current state, outstanding work and next actions; aim for 100–200 lines where practical. Update at release checkpoints when state materially changes, when explicitly requested, or when essential unfinished-work context would otherwise be lost.
- `docs/code-map.md` (if present): stable feature-to-source-and-test navigation. Keep concise; update affected entries when source locations change. Until created, use the existing mapping in the handoff. Do not create a new map as part of an unrelated bug fix.
- `docs/dialogue.md`: decision index, not a transcript. At the checkpoint, record material requirements, architectural/behavioural decisions, rejected alternatives and supersessions in dated records under `docs/decisions/`, following the existing index format. Include relevant requirement IDs, rationale and source references.
- Preserve `docs/archive/dialogue-through-2026-11-26.md` and other historical records. Search the decision index first; search archives by specific term or requirement ID with limited context only when necessary.
- Do not record routine prompts, responses, debugging steps or successful test logs. Do not append to the legacy archive.
- Assign document-specific IDs to new formal requirements. At the checkpoint, update affected design, requirements and feature status, distinguishing implemented, partial and planned functionality. Prefer targeted edits, preserve history and avoid wholesale reconciliation unless explicitly requested.

Do not defer essential new knowledge if it cannot be recovered from tracked changes or existing records. For isolated fixes that restore documented behaviour, no documentation change is normally necessary.

## 7. FFmpeg release integrity

Pinned FFmpeg binaries are release-critical. Before changing a pin or declaring a release ready:

- Confirm each pinned asset resolves and is covered by the upstream retention policy.
- Verify upstream-published SHA-256 digests and compatible `ffmpeg` and `ffprobe` executables.
- Run relevant fetch-script tests and the full build. Reuse valid evidence for the same candidate where appropriate.
- Never use moving `latest` URLs or unverified fallbacks. Report unavailable digests/assets as blockers rather than assuming integrity.

Do not perform release-specific FFmpeg checks for unrelated development tasks.

## 8. Repository hygiene and authorisation

- Preserve unrelated and uncommitted user changes. Do not discard, reset, overwrite or stash them without appropriate authorisation.
- Do not commit dependencies, generated artifacts, temporary files or downloaded binaries, including `node_modules/`, `dist/`, `tmp/`, `.git/tmp/` and `app/resources/ffmpeg/`. Use established external downloads or Git LFS when appropriate.
- Do not expose secrets or credentials. Do not perform destructive Git operations, alter remote branches, push, tag or publish without authorisation.
- Respect existing CI, packaging, release and branch requirements. If a required check or resource is unavailable, report it rather than bypassing it.

## 9. Completion report

Before finishing, inspect the scoped diff and confirm required verification for the selected workflow. Keep the final response proportionate:

- What changed and the important affected files.
- Checks run and their actual results.
- Material assumptions, remaining risks, skipped required checks and blockers, if any.
- For release work, readiness and any outstanding publication steps.

Do not repeat the implementation diff or full logs unless requested. Do not claim success for incomplete or unverified work. Stop when the requested task is complete; do not initiate additional cleanup, documentation, release or Git operations without a reason grounded in the selected workflow.
