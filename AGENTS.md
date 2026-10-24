# AGENTS.md — Tanda Forge

## Mission

Tanda Forge is a cross-platform Electron/TypeScript application for preparing tandas, managing music and playlists, and running live Argentine tango events.

The objective is to deliver reliable, maintainable features with minimal user supervision, while preserving architectural decisions, requirements traceability and project continuity.

Prioritise correctness, live-playback safety and data integrity over saving tokens. Avoid unnecessary investigation, repetition and documentation work.

## 1. Autonomous Development

When the user requests a feature or bug fix:

1. Read `docs/handoff.md` for current project context.
2. Locate the relevant requirements, design documents, source files and tests.
3. Investigate only as far as necessary to understand the affected functionality.
4. Form a brief internal implementation plan.
5. Implement the requested change, including appropriate tests, translations and documentation.
6. Verify the completed work.
7. Update project continuity records as needed.
8. Report the outcome, verification results and any remaining issues.

Work independently through ordinary technical decisions. Do not ask the user to approve routine implementation details.

Follow existing patterns and choose the smallest maintainable solution consistent with requirements.

Ask for clarification only when:
- The intended user-facing behaviour has materially different plausible interpretations.
- A decision would substantially change architecture, compatibility or established requirements.
- An action could cause irreversible data loss or destructive migration.
- A required external credential, resource or product decision is unavailable.
- Existing requirements conflict and cannot be reconciled safely.

When uncertainty is minor, make a reasonable assumption, implement consistently and report it.

Do not silently broaden the requested feature or perform unrelated refactoring.

## 2. Project Knowledge and Continuity

A new developer or coding agent must be able to clone the repository and continue development without access to previous conversations.

### Handoff

`docs/handoff.md` is the concise current-state briefing, not a chronological development log.

It should contain:
- Current architecture and important constraints.
- Active work and feature status.
- Outstanding problems or incomplete tasks.
- Important verified technical decisions, with links to detailed documentation.
- Relevant verification status and next actions.

Keep the handoff concise, preferably around 100–200 lines.

Update it once at task completion when material project state has changed, or at a checkpoint when work must be handed over unfinished.

Remove obsolete operational details rather than continually appending history.

### Dialogue and Decision History

`docs/dialogue.md` records significant user requirements, decisions and engineering rationale.

Record:
- New or materially changed requirements.
- Important architectural and behavioural decisions.
- Rejected alternatives where the reasoning is useful.
- Significant constraints or trade-offs.
- Decisions that supersede earlier decisions.

Do not record routine prompts, intermediate responses, command output, test logs or repetitive debugging conversations.

Preserve existing history. Append concise, searchable records with dates, affected requirement identifiers and relevant file references.

Consult historical records when necessary to understand a decision; do not read the entire history by default.

### Documentation Authority

Current approved requirements and design documents describe intended behaviour.

Code and tests establish what is actually implemented.

The handoff summarises current project state.

Dialogue records explain historical decisions but do not override current approved requirements.

Investigate discrepancies rather than silently treating an outdated document as authoritative.

## 3. Code Quality

- Write defensive, maintainable code.
- Handle failures gracefully and report meaningful user-facing errors.
- Preserve existing functionality unless explicitly changed.
- Add or update unit tests for new or modified behaviour wherever feasible.
- Use established project architecture and conventions.
- Avoid unrelated refactoring and unnecessary dependencies.
- Keep all UI strings in the language map (i18n), except user data and tag-derived metadata.

Pay particular attention to:
- Live playback and audio output routing.
- Library and playlist data integrity.
- Safe failure behaviour during live DJ sessions.
- Platform compatibility across macOS, Windows and Linux.

Do not silently change established audio-routing or playback safety behaviour.

## 4. Requirements and Design Documents

- Assign document-specific requirement identifiers to new formal requirements.
- Update relevant design documents when requirements or documented behaviour change.
- Keep requirements, implementation and feature-status records consistent.
- Clearly distinguish implemented, partially implemented and planned features.
- Update only the documents affected by the current task.
- Do not perform a full documentation reconciliation during routine development.
- Prefer targeted edits rather than rewriting entire documents.

Existing historical documentation must be preserved unless explicitly superseded or archived.

## 5. Verification

During implementation:
- Run focused tests for affected functionality.
- Run relevant type checks or builds when appropriate.
- Fix failures introduced by the task.
- Avoid repeatedly running unchanged checks without a reason.

At completion of a code-change task:
- Run `npm run preflight` to execute the full unit-test suite and production build.
- Run relevant Playwright tests for affected user workflows when appropriate.
- Perform additional checks for high-risk audio, data migration, packaging or platform-specific changes.

Do not repeatedly execute the full suite between intermediate edits unless necessary.

A task is not considered fully verified unless its required checks have passed.

If tests or builds fail, investigate failures caused by the task. Clearly report unrelated or unresolved failures rather than claiming success.

Documentation-only changes do not require an application build unless they affect executable examples, configuration, generated code or build-sensitive files.

## 6. FFmpeg Release Integrity

Pinned FFmpeg binaries are release-critical dependencies.

Before changing an FFmpeg pin or declaring a release ready:
- Verify each pinned asset still resolves.
- Confirm coverage by the upstream retention policy.
- Verify upstream-published SHA-256 digests.
- Confirm compatible `ffmpeg` and `ffprobe` executables.
- Run fetch-script tests and the full build.
- Never use a moving `latest` URL or an unverified fallback.

Do not perform release-specific FFmpeg verification for unrelated development tasks.

## 7. Repository Hygiene

Do not commit large binaries, generated artifacts or temporary directories, including:

- `node_modules/`
- `dist/`
- `tmp/`
- `.git/tmp/`
- `app/resources/ffmpeg/`

Use external downloads or Git LFS where appropriate.

Preserve unrelated user changes and do not discard uncommitted work.

Do not push, publish releases, alter remote branches or perform destructive Git operations unless authorised.

## 8. Efficient Agent Operation

- Search narrowly before searching the entire repository.
- Read only the relevant sections of large documentation files.
- Avoid re-reading unchanged files unnecessarily.
- Use focused command output rather than dumping large logs into context.
- Batch related changes into logical tasks.
- Do not launch unnecessary parallel investigations.
- Use the current conversation's context rather than repeatedly rediscovering facts.
- Avoid long progress narratives and repeated explanations.
- Do not sacrifice required verification or correctness merely to reduce tool usage.

## 9. Documentation Sweep Mode

Only perform a full documentation sweep when explicitly requested.

For a documentation sweep:
1. Review the documentation structure and current approved requirements.
2. Compare relevant documentation against implementation and tests.
3. Correct outdated or contradictory statements.
4. Reconcile requirement identifiers and feature status.
5. Preserve important historical decisions.
6. Update the handoff to reflect the verified current state.
7. Record meaningful new decisions in the dialogue history.
8. Report unresolved discrepancies.

Do not change production code during a documentation-only sweep without explicit authorisation.

## 10. Task Completion

Before finishing:
- Ensure the requested functionality is implemented.
- Verify relevant behaviour and required checks.
- Update affected design and requirements documents.
- Update the handoff if material project state changed.
- Record significant decisions in the dialogue history.

Provide a concise final report containing:
- What changed.
- What was tested and whether it passed.
- Any important assumptions.
- Remaining problems or user decisions required.

Do not claim success for incomplete or unverified work.
