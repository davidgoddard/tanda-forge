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
- If a change would introduce ambiguity, stop and ask for clarification.

## Documentation Discipline

- Update or add design docs in the same change as code updates.
- If a doc is intentionally ahead of implementation, mark it clearly as "planned."
