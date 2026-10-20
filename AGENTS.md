# AGENTS.md

## Global Rules

- All new code must include unit tests where feasible.
- All code changes must be verified by a successful build and all tests passing.
- Design documents must reflect current requirements and code behavior.
- Runtime behavior must be defensive: expect failures, handle them gracefully,
  and keep the user informed about errors and knock-on effects.
- All UI strings must be sourced from a language map (i18n), except for user
  data and tag-derived metadata.
- Keep the git repository lean: never commit large binaries, generated artifacts,
  or temp directories (e.g. `node_modules/`, `dist/`, `tmp/`, `.git/tmp/`,
  `app/resources/ffmpeg/`). Use external downloads or Git LFS when needed.
- All new requirements must include document-specific requirement identifiers
  in the relevant design docs.
- After any code or doc change, update `docs/handoff.md` and `docs/dialogue.md`.
- Treat the pinned FFmpeg binaries as release-critical dependencies. Before
  changing an FFmpeg pin or declaring a release ready, verify that each pinned
  asset still resolves, is covered by the upstream retention policy, matches
  its upstream-published SHA-256 digest, contains compatible `ffmpeg` and
  `ffprobe` executables, and passes the fetch-script tests plus the full build.
  Never replace a pin with a moving `latest` URL or an unverified fallback.
- If a change would introduce ambiguity, stop and ask for clarification.
- Always record the users prompt and any generated responses or questions in the `docs/dialogue.md`.

## Documentation Discipline

- Update or add design docs in the same change as code updates.
- If a doc is intentionally ahead of implementation, mark it clearly as "planned."  Ensure that the tracking and feature matrix contains any features that are not fully implemented with a description of what is missing.
