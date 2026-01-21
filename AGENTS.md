# AGENTS.md

## Global Rules

- All new code must include unit tests where feasible.
- Design documents must reflect current requirements and code behavior.
- Runtime behavior must be defensive: expect failures, handle them gracefully,
  and keep the user informed about errors and knock-on effects.
- All UI strings must be sourced from a language map (i18n), except for user
  data and tag-derived metadata.
- If a change would introduce ambiguity, stop and ask for clarification.

## Documentation Discipline

- Update or add design docs in the same change as code updates.
- If a doc is intentionally ahead of implementation, mark it clearly as "planned."
